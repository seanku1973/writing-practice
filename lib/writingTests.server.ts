export type ServerWritingTest = {
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

export const serverWritingTests: ServerWritingTest[] = [
  {
    code: "WT01",
    exerciseLabel: "Exercise 01",
    title: "中級寫作能力測驗 01",
    durationSeconds: 40 * 60,

    translation: {
      title: "第一部分：中譯英（40%）",
      instruction:
        "請將下列的一段中文翻譯成通順、達意且前後連貫的英文。",
      prompt:
        "我媽媽今天得照顧我奶奶，所以她要我在她不在家的時候做一些家事。我得掃地、清理廚房、洗衣服、烘衣服和打掃廁所。我最初的計畫是在早上完成所有的差事，這樣我下午就可放鬆並做我想做的事情了。然而，我想我可能會把最不好的差事——掃廁所——留到晚一點做！",
    },

    essay: {
      title: "第二部分：英文作文（60%）",
      instruction:
        "請依下面所提供的文字提示寫一篇英文作文，長度約 120 字（8 至 12 個句子）。作文可以是一個完整的段落，也可以分段。",
      prompt:
        "在臺灣，飲料店（drink shops）越開越多，有的飲料連鎖店甚至還到國外開店。",
      questions: [
        "說明為什麼飲料店如此受歡迎。",
        "你去飲料店時喜歡買什麼飲料？為什麼？",
      ],
    },
  },

  // 未來新增 Exercise 02、Exercise 03 時，
  // 只要在這個陣列增加下一份測驗即可。
];

export function getServerWritingTest(code: string) {
  return serverWritingTests.find((test) => test.code === code);
}

export function getWritingTestMetadata() {
  return serverWritingTests.map((test) => ({
    code: test.code,
    exerciseLabel: test.exerciseLabel,
    title: test.title,
    durationSeconds: test.durationSeconds,
  }));
}
