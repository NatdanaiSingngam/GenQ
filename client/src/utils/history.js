const STORAGE_KEY = "genq_quiz_history";
const DELETED_KEY = "genq_deleted_quizzes";

function getDeletedIds() {
  try {
    const raw = sessionStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function addDeletedId(id) {
  try {
    const ids = getDeletedIds();
    ids.add(id);
    sessionStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
  } catch {}
}

function setDeletedIds(ids) {
  try {
    sessionStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
  } catch {}
}

const KNOWN_SEED_SOURCES = new Set([
  "Database_Chapter1_Introduction.pdf",
]);

export function getSessionHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const deleted = getDeletedIds();
    // Filter out deleted IDs and known seed sources
    const cleaned = list.filter((q) => !deleted.has(q.id) && !KNOWN_SEED_SOURCES.has(q.source));
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
      round: quiz.round || 0,
      createdAt: quiz.createdAt || new Date().toISOString(),
      questionCount: quiz.questionCount,
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function removeFromSessionHistory(id) {
  try {
    const history = getSessionHistory();
    const filtered = history.filter((h) => h.id !== id);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    addDeletedId(id);
  } catch {}
}

export function clearSessionHistory() {
  try {
    // Save all current quiz IDs as deleted before clearing
    const history = getSessionHistory();
    const allIds = new Set(getDeletedIds());
    history.forEach((q) => allIds.add(q.id));
    setDeletedIds(allIds);
  } catch {}
  sessionStorage.removeItem(STORAGE_KEY);
}
