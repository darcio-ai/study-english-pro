export type PlacementQuestion = {
  id: number;
  level: "A1-A2" | "B1" | "B2";
  question: string;
  options: string[];
  answer: number; // index
  focus: string;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  // ===== A1-A2 (1-8) =====
  { id: 1, level: "A1-A2", focus: "to be", question: "She ___ my sister.", options: ["am", "is", "are", "be"], answer: 1 },
  { id: 2, level: "A1-A2", focus: "articles", question: "I bought ___ apple and ___ banana.", options: ["a / a", "an / a", "the / an", "an / an"], answer: 1 },
  { id: 3, level: "A1-A2", focus: "present simple", question: "He ___ coffee every morning.", options: ["drink", "drinks", "drinking", "is drink"], answer: 1 },
  { id: 4, level: "A1-A2", focus: "past simple", question: "Yesterday I ___ to the cinema.", options: ["go", "went", "gone", "going"], answer: 1 },
  { id: 5, level: "A1-A2", focus: "prepositions", question: "The book is ___ the table.", options: ["in", "at", "on", "to"], answer: 2 },
  { id: 6, level: "A1-A2", focus: "can", question: "___ you swim?", options: ["Do", "Can", "Are", "Is"], answer: 1 },
  { id: 7, level: "A1-A2", focus: "plurals", question: "There are three ___ in the garden.", options: ["child", "childs", "children", "childrens"], answer: 2 },
  { id: 8, level: "A1-A2", focus: "possessives", question: "This is ___ car. (belonging to me)", options: ["my", "mine", "I", "me"], answer: 0 },

  // ===== B1 (9-17) =====
  { id: 9, level: "B1", focus: "present perfect", question: "I ___ never ___ to Japan.", options: ["have / been", "has / been", "am / be", "did / go"], answer: 0 },
  { id: 10, level: "B1", focus: "modal verbs", question: "You ___ study harder if you want to pass.", options: ["should", "would", "could", "might"], answer: 0 },
  { id: 11, level: "B1", focus: "1st conditional", question: "If it ___ tomorrow, we'll stay home.", options: ["rains", "will rain", "rained", "would rain"], answer: 0 },
  { id: 12, level: "B1", focus: "phrasal verbs", question: "Please ___ the lights when you leave.", options: ["turn off", "turn on", "turn over", "turn up"], answer: 0 },
  { id: 13, level: "B1", focus: "passive voice", question: "This song ___ by millions of people.", options: ["listens", "is listened to", "listened", "is listening"], answer: 1 },
  { id: 14, level: "B1", focus: "comparatives", question: "This exercise is ___ than the last one.", options: ["difficulter", "more difficult", "most difficult", "difficult"], answer: 1 },
  { id: 15, level: "B1", focus: "going to", question: "Look at those clouds! It ___ rain.", options: ["will", "is going to", "would", "rains"], answer: 1 },
  { id: 16, level: "B1", focus: "since/for", question: "I have lived here ___ 2010.", options: ["for", "since", "from", "ago"], answer: 1 },
  { id: 17, level: "B1", focus: "used to", question: "When I was a child, I ___ play football every day.", options: ["use to", "used to", "am used to", "was used to"], answer: 1 },

  // ===== B2 (18-25) =====
  { id: 18, level: "B2", focus: "past perfect", question: "By the time we arrived, the movie ___.", options: ["started", "had started", "was starting", "has started"], answer: 1 },
  { id: 19, level: "B2", focus: "2nd conditional", question: "If I ___ you, I would apologize.", options: ["am", "was", "were", "be"], answer: 2 },
  { id: 20, level: "B2", focus: "reported speech", question: "She said she ___ tired.", options: ["is", "was", "be", "has been"], answer: 1 },
  { id: 21, level: "B2", focus: "relative clauses", question: "That's the man ___ car was stolen.", options: ["who", "which", "whose", "that"], answer: 2 },
  { id: 22, level: "B2", focus: "mixed conditional", question: "If I had studied medicine, I ___ a doctor now.", options: ["am", "would be", "will be", "was"], answer: 1 },
  { id: 23, level: "B2", focus: "collocations", question: "Can I ___ you a favor?", options: ["do", "make", "ask", "give"], answer: 2 },
  { id: 24, level: "B2", focus: "wish/regret", question: "I wish I ___ harder for the exam.", options: ["studied", "had studied", "would study", "study"], answer: 1 },
  { id: 25, level: "B2", focus: "inversion", question: "Never ___ such a beautiful sunset.", options: ["I have seen", "have I seen", "I saw", "did I saw"], answer: 1 },
];

export function calculateLevel(correctCount: number): "beginner" | "intermediate" | "advanced" {
  if (correctCount <= 8) return "beginner";
  if (correctCount <= 16) return "intermediate";
  return "advanced";
}
