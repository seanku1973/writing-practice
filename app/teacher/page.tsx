"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  student_code: string;
  display_name: string;
  is_active: boolean;
};

type WritingAttempt = {
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
  ai_error_message: string | null;
  created_at: string;
};

type SortKey =
  | "newest"
  | "oldest"
  | "score_high"
  | "score_low"
  | "student";

function formatDate(value: string | null) {
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

function statusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "作答中";
    case "awaiting_upload":
      return "等待照片";
    case "submitted":
      return "已繳交";
    case "transcribing":
      return "手寫辨識中";
    case "evaluating":
      return "AI 評分中";
    case "completed":
      return "完成";
    case "transcription_failed":
      return "辨識失敗";
    case "evaluation_failed":
      return "評分失敗";
    default:
      return status;
  }
}

function aiStatusLabel(status: string) {
  switch (status) {
    case "not_requested":
      return "未開始";
    case "pending":
      return "等待中";
    case "processing":
      return "處理中";
    case "completed":
      return "完成";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

export default function WritingTeacherDashboardPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<WritingAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [query, setQuery] = useState("");
  const [testFilter, setTestFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

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

      const [studentsResult, attemptsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, student_code, display_name, is_active")
          .order("display_name", { ascending: true }),

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
            ai_error_message,
            created_at
            `
          )
          .order("created_at", { ascending: false }),
      ]);

      if (studentsResult.error) {
        throw studentsResult.error;
      }

      if (attemptsResult.error) {
        throw attemptsResult.error;
      }

      setStudents((studentsResult.data ?? []) as Student[]);
      setAttempts((attemptsResult.data ?? []) as WritingAttempt[]);
    } catch (error) {
      console.error(error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "無法載入 Writing Teacher Dashboard。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const studentMap = useMemo(() => {
    return new Map(students.map((student) => [student.id, student]));
  }, [students]);

  const testCodes = useMemo(() => {
    return Array.from(
      new Set(attempts.map((attempt) => attempt.test_code))
    ).sort();
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = attempts.filter((attempt) => {
      const student = studentMap.get(attempt.student_id);

      const studentName = student?.display_name ?? "";
      const studentCode = student?.student_code ?? "";

      const matchesQuery =
        !normalizedQuery ||
        studentName.toLowerCase().includes(normalizedQuery) ||
        studentCode.toLowerCase().includes(normalizedQuery) ||
        attempt.test_code.toLowerCase().includes(normalizedQuery);

      const matchesTest =
        testFilter === "all" || attempt.test_code === testFilter;

      const matchesMode =
        modeFilter === "all" || attempt.input_mode === modeFilter;

      const matchesStatus =
        statusFilter === "all" || attempt.status === statusFilter;

      const matchesResult =
        resultFilter === "all" ||
        (resultFilter === "pass" && attempt.passed === true) ||
        (resultFilter === "fail" && attempt.passed === false) ||
        (resultFilter === "unscored" &&
          (attempt.total_score === null ||
            attempt.ai_status !== "completed"));

      return (
        matchesQuery &&
        matchesTest &&
        matchesMode &&
        matchesStatus &&
        matchesResult
      );
    });

    filtered.sort((a, b) => {
      const studentA =
        studentMap.get(a.student_id)?.display_name ?? "";
      const studentB =
        studentMap.get(b.student_id)?.display_name ?? "";

      switch (sortKey) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "score_high":
          return (b.total_score ?? -1) - (a.total_score ?? -1);

        case "score_low":
          return (a.total_score ?? 999) - (b.total_score ?? 999);

        case "student":
          return studentA.localeCompare(studentB, "zh-Hant");

        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });

    return filtered;
  }, [
    attempts,
    studentMap,
    query,
    testFilter,
    modeFilter,
    resultFilter,
    statusFilter,
    sortKey,
  ]);

  const completedAttempts = useMemo(
    () =>
      attempts.filter(
        (attempt) =>
          attempt.status === "completed" &&
          attempt.total_score !== null
      ),
    [attempts]
  );

  const stats = useMemo(() => {
    const completed = completedAttempts.length;

    const average =
      completed > 0
        ? completedAttempts.reduce(
            (sum, attempt) => sum + (attempt.total_score ?? 0),
            0
          ) / completed
        : 0;

    const passed = completedAttempts.filter(
      (attempt) => attempt.passed === true
    ).length;

    const passRate =
      completed > 0 ? (passed / completed) * 100 : 0;

    const paperCount = attempts.filter(
      (attempt) => attempt.input_mode === "paper"
    ).length;

    const lowConfidence = attempts.filter(
      (attempt) =>
        attempt.input_mode === "paper" &&
        attempt.transcription_confidence === "low"
    ).length;

    return {
      total: attempts.length,
      completed,
      average,
      passRate,
      paperCount,
      lowConfidence,
    };
  }, [attempts, completedAttempts]);

  const studentSummaries = useMemo(() => {
    return students
      .map((student) => {
        const studentAttempts = completedAttempts.filter(
          (attempt) => attempt.student_id === student.id
        );

        if (studentAttempts.length === 0) {
          return {
            student,
            attempts: 0,
            average: null as number | null,
            best: null as number | null,
            passRate: null as number | null,
            latest: null as WritingAttempt | null,
          };
        }

        const total = studentAttempts.reduce(
          (sum, attempt) => sum + (attempt.total_score ?? 0),
          0
        );

        const passed = studentAttempts.filter(
          (attempt) => attempt.passed === true
        ).length;

        const latest = [...studentAttempts].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )[0];

        return {
          student,
          attempts: studentAttempts.length,
          average: total / studentAttempts.length,
          best: Math.max(
            ...studentAttempts.map(
              (attempt) => attempt.total_score ?? 0
            )
          ),
          passRate: (passed / studentAttempts.length) * 100,
          latest,
        };
      })
      .filter((row) => row.attempts > 0)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  }, [students, completedAttempts]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/teacher-login");
    router.refresh();
  }

  if (loading) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          正在載入 Writing Teacher Dashboard...
        </div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main style={centerPageStyle}>
        <div style={centerCardStyle}>
          <h1>無法載入老師後台</h1>
          <p style={{ color: "#b91c1c", lineHeight: 1.7 }}>
            {errorText}
          </p>
          <button onClick={() => void loadData()} style={primaryButtonStyle}>
            重新載入
          </button>
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
      <div style={{ maxWidth: "1380px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
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

            <h1 style={{ margin: "7px 0 4px" }}>
              Teacher Dashboard
            </h1>

            <p style={{ margin: 0, color: "#64748b" }}>
              中級寫作測驗 · 學生成績、作答模式與 AI 評分管理
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => void loadData()}
              style={secondaryButtonStyle}
            >
              ↻ 更新資料
            </button>

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
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <StatCard
            label="Total Attempts"
            value={String(stats.total)}
            hint="所有寫作紀錄"
          />

          <StatCard
            label="Completed"
            value={String(stats.completed)}
            hint="AI 評分完成"
          />

          <StatCard
            label="Average Score"
            value={
              stats.completed > 0
                ? `${stats.average.toFixed(1)}`
                : "-"
            }
            hint="/ 100"
          />

          <StatCard
            label="Pass Rate"
            value={
              stats.completed > 0
                ? `${stats.passRate.toFixed(1)}%`
                : "-"
            }
            hint="80 分以上"
          />

          <StatCard
            label="Paper Mode"
            value={String(stats.paperCount)}
            hint="紙筆作答"
          />

          <StatCard
            label="Low Confidence"
            value={String(stats.lowConfidence)}
            hint="建議老師核對手寫稿"
            warning={stats.lowConfidence > 0}
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
              <h2 style={{ margin: 0 }}>Writing Attempts</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                點選「查看報告」可查看原始答案、AI Transcript、
                訂正與評語。
              </p>
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              顯示 {filteredAttempts.length} / {attempts.length} 筆
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋學生姓名 / 代碼 / Test..."
              style={inputStyle}
            />

            <select
              value={testFilter}
              onChange={(event) => setTestFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">全部測驗</option>
              {testCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <select
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">全部作答方式</option>
              <option value="computer">💻 Computer</option>
              <option value="paper">✍️ Paper</option>
            </select>

            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">全部成績</option>
              <option value="pass">PASS</option>
              <option value="fail">FAIL</option>
              <option value="unscored">尚未評分</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">全部狀態</option>
              <option value="in_progress">作答中</option>
              <option value="awaiting_upload">等待照片</option>
              <option value="submitted">已繳交</option>
              <option value="transcribing">手寫辨識中</option>
              <option value="evaluating">AI 評分中</option>
              <option value="completed">完成</option>
              <option value="transcription_failed">辨識失敗</option>
              <option value="evaluation_failed">評分失敗</option>
            </select>

            <select
              value={sortKey}
              onChange={(event) =>
                setSortKey(event.target.value as SortKey)
              }
              style={inputStyle}
            >
              <option value="newest">最新優先</option>
              <option value="oldest">最舊優先</option>
              <option value="score_high">分數高 → 低</option>
              <option value="score_low">分數低 → 高</option>
              <option value="student">學生姓名</option>
            </select>
          </div>

          <div style={{ overflowX: "auto", marginTop: "20px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1120px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Student",
                    "Test",
                    "Mode",
                    "Status",
                    "Translation",
                    "Essay",
                    "Total",
                    "Result",
                    "Time",
                    "Submitted",
                    "AI",
                    "Report",
                  ].map((title) => (
                    <th key={title} style={thStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        padding: "35px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      找不到符合條件的寫作紀錄。
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((attempt) => {
                    const student = studentMap.get(
                      attempt.student_id
                    );

                    return (
                      <tr key={attempt.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>
                            {student?.display_name ?? "Unknown"}
                          </div>
                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: "12px",
                              marginTop: "3px",
                            }}
                          >
                            {student?.student_code ?? "-"}
                          </div>
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
                          <StatusBadge
                            status={attempt.status}
                            label={statusLabel(attempt.status)}
                          />

                          {attempt.transcription_confidence ===
                            "low" && (
                            <div
                              style={{
                                marginTop: "5px",
                                color: "#c2410c",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              ⚠ Low confidence
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {attempt.translation_score !== null ? (
                            <>
                              <strong>
                                {attempt.translation_score}/40
                              </strong>
                              <div style={subtleTextStyle}>
                                Level{" "}
                                {attempt.translation_level ?? "-"}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={tdStyle}>
                          {attempt.essay_score !== null ? (
                            <>
                              <strong>
                                {attempt.essay_score}/60
                              </strong>
                              <div style={subtleTextStyle}>
                                Level {attempt.essay_level ?? "-"}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={tdStyle}>
                          {attempt.total_score !== null ? (
                            <strong
                              style={{
                                fontSize: "18px",
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
                          {attempt.passed === true ? (
                            <ResultBadge pass />
                          ) : attempt.passed === false &&
                            attempt.total_score !== null ? (
                            <ResultBadge pass={false} />
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={tdStyle}>
                          {formatElapsed(attempt.elapsed_seconds)}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(attempt.submitted_at)}
                        </td>

                        <td style={tdStyle}>
                          <div>
                            {aiStatusLabel(attempt.ai_status)}
                          </div>

                          {attempt.ai_error_message && (
                            <div
                              title={attempt.ai_error_message}
                              style={{
                                color: "#dc2626",
                                fontSize: "12px",
                                marginTop: "4px",
                                maxWidth: "160px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {attempt.ai_error_message}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <Link
                            href={`/teacher/writing/${attempt.id}`}
                            style={reportLinkStyle}
                          >
                            查看報告
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

        <section style={sectionStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Student Summary</h2>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              只統計已完成 AI 評分的 Writing Attempts。
            </p>
          </div>

          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "800px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Student",
                    "Attempts",
                    "Average",
                    "Best",
                    "Pass Rate",
                    "Latest Score",
                    "Progress",
                  ].map((title) => (
                    <th key={title} style={thStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {studentSummaries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      尚無已完成的 Writing 成績。
                    </td>
                  </tr>
                ) : (
                  studentSummaries.map((row) => (
                    <tr key={row.student.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800 }}>
                          {row.student.display_name}
                        </div>
                        <div style={subtleTextStyle}>
                          {row.student.student_code}
                        </div>
                      </td>

                      <td style={tdStyle}>{row.attempts}</td>

                      <td style={tdStyle}>
                        <strong>
                          {row.average?.toFixed(1) ?? "-"}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {row.best ?? "-"}
                      </td>

                      <td style={tdStyle}>
                        {row.passRate !== null
                          ? `${row.passRate.toFixed(1)}%`
                          : "-"}
                      </td>

                      <td style={tdStyle}>
                        {row.latest ? (
                          <Link
                            href={`/teacher/writing/${row.latest.id}`}
                            style={{
                              color:
                                row.latest.passed === true
                                  ? "#15803d"
                                  : "#dc2626",
                              fontWeight: 800,
                              textDecoration: "none",
                            }}
                          >
                            {row.latest.total_score ?? "-"} / 100
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td style={tdStyle}>
                        <Link
                          href={`/teacher/student/${row.student.id}/progress`}
                          style={progressLinkStyle}
                        >
                          Progress 分析
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  warning = false,
}: {
  label: string;
  value: string;
  hint: string;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        background: warning ? "#fff7ed" : "white",
        border: warning
          ? "1px solid #fed7aa"
          : "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 5px 16px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          color: warning ? "#9a3412" : "#64748b",
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
          color: warning ? "#c2410c" : "#0f172a",
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: warning ? "#9a3412" : "#94a3b8",
          fontSize: "12px",
          marginTop: "4px",
        }}
      >
        {hint}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  let background = "#f1f5f9";
  let color = "#475569";

  if (status === "completed") {
    background = "#dcfce7";
    color = "#166534";
  } else if (
    status === "evaluation_failed" ||
    status === "transcription_failed"
  ) {
    background = "#fef2f2";
    color = "#b91c1c";
  } else if (
    status === "transcribing" ||
    status === "evaluating"
  ) {
    background = "#eff6ff";
    color = "#1d4ed8";
  } else if (status === "awaiting_upload") {
    background = "#fff7ed";
    color = "#c2410c";
  }

  return (
    <span
      style={{
        display: "inline-block",
        background,
        color,
        padding: "5px 8px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function ResultBadge({ pass }: { pass: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: pass ? "#dcfce7" : "#fee2e2",
        color: pass ? "#166534" : "#b91c1c",
        padding: "5px 9px",
        borderRadius: "999px",
        fontWeight: 900,
        fontSize: "12px",
      }}
    >
      {pass ? "PASS" : "FAIL"}
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "white",
  color: "#0f172a",
  fontSize: "14px",
};

const thStyle = {
  padding: "12px 10px",
  borderBottom: "2px solid #cbd5e1",
  background: "#f8fafc",
  textAlign: "left" as const,
  fontSize: "12px",
  color: "#475569",
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "13px 10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
  fontSize: "13px",
};

const subtleTextStyle = {
  color: "#94a3b8",
  fontSize: "12px",
  marginTop: "3px",
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

const primaryButtonStyle = {
  padding: "12px 20px",
  border: "none",
  borderRadius: "9px",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
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

const logoutButtonStyle = {
  padding: "10px 15px",
  border: "1px solid #fecaca",
  borderRadius: "9px",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  padding: "10px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "white",
  color: "#334155",
  fontWeight: 700,
};


const progressLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  background: "#eef2ff",
  color: "#3730a3",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "1px solid #c7d2fe",
  fontWeight: 800,
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};
