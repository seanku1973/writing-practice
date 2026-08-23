"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  student_code: string;
  display_name: string;
};

type ErrorItem = {
  part?: string;
  original_excerpt?: string;
  corrected_excerpt?: string;
  category?: string;
  explanation?: string;
};

type Attempt = {
  id: string;
  student_id: string;
  test_code: string;
  input_mode: "computer" | "paper";
  status: string;

  started_at: string | null;
  writing_ended_at: string | null;
  submitted_at: string | null;
  elapsed_seconds: number | null;

  translation_text: string | null;
  essay_text: string | null;

  translation_word_count: number | null;
  essay_word_count: number | null;
  essay_sentence_count: number | null;

  paper_bucket: string | null;
  paper_image_paths: unknown;

  transcription_status: string | null;
  transcription_confidence: string | null;
  transcription_raw: unknown;

  translation_level: number | null;
  translation_score: number | null;

  essay_level: number | null;
  essay_score: number | null;

  total_score: number | null;
  passed: boolean | null;

  translation_corrected: string | null;
  essay_corrected: string | null;

  translation_feedback: string | null;
  essay_feedback: string | null;

  strengths: string | null;
  improvements: string | null;

  error_analysis: unknown;

  ai_status: string;
  ai_model: string | null;
  ai_prompt_version: string | null;
  ai_evaluated_at: string | null;
  ai_error_message: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(seconds: number | null) {
  if (seconds === null) return "-";

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.length > 0
  );
}

function safeErrorItems(value: unknown): ErrorItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is ErrorItem =>
      typeof item === "object" && item !== null
  );
}

function translationLevelLabel(level: number | null) {
  switch (level) {
    case 5:
      return "翻譯能力佳";
    case 4:
      return "翻譯能力可";
    case 3:
      return "翻譯能力有限";
    case 2:
      return "稍具翻譯能力";
    case 1:
      return "無翻譯能力";
    case 0:
      return "未答／等同未答";
    default:
      return "-";
  }
}

function essayLevelLabel(level: number | null) {
  switch (level) {
    case 5:
      return "寫作能力佳";
    case 4:
      return "寫作能力可";
    case 3:
      return "寫作能力有限";
    case 2:
      return "稍具寫作能力";
    case 1:
      return "無寫作能力";
    case 0:
      return "未答／等同未答";
    default:
      return "-";
  }
}

export default function TeacherWritingAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  async function loadAttempt() {
    setLoading(true);
    setErrorText("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/teacher-login");
        return;
      }

      const { data, error } = await supabase
        .from("writing_attempts")
        .select(
          `
          id,
          student_id,
          test_code,
          input_mode,
          status,
          started_at,
          writing_ended_at,
          submitted_at,
          elapsed_seconds,
          translation_text,
          essay_text,
          translation_word_count,
          essay_word_count,
          essay_sentence_count,
          paper_bucket,
          paper_image_paths,
          transcription_status,
          transcription_confidence,
          transcription_raw,
          translation_level,
          translation_score,
          essay_level,
          essay_score,
          total_score,
          passed,
          translation_corrected,
          essay_corrected,
          translation_feedback,
          essay_feedback,
          strengths,
          improvements,
          error_analysis,
          ai_status,
          ai_model,
          ai_prompt_version,
          ai_evaluated_at,
          ai_error_message
          `
        )
        .eq("id", attemptId)
        .single();

      if (error || !data) {
        throw error ?? new Error("找不到此 Writing Attempt。");
      }

      const loadedAttempt = data as Attempt;
      setAttempt(loadedAttempt);

      const { data: studentData, error: studentError } =
        await supabase
          .from("students")
          .select("id, student_code, display_name")
          .eq("id", loadedAttempt.student_id)
          .single();

      if (studentError) {
        throw studentError;
      }

      setStudent(studentData as Student);

      if (loadedAttempt.input_mode === "paper") {
        const paths = safeStringArray(
          loadedAttempt.paper_image_paths
        );

        if (paths.length > 0) {
          const bucket =
            loadedAttempt.paper_bucket || "writing-answers";

          const urls: string[] = [];

          for (const path of paths) {
            const { data: signed, error: signedError } =
              await supabase.storage
                .from(bucket)
                .createSignedUrl(path, 60 * 60);

            if (!signedError && signed?.signedUrl) {
              urls.push(signed.signedUrl);
            }
          }

          setImageUrls(urls);
        }
      }
    } catch (error) {
      console.error(error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "無法載入 Writing Attempt。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttempt();
  }, [attemptId]);

  const errors = useMemo(
    () => safeErrorItems(attempt?.error_analysis),
    [attempt?.error_analysis]
  );

  if (loading) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          正在載入學生 Writing Report...
        </div>
      </main>
    );
  }

  if (errorText || !attempt) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          <h1>無法顯示報告</h1>
          <p style={{ color: "#b91c1c" }}>
            {errorText || "Unknown error"}
          </p>

          <Link href="/teacher" style={primaryLinkStyle}>
            返回 Teacher Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const completed =
    attempt.status === "completed" &&
    attempt.ai_status === "completed";

  const passed = attempt.passed === true;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "28px 20px 80px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <Link href="/teacher" style={secondaryLinkStyle}>
              ← Teacher Dashboard
            </Link>

            {student && (
              <Link
                href={`/teacher/student/${student.id}/progress`}
                style={progressLinkStyle}
              >
                📈 學生 Progress
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadAttempt()}
            style={secondaryButtonStyle}
          >
            ↻ 重新整理
          </button>
        </div>

        <section style={heroStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "22px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#2563eb",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  fontSize: "13px",
                }}
              >
                TEACHER WRITING REPORT
              </div>

              <h1 style={{ margin: "8px 0 5px" }}>
                {student?.display_name ?? "Student"}
              </h1>

              <div style={{ color: "#64748b" }}>
                {student?.student_code ?? "-"} · {attempt.test_code} ·{" "}
                {attempt.input_mode === "paper"
                  ? "✍️ Paper Mode"
                  : "💻 Computer Mode"}
              </div>
            </div>

            {completed ? (
              <div
                style={{
                  minWidth: "190px",
                  textAlign: "center",
                  padding: "18px 24px",
                  borderRadius: "18px",
                  background: passed ? "#f0fdf4" : "#fef2f2",
                  border: passed
                    ? "1px solid #bbf7d0"
                    : "1px solid #fecaca",
                }}
              >
                <div
                  style={{
                    fontSize: "38px",
                    fontWeight: 900,
                    color: passed ? "#15803d" : "#dc2626",
                  }}
                >
                  {attempt.total_score ?? 0} / 100
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontWeight: 900,
                    color: passed ? "#15803d" : "#dc2626",
                  }}
                >
                  {passed ? "PASS" : "FAIL"}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "15px 20px",
                  borderRadius: "12px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  fontWeight: 800,
                }}
              >
                {attempt.status}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <InfoBox
              label="Translation"
              value={
                attempt.translation_score !== null
                  ? `${attempt.translation_score} / 40`
                  : "-"
              }
            />

            <InfoBox
              label="Essay"
              value={
                attempt.essay_score !== null
                  ? `${attempt.essay_score} / 60`
                  : "-"
              }
            />

            <InfoBox
              label="Writing Time"
              value={formatElapsed(attempt.elapsed_seconds)}
            />

            <InfoBox
              label="Submitted"
              value={formatDate(attempt.submitted_at)}
            />
          </div>

          {attempt.ai_error_message && (
            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                borderRadius: "10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                lineHeight: 1.7,
              }}
            >
              <strong>AI Error:</strong> {attempt.ai_error_message}
            </div>
          )}

          {attempt.input_mode === "paper" &&
            attempt.transcription_confidence === "low" && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  lineHeight: 1.7,
                }}
              >
                ⚠️ 此份手寫辨識信心為 <strong>LOW</strong>，
                請老師務必將 AI Transcript 與原始答案卷逐項比對。
              </div>
            )}
        </section>

        {attempt.input_mode === "paper" && (
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>Original Answer Sheet</h2>

            {imageUrls.length === 0 ? (
              <p style={mutedTextStyle}>
                目前沒有可顯示的答案卷圖片。
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "16px",
                  marginTop: "18px",
                }}
              >
                {imageUrls.map((url, index) => (
                  <div
                    key={url}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={url}
                      alt={`答案卷第 ${index + 1} 頁`}
                      style={{
                        width: "100%",
                        height: "420px",
                        objectFit: "contain",
                        display: "block",
                        background: "#e2e8f0",
                      }}
                    />

                    <div
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        fontWeight: 800,
                      }}
                    >
                      Page {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <InfoBox
                label="Transcription Status"
                value={attempt.transcription_status ?? "-"}
              />

              <InfoBox
                label="Transcription Confidence"
                value={attempt.transcription_confidence ?? "-"}
              />
            </div>
          </section>
        )}

        <section style={sectionStyle}>
          <PartHeading
            title="Part 1 — Translation"
            level={attempt.translation_level}
            label={translationLevelLabel(attempt.translation_level)}
            score={
              attempt.translation_score !== null
                ? `${attempt.translation_score} / 40`
                : "-"
            }
          />

          <AnswerBlock
            title={
              attempt.input_mode === "paper"
                ? "AI Transcript"
                : "Student Answer"
            }
            text={attempt.translation_text}
          />

          <AnswerBlock
            title="Corrected Version"
            text={attempt.translation_corrected}
            corrected
          />

          <FeedbackBox
            title="Translation Feedback"
            text={attempt.translation_feedback}
          />
        </section>

        <section style={sectionStyle}>
          <PartHeading
            title="Part 2 — English Composition"
            level={attempt.essay_level}
            label={essayLevelLabel(attempt.essay_level)}
            score={
              attempt.essay_score !== null
                ? `${attempt.essay_score} / 60`
                : "-"
            }
          />

          <div
            style={{
              marginBottom: "14px",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            {attempt.essay_word_count ?? 0} words ·{" "}
            {attempt.essay_sentence_count ?? 0} sentences
          </div>

          <AnswerBlock
            title={
              attempt.input_mode === "paper"
                ? "AI Transcript"
                : "Student Essay"
            }
            text={attempt.essay_text}
          />

          <AnswerBlock
            title="Corrected Essay"
            text={attempt.essay_corrected}
            corrected
          />

          <FeedbackBox
            title="Essay Feedback"
            text={attempt.essay_feedback}
          />
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Error Analysis</h2>

          {errors.length === 0 ? (
            <p style={mutedTextStyle}>
              沒有可顯示的主要錯誤分析。
            </p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "16px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "760px",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Part",
                      "Original",
                      "Correction",
                      "Type",
                      "Explanation",
                    ].map((title) => (
                      <th key={title} style={thStyle}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {errors.map((item, index) => (
                    <tr key={index}>
                      <td style={tdStyle}>
                        {item.part === "translation"
                          ? "Translation"
                          : "Essay"}
                      </td>

                      <td style={tdStyle}>
                        {item.original_excerpt || "-"}
                      </td>

                      <td style={tdStyle}>
                        {item.corrected_excerpt || "-"}
                      </td>

                      <td style={tdStyle}>
                        {item.category || "-"}
                      </td>

                      <td style={tdStyle}>
                        {item.explanation || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "18px",
            }}
          >
            <FeedbackBox
              title="Strengths"
              text={attempt.strengths}
              positive
            />

            <FeedbackBox
              title="Improvements"
              text={attempt.improvements}
            />
          </div>

          <div
            style={{
              marginTop: "18px",
              color: "#94a3b8",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            AI model: {attempt.ai_model ?? "-"}
            <br />
            Prompt version: {attempt.ai_prompt_version ?? "-"}
            <br />
            AI evaluated: {formatDate(attempt.ai_evaluated_at)}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontWeight: 800,
          fontSize: "16px",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PartHeading({
  title,
  level,
  label,
  score,
}: {
  title: string;
  level: number | null;
  label: string;
  score: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 7px" }}>{title}</h2>

        <div
          style={{
            color: "#2563eb",
            fontWeight: 800,
          }}
        >
          Level {level ?? "-"} · {label}
        </div>
      </div>

      <div
        style={{
          fontSize: "24px",
          fontWeight: 900,
        }}
      >
        {score}
      </div>
    </div>
  );
}

function AnswerBlock({
  title,
  text,
  corrected = false,
}: {
  title: string;
  text: string | null;
  corrected?: boolean;
}) {
  return (
    <div style={{ marginTop: "18px" }}>
      <h3 style={{ margin: "0 0 9px", fontSize: "16px" }}>
        {title}
      </h3>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.85,
          background: corrected ? "#f0fdf4" : "#f8fafc",
          border: corrected
            ? "1px solid #bbf7d0"
            : "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        {text?.trim() || "(No answer)"}
      </div>
    </div>
  );
}

function FeedbackBox({
  title,
  text,
  positive = false,
}: {
  title: string;
  text: string | null;
  positive?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: "18px",
        padding: "18px",
        borderRadius: "12px",
        background: positive ? "#f0fdf4" : "#eff6ff",
        border: positive
          ? "1px solid #bbf7d0"
          : "1px solid #bfdbfe",
      }}
    >
      <h3 style={{ margin: "0 0 9px", fontSize: "16px" }}>
        {title}
      </h3>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.75,
          color: positive ? "#166534" : "#1e3a8a",
        }}
      >
        {text?.trim() || "-"}
      </div>
    </div>
  );
}

const centerPageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#f1f5f9",
  padding: "30px 20px",
  fontFamily: "Arial, sans-serif",
};

const centerCardStyle = {
  width: "100%",
  maxWidth: "650px",
  padding: "36px",
  borderRadius: "18px",
  background: "white",
  boxShadow: "0 12px 35px rgba(15,23,42,0.08)",
  textAlign: "center" as const,
};

const heroStyle = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "30px",
  boxShadow: "0 10px 30px rgba(15,23,42,0.07)",
};

const sectionStyle = {
  marginTop: "22px",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 6px 20px rgba(15,23,42,0.04)",
};

const mutedTextStyle = {
  color: "#64748b",
  lineHeight: 1.7,
};

const thStyle = {
  padding: "12px",
  borderBottom: "2px solid #cbd5e1",
  background: "#f8fafc",
  textAlign: "left" as const,
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
  lineHeight: 1.6,
};

const primaryLinkStyle = {
  display: "inline-block",
  marginTop: "18px",
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "12px 20px",
  borderRadius: "9px",
  fontWeight: 800,
};

const secondaryLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "white",
  color: "#334155",
  border: "1px solid #cbd5e1",
  padding: "10px 15px",
  borderRadius: "9px",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: "10px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "white",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
};


const progressLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "#eef2ff",
  color: "#3730a3",
  border: "1px solid #c7d2fe",
  padding: "10px 15px",
  borderRadius: "9px",
  fontWeight: 800,
};
