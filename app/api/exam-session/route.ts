import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getServerWritingTest,
  getWritingTestMetadata,
} from "@/lib/writingTests.server";

export const runtime = "nodejs";

const COOKIE_NAME = "writing_exam_gate";

function getSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

async function requireStudent(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const supabase = getSupabaseClient(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw new Error("STUDENT_REQUIRED");
  }

  return {
    authUserId: user.id,
    studentId: student.id as string,
  };
}

function parsePasswordHash() {
  const stored = process.env.EXAM_PROCTOR_PASSWORD_HASH;

  if (!stored) {
    throw new Error(
      "EXAM_PROCTOR_PASSWORD_HASH is not configured."
    );
  }

  // Use ':' for new hashes. Next.js .env loading can treat '$...'
  // as variable expansion, which may corrupt a hash stored with '$'.
  const separator = stored.includes(":") ? ":" : "$";
  const [scheme, saltText, hashText] = stored.split(separator);

  if (
    scheme !== "scrypt" ||
    !saltText ||
    !hashText
  ) {
    throw new Error(
      "EXAM_PROCTOR_PASSWORD_HASH has an invalid format. Please run: node scripts/configure-exam-gate.mjs"
    );
  }

  return {
    salt: Buffer.from(saltText, "base64url"),
    expected: Buffer.from(hashText, "base64url"),
  };
}

function verifyPassword(password: string) {
  const { salt, expected } = parsePasswordHash();
  const actual = crypto.scryptSync(password, salt, expected.length);

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function gateSecret() {
  const secret = process.env.EXAM_GATE_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "EXAM_GATE_SECRET is missing or too short."
    );
  }

  return secret;
}

function gateTtlSeconds() {
  const raw = Number(process.env.EXAM_GATE_TTL_SECONDS ?? "600");

  if (!Number.isFinite(raw)) return 600;

  return Math.max(120, Math.min(1800, Math.round(raw)));
}

function signGateToken(studentId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + gateTtlSeconds();

  const payload = {
    sid: studentId,
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };

  const body = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", gateSecret())
    .update(body)
    .digest("base64url");

  return {
    token: `${body}.${signature}`,
    expiresAt,
  };
}

function verifyGateToken(
  token: string | undefined,
  studentId: string
) {
  if (!token) return false;

  const [body, signature] = token.split(".");

  if (!body || !signature) return false;

  const expected = crypto
    .createHmac("sha256", gateSecret())
    .update(body)
    .digest();

  let actual: Buffer;

  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as {
      sid?: string;
      exp?: number;
    };

    if (payload.sid !== studentId) return false;
    if (!payload.exp) return false;

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function setGateCookie(
  response: NextResponse,
  token: string,
  maxAge: number
) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

function clearGateCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const student = await requireStudent(request);
    const body = await request.json();
    const action =
      typeof body?.action === "string" ? body.action : "";

    if (action === "lock") {
      const response = NextResponse.json({ ok: true });
      clearGateCookie(response);
      return response;
    }

    if (action === "unlock") {
      const password =
        typeof body?.password === "string"
          ? body.password
          : "";

      if (!password) {
        return errorResponse("請輸入監考老師密碼。", 400);
      }

      if (!verifyPassword(password)) {
        return errorResponse("監考老師密碼不正確。", 403);
      }

      const { token } = signGateToken(student.studentId);

      const response = NextResponse.json({
        ok: true,
        expiresInSeconds: gateTtlSeconds(),
      });

      setGateCookie(response, token, gateTtlSeconds());

      return response;
    }

    const cookieToken = request.cookies.get(COOKIE_NAME)?.value;

    const unlocked = verifyGateToken(
      cookieToken,
      student.studentId
    );

    if (!unlocked) {
      return errorResponse(
        "現場考試尚未經監考老師授權，或授權已過期。",
        403
      );
    }

    if (action === "status") {
      return NextResponse.json({ ok: true, unlocked: true });
    }

    if (action === "list_tests") {
      return NextResponse.json({
        ok: true,
        tests: getWritingTestMetadata(),
      });
    }

    if (action === "get_test") {
      const testCode =
        typeof body?.testCode === "string"
          ? body.testCode.trim()
          : "";

      const test = getServerWritingTest(testCode);

      if (!test) {
        return errorResponse("找不到指定的 Writing Exercise。", 404);
      }

      return NextResponse.json({
        ok: true,
        test,
      });
    }

    if (action === "consume") {
      const testCode =
        typeof body?.testCode === "string"
          ? body.testCode.trim()
          : "";

      if (!getServerWritingTest(testCode)) {
        return errorResponse("找不到指定的 Writing Exercise。", 404);
      }

      const response = NextResponse.json({
        ok: true,
        consumed: true,
      });

      // START 後立即銷毀監考授權。
      // 下一份測驗一定要重新由老師輸入密碼。
      clearGateCookie(response);

      return response;
    }

    return errorResponse("Unknown exam gate action.", 400);
  } catch (error) {
    console.error("Exam gate error:", error);

    if (
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" ||
        error.message === "STUDENT_REQUIRED")
    ) {
      return errorResponse("學生登入狀態無效。", 401);
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Exam gate error.",
      500
    );
  }
}
