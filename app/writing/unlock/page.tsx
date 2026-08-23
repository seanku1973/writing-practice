"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnswerMode = "computer" | "paper";

export default function ExamUnlockPage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [mode, setMode] = useState<AnswerMode | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const savedMode = localStorage.getItem(
        "writing_input_mode"
      ) as AnswerMode | null;

      if (
        savedMode !== "computer" &&
        savedMode !== "paper"
      ) {
        router.replace("/writing");
        return;
      }

      setMode(savedMode);
      setStudentName(
        localStorage.getItem("student_name") ?? "Student"
      );
      setLoading(false);
    }

    void initialize();
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!password) {
      setErrorText("請由監考老師輸入密碼。");
      return;
    }

    setSubmitting(true);
    setErrorText("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/exam-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "unlock",
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "監考老師授權失敗。"
        );
      }

      setPassword("");
      router.replace("/writing/select");
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "監考老師授權失敗。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>載入中...</section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "50px",
            }}
          >
            🔐
          </div>

          <div
            style={{
              marginTop: "12px",
              color: "#dc2626",
              fontWeight: 900,
              letterSpacing: "1px",
              fontSize: "13px",
            }}
          >
            PROCTOR AUTHORIZATION
          </div>

          <h1 style={{ margin: "8px 0 5px" }}>
            現場考試授權
          </h1>

          <p
            style={{
              color: "#64748b",
              lineHeight: 1.7,
            }}
          >
            此頁必須交由現場監考老師操作。
            <br />
            學生本人不應取得監考密碼。
          </p>
        </div>

        <div
          style={{
            marginTop: "22px",
            padding: "16px",
            borderRadius: "12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            lineHeight: 1.8,
          }}
        >
          <strong>Student：</strong>
          {studentName}
          <br />
          <strong>Mode：</strong>
          {mode === "computer"
            ? "💻 電腦作答"
            : "✍️ 紙筆作答"}
        </div>

        <form onSubmit={submit}>
          <label
            style={{
              display: "block",
              marginTop: "22px",
              color: "#334155",
              fontWeight: 800,
            }}
          >
            監考老師密碼
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoFocus
              autoComplete="off"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: "8px",
                padding: "14px",
                border: "2px solid #cbd5e1",
                borderRadius: "10px",
                fontSize: "18px",
              }}
            />
          </label>

          {errorText && (
            <div
              style={{
                marginTop: "16px",
                padding: "13px",
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
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: "20px",
              padding: "15px",
              border: "none",
              borderRadius: "10px",
              background: submitting ? "#94a3b8" : "#16a34a",
              color: "white",
              fontWeight: 900,
              fontSize: "17px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? "驗證中..."
              : "老師確認授權 →"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.replace("/writing")}
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            background: "white",
            color: "#475569",
            cursor: "pointer",
          }}
        >
          取消，返回學生 Writing 首頁
        </button>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, #eef4ff, #f8fafc)",
  padding: "30px 20px",
  fontFamily: "Arial, sans-serif",
};

const cardStyle = {
  width: "100%",
  maxWidth: "540px",
  background: "white",
  padding: "38px",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
};
