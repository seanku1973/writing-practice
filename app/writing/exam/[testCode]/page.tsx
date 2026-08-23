"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnswerMode = "computer" | "paper";

type ExamTest = {
  code: string;
  exerciseLabel: string;
  title: string;
  durationSeconds: number;
  translation: {
    title: string;
    instruction: string;
    prompt: string;
  };
  essay: {
    title: string;
    instruction: string;
    prompt: string;
    questions: string[];
  };
};

function countWords(text: string) {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

function countSentences(text: string) {
  const clean = text.trim();
  if (!clean) return 0;

  const matches = clean.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 0;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

export default function WritingTestPage() {
  const router = useRouter();
  const params = useParams();
  const testCode = String(params.testCode ?? "");

  const [test, setTest] = useState<ExamTest | null>(null);

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [mode, setMode] = useState<AnswerMode | null>(null);

  const [started, setStarted] = useState(false);
  const [writingEnded, setWritingEnded] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(2400);

  const [translationAnswer, setTranslationAnswer] = useState("");
  const [essayAnswer, setEssayAnswer] = useState("");

  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [ending, setEnding] = useState(false);

  const [paperFiles, setPaperFiles] = useState<File[]>([]);
  const [paperPreviews, setPaperPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [aiPhase, setAiPhase] = useState<
    "idle" | "processing" | "completed" | "error"
  >("idle");
  const [aiMessage, setAiMessage] = useState("");

  const endTimeRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const paperPreviewsRef = useRef<string[]>([]);

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
          action: "get_test",
          testCode,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.test) {
        router.replace("/writing/unlock");
        return;
      }

      const loadedTest = result.test as ExamTest;

      setTest(loadedTest);
      setSecondsLeft(loadedTest.durationSeconds);
      setMode(savedMode);
      setStudentName(
        localStorage.getItem("student_name") ?? ""
      );
      setLoading(false);
    }

    void initialize();
  }, [router, testCode]);

  useEffect(() => {
    if (!started || writingEnded) return;

    const timer = window.setInterval(() => {
      if (!endTimeRef.current) return;

      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000)
      );

      setSecondsLeft(remaining);
    }, 250);

    return () => window.clearInterval(timer);
  }, [started, writingEnded]);

  useEffect(() => {
    if (
      !started ||
      writingEnded ||
      ending ||
      mode !== "computer" ||
      !attemptId
    ) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    setSaveStatus("尚未儲存");

    autosaveTimerRef.current = window.setTimeout(async () => {
      setSaveStatus("儲存中...");

      const { error } = await supabase
        .from("writing_attempts")
        .update({
          translation_text: translationAnswer,
          essay_text: essayAnswer,
          translation_word_count: countWords(translationAnswer),
          essay_word_count: countWords(essayAnswer),
          essay_sentence_count: countSentences(essayAnswer),
        })
        .eq("id", attemptId);

      if (error) {
        console.error(error);
        setSaveStatus("⚠️ 儲存失敗");
        return;
      }

      setSaveStatus("✓ 已自動儲存");
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    translationAnswer,
    essayAnswer,
    started,
    writingEnded,
    ending,
    mode,
    attemptId,
  ]);

  useEffect(() => {
    paperPreviewsRef.current = paperPreviews;
  }, [paperPreviews]);

  useEffect(() => {
    return () => {
      paperPreviewsRef.current.forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, []);

  const calculateElapsedSeconds = useCallback((endedAtMs: number) => {
    if (!test) return 0;

    const startedAtText = localStorage.getItem("writing_started_at");
    const startedAtMs = startedAtText
      ? new Date(startedAtText).getTime()
      : endedAtMs;

    const raw = Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000));

    return Math.min(test.durationSeconds, raw);
  }, []);

  const endWriting = useCallback(
    async (automatic = false) => {
      if (!test || !mode || !attemptId || ending || writingEnded) return;

      if (!automatic) {
        const confirmed = window.confirm(
          mode === "computer"
            ? "確定要繳交測驗嗎？\n\n繳交後將不能再修改答案。"
            : "確定要結束作答嗎？\n\n結束後將不能再繼續書寫，接下來會進入答案卷拍照上傳。"
        );

        if (!confirmed) return;
      }

      setEnding(true);

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }

      const endedAtMs = Date.now();
      const endedAt = new Date(endedAtMs).toISOString();
      const elapsedSeconds = automatic
        ? test.durationSeconds
        : calculateElapsedSeconds(endedAtMs);

      try {
        if (mode === "computer") {
          setSaveStatus(
            automatic ? "時間到，正在自動繳交..." : "正在正式繳交..."
          );

          const { error } = await supabase
            .from("writing_attempts")
            .update({
              translation_text: translationAnswer,
              essay_text: essayAnswer,
              translation_word_count: countWords(translationAnswer),
              essay_word_count: countWords(essayAnswer),
              essay_sentence_count: countSentences(essayAnswer),
              writing_ended_at: endedAt,
              submitted_at: endedAt,
              elapsed_seconds: elapsedSeconds,
              status: "submitted",
              ai_status: "not_requested",
            })
            .eq("id", attemptId);

          if (error) throw error;

          localStorage.setItem("writing_ended_at", endedAt);
          localStorage.setItem("writing_submitted_at", endedAt);

          setSecondsLeft(automatic ? 0 : secondsLeft);
          setWritingEnded(true);
          setSubmissionComplete(true);
          setSaveStatus("✓ 已正式繳交");

          void runAiEvaluation(attemptId);
        } else {
          setUploadStatus(
            automatic ? "時間到，正在結束作答..." : "正在結束作答..."
          );

          const { error } = await supabase
            .from("writing_attempts")
            .update({
              writing_ended_at: endedAt,
              elapsed_seconds: elapsedSeconds,
              status: "awaiting_upload",
              transcription_status: "pending",
            })
            .eq("id", attemptId);

          if (error) throw error;

          localStorage.setItem("writing_ended_at", endedAt);

          setSecondsLeft(automatic ? 0 : secondsLeft);
          setWritingEnded(true);
          setUploadStatus("");
        }
      } catch (error) {
        console.error(error);
        alert(
          automatic
            ? "時間已到，但系統儲存作答狀態失敗。請保留此頁並通知老師。"
            : "繳交失敗，請檢查網路後再試一次。"
        );
      } finally {
        setEnding(false);
      }
    },
    [
      attemptId,
      calculateElapsedSeconds,
      ending,
      essayAnswer,
      mode,
      secondsLeft,
      translationAnswer,
      writingEnded,
    ]
  );

  useEffect(() => {
    if (
      started &&
      secondsLeft === 0 &&
      !writingEnded &&
      !ending &&
      attemptId &&
      mode
    ) {
      void endWriting(true);
    }
  }, [
    started,
    secondsLeft,
    writingEnded,
    ending,
    attemptId,
    mode,
    endWriting,
  ]);

  async function runAiEvaluation(currentAttemptId: string) {
    if (aiPhase === "processing") return;

    setAiPhase("processing");
    setAiMessage(
      mode === "paper"
        ? "正在辨識手寫答案並依正式標準評分..."
        : "正在依正式寫作評分標準進行 AI 評分..."
    );

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("登入狀態已失效，請重新登入。");
      }

      const response = await fetch("/api/evaluate-writing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          attemptId: currentAttemptId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "OpenAI 寫作評分失敗。"
        );
      }

      setAiPhase("completed");
      setAiMessage("✓ AI 評分完成，正在開啟成績報告...");

      router.push(`/writing/result/${currentAttemptId}`);
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "AI 評分失敗。";

      setAiPhase("error");
      setAiMessage(message);
    }
  }

  async function consumeProctorAuthorization() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("學生登入狀態已失效。");
    }

    const response = await fetch("/api/exam-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "consume",
        testCode,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
          "監考老師授權已過期，請重新授權。"
      );
    }
  }

  async function startTest() {
    if (!test || !mode) return;

    setSaving(true);
    setSaveStatus("正在建立測驗紀錄...");

    try {
      await consumeProctorAuthorization();

      const studentId = localStorage.getItem("student_id");

      if (!studentId) {
        alert("找不到學生資料，請重新登入。");
        router.replace("/login");
        return;
      }

      const startTime = Date.now();
      const endTime = startTime + test.durationSeconds * 1000;
      const startedAt = new Date(startTime).toISOString();

      const { data, error } = await supabase
        .from("writing_attempts")
        .insert({
          student_id: studentId,
          test_code: test.code,
          input_mode: mode,
          status: "in_progress",
          started_at: startedAt,
          transcription_status:
            mode === "paper" ? "pending" : "not_required",
          ai_status: "not_requested",
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert(`無法開始測驗：${error.message}`);
        return;
      }

      setAttemptId(data.id);

      localStorage.setItem("writing_attempt_id", data.id);
      localStorage.setItem("writing_started_at", startedAt);
      localStorage.setItem(
        "writing_expected_end_at",
        new Date(endTime).toISOString()
      );

      endTimeRef.current = endTime;
      setSecondsLeft(test.durationSeconds);
      setStarted(true);
      setSaveStatus("");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "開始測驗時發生錯誤。"
      );

      router.replace("/writing/unlock");
    } finally {
      setSaving(false);
    }
  }

  function handlePaperFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    if (!selected.length) return;

    setUploadError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const validFiles: File[] = [];

    for (const file of selected) {
      if (!allowedTypes.includes(file.type)) {
        setUploadError("只能上傳 JPG、PNG 或 WEBP 圖片。");
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setUploadError("每張圖片大小不可超過 10 MB。");
        continue;
      }

      validFiles.push(file);
    }

    const remainingSlots = Math.max(0, 10 - paperFiles.length);
    const filesToAdd = validFiles.slice(0, remainingSlots);

    if (validFiles.length > remainingSlots) {
      setUploadError("答案卷最多上傳 10 張圖片。");
    }

    if (!filesToAdd.length) {
      event.target.value = "";
      return;
    }

    const newPreviews = filesToAdd.map((file) =>
      URL.createObjectURL(file)
    );

    setPaperFiles((current) => [...current, ...filesToAdd]);
    setPaperPreviews((current) => [...current, ...newPreviews]);

    event.target.value = "";
  }

  function removePaperFile(index: number) {
    URL.revokeObjectURL(paperPreviews[index]);

    setPaperFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index)
    );

    setPaperPreviews((current) =>
      current.filter((_, previewIndex) => previewIndex !== index)
    );
  }

  async function submitPaperAnswers() {
    if (!attemptId || mode !== "paper" || uploading) return;

    if (!paperFiles.length) {
      setUploadError("請至少上傳一張答案卷照片。");
      return;
    }

    const confirmed = window.confirm(
      `目前共有 ${paperFiles.length} 張答案卷照片。\n\n請確認照片清楚、方向正確、沒有缺頁。確定正式繳交嗎？`
    );

    if (!confirmed) return;

    const studentId = localStorage.getItem("student_id");

    if (!studentId) {
      alert("找不到學生資料，請重新登入。");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadStatus("正在上傳答案卷...");

    const uploadedPaths: string[] = [];

    try {
      for (let index = 0; index < paperFiles.length; index += 1) {
        const file = paperFiles[index];
        const extension = getFileExtension(file);

        const path = `${studentId}/${attemptId}/page-${String(
          index + 1
        ).padStart(2, "0")}.${extension}`;

        setUploadStatus(
          `正在上傳第 ${index + 1} / ${paperFiles.length} 張...`
        );

        const { error } = await supabase.storage
          .from("writing-answers")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (error) throw error;

        uploadedPaths.push(path);
      }

      const submittedAt = new Date().toISOString();

      setUploadStatus("照片上傳完成，正在完成繳交...");

      const { error: updateError } = await supabase
        .from("writing_attempts")
        .update({
          paper_bucket: "writing-answers",
          paper_image_paths: uploadedPaths,
          submitted_at: submittedAt,
          status: "submitted",
          transcription_status: "pending",
          ai_status: "not_requested",
        })
        .eq("id", attemptId);

      if (updateError) throw updateError;

      localStorage.setItem("writing_submitted_at", submittedAt);

      setUploadStatus("✓ 答案卷已正式繳交");
      setSubmissionComplete(true);

      void runAiEvaluation(attemptId);
    } catch (error) {
      console.error(error);

      if (uploadedPaths.length) {
        await supabase.storage
          .from("writing-answers")
          .remove(uploadedPaths);
      }

      setUploadStatus("");
      setUploadError(
        "答案卷上傳或繳交失敗。請檢查網路後再試一次。"
      );
    } finally {
      setUploading(false);
    }
  }

  if (!test) {
    return <main>找不到指定的 Writing Exercise。</main>;
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f1f5f9",
        }}
      >
        載入中...
      </main>
    );
  }

  if (!started) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #eef4ff, #f8fafc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "760px",
            background: "white",
            padding: "46px",
            borderRadius: "22px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#2563eb",
              fontWeight: 800,
              letterSpacing: "1px",
            }}
          >
            {test.exerciseLabel.toUpperCase()}
          </div>

          <h1
            style={{
              color: "#0f172a",
              marginBottom: "8px",
            }}
          >
            {test.title}
          </h1>

          <div
            style={{
              fontSize: "18px",
              color: "#475569",
              marginBottom: "28px",
            }}
          >
            {studentName || "Student"}
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "15px",
              padding: "22px",
              lineHeight: 1.9,
            }}
          >
            <strong>作答方式：</strong>
            {mode === "computer"
              ? " 💻 電腦作答"
              : " ✍️ 紙筆作答"}

            <br />

            <strong>測驗時間：</strong>
            40 分鐘

            <br />

            <strong>第一部分：</strong>
            中譯英 40%

            <br />

            <strong>第二部分：</strong>
            英文作文 60%
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "17px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "12px",
              color: "#9a3412",
              lineHeight: 1.7,
            }}
          >
            按下 START 後，40 分鐘倒數會立即開始。
            <br />
            測驗開始後不可更改作答模式。
          </div>

          <button
            onClick={startTest}
            disabled={saving}
            style={{
              marginTop: "30px",
              minWidth: "240px",
              padding: "17px 30px",
              border: "none",
              borderRadius: "12px",
              background: saving ? "#94a3b8" : "#16a34a",
              color: "white",
              fontSize: "20px",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving
                ? "none"
                : "0 8px 20px rgba(22,163,74,0.22)",
            }}
          >
            {saving ? "建立測驗中..." : "START 開始測驗"}
          </button>

          {saveStatus && (
            <div
              style={{
                marginTop: "12px",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {saveStatus}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (writingEnded) {
    if (mode === "computer") {
      return (
        <main style={finishedPageStyle}>
          <section style={finishedCardStyle}>
            <div style={{ fontSize: "56px" }}>✅</div>

            <h1 style={{ color: "#0f172a", marginBottom: "10px" }}>
              測驗已繳交
            </h1>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              電腦作答內容已鎖定並儲存至系統。
            </p>

            <div style={summaryBoxStyle}>
              中譯英：{countWords(translationAnswer)} words
              <br />
              英文作文：{countWords(essayAnswer)} words
              <br />
              作文句數：{countSentences(essayAnswer)} sentences
            </div>

            <div style={successNoticeStyle}>
              {submissionComplete
                ? "✓ 正式繳交完成"
                : "正在完成繳交..."}
            </div>

            <AiStatusPanel
              phase={aiPhase}
              message={aiMessage}
              onRetry={() =>
                attemptId && void runAiEvaluation(attemptId)
              }
            />
          </section>
        </main>
      );
    }

    if (submissionComplete) {
      return (
        <main style={finishedPageStyle}>
          <section style={finishedCardStyle}>
            <div style={{ fontSize: "56px" }}>✅</div>

            <h1 style={{ color: "#0f172a", marginBottom: "10px" }}>
              答案卷已繳交
            </h1>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              共上傳 {paperFiles.length} 張答案卷照片。
              <br />
              原始照片已安全儲存在系統中。
            </p>

            <div style={successNoticeStyle}>
              ✓ 正式繳交完成
            </div>

            <AiStatusPanel
              phase={aiPhase}
              message={aiMessage}
              onRetry={() =>
                attemptId && void runAiEvaluation(attemptId)
              }
            />
          </section>
        </main>
      );
    }

    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          padding: "34px 20px 70px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <section
          style={{
            maxWidth: "920px",
            margin: "0 auto",
            background: "white",
            padding: "38px",
            borderRadius: "22px",
            boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "52px" }}>📷</div>

            <h1 style={{ color: "#0f172a", marginBottom: "8px" }}>
              作答時間已結束
            </h1>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              請停止書寫，現在拍攝並上傳完整答案卷。
              <br />
              <strong style={{ color: "#9a3412" }}>
                拍照與上傳時間不計入 40 分鐘作答時間。
              </strong>
            </p>
          </div>

          <div
            style={{
              marginTop: "28px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "14px",
              padding: "18px 22px",
              color: "#9a3412",
              lineHeight: 1.8,
            }}
          >
            上傳前請確認：
            <br />
            ✓ 所有答案頁都已拍攝
            <br />
            ✓ 文字清楚、沒有反光
            <br />
            ✓ 沒有裁掉上下左右內容
            <br />
            ✓ 照片方向正確
          </div>

          <div style={{ marginTop: "28px", textAlign: "center" }}>
            <label
              htmlFor="paper-answer-upload"
              style={{
                display: "inline-block",
                padding: "15px 26px",
                borderRadius: "11px",
                background: "#2563eb",
                color: "white",
                fontWeight: 800,
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              📷 拍照 / 選擇答案卷照片
            </label>

            <input
              id="paper-answer-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              disabled={uploading}
              onChange={handlePaperFiles}
              style={{ display: "none" }}
            />

            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginTop: "10px",
              }}
            >
              JPG / PNG / WEBP，每張最多 10 MB，最多 10 張
            </div>
          </div>

          {uploadError && (
            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              {uploadError}
            </div>
          )}

          {paperFiles.length > 0 && (
            <>
              <div
                style={{
                  marginTop: "32px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <h2 style={{ margin: 0, color: "#0f172a" }}>
                  答案卷預覽
                </h2>

                <div
                  style={{
                    color: "#2563eb",
                    fontWeight: 800,
                  }}
                >
                  {paperFiles.length} 張
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "18px",
                }}
              >
                {paperFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      overflow: "hidden",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={paperPreviews[index]}
                      alt={`答案卷第 ${index + 1} 頁`}
                      style={{
                        width: "100%",
                        height: "260px",
                        objectFit: "contain",
                        background: "#e2e8f0",
                        display: "block",
                      }}
                    />

                    <div style={{ padding: "13px" }}>
                      <div
                        style={{
                          color: "#0f172a",
                          fontWeight: 800,
                        }}
                      >
                        Page {index + 1}
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginTop: "4px",
                          wordBreak: "break-all",
                        }}
                      >
                        {file.name}
                      </div>

                      <button
                        type="button"
                        onClick={() => removePaperFile(index)}
                        disabled={uploading}
                        style={{
                          width: "100%",
                          marginTop: "10px",
                          padding: "9px",
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: "#dc2626",
                          borderRadius: "8px",
                          fontWeight: 700,
                          cursor: uploading ? "not-allowed" : "pointer",
                        }}
                      >
                        移除此頁
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: "center", marginTop: "30px" }}>
                <button
                  onClick={submitPaperAnswers}
                  disabled={uploading || paperFiles.length === 0}
                  style={{
                    minWidth: "250px",
                    padding: "16px 28px",
                    border: "none",
                    borderRadius: "11px",
                    background: uploading ? "#94a3b8" : "#16a34a",
                    color: "white",
                    fontWeight: 800,
                    fontSize: "18px",
                    cursor: uploading ? "not-allowed" : "pointer",
                  }}
                >
                  {uploading
                    ? "正在上傳..."
                    : "確認答案無誤，正式繳交"}
                </button>

                {uploadStatus && (
                  <div
                    style={{
                      marginTop: "13px",
                      color: "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    {uploadStatus}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.96)",
          borderBottom: "1px solid #e2e8f0",
          padding: "14px 22px",
        }}
      >
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {test.title}
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginTop: "3px",
              }}
            >
              {mode === "computer"
                ? "💻 Computer Mode"
                : "✍️ Paper Mode"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <Timer secondsLeft={secondsLeft} />

            {mode === "computer" && (
              <div
                style={{
                  fontSize: "12px",
                  color:
                    saveStatus === "⚠️ 儲存失敗"
                      ? "#dc2626"
                      : "#64748b",
                  marginTop: "5px",
                }}
              >
                {saveStatus}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "30px 20px 80px",
        }}
      >
        <section style={sectionStyle}>
          <div style={partLabelStyle}>PART 1 · 40%</div>

          <h2
            style={{
              color: "#0f172a",
              marginTop: "8px",
            }}
          >
            {test.translation.title}
          </h2>

          <p style={instructionStyle}>
            {test.translation.instruction}
          </p>

          <div style={promptStyle}>
            {test.translation.prompt}
          </div>

          {mode === "computer" ? (
            <>
              <textarea
                value={translationAnswer}
                onChange={(e) =>
                  setTranslationAnswer(e.target.value)
                }
                placeholder="請在此輸入英文翻譯..."
                disabled={ending}
                style={{
                  ...textareaStyle,
                  minHeight: "210px",
                }}
              />

              <div style={counterStyle}>
                Words: {countWords(translationAnswer)}
              </div>
            </>
          ) : (
            <PaperMessage />
          )}
        </section>

        <section
          style={{
            ...sectionStyle,
            marginTop: "28px",
          }}
        >
          <div style={partLabelStyle}>PART 2 · 60%</div>

          <h2
            style={{
              color: "#0f172a",
              marginTop: "8px",
            }}
          >
            {test.essay.title}
          </h2>

          <p style={instructionStyle}>
            {test.essay.instruction}
          </p>

          <div style={promptStyle}>
            <div
              style={{
                marginBottom: "12px",
              }}
            >
              {test.essay.prompt}
            </div>

            <ol
              style={{
                margin: 0,
                paddingLeft: "22px",
              }}
            >
              {test.essay.questions.map((question) => (
                <li
                  key={question}
                  style={{
                    marginBottom: "7px",
                  }}
                >
                  {question}
                </li>
              ))}
            </ol>
          </div>

          {mode === "computer" ? (
            <>
              <textarea
                value={essayAnswer}
                onChange={(e) =>
                  setEssayAnswer(e.target.value)
                }
                placeholder="請在此輸入英文作文..."
                disabled={ending}
                style={{
                  ...textareaStyle,
                  minHeight: "360px",
                }}
              />

              <div
                style={{
                  ...counterStyle,
                  display: "flex",
                  gap: "18px",
                  flexWrap: "wrap",
                }}
              >
                <span>Words: {countWords(essayAnswer)}</span>

                <span>
                  Sentences: {countSentences(essayAnswer)}
                </span>

                <span>Target: about 120 words</span>
              </div>
            </>
          ) : (
            <PaperMessage />
          )}
        </section>

        <div
          style={{
            marginTop: "32px",
            textAlign: "center",
          }}
        >
          <button
            onClick={() => void endWriting(false)}
            disabled={ending}
            style={{
              minWidth: "220px",
              padding: "16px 30px",
              background: ending ? "#94a3b8" : "#dc2626",
              border: "none",
              borderRadius: "11px",
              color: "white",
              fontWeight: 800,
              fontSize: "18px",
              cursor: ending ? "not-allowed" : "pointer",
            }}
          >
            {ending ? "處理中..." : "繳交 HAND IN"}
          </button>

          <div
            style={{
              marginTop: "10px",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            {mode === "computer"
              ? "按下後將鎖定答案並正式繳交"
              : "按下後將結束書寫並進入答案卷上傳"}
          </div>
        </div>
      </div>
    </main>
  );
}

function AiStatusPanel({
  phase,
  message,
  onRetry,
}: {
  phase: "idle" | "processing" | "completed" | "error";
  message: string;
  onRetry: () => void;
}) {
  if (phase === "error") {
    return (
      <div style={{ marginTop: "24px" }}>
        <div
          style={{
            padding: "14px",
            borderRadius: "10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            lineHeight: 1.6,
          }}
        >
          AI 評分未完成：{message}
        </div>

        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: "16px",
            padding: "13px 24px",
            border: "none",
            borderRadius: "10px",
            background: "#2563eb",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          重新執行 AI 評分
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "24px",
        padding: "16px",
        borderRadius: "10px",
        background:
          phase === "completed" ? "#f0fdf4" : "#eff6ff",
        border:
          phase === "completed"
            ? "1px solid #bbf7d0"
            : "1px solid #bfdbfe",
        color:
          phase === "completed" ? "#166534" : "#1d4ed8",
        fontWeight: 700,
        lineHeight: 1.7,
      }}
    >
      {phase === "processing" && "⏳ "}
      {message || "正在準備 AI 評分..."}
    </div>
  );
}

function Timer({ secondsLeft }: { secondsLeft: number }) {
  let background = "#dcfce7";
  let color = "#166534";
  let border = "#bbf7d0";

  if (secondsLeft <= 300) {
    background = "#fff7ed";
    color = "#c2410c";
    border = "#fed7aa";
  }

  if (secondsLeft <= 60) {
    background = "#fef2f2";
    color = "#dc2626";
    border = "#fecaca";
  }

  return (
    <div
      style={{
        minWidth: "130px",
        textAlign: "center",
        background,
        color,
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "9px 16px",
        fontSize: "26px",
        fontWeight: 900,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatTime(secondsLeft)}
    </div>
  );
}

function PaperMessage() {
  return (
    <div
      style={{
        marginTop: "20px",
        padding: "26px",
        borderRadius: "14px",
        border: "2px dashed #94a3b8",
        background: "#f8fafc",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "32px",
          marginBottom: "8px",
        }}
      >
        ✍️
      </div>

      <strong style={{ color: "#0f172a" }}>
        請在答案紙上作答
      </strong>

      <div
        style={{
          color: "#64748b",
          marginTop: "7px",
          fontSize: "14px",
        }}
      >
        此模式不提供鍵盤輸入欄位
      </div>
    </div>
  );
}

const sectionStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "32px",
  boxShadow: "0 5px 18px rgba(15,23,42,0.05)",
};

const partLabelStyle = {
  display: "inline-block",
  padding: "6px 11px",
  background: "#eff6ff",
  color: "#2563eb",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 800,
};

const instructionStyle = {
  color: "#475569",
  lineHeight: 1.8,
  fontSize: "15px",
};

const promptStyle = {
  marginTop: "18px",
  padding: "22px",
  borderRadius: "13px",
  background: "#f8fafc",
  borderLeft: "5px solid #2563eb",
  color: "#0f172a",
  lineHeight: 1.9,
  fontSize: "17px",
};

const textareaStyle = {
  width: "100%",
  marginTop: "22px",
  padding: "18px",
  border: "2px solid #cbd5e1",
  borderRadius: "12px",
  resize: "vertical" as const,
  fontFamily: "Arial, sans-serif",
  fontSize: "17px",
  lineHeight: 1.8,
  color: "#0f172a",
  boxSizing: "border-box" as const,
  outline: "none",
};

const counterStyle = {
  color: "#64748b",
  fontSize: "13px",
  marginTop: "9px",
  textAlign: "right" as const,
};

const finishedPageStyle = {
  minHeight: "100vh",
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "30px 20px",
  fontFamily: "Arial, sans-serif",
};

const finishedCardStyle = {
  width: "100%",
  maxWidth: "720px",
  background: "white",
  padding: "48px",
  borderRadius: "22px",
  textAlign: "center" as const,
  boxShadow: "0 15px 45px rgba(15,23,42,0.10)",
};

const summaryBoxStyle = {
  background: "#f8fafc",
  padding: "18px",
  borderRadius: "12px",
  marginTop: "22px",
  lineHeight: 1.8,
};

const successNoticeStyle = {
  marginTop: "20px",
  padding: "14px",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: "10px",
  fontWeight: 800,
};

