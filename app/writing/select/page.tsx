"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TestMetadata = {
  code: string;
  exerciseLabel: string;
  title: string;
  durationSeconds: number;
};

type AnswerMode = "computer" | "paper";

export default function ExerciseSelectionPage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [mode, setMode] = useState<AnswerMode | null>(null);
  const [tests, setTests] = useState<TestMetadata[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function initialize() {
      try {
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
            action: "list_tests",
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          router.replace("/writing/unlock");
          return;
        }

        const loadedTests = (result.tests ?? []) as TestMetadata[];

        setTests(loadedTests);

        if (loadedTests.length === 1) {
          setSelectedCode(loadedTests[0].code);
        }
      } catch (error) {
        console.error(error);
        setErrorText(
          error instanceof Error
            ? error.message
            : "無法載入 Exercise。"
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, [router]);

  async function cancelExam() {
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
        body: JSON.stringify({
          action: "lock",
        }),
      }).catch(() => null);
    }

    router.replace("/writing");
  }

  function continueToPreparation() {
    const selected = tests.find(
      (test) => test.code === selectedCode
    );

    if (!selected) return;

    localStorage.setItem(
      "writing_selected_test_code",
      selected.code
    );

    localStorage.setItem(
      "writing_selected_test_title",
      selected.title
    );

    router.push(`/writing/exam/${selected.code}`);
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>載入 Exercise...</section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: "#2563eb",
              fontWeight: 900,
              fontSize: "13px",
              letterSpacing: "1px",
            }}
          >
            EXERCISE SELECTION
          </div>

          <h1 style={{ margin: "9px 0 6px" }}>
            選擇本次寫作考題
          </h1>

          <p
            style={{
              color: "#64748b",
              lineHeight: 1.7,
            }}
          >
            監考老師授權已完成。請選擇這一次要進行的 Exercise。
          </p>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "14px",
            borderRadius: "11px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            lineHeight: 1.7,
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

        {errorText && (
          <div
            style={{
              marginTop: "18px",
              padding: "13px",
              borderRadius: "9px",
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            {errorText}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "24px",
          }}
        >
          {tests.map((test) => {
            const selected = selectedCode === test.code;

            return (
              <button
                key={test.code}
                type="button"
                onClick={() => setSelectedCode(test.code)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "20px",
                  borderRadius: "14px",
                  border: selected
                    ? "3px solid #2563eb"
                    : "2px solid #e2e8f0",
                  background: selected
                    ? "#eff6ff"
                    : "white",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    color: "#2563eb",
                    fontWeight: 900,
                    fontSize: "15px",
                  }}
                >
                  {test.exerciseLabel}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "#0f172a",
                    fontWeight: 900,
                    fontSize: "20px",
                  }}
                >
                  {test.title}
                </div>

                <div
                  style={{
                    marginTop: "7px",
                    color: "#64748b",
                  }}
                >
                  {Math.round(test.durationSeconds / 60)} 分鐘 ·
                  中譯英 40% · 英文作文 60%
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    color: selected
                      ? "#2563eb"
                      : "#94a3b8",
                    fontWeight: 800,
                  }}
                >
                  {selected ? "✓ 已選擇" : "選擇此 Exercise"}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={continueToPreparation}
          disabled={!selectedCode}
          style={{
            width: "100%",
            marginTop: "24px",
            padding: "15px",
            border: "none",
            borderRadius: "10px",
            background: selectedCode ? "#2563eb" : "#cbd5e1",
            color: "white",
            fontWeight: 900,
            fontSize: "17px",
            cursor: selectedCode ? "pointer" : "not-allowed",
          }}
        >
          提交 Exercise → 準備開始測驗
        </button>

        <button
          type="button"
          onClick={() => void cancelExam()}
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
          取消本次現場考試
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
  maxWidth: "700px",
  background: "white",
  padding: "38px",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
};
