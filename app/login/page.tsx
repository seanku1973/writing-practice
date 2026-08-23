"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StudentLoginPage() {
  const router = useRouter();

  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const code = studentCode.trim().toLowerCase();

    if (!code || !password) {
      setErrorText("請輸入學生代碼與密碼。");
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      // 沿用原 speaking-practice 已建立的 Supabase Auth 帳號。
      const email = `${code}@speaking.test`;

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error || !data.user) {
        throw new Error("學生代碼或密碼不正確。");
      }

      const { data: student, error: studentError } =
        await supabase
          .from("students")
          .select("id, student_code, display_name, is_active")
          .eq("auth_user_id", data.user.id)
          .eq("is_active", true)
          .single();

      if (studentError || !student) {
        await supabase.auth.signOut();
        throw new Error("找不到有效的學生資料。");
      }

      localStorage.setItem("student_id", student.id);
      localStorage.setItem(
        "student_name",
        student.display_name
      );
      localStorage.setItem(
        "student_code",
        student.student_code
      );

      router.replace("/writing");
      router.refresh();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "登入失敗。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, #eef4ff, #f8fafc)",
        padding: "30px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "white",
          borderRadius: "20px",
          padding: "36px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
        }}
      >
        <div
          style={{
            color: "#2563eb",
            fontWeight: 800,
            letterSpacing: "1px",
            fontSize: "13px",
          }}
        >
          WRITING PRACTICE
        </div>

        <h1 style={{ margin: "8px 0 5px" }}>學生登入</h1>

        <p
          style={{
            color: "#64748b",
            lineHeight: 1.7,
            marginTop: "8px",
          }}
        >
          登入後可隨時查看 Writing Progress；正式考試則需要監考老師授權。
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Student Code
            <input
              value={studentCode}
              onChange={(event) =>
                setStudentCode(event.target.value)
              }
              autoComplete="username"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>

          {errorText && (
            <div
              style={{
                marginTop: "15px",
                padding: "12px",
                borderRadius: "9px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              {errorText}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "20px",
              padding: "14px",
              border: "none",
              borderRadius: "10px",
              background: loading ? "#94a3b8" : "#2563eb",
              color: "white",
              fontWeight: 800,
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "18px" }}>
          <Link href="/" style={{ color: "#64748b" }}>
            返回首頁
          </Link>
        </div>
      </section>
    </main>
  );
}

const labelStyle = {
  display: "block",
  marginTop: "18px",
  color: "#334155",
  fontWeight: 700,
  fontSize: "14px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginTop: "7px",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  fontSize: "16px",
};
