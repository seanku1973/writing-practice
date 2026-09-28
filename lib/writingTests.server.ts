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

  {
    code: "WT02",
    exerciseLabel: "Exercise 02",
    title: "中級寫作能力測驗 02",
    durationSeconds: 40 * 60,

    translation: {
      title: "第一部分：中譯英（40%）",
      instruction:
        "請將下列的一段中文翻譯成通順、達意且前後連貫的英文。",
      prompt:
        "我姊姊從小的時候就一直有在畫畫，她也非常自豪於她的繪畫技術。國中時，她曾為了在全國繪畫比赛中得名而在畫室閉關練習了整整一周。有時候，她會參觀美術館和各種展覽來從中學習不同的繪畫技術。去年，我姊姊決定了不再當美術老師。她想要做為一名真正的畫家自己辦展覽。這是個不容易的決定。也許她現在唯一需要的就是我們的支持吧。",
    },

    essay: {
      title: "第二部分：英文作文（60%）",
      instruction:
        "請依下面所提供的文字提示寫一篇英文作文，長度約 120 字（8 至 12 個句子）。作文可以是一個完整的段落，也可以分段。",
      prompt:
      "你認為家裡生活環境的維持應該是誰的責任?請寫一篇文章說明你的看法。",
      questions: [
        "說明你對家事該如何分工的看法及理由。",
        "舉例說明你家中家事分工的情形，並描述你自己做家事的經驗及感想。",
      ],
    },
  },
  
  {
    code: "WT03",
    exerciseLabel: "Exercise 03",
    title: "中級寫作能力測驗 03",
    durationSeconds: 40 * 60,

    translation: {
      title: "第一部分：中譯英（40%）",
      instruction:
        "請將下列的一段中文翻譯成通順、達意且前後連貫的英文。",
      prompt:
        "今天回家途中，我在十字路口目睹了一場車禍。有台轎車撞倒了一名機車騎士。駕駛馬上下車了，她看起來還酪醺醺的。旁邊的路人報了警、叫了救護車，還拍了照，希望能幫上忙。我覺得那個駕駛一定是開很快，而我不禁對此感到既生氣又難過。無論那名駕駛會受到怎樣的處罰，我真希望她不要再酒醉駕車了。",
    },

    essay: {
      title: "第二部分：英文作文（60%）",
      instruction:
        "請依下面所提供的文字提示寫一篇英文作文，長度約 120 字（8 至 12 個句子）。作文可以是一個完整的段落，也可以分段。",
      prompt:
      "政府要求店家禁用塑膠吸管的政策，已施行一段時間。請寫一篇文章說明你的看法。",
      questions: [
        "你認為這政策好嗎？為什麼或為什麼不？",
        "你還會建議如何在日常生活中做環保呢？",
      ],
    },
  },
  {
    code: "WT04",
    exerciseLabel: "Exercise 04",
    title: "中級寫作能力測驗 04",
    durationSeconds: 40 * 60,

    translation: {
      title: "第一部分：中譯英（40%）",
      instruction:
        "請將下列的一段中文翻譯成通順、達意且前後連貫的英文。",
      prompt:
        "Stella每年八月都會到紐約出差，而今年她打算帶她十歲大的兒子同行。Stella 最近一直在忙著計畫她的理想旅程。她正在考慮帶她兒子去遊樂園坐真正刺激的雲霄飛車。她相信她兒子絕對會對這很有與趣的。",
    },

    essay: {
      title: "第二部分：英文作文（60%）",
      instruction:
        "請依下面所提供的文字提示寫一篇英文作文，長度約 120 字（8 至 12 個句子）。作文可以是一個完整的段落，也可以分段。",
      prompt:
      "不論是和家人或朋友，每個人難免會有爭執的經驗。請寫一篇文章說明你的看法。",
      questions: [
        "發生爭吵的原因與經過。",
        "解決方式與這次事件的影響或感想。",
      ],
    },
  },

  {
    code: "WT05",
    exerciseLabel: "Exercise 05",
    title: "中級寫作能力測驗 05",
    durationSeconds: 40 * 60,

    translation: {
      title: "第一部分：中譯英（40%）",
      instruction:
        "請將下列的一段中文翻譯成通順、達意且前後連貫的英文。",
      prompt:
        "找工作的傳統方式是看報紙的分類廣告。然而，隨著科技的發達，網路早就已經成為求職的主要管道。公司和僱主可以把工作職缺刊登在公司的網頁上，無須再花費一毛錢登報。求職者也可以在網路上張貼他們的履歷。",
    },

    essay: {
      title: "第二部分：英文作文（60%）",
      instruction:
        "請依下面所提供的文字提示寫一篇英文作文，長度約 120 字（8 至 12 個句子）。作文可以是一個完整的段落，也可以分段。",
      prompt:
      "圖片中有兩個人，他們都在挖掘地下的寶藏，但其中一個人已經接近成功，卻選擇了放棄。請寫一篇文章說明你的看法。",
      questions: [
        "談一談在生活、學習或工作中，我們是否應該堅持到底？",
        "從不同的角度探討放棄和堅持的利弊，並結合自身經驗或生活中的例子進行闡述。",
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
