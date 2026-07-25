const STORAGE_KEY = "genq_quiz_history";

const KNOWN_SEED_SOURCES = new Set([
  "Database_Chapter1_Introduction.pdf",
]);

export function getSessionHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    // Auto-clean old seed/demo entries (added by removed seed quiz feature)
    const cleaned = list.filter((q) => !KNOWN_SEED_SOURCES.has(q.source));
    if (cleaned.length !== list.length) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
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
