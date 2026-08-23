"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnswerMode = "computer" | "paper" | null;

export default function WritingStudentHomePage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [mode, setMode] = useState<AnswerMode>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setStudentName(
        localStorage.getItem("student_name") ?? "Student"
      );

      // 只要回到學生 Writing 首頁，就取消任何尚未使用的監考授權。
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await fetch("/api/exam-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "lock" }),
        }).catch(() => null);
      }

      localStorage.removeItem("writing_selected_test_code");
      localStorage.removeItem("writing_selected_test_title");

      setLoading(false);
    }

    void initialize();
  }, [router]);

  function continueToExam() {
    if (!mode) return;

    localStorage.setItem("writing_input_mode", mode);
    router.push("/writing/unlock");
  }

  async function logout() {
    await supabase.auth.signOut();

    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    localStorage.removeItem("student_code");
    localStorage.removeItem("writing_input_mode");
    localStorage.removeItem("writing_selected_test_code");
    localStorage.removeItem("writing_selected_test_title");

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        載入中...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #eef4ff 0%, #f8fafc 50%, #eef2ff 100%)",
        padding: "28px 20px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Student
            </div>
            <div
              style={{
                color: "#0f172a",
                fontWeight: 900,
                fontSize: "20px",
              }}
            >
              {studentName}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
            <Link href="/progress" style={progressLinkStyle}>
              📈 我的 Writing Progress
            </Link>

            <button onClick={logout} style={logoutButtonStyle}>
              登出
            </button>
          </div>
        </header>

        <section style={cardStyle}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: "#2563eb",
                fontWeight: 800,
                letterSpacing: "1px",
                fontSize: "13px",
              }}
            >
              ON-SITE WRITING EXAM
            </div>

            <h1
              style={{
                margin: "9px 0 6px",
                color: "#0f172a",
                fontSize: "36px",
              }}
            >
              中級寫作能力測驗
            </h1>

            <p
              style={{
                color: "#64748b",
                lineHeight: 1.7,
                maxWidth: "690px",
                margin: "12px auto 0",
              }}
            >
              正式寫作測驗為現場監考。請先選擇作答方式；
              下一步必須由監考老師輸入密碼授權，之後才能選擇 Exercise。
            </p>
          </div>

          <div
            style={{
              marginTop: "30px",
              padding: "18px",
              borderRadius: "14px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              lineHeight: 1.75,
            }}
          >
            <strong>考試規則：</strong>
            學生在家可以登入查看 Progress，但無法自行開啟考題。
            無論選擇電腦或紙筆作答，每一次正式測驗都需要監考老師重新授權。
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
              marginTop: "28px",
            }}
          >
            <ModeCard
              selected={mode === "computer"}
              icon="💻"
              title="電腦作答"
              subtitle="Computer Mode"
              description="使用鍵盤輸入中譯英與英文作文；系統自動儲存作答內容。"
              onClick={() => setMode("computer")}
            />

            <ModeCard
              selected={mode === "paper"}
              icon="✍️"
              title="紙筆作答"
              subtitle="Paper Mode"
              description="使用正式答案紙書寫；時間結束後拍攝答案卷，上傳後由 AI 辨識與評分。"
              onClick={() => setMode("paper")}
            />
          </div>

          {mode && (
            <div
              style={{
                marginTop: "22px",
                padding: "14px",
                borderRadius: "11px",
                background: "#eff6ff",
                color: "#1e40af",
                textAlign: "center",
                fontWeight: 800,
              }}
            >
              已選擇：
              {mode === "computer"
                ? " 💻 電腦作答"
                : " ✍️ 紙筆作答"}
            </div>
          )}

          <div
            style={{
              marginTop: "28px",
              textAlign: "center",
            }}
          >
            <button
              onClick={continueToExam}
              disabled={!mode}
              style={{
                minWidth: "290px",
                padding: "16px 28px",
                border: "none",
                borderRadius: "11px",
                background: mode ? "#2563eb" : "#cbd5e1",
                color: "white",
                fontSize: "18px",
                fontWeight: 900,
                cursor: mode ? "pointer" : "not-allowed",
              }}
            >
              下一步：監考老師授權 →
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  selected,
  icon,
  title,
  subtitle,
  description,
  onClick,
}: {
  selected: boolean;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "28px",
        borderRadius: "18px",
        border: selected
          ? "3px solid #2563eb"
          : "2px solid #e2e8f0",
        background: selected ? "#eff6ff" : "white",
        cursor: "pointer",
        boxShadow: selected
          ? "0 8px 24px rgba(37,99,235,0.14)"
          : "none",
      }}
    >
      <div style={{ fontSize: "46px" }}>{icon}</div>

      <div
        style={{
          marginTop: "14px",
          fontWeight: 900,
          fontSize: "24px",
          color: "#0f172a",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#2563eb",
          fontWeight: 800,
          marginTop: "4px",
        }}
      >
        {subtitle}
      </div>

      <p
        style={{
          marginBottom: 0,
          color: "#64748b",
          lineHeight: 1.7,
        }}
      >
        {description}
      </p>

      <div
        style={{
          marginTop: "16px",
          fontWeight: 800,
          color: selected ? "#2563eb" : "#94a3b8",
        }}
      >
        {selected ? "✓ 已選擇" : "選擇此模式"}
      </div>
    </button>
  );
}

const loadingPageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#f1f5f9",
  fontFamily: "Arial, sans-serif",
};

const cardStyle = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "22px",
  padding: "40px",
  boxShadow: "0 16px 45px rgba(15,23,42,0.10)",
};

const progressLinkStyle = {
  textDecoration: "none",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: "9px",
  padding: "10px 16px",
  fontWeight: 900,
};

const logoutButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#475569",
  borderRadius: "9px",
  padding: "10px 16px",
  cursor: "pointer",
};
