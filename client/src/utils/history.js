const STORAGE_KEY = "genq_quiz_history";

export function getSessionHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToSessionHistory(quiz) {
  try {
    const history = getSessionHistory();
    // Avoid duplicates
    const filtered = history.filter((h) => h.id !== quiz.id);
    filtered.unshift({
      id: quiz.id,
      title: quiz.title,
      source: quiz.source,
      createdAt: quiz.createdAt || new Date().toISOString(),
      questionCount: quiz.questionCount,
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function clearSessionHistory() {
  sessionStorage.removeItem(STORAGE_KEY);
}
