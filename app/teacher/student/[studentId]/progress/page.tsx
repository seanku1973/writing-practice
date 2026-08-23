"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  student_code: string;
  display_name: string;
  is_active: boolean;
};

type Attempt = {
  id: string;
  student_id: string;
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

  transcription_status: string | null;
  transcription_confidence: string | null;

  ai_status: string;
  ai_evaluated_at: string | null;
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

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    in_progress: "作答中",
    awaiting_upload: "等待照片",
    submitted: "已繳交",
    transcribing: "手寫辨識中",
    evaluating: "AI 評分中",
    completed: "完成",
    transcription_failed: "辨識失敗",
    evaluation_failed: "評分失敗",
  };

  return labels[status] ?? status;
}

function deltaText(value: number | null) {
  if (value === null) return "-";
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export default function TeacherStudentProgressPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [trendKey, setTrendKey] = useState<TrendKey>("total");

  async function loadData() {
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

      const [studentResult, attemptsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, student_code, display_name, is_active")
          .eq("id", studentId)
          .single(),

        supabase
          .from("writing_attempts")
          .select(
            `
            id,
            student_id,
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
            transcription_status,
            transcription_confidence,
            ai_status,
            ai_evaluated_at,
            created_at
            `
          )
          .eq("student_id", studentId)
          .order("created_at", { ascending: true }),
      ]);

      if (studentResult.error || !studentResult.data) {
        throw (
          studentResult.error ??
          new Error("找不到此學生資料。")
        );
      }

      if (attemptsResult.error) {
        throw attemptsResult.error;
      }

      setStudent(studentResult.data as Student);
      setAttempts((attemptsResult.data ?? []) as Attempt[]);
    } catch (error) {
      console.error(error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "無法載入學生 Progress。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [studentId]);

  const completed = useMemo(
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
    const totalScores = completed
      .map((attempt) => attempt.total_score)
      .filter((value): value is number => value !== null);

    const translationScores = completed
      .map((attempt) => attempt.translation_score)
      .filter((value): value is number => value !== null);

    const essayScores = completed
      .map((attempt) => attempt.essay_score)
      .filter((value): value is number => value !== null);

    const writingTimes = completed
      .map((attempt) => attempt.elapsed_seconds)
      .filter((value): value is number => value !== null);

    const passed = completed.filter(
      (attempt) => attempt.passed === true
    ).length;

    const computer = attempts.filter(
      (attempt) => attempt.input_mode === "computer"
    ).length;

    const paper = attempts.filter(
      (attempt) => attempt.input_mode === "paper"
    ).length;

    const lowConfidence = attempts.filter(
      (attempt) =>
        attempt.input_mode === "paper" &&
        attempt.transcription_confidence === "low"
    ).length;

    return {
      completed: completed.length,
      avgTotal: average(totalScores),
      avgTranslation: average(translationScores),
      avgEssay: average(essayScores),
      avgTime: average(writingTimes),
      best:
        totalScores.length > 0 ? Math.max(...totalScores) : null,
      passRate:
        completed.length > 0 ? (passed / completed.length) * 100 : null,
      computer,
      paper,
      lowConfidence,
    };
  }, [attempts, completed]);

  const change = useMemo(() => {
    if (completed.length === 0) {
      return {
        total: null as number | null,
        translation: null as number | null,
        essay: null as number | null,
      };
    }

    const first = completed[0];
    const latest = completed[completed.length - 1];

    return {
      total:
        (latest.total_score ?? 0) - (first.total_score ?? 0),
      translation:
        (latest.translation_score ?? 0) -
        (first.translation_score ?? 0),
      essay:
        (latest.essay_score ?? 0) - (first.essay_score ?? 0),
    };
  }, [completed]);

  const rolling = useMemo(() => {
    if (completed.length === 0) {
      return {
        recentAverage: null as number | null,
        previousAverage: null as number | null,
        delta: null as number | null,
      };
    }

    const recent = completed.slice(-3);

    const recentAverage = average(
      recent
        .map((attempt) => attempt.total_score)
        .filter((value): value is number => value !== null)
    );

    const previousPool = completed.slice(0, Math.max(0, completed.length - 3));

    const previousAverage =
      previousPool.length > 0
        ? average(
            previousPool
              .map((attempt) => attempt.total_score)
              .filter((value): value is number => value !== null)
          )
        : null;

    return {
      recentAverage,
      previousAverage,
      delta:
        recentAverage !== null && previousAverage !== null
          ? recentAverage - previousAverage
          : null,
    };
  }, [completed]);

  const chartData = useMemo(() => {
    return completed.map((attempt, index) => {
      let raw = attempt.total_score ?? 0;
      let max = 100;

      if (trendKey === "translation") {
        raw = attempt.translation_score ?? 0;
        max = 40;
      } else if (trendKey === "essay") {
        raw = attempt.essay_score ?? 0;
        max = 60;
      }

      return {
        index,
        attempt,
        raw,
        normalized: (raw / max) * 100,
      };
    });
  }, [completed, trendKey]);

  const levelDistribution = useMemo(() => {
    const translation = [0, 0, 0, 0, 0, 0];
    const essay = [0, 0, 0, 0, 0, 0];

    completed.forEach((attempt) => {
      if (
        attempt.translation_level !== null &&
        attempt.translation_level >= 0 &&
        attempt.translation_level <= 5
      ) {
        translation[attempt.translation_level] += 1;
      }

      if (
        attempt.essay_level !== null &&
        attempt.essay_level >= 0 &&
        attempt.essay_level <= 5
      ) {
        essay[attempt.essay_level] += 1;
      }
    });

    return { translation, essay };
  }, [completed]);

  const history = useMemo(
    () => [...attempts].reverse(),
    [attempts]
  );

  if (loading) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          正在載入學生 Writing Progress...
        </div>
      </main>
    );
  }

  if (errorText || !student) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          <h1>無法載入 Progress</h1>
          <p style={{ color: "#b91c1c", lineHeight: 1.7 }}>
            {errorText || "Unknown error"}
          </p>

          <Link href="/teacher" style={primaryLinkStyle}>
            返回 Teacher Dashboard
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
        padding: "28px 20px 80px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1220px", margin: "0 auto" }}>
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
                color: "#4f46e5",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "1px",
              }}
            >
              TEACHER · STUDENT PROGRESS
            </div>

            <h1 style={{ margin: "7px 0 4px" }}>
              {student.display_name}
            </h1>

            <div style={{ color: "#64748b" }}>
              {student.student_code} · Writing Progress Analysis
            </div>
          </div>

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

            <button
              type="button"
              onClick={() => void loadData()}
              style={secondaryButtonStyle}
            >
              ↻ 更新資料
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "14px",
          }}
        >
          <StatCard
            label="Completed"
            value={String(stats.completed)}
            hint="完成 AI 評分"
          />

          <StatCard
            label="Average"
            value={
              stats.avgTotal !== null
                ? stats.avgTotal.toFixed(1)
                : "-"
            }
            hint="/ 100"
          />

          <StatCard
            label="Best Score"
            value={
              stats.best !== null ? String(stats.best) : "-"
            }
            hint="/ 100"
          />

          <StatCard
            label="Pass Rate"
            value={
              stats.passRate !== null
                ? `${stats.passRate.toFixed(1)}%`
                : "-"
            }
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
            value={
              stats.avgEssay !== null
                ? stats.avgEssay.toFixed(1)
                : "-"
            }
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
              <h2 style={{ margin: 0 }}>Performance Change</h2>
              <p style={mutedTextStyle}>
                第一份已完成測驗與最新一份已完成測驗的差異。
              </p>
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              {completed.length > 0
                ? `${formatDate(completed[0].submitted_at)} → ${formatDate(
                    completed[completed.length - 1].submitted_at
                  )}`
                : "尚無完成紀錄"}
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <DeltaCard
              label="Total Score"
              value={change.total}
              suffix="/100"
            />

            <DeltaCard
              label="Translation"
              value={change.translation}
              suffix="/40"
            />

            <DeltaCard
              label="Essay"
              value={change.essay}
              suffix="/60"
            />

            <DeltaCard
              label="Recent 3 vs Earlier"
              value={rolling.delta}
              suffix=" pts"
            />
          </div>

          {rolling.recentAverage !== null && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px",
                borderRadius: "11px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#475569",
                lineHeight: 1.7,
              }}
            >
              最近最多 3 次平均：
              <strong> {rolling.recentAverage.toFixed(1)}</strong>
              {rolling.previousAverage !== null && (
                <>
                  {" "}
                  · 更早紀錄平均：
                  <strong>
                    {" "}
                    {rolling.previousAverage.toFixed(1)}
                  </strong>
                </>
              )}
            </div>
          )}
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
              <p style={mutedTextStyle}>
                可切換 Total、Translation、Essay 觀察長期走勢。
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <TrendButton
                active={trendKey === "total"}
                onClick={() => setTrendKey("total")}
              >
                Total /100
              </TrendButton>

              <TrendButton
                active={trendKey === "translation"}
                onClick={() => setTrendKey("translation")}
              >
                Translation /40
              </TrendButton>

              <TrendButton
                active={trendKey === "essay"}
                onClick={() => setTrendKey("essay")}
              >
                Essay /60
              </TrendButton>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div style={emptyBoxStyle}>
              尚無已完成 AI 評分的 Writing 成績。
            </div>
          ) : (
            <TrendChart data={chartData} trendKey={trendKey} />
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Section Profile</h2>
          <p style={mutedTextStyle}>
            以平均得分率比較 Translation 與 Essay，協助老師判斷目前相對弱項。
          </p>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(290px, 1fr))",
              gap: "18px",
            }}
          >
            <SkillBar
              label="Translation"
              score={stats.avgTranslation}
              max={40}
            />

            <SkillBar
              label="Essay"
              score={stats.avgEssay}
              max={60}
            />
          </div>

          <div
            style={{
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            <LevelDistribution
              title="Translation Level Distribution"
              counts={levelDistribution.translation}
            />

            <LevelDistribution
              title="Essay Level Distribution"
              counts={levelDistribution.essay}
            />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Test Mode / Data Quality</h2>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <InfoCard
              label="Computer Mode"
              value={String(stats.computer)}
            />

            <InfoCard
              label="Paper Mode"
              value={String(stats.paper)}
            />

            <InfoCard
              label="Average Writing Time"
              value={
                stats.avgTime !== null
                  ? formatElapsed(Math.round(stats.avgTime))
                  : "-"
              }
            />

            <InfoCard
              label="Low Transcript Confidence"
              value={String(stats.lowConfidence)}
              warning={stats.lowConfidence > 0}
            />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Writing History</h2>

          <p style={mutedTextStyle}>
            包含已完成、作答中、等待照片及 AI 處理失敗的所有紀錄。
          </p>

          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1040px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Date",
                    "Test",
                    "Mode",
                    "Translation",
                    "Essay",
                    "Total",
                    "Result / Status",
                    "Time",
                    "Transcript",
                    "Report",
                  ].map((title) => (
                    <th key={title} style={thStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        padding: "35px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      尚無 Writing Attempt。
                    </td>
                  </tr>
                ) : (
                  history.map((attempt) => {
                    const completedAttempt =
                      attempt.status === "completed" &&
                      attempt.ai_status === "completed" &&
                      attempt.total_score !== null;

                    return (
                      <tr key={attempt.id}>
                        <td style={tdStyle}>
                          {formatDateTime(
                            attempt.submitted_at ?? attempt.created_at
                          )}
                        </td>

                        <td style={tdStyle}>
                          <strong>{attempt.test_code}</strong>
                        </td>

                        <td style={tdStyle}>
                          {attempt.input_mode === "paper"
                            ? "✍️ Paper"
                            : "💻 Computer"}
                        </td>

                        <td style={tdStyle}>
                          {attempt.translation_score !== null
                            ? `${attempt.translation_score}/40 · L${
                                attempt.translation_level ?? "-"
                              }`
                            : "-"}
                        </td>

                        <td style={tdStyle}>
                          {attempt.essay_score !== null
                            ? `${attempt.essay_score}/60 · L${
                                attempt.essay_level ?? "-"
                              }`
                            : "-"}
                        </td>

                        <td style={tdStyle}>
                          {attempt.total_score !== null ? (
                            <strong
                              style={{
                                fontSize: "17px",
                                color:
                                  attempt.passed === true
                                    ? "#15803d"
                                    : "#dc2626",
                              }}
                            >
                              {attempt.total_score}
                            </strong>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={tdStyle}>
                          {completedAttempt ? (
                            <ResultBadge
                              pass={attempt.passed === true}
                            />
                          ) : (
                            <StatusBadge
                              status={attempt.status}
                            />
                          )}
                        </td>

                        <td style={tdStyle}>
                          {formatElapsed(attempt.elapsed_seconds)}
                        </td>

                        <td style={tdStyle}>
                          {attempt.input_mode === "paper" ? (
                            <div>
                              {attempt.transcription_status ?? "-"}
                              {attempt.transcription_confidence && (
                                <div
                                  style={{
                                    marginTop: "4px",
                                    fontSize: "11px",
                                    color:
                                      attempt.transcription_confidence ===
                                      "low"
                                        ? "#c2410c"
                                        : "#64748b",
                                  }}
                                >
                                  confidence:{" "}
                                  {attempt.transcription_confidence}
                                </div>
                              )}
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>

                        <td style={tdStyle}>
                          <Link
                            href={`/teacher/writing/${attempt.id}`}
                            style={reportLinkStyle}
                          >
                            查看紀錄
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
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
    raw: number;
    normalized: number;
  }[];
  trendKey: TrendKey;
}) {
  const width = 940;
  const height = 330;
  const left = 56;
  const right = 26;
  const top = 28;
  const bottom = 62;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xFor = (index: number) => {
    if (data.length <= 1) return left + plotWidth / 2;

    return left + (index / (data.length - 1)) * plotWidth;
  };

  const yFor = (normalized: number) =>
    top + ((100 - normalized) / 100) * plotHeight;

  const polyline = data
    .map(
      (item, index) =>
        `${xFor(index)},${yFor(item.normalized)}`
    )
    .join(" ");

  return (
    <div style={{ marginTop: "20px", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          minWidth: "780px",
          display: "block",
          background: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          color: "#4f46e5",
        }}
        aria-label="Teacher student writing score trend"
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
            points={polyline}
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
                fontWeight="800"
                fill="#0f172a"
              >
                {item.raw}
              </text>

              <text
                x={x}
                y={height - 31}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
              >
                {item.attempt.test_code}
              </text>

              <text
                x={x}
                y={height - 17}
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
          lineHeight: 1.65,
        }}
      >
        {trendKey === "total"
          ? "Total 以 100 分滿分顯示；80 分線為正式總分通過基準。"
          : trendKey === "translation"
          ? "Translation 以得分率標準化至 0–100% 顯示；點上數字仍為實際 /40 分數。80% 線僅為比較參考。"
          : "Essay 以得分率標準化至 0–100% 顯示；點上數字仍為實際 /60 分數。80% 線僅為比較參考。"}
      </div>
    </div>
  );
}

function SkillBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number | null;
  max: number;
}) {
  const percent =
    score === null ? 0 : Math.max(0, Math.min(100, (score / max) * 100));

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "18px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <strong>{label}</strong>

        <span
          style={{
            fontWeight: 900,
            fontSize: "19px",
          }}
        >
          {score !== null ? score.toFixed(1) : "-"} / {max}
        </span>
      </div>

      <div
        style={{
          height: "11px",
          borderRadius: "999px",
          background: "#e2e8f0",
          marginTop: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: "999px",
            background: "#4f46e5",
          }}
        />
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        {score !== null ? `${percent.toFixed(1)}%` : "No data"}
      </div>
    </div>
  );
}

function LevelDistribution({
  title,
  counts,
}: {
  title: string;
  counts: number[];
}) {
  const maxCount = Math.max(1, ...counts);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "18px",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "16px" }}>{title}</h3>

      <div style={{ marginTop: "15px" }}>
        {[5, 4, 3, 2, 1, 0].map((level) => {
          const count = counts[level] ?? 0;
          const width = (count / maxCount) * 100;

          return (
            <div
              key={level}
              style={{
                display: "grid",
                gridTemplateColumns: "58px 1fr 32px",
                alignItems: "center",
                gap: "9px",
                marginTop: "8px",
              }}
            >
              <div
                style={{
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Level {level}
              </div>

              <div
                style={{
                  height: "9px",
                  background: "#e2e8f0",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${width}%`,
                    height: "100%",
                    background: "#6366f1",
                  }}
                />
              </div>

              <div
                style={{
                  textAlign: "right",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix: string;
}) {
  const positive = value !== null && value > 0;
  const negative = value !== null && value < 0;

  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "18px",
        border: positive
          ? "1px solid #bbf7d0"
          : negative
          ? "1px solid #fecaca"
          : "1px solid #e2e8f0",
        background: positive
          ? "#f0fdf4"
          : negative
          ? "#fef2f2"
          : "#f8fafc",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "28px",
          fontWeight: 900,
          color: positive
            ? "#15803d"
            : negative
            ? "#dc2626"
            : "#0f172a",
        }}
      >
        {deltaText(value)}
        {value !== null && (
          <span
            style={{
              fontSize: "12px",
              marginLeft: "4px",
              fontWeight: 700,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
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
      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "30px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          marginTop: "3px",
        }}
      >
        {hint}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        background: warning ? "#fff7ed" : "#f8fafc",
        border: warning
          ? "1px solid #fed7aa"
          : "1px solid #e2e8f0",
        borderRadius: "13px",
        padding: "17px",
      }}
    >
      <div
        style={{
          color: warning ? "#9a3412" : "#64748b",
          fontSize: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontWeight: 900,
          fontSize: "21px",
          color: warning ? "#c2410c" : "#0f172a",
        }}
      >
        {value}
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
        border: active
          ? "1px solid #4f46e5"
          : "1px solid #cbd5e1",
        background: active ? "#eef2ff" : "white",
        color: active ? "#3730a3" : "#475569",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
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
      {statusLabel(status)}
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

const mutedTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  lineHeight: 1.7,
};

const emptyBoxStyle = {
  marginTop: "24px",
  padding: "42px 20px",
  textAlign: "center" as const,
  color: "#94a3b8",
  background: "#f8fafc",
  borderRadius: "12px",
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

const reportLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "7px 10px",
  borderRadius: "8px",
  fontWeight: 800,
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
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
