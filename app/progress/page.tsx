"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Attempt = {
  id: string;
  test_code: string;
  input_mode: "computer" | "paper";
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  elapsed_seconds: number | null;
  translation_level: number | null;
  translation_score: number | null;
  essay_level: number | null;
  essay_score: number | null;
  total_score: number | null;
  passed: boolean | null;
  transcription_confidence: string | null;
  ai_status: string;
  created_at: string;
};

type TrendKey = "total" | "translation" | "essay";

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(seconds: number | null) {
  if (seconds === null) return "-";

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function WritingProgressPage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [trendKey, setTrendKey] = useState<TrendKey>("total");

  useEffect(() => {
    async function loadProgress() {
      setLoading(true);
      setErrorText("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const studentId = localStorage.getItem("student_id");

        if (!studentId) {
          router.replace("/login");
          return;
        }

        setStudentName(localStorage.getItem("student_name") ?? "Student");

        const { data, error } = await supabase
          .from("writing_attempts")
          .select(`
            id,
            test_code,
            input_mode,
            status,
            started_at,
            submitted_at,
            elapsed_seconds,
            translation_level,
            translation_score,
            essay_level,
            essay_score,
            total_score,
            passed,
            transcription_confidence,
            ai_status,
            created_at
          `)
          .eq("student_id", studentId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setAttempts((data ?? []) as Attempt[]);
      } catch (error) {
        console.error(error);
        setErrorText(
          error instanceof Error ? error.message : "無法載入 Writing Progress。"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProgress();
  }, [router]);

  const completedAttempts = useMemo(
    () =>
      attempts.filter(
        (attempt) =>
          attempt.status === "completed" &&
          attempt.ai_status === "completed" &&
          attempt.total_score !== null
      ),
    [attempts]
  );

  const stats = useMemo(() => {
    const totalScores = completedAttempts
      .map((attempt) => attempt.total_score)
      .filter((value): value is number => value !== null);

    const translationScores = completedAttempts
      .map((attempt) => attempt.translation_score)
      .filter((value): value is number => value !== null);

    const essayScores = completedAttempts
      .map((attempt) => attempt.essay_score)
      .filter((value): value is number => value !== null);

    const passCount = completedAttempts.filter(
      (attempt) => attempt.passed === true
    ).length;

    return {
      completed: completedAttempts.length,
      avgTotal: average(totalScores),
      avgTranslation: average(translationScores),
      avgEssay: average(essayScores),
      best: totalScores.length > 0 ? Math.max(...totalScores) : null,
      passRate:
        completedAttempts.length > 0
          ? (passCount / completedAttempts.length) * 100
          : null,
    };
  }, [completedAttempts]);

  const chartData = useMemo(() => {
    return completedAttempts.map((attempt, index) => {
      let rawScore = attempt.total_score ?? 0;
      let max = 100;

      if (trendKey === "translation") {
        rawScore = attempt.translation_score ?? 0;
        max = 40;
      } else if (trendKey === "essay") {
        rawScore = attempt.essay_score ?? 0;
        max = 60;
      }

      return {
        index,
        attempt,
        rawScore,
        normalized: (rawScore / max) * 100,
      };
    });
  }, [completedAttempts, trendKey]);

  const recentAttempts = useMemo(() => [...attempts].reverse(), [attempts]);

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    localStorage.removeItem("student_code");
    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>正在載入 Writing Progress...</div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          <h1>無法載入進度</h1>
          <p style={{ color: "#b91c1c" }}>{errorText}</p>
          <Link href="/writing" style={primaryLinkStyle}>
            返回 Writing Test
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "28px 20px 70px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <div
              style={{
                color: "#2563eb",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "1px",
              }}
            >
              WRITING PRACTICE
            </div>

            <h1 style={{ margin: "7px 0 4px" }}>My Writing Progress</h1>
            <div style={{ color: "#64748b" }}>{studentName}</div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/writing" style={primaryLinkStyle}>
              開始 Writing Test
            </Link>
            <Link href="/" style={secondaryLinkStyle}>
              Writing 首頁
            </Link>
            <button onClick={logout} style={logoutButtonStyle}>
              登出
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <StatCard label="Completed Tests" value={String(stats.completed)} hint="AI 評分完成" />
          <StatCard
            label="Average Score"
            value={stats.avgTotal !== null ? stats.avgTotal.toFixed(1) : "-"}
            hint="/ 100"
          />
          <StatCard
            label="Best Score"
            value={stats.best !== null ? String(stats.best) : "-"}
            hint="/ 100"
          />
          <StatCard
            label="Pass Rate"
            value={stats.passRate !== null ? `${stats.passRate.toFixed(1)}%` : "-"}
            hint="80 分以上"
          />
          <StatCard
            label="Avg Translation"
            value={
              stats.avgTranslation !== null
                ? stats.avgTranslation.toFixed(1)
                : "-"
            }
            hint="/ 40"
          />
          <StatCard
            label="Avg Essay"
            value={stats.avgEssay !== null ? stats.avgEssay.toFixed(1) : "-"}
            hint="/ 60"
          />
        </section>

        <section style={sectionStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Score Trend</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                觀察總分、中譯英與作文的長期變化。
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <TrendButton active={trendKey === "total"} onClick={() => setTrendKey("total")}>
                Total /100
              </TrendButton>
              <TrendButton
                active={trendKey === "translation"}
                onClick={() => setTrendKey("translation")}
              >
                Translation /40
              </TrendButton>
              <TrendButton active={trendKey === "essay"} onClick={() => setTrendKey("essay")}>
                Essay /60
              </TrendButton>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div
              style={{
                marginTop: "26px",
                padding: "45px 20px",
                textAlign: "center",
                color: "#94a3b8",
                background: "#f8fafc",
                borderRadius: "12px",
              }}
            >
              尚無已完成 AI 評分的 Writing 成績。
            </div>
          ) : (
            <TrendChart data={chartData} trendKey={trendKey} />
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Writing History</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            可重新開啟每一次測驗的完整 AI Writing Report。
          </p>

          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "920px",
              }}
            >
              <thead>
                <tr>
                  {["Date", "Test", "Mode", "Translation", "Essay", "Total", "Result", "Time", "Report"].map(
                    (title) => (
                      <th key={title} style={thStyle}>
                        {title}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {recentAttempts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "35px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      尚無 Writing Test 紀錄。
                    </td>
                  </tr>
                ) : (
                  recentAttempts.map((attempt) => {
                    const completed =
                      attempt.status === "completed" &&
                      attempt.ai_status === "completed" &&
                      attempt.total_score !== null;

                    return (
                      <tr key={attempt.id}>
                        <td style={tdStyle}>{formatDate(attempt.submitted_at ?? attempt.created_at)}</td>
                        <td style={tdStyle}><strong>{attempt.test_code}</strong></td>
                        <td style={tdStyle}>
                          {attempt.input_mode === "paper" ? "✍️ Paper" : "💻 Computer"}
                          {attempt.transcription_confidence === "low" && (
                            <div style={{ color: "#c2410c", fontSize: "11px", marginTop: "4px" }}>
                              ⚠ Low transcript confidence
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {attempt.translation_score !== null ? `${attempt.translation_score}/40` : "-"}
                        </td>
                        <td style={tdStyle}>
                          {attempt.essay_score !== null ? `${attempt.essay_score}/60` : "-"}
                        </td>
                        <td style={tdStyle}>
                          {attempt.total_score !== null ? (
                            <strong
                              style={{
                                fontSize: "17px",
                                color: attempt.passed === true ? "#15803d" : "#dc2626",
                              }}
                            >
                              {attempt.total_score}
                            </strong>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={tdStyle}>
                          {completed ? (
                            <ResultBadge pass={attempt.passed === true} />
                          ) : (
                            <StatusBadge status={attempt.status} />
                          )}
                        </td>
                        <td style={tdStyle}>{formatElapsed(attempt.elapsed_seconds)}</td>
                        <td style={tdStyle}>
                          {completed ? (
                            <Link href={`/writing/result/${attempt.id}`} style={reportLinkStyle}>
                              查看報告
                            </Link>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>尚未完成</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {completedAttempts.length > 0 && (
          <section style={sectionStyle}>
            <h2 style={{ margin: 0 }}>Latest Performance</h2>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "14px",
              }}
            >
              {completedAttempts
                .slice(-3)
                .reverse()
                .map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/writing/result/${attempt.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "18px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: "18px" }}>{attempt.test_code}</div>
                        <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
                          {formatDate(attempt.submitted_at)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: 900,
                          color: attempt.passed === true ? "#15803d" : "#dc2626",
                        }}
                      >
                        {attempt.total_score}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      <MiniScore label="Translation" value={`${attempt.translation_score ?? 0}/40`} />
                      <MiniScore label="Essay" value={`${attempt.essay_score ?? 0}/60`} />
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function TrendChart({
  data,
  trendKey,
}: {
  data: {
    index: number;
    attempt: Attempt;
    rawScore: number;
    normalized: number;
  }[];
  trendKey: TrendKey;
}) {
  const width = 920;
  const height = 320;
  const left = 54;
  const right = 24;
  const top = 24;
  const bottom = 58;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xFor = (index: number) => {
    if (data.length <= 1) return left + plotWidth / 2;
    return left + (index / (data.length - 1)) * plotWidth;
  };

  const yFor = (normalized: number) =>
    top + ((100 - normalized) / 100) * plotHeight;

  const points = data
    .map((item, index) => `${xFor(index)},${yFor(item.normalized)}`)
    .join(" ");

  return (
    <div style={{ marginTop: "20px", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          minWidth: "760px",
          display: "block",
          background: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          color: "#2563eb",
        }}
        role="img"
        aria-label="Writing score trend"
      >
        {[0, 20, 40, 60, 80, 100].map((value) => {
          const y = yFor(value);

          return (
            <g key={value}>
              <line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {value}
              </text>
            </g>
          );
        })}

        <line
          x1={left}
          y1={yFor(80)}
          x2={width - right}
          y2={yFor(80)}
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />

        <text
          x={width - right}
          y={yFor(80) - 7}
          textAnchor="end"
          fontSize="11"
          fill="#64748b"
        >
          80% reference
        </text>

        {data.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {data.map((item, index) => {
          const x = xFor(index);
          const y = yFor(item.normalized);

          return (
            <g key={item.attempt.id}>
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="white"
                stroke="currentColor"
                strokeWidth="3"
              />

              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
              >
                {item.rawScore}
              </text>

              <text
                x={x}
                y={height - 28}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
              >
                {item.attempt.test_code}
              </text>

              <text
                x={x}
                y={height - 14}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {formatDate(item.attempt.submitted_at)}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          marginTop: "9px",
          color: "#64748b",
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        圖表縱軸以百分比標準化，點上的數字仍顯示實際分數。
        {trendKey === "translation" && " Translation 實際滿分 40。"}
        {trendKey === "essay" && " Essay 實際滿分 60。"}
      </div>
    </div>
  );
}

function TrendButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 11px",
        borderRadius: "9px",
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        background: active ? "#eff6ff" : "white",
        color: active ? "#1d4ed8" : "#475569",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "19px",
        boxShadow: "0 5px 16px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: "6px", fontSize: "30px", fontWeight: 900 }}>
        {value}
      </div>
      <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "3px" }}>
        {hint}
      </div>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "9px",
        padding: "10px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: "11px" }}>{label}</div>
      <div style={{ marginTop: "3px", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ResultBadge({ pass }: { pass: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: pass ? "#dcfce7" : "#fee2e2",
        color: pass ? "#166534" : "#b91c1c",
        borderRadius: "999px",
        padding: "5px 9px",
        fontWeight: 900,
        fontSize: "12px",
      }}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    in_progress: "作答中",
    awaiting_upload: "等待照片",
    submitted: "已繳交",
    transcribing: "辨識中",
    evaluating: "AI 評分中",
    transcription_failed: "辨識失敗",
    evaluation_failed: "評分失敗",
  };

  return (
    <span
      style={{
        display: "inline-block",
        background: "#f1f5f9",
        color: "#475569",
        borderRadius: "999px",
        padding: "5px 9px",
        fontWeight: 700,
        fontSize: "11px",
      }}
    >
      {labels[status] ?? status}
    </span>
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

const sectionStyle = {
  marginTop: "22px",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 6px 20px rgba(15,23,42,0.04)",
};

const thStyle = {
  padding: "12px 10px",
  borderBottom: "2px solid #cbd5e1",
  background: "#f8fafc",
  textAlign: "left" as const,
  color: "#475569",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "13px 10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
  fontSize: "13px",
};

const primaryLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "10px 15px",
  borderRadius: "9px",
  fontWeight: 800,
};

const secondaryLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "white",
  color: "#334155",
  padding: "10px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  fontWeight: 700,
};

const logoutButtonStyle = {
  padding: "10px 15px",
  background: "white",
  border: "1px solid #fecaca",
  color: "#dc2626",
  borderRadius: "9px",
  fontWeight: 700,
  cursor: "pointer",
};

const reportLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "7px 10px",
  borderRadius: "8px",
  fontWeight: 800,
  fontSize: "12px",
};
