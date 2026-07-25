import axios from "axios";

// On Cloudflare Workers: use VITE_API_URL env var
// On local dev: proxy via Vite config
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s for AI processing
});

export async function uploadFile(file, onProgress, config) {
  const formData = new FormData();
  formData.append("file", file);
  if (config) {
    formData.append("config", JSON.stringify(config));
  }

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

export async function getQuizList() {
  const { data } = await api.get("/quiz");
  return data;
}

export default api;
