import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getServerWritingTest } from "@/lib/writingTests.server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-5.6-luna";
const PROMPT_VERSION = "writing-gept-v1";

type InputMode = "computer" | "paper";

type WritingAttempt = {
  id: string;
  student_id: string;
  test_code: string;
  input_mode: InputMode;
  status: string;
  translation_text: string | null;
  essay_text: string | null;
  paper_bucket: string | null;
  paper_image_paths: unknown;
  ai_status: string;
};

type WritingTest = {
  test_code: string;
  translation_prompt: string;
  essay_prompt: string;
};

type TranscriptionResult = {
  translation_text: string;
  essay_text: string;
  confidence: "high" | "medium" | "low";
  unclear_segments: string[];
};

type ErrorItem = {
  part: "translation" | "essay";
  original_excerpt: string;
  corrected_excerpt: string;
  category: string;
  explanation: string;
};

type EvaluationResult = {
  translation_level: number;
  translation_corrected: string;
  translation_feedback: string;

  essay_level: number;
  essay_corrected: string;
  essay_feedback: string;

  strengths: string;
  improvements: string;

  error_analysis: ErrorItem[];
};

function getSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

function normalizeLevel(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(numeric)));
}

function translationScore(level: number) {
  return normalizeLevel(level) * 8;
}

function essayScore(level: number) {
  return normalizeLevel(level) * 12;
}

function mimeFromPath(path: string) {
  const lower = path.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";

  return "image/jpeg";
}

function countSentences(text: string) {
  const clean = text.trim();

  if (!clean) return 0;

  const matches = clean.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 0;
}

function getPaperPaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.length > 0
  );
}

function transcriptionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      translation_text: {
        type: "string",
      },
      essay_text: {
        type: "string",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
      },
      unclear_segments: {
        type: "array",
        items: {
          type: "string",
        },
        maxItems: 20,
      },
    },
    required: [
      "translation_text",
      "essay_text",
      "confidence",
      "unclear_segments",
    ],
  };
}

function evaluationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      translation_level: {
        type: "integer",
        minimum: 0,
        maximum: 5,
      },
      translation_corrected: {
        type: "string",
      },
      translation_feedback: {
        type: "string",
      },

      essay_level: {
        type: "integer",
        minimum: 0,
        maximum: 5,
      },
      essay_corrected: {
        type: "string",
      },
      essay_feedback: {
        type: "string",
      },

      strengths: {
        type: "string",
      },
      improvements: {
        type: "string",
      },

      error_analysis: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            part: {
              type: "string",
              enum: ["translation", "essay"],
            },
            original_excerpt: {
              type: "string",
            },
            corrected_excerpt: {
              type: "string",
            },
            category: {
              type: "string",
            },
            explanation: {
              type: "string",
            },
          },
          required: [
            "part",
            "original_excerpt",
            "corrected_excerpt",
            "category",
            "explanation",
          ],
        },
      },
    },
    required: [
      "translation_level",
      "translation_corrected",
      "translation_feedback",
      "essay_level",
      "essay_corrected",
      "essay_feedback",
      "strengths",
      "improvements",
      "error_analysis",
    ],
  };
}

async function transcribePaperAnswers(
  supabase: ReturnType<typeof getSupabaseClient>,
  attempt: WritingAttempt,
  writingTest: WritingTest
): Promise<TranscriptionResult> {
  const bucket = attempt.paper_bucket || "writing-answers";
  const paths = getPaperPaths(attempt.paper_image_paths);

  if (!paths.length) {
    throw new Error("No paper answer images were found.");
  }

  const content: any[] = [
    {
      type: "input_text",
      text: `You are transcribing a student's handwritten English writing test.

This test has TWO sections:
1. Chinese-to-English translation.
2. English composition.

Translation source prompt (for locating the section only):
${writingTest.translation_prompt}

Essay prompt (for locating the section only):
${writingTest.essay_prompt}

CRITICAL TRANSCRIPTION RULES:
- Transcribe EXACTLY what the student wrote.
- Do NOT correct grammar.
- Do NOT correct spelling.
- Do NOT correct capitalization.
- Do NOT improve punctuation.
- Do NOT improve vocabulary or sentence structure.
- Do NOT invent words from the source prompt or from what you think the student intended.
- Keep the student's errors exactly as visible.
- Separate the result into translation_text and essay_text.
- If a word or phrase truly cannot be read, write [unclear] at that location.
- confidence describes the overall handwriting transcription reliability.
- unclear_segments should briefly list unreadable areas. Return an empty array if none.

The source prompts above are ONLY section-location hints. Never copy them into the student's answer.`,
    },
  ];

  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      throw new Error(
        `Failed to read answer image: ${error?.message ?? path}`
      );
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    const dataUrl = `data:${mimeFromPath(path)};base64,${bytes.toString(
      "base64"
    )}`;

    content.push({
      type: "input_image",
      image_url: dataUrl,
      detail: "high",
    });
  }

  const response = await openai.responses.create({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content:
          "You are a precise handwriting transcription engine for an English writing exam. Faithfulness to the student's actual writing is more important than grammatical correctness.",
      },
      {
        role: "user",
        content,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "writing_handwriting_transcription",
        strict: true,
        schema: transcriptionSchema(),
      },
    },
  });

  if (!response.output_text) {
    throw new Error("No handwriting transcription was produced.");
  }

  return JSON.parse(response.output_text) as TranscriptionResult;
}

async function evaluateWriting(
  writingTest: WritingTest,
  translationText: string,
  essayText: string
): Promise<EvaluationResult> {
  const response = await openai.responses.create({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content: `You are an assessment engine for a GEPT Intermediate-style English writing test.

The official test has two sections.

SECTION 1: Chinese-to-English translation, 40 points.
Choose exactly ONE level from 0 to 5:
Level 5 = Translation ability is strong. The content fully expresses the source meaning; organization and coherence are excellent; sentence structures are well controlled; word choice, grammar, spelling, punctuation, and capitalization are almost error-free.
Level 4 = Translation ability is adequate/good. The content appropriately expresses the source meaning; organization, coherence, and sentence structure are generally good; occasional language-mechanics errors do not prevent the meaning from being expressed.
Level 3 = Translation ability is limited. The content does not fully express the source meaning; organization is loose and coherence is insufficient; sentence structures are not fully controlled; errors sometimes interfere with meaning.
Level 2 = Slight translation ability. Only part of the source meaning is expressed; organization and coherence are poor; sentence structures are weak and much is difficult to understand; language-mechanics errors are serious.
Level 1 = No functional translation ability. The content fails to express the source meaning; sentence structure is poorly controlled and the response is not understandable; errors are numerous and severe.
Level 0 = No answer or effectively no assessable answer.

The SERVER converts the chosen translation level to the official score:
Level 0=0, 1=8, 2=16, 3=24, 4=32, 5=40.
Do NOT invent a different numeric score.

SECTION 2: English composition, 60 points.
Choose exactly ONE level from 0 to 5:
Level 5 = Writing ability is strong. Content appropriately fulfills the prompt and is clear and well organized; organization is excellent; vocabulary and sentence patterns are used flexibly; only occasional grammar, spelling, or punctuation errors occur.
Level 4 = Writing ability is adequate/good. Content fulfills the prompt and is generally clear; organization is generally complete; vocabulary and sentence patterns are correctly used; errors do not interfere with understanding.
Level 3 = Writing ability is limited. Content generally relates to the prompt but is not fully developed or fully clear; organization is acceptable; vocabulary and sentence patterns are not well controlled; errors are frequent enough to affect understanding.
Level 2 = Slight writing ability. Only part of the prompt is addressed and much is difficult to understand; organization is poor; vocabulary and sentence patterns are limited; many errors occur.
Level 1 = No functional writing ability. Content fails to fulfill the prompt and cannot be understood; organization is lacking; vocabulary and sentence patterns are extremely limited; errors are excessive.
Level 0 = No answer or effectively no assessable answer.

The SERVER converts the chosen essay level to the official score:
Level 0=0, 1=12, 2=24, 3=36, 4=48, 5=60.
Do NOT invent a different numeric score.

Additional grading rules:
- Grade the student's actual response, not whether it matches a model answer word-for-word.
- For translation, compare meaning against the Chinese source prompt.
- For the essay, assess whether both requested points are addressed.
- The target is about 120 words and about 8-12 sentences, but length alone must not determine the level.
- Do not reward complexity when it causes loss of clarity or correctness.
- Treat spelling, capitalization, punctuation, grammar, organization, content, and word choice according to the rubric.
- Feedback, strengths, improvements, category explanations: Traditional Chinese.
- Corrected versions: English.
- Corrected versions should preserve the student's intended content and wording as much as reasonably possible rather than rewriting into an unrelated advanced essay.
- If a section is genuinely unanswered or unassessable and receives Level 0, return an empty string for that section's corrected version.
- error_analysis should contain the most useful errors only, maximum 12. If there are no meaningful errors, return an empty array.`,
      },
      {
        role: "user",
        content: `TRANSLATION SOURCE:
${writingTest.translation_prompt}

STUDENT TRANSLATION:
${translationText || "[No answer]"}

ESSAY PROMPT:
${writingTest.essay_prompt}

STUDENT ESSAY:
${essayText || "[No answer]"}

Evaluate both sections using only the six-level rubrics above.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "gept_writing_evaluation",
        strict: true,
        schema: evaluationSchema(),
      },
    },
  });

  if (!response.output_text) {
    throw new Error("No writing evaluation was produced.");
  }

  return JSON.parse(response.output_text) as EvaluationResult;
}

export async function POST(request: Request) {
  let supabase:
    | ReturnType<typeof getSupabaseClient>
    | null = null;
  let attemptId = "";
  let stage: "authentication" | "transcription" | "evaluation" =
    "authentication";

  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY is missing from .env.local.",
        },
        { status: 500 }
      );
    }

    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return Response.json(
        { error: "Authentication is required." },
        { status: 401 }
      );
    }

    supabase = getSupabaseClient(accessToken);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return Response.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 }
      );
    }

    const body = await request.json();
    attemptId =
      typeof body?.attemptId === "string"
        ? body.attemptId.trim()
        : "";

    if (!attemptId) {
      return Response.json(
        { error: "attemptId is required." },
        { status: 400 }
      );
    }

    const { data: attemptData, error: attemptError } =
      await supabase
        .from("writing_attempts")
        .select(
          `
          id,
          student_id,
          test_code,
          input_mode,
          status,
          translation_text,
          essay_text,
          paper_bucket,
          paper_image_paths,
          ai_status
          `
        )
        .eq("id", attemptId)
        .single();

    if (attemptError || !attemptData) {
      return Response.json(
        {
          error:
            "Writing attempt was not found or you do not have permission to access it.",
        },
        { status: 404 }
      );
    }

    const attempt = attemptData as WritingAttempt;

    if (attempt.ai_status === "completed") {
      return Response.json({
        ok: true,
        already_completed: true,
        attempt_id: attempt.id,
      });
    }

    if (
      ![
        "submitted",
        "evaluation_failed",
        "transcription_failed",
      ].includes(attempt.status)
    ) {
      return Response.json(
        {
          error:
            "This attempt must be submitted before AI evaluation can run.",
        },
        { status: 409 }
      );
    }

    const serverTest = getServerWritingTest(
      attempt.test_code
    );

    if (!serverTest) {
      throw new Error(
        "The writing test prompts could not be loaded."
      );
    }

    const writingTest: WritingTest = {
      test_code: serverTest.code,
      translation_prompt:
        serverTest.translation.prompt,
      essay_prompt: [
        serverTest.essay.prompt,
        ...serverTest.essay.questions.map(
          (question, index) =>
            `(${index + 1}) ${question}`
        ),
      ].join("\n"),
    };

    let translationText = attempt.translation_text ?? "";
    let essayText = attempt.essay_text ?? "";
    let transcription: TranscriptionResult | null = null;

    if (attempt.input_mode === "paper") {
      stage = "transcription";

      await supabase
        .from("writing_attempts")
        .update({
          status: "transcribing",
          transcription_status: "processing",
          ai_status: "processing",
          ai_error_message: null,
        })
        .eq("id", attemptId);

      transcription = await transcribePaperAnswers(
        supabase,
        attempt,
        writingTest
      );

      translationText = transcription.translation_text.trim();
      essayText = transcription.essay_text.trim();

      const transcriptionStatus =
        transcription.confidence === "low"
          ? "needs_review"
          : "completed";

      const { error: transcriptionSaveError } =
        await supabase
          .from("writing_attempts")
          .update({
            translation_text: translationText,
            essay_text: essayText,
            transcription_status: transcriptionStatus,
            transcription_confidence:
              transcription.confidence,
            transcription_raw: transcription,
            transcribed_at: new Date().toISOString(),
            status: "evaluating",
          })
          .eq("id", attemptId);

      if (transcriptionSaveError) {
        throw new Error(
          `Handwriting transcript could not be saved: ${transcriptionSaveError.message}`
        );
      }
    } else {
      stage = "evaluation";

      await supabase
        .from("writing_attempts")
        .update({
          status: "evaluating",
          ai_status: "processing",
          ai_error_message: null,
        })
        .eq("id", attemptId);
    }

    stage = "evaluation";

    const evaluation = await evaluateWriting(
      writingTest,
      translationText,
      essayText
    );

    const translationLevel = normalizeLevel(
      evaluation.translation_level
    );
    const essayLevel = normalizeLevel(evaluation.essay_level);

    const tScore = translationScore(translationLevel);
    const eScore = essayScore(essayLevel);
    const totalScore = tScore + eScore;
    const passed = totalScore >= 80;

    const result = {
      ...evaluation,
      translation_level: translationLevel,
      essay_level: essayLevel,
      translation_score: tScore,
      essay_score: eScore,
      total_score: totalScore,
      passed,
    };

    const { error: saveError } = await supabase
      .from("writing_attempts")
      .update({
        translation_text: translationText,
        essay_text: essayText,

        translation_word_count:
          translationText.trim().length > 0
            ? translationText.trim().split(/\s+/).length
            : 0,

        essay_word_count:
          essayText.trim().length > 0
            ? essayText.trim().split(/\s+/).length
            : 0,

        essay_sentence_count: countSentences(essayText),

        translation_level: translationLevel,
        translation_score: tScore,

        essay_level: essayLevel,
        essay_score: eScore,

        total_score: totalScore,
        passed,

        translation_corrected:
          evaluation.translation_corrected,
        essay_corrected: evaluation.essay_corrected,

        translation_feedback:
          evaluation.translation_feedback,
        essay_feedback: evaluation.essay_feedback,

        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        error_analysis: evaluation.error_analysis,

        ai_status: "completed",
        ai_model: MODEL,
        ai_prompt_version: PROMPT_VERSION,
        ai_raw_response: {
          transcription,
          evaluation: result,
        },
        ai_evaluated_at: new Date().toISOString(),
        ai_error_message: null,

        status: "completed",
      })
      .eq("id", attemptId);

    if (saveError) {
      throw new Error(
        `AI evaluation could not be saved: ${saveError.message}`
      );
    }

    return Response.json({
      ok: true,
      attempt_id: attemptId,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      transcription,
      evaluation: result,
    });
  } catch (error) {
    console.error("Writing evaluation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown writing evaluation error.";

    if (supabase && attemptId) {
      const failedStatus =
        stage === "transcription"
          ? "transcription_failed"
          : "evaluation_failed";

      const transcriptionStatus =
        stage === "transcription" ? "failed" : undefined;

      await supabase
        .from("writing_attempts")
        .update({
          status: failedStatus,
          ai_status: "failed",
          ai_error_message: message,
          ...(transcriptionStatus
            ? { transcription_status: transcriptionStatus }
            : {}),
        })
        .eq("id", attemptId);
    }

    return Response.json(
      {
        error: message,
        stage,
      },
      { status: 500 }
    );
  }
}
