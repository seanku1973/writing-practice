"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #eef4ff 0%, #f8fafc 45%, #eef2ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "52px 44px",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 15px",
              borderRadius: "999px",
              background: "#eff6ff",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "1px",
              marginBottom: "18px",
            }}
          >
            GEPT INTERMEDIATE
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "46px",
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            中級寫作能力測驗
          </h1>

          <div
            style={{
              marginTop: "10px",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "25px",
            }}
          >
            Writing Practice
          </div>

          <p
            style={{
              margin: "20px auto 0",
              maxWidth: "650px",
              color: "#64748b",
              fontSize: "17px",
              lineHeight: 1.7,
            }}
          >
            模擬中級寫作測驗，完成測驗後由 AI 依正式評分標準進行評分、
            訂正與學習建議。
          </p>
        </div>

        <div
          style={{
            marginTop: "38px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "22px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px", marginBottom: "8px" }}>⏱️</div>
            <div
              style={{
                color: "#0f172a",
                fontWeight: 800,
                fontSize: "19px",
              }}
            >
              40 分鐘
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                marginTop: "6px",
              }}
            >
              完整模擬測驗時間
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "22px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px", marginBottom: "8px" }}>🌐</div>
            <div
              style={{
                color: "#0f172a",
                fontWeight: 800,
                fontSize: "19px",
              }}
            >
              中譯英 40%
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                marginTop: "6px",
              }}
            >
              Translation
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "22px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px", marginBottom: "8px" }}>✍️</div>
            <div
              style={{
                color: "#0f172a",
                fontWeight: 800,
                fontSize: "19px",
              }}
            >
              英文作文 60%
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                marginTop: "6px",
              }}
            >
              English Composition
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "34px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "16px",
            padding: "18px 22px",
            color: "#9a3412",
            lineHeight: 1.7,
            textAlign: "center",
          }}
        >
          登入後，學生可選擇
          <strong>「💻 電腦作答」</strong>
          或
          <strong>「✍️ 紙筆作答」</strong>。
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginTop: "34px",
          }}
        >
          <Link
            href="/login"
            style={{
              minWidth: "180px",
              textAlign: "center",
              textDecoration: "none",
              background: "#2563eb",
              color: "#ffffff",
              padding: "16px 28px",
              borderRadius: "12px",
              fontWeight: 800,
              fontSize: "17px",
              boxShadow: "0 8px 20px rgba(37, 99, 235, 0.22)",
            }}
          >
            學生登入
          </Link>

          <Link
            href="/teacher-login"
            style={{
              minWidth: "180px",
              textAlign: "center",
              textDecoration: "none",
              background: "#0f172a",
              color: "#ffffff",
              padding: "16px 28px",
              borderRadius: "12px",
              fontWeight: 800,
              fontSize: "17px",
            }}
          >
            老師登入
          </Link>
        </div>
      </div>
    </main>
  );
}