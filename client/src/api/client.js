import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 120000, // 2 min for AI processing
});

export async function uploadFile(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  });
  return data; // { quizId, title, questionCount }
}

export async function getQuiz(quizId) {
  const { data } = await api.get(`/quiz/${quizId}`);
  return data;
}

export async function submitAnswers(quizId, answers) {
  const { data } = await api.post(`/quiz/${quizId}/submit`, { answers });
  return data;
}

export async function getSeedQuiz() {
  const { data } = await api.get("/quiz/seed/data");
  return data;
}

export async function getQuizList() {
  const { data } = await api.get("/quiz");
  return data;
}

export default api;
