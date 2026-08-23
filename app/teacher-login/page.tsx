"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TeacherLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setErrorText("請輸入教師 Email 與密碼。");
      return;
    }

    setLoading(true);
    setErrorText("");

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (authError || !authData.user) {
      setErrorText("Email 或密碼錯誤。");
      setLoading(false);
      return;
    }

    const { data: teacher, error: teacherError } = await supabase
      .from("teacher_profiles")
      .select("auth_user_id, display_name, role, is_active")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (
      teacherError ||
      !teacher ||
      !teacher.is_active ||
      !["teacher", "admin"].includes(teacher.role)
    ) {
      await supabase.auth.signOut();
      setErrorText("此帳號沒有教師後台權限。");
      setLoading(false);
      return;
    }

    router.replace("/teacher");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        padding: "60px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          margin: "0 auto",
          padding: "32px",
          backgroundColor: "white",
          borderRadius: "18px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "8px" }}>
          Teacher Login
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            marginBottom: "28px",
          }}
        >
          教師後台登入
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="teacher-email"
            style={{
              display: "block",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Email
          </label>

          <input
            id="teacher-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              marginBottom: "18px",
            }}
          />

          <label
            htmlFor="teacher-password"
            style={{
              display: "block",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Password
          </label>

          <input
            id="teacher-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              marginBottom: "18px",
            }}
          />

          {errorText && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                marginBottom: "18px",
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
              padding: "13px",
              border: "none",
              borderRadius: "9px",
              backgroundColor: loading ? "#94a3b8" : "#0f172a",
              color: "white",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "登入中..." : "登入教師後台"}
          </button>
        </form>
      </div>
    </main>
  );
}
