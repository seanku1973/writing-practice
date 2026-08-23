export type ExercisePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "answer";
      text: string;
      width?: string;
    };

export type Exercise = {
  id: string;
  title: string;
  chineseTitle: string;
  description: string;
  image: string;
  parts: ExercisePart[];
};

export const exercises: Exercise[] = [
  {
    id: "1",

    title: "Fire Drill",

    chineseTitle: "消防演練",

    description:
      "觀察消防演練圖片，練習描述地點、人物、動作、背景與個人想法。",

    image: "/images/fire-drill.jpg",

    parts: [
      {
        type: "answer",
        text: "The picture was probably taken in",
        width: "300px",
      },

      {
        type: "text",
        text: " a city street or alley ",
      },

      {
        type: "answer",
        text: "where there are many",
        width: "220px",
      },

      {
        type: "text",
        text:
          " firefighters participating in a fire drill with their fire engine and hoses. ",
      },

      {
        type: "answer",
        text: "It looks that",
        width: "150px",
      },

      {
        type: "text",
        text: " they are really serious and focused ",
      },

      {
        type: "answer",
        text: "because they are",
        width: "180px",
      },

      {
        type: "text",
        text:
          " practicing how to put out a fire efficiently and save lives. In the ",
      },

      {
        type: "answer",
        text: "left side of the photo",
        width: "220px",
      },

      {
        type: "text",
        text:
          ", we can see several firefighters with helmets and full protective suits, kneeling on the ground and aiming the water hose toward a building, ",
      },

      {
        type: "answer",
        text: "because they are",
        width: "180px",
      },

      {
        type: "text",
        text: " simulating how to stop a fire from spreading. ",
      },

      {
        type: "answer",
        text: "There is",
        width: "120px",
      },

      {
        type: "text",
        text: " also a big red fire truck in the ",
      },

      {
        type: "answer",
        text: "middle of the photo",
        width: "200px",
      },

      {
        type: "text",
        text:
          ", with a tall ladder extended upward and one firefighter standing nearby, monitoring the situation. ",
      },

      {
        type: "answer",
        text: "It seems that",
        width: "150px",
      },

      {
        type: "text",
        text:
          " they might be doing an emergency response drill to stay prepared for real-life incidents. In the ",
      },

      {
        type: "answer",
        text: "background",
        width: "140px",
      },

      {
        type: "text",
        text: ", ",
      },

      {
        type: "answer",
        text: "the weather looks",
        width: "180px",
      },

      {
        type: "text",
        text:
          " cloudy but dry, and the scene is surrounded by residential buildings and a local post office. Actually, I haven’t been to a place like this. I am always wondering how firefighters manage to stay calm and act fast during emergencies, and ",
      },

      {
        type: "answer",
        text: "if I had an opportunity",
        width: "220px",
      },

      {
        type: "text",
        text:
          ", I would like to watch a fire drill in person and learn more about their work.",
      },
    ],
  },
];

export function getExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id);
}