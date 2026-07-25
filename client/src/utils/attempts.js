const ATTEMPTS_KEY = "genq_quiz_attempts";

export function saveAttempt(quizId, result) {
  try {
    const attempts = getAttempts();
    const entry = {
      quizId,
      timestamp: new Date().toISOString(),
      score: result.score,
      grade: result.grade,
      correctCount: result.correctCount,
      total: result.total,
    };
    if (!attempts[quizId]) attempts[quizId] = [];
    attempts[quizId].push(entry);
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // ignore
  }
}

export function getAttempts(quizId) {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return quizId ? (all[quizId] || []) : all;
  } catch {
    return quizId ? [] : {};
  }
}

export function getFolderAttempts(source, quizzes) {
  // quizzes = array of { id, source } items in the folder
  try {
    const allAttempts = getAttempts();
    const folderIds = new Set(quizzes.map((q) => q.id));
    const folderAttempts = [];
    for (const [qid, attempts] of Object.entries(allAttempts)) {
      if (folderIds.has(qid)) {
        folderAttempts.push(...attempts.map((a) => ({ ...a, quizId: qid })));
      }
    }
    return folderAttempts.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  } catch {
    return [];
  }
}

export function getAttemptStats(source, quizzes) {
  const attempts = getFolderAttempts(source, quizzes);
  if (attempts.length === 0) return null;
  const scores = attempts.map((a) => a.score);
  const total = attempts[0].total;
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return {
    count: attempts.length,
    best,
    worst,
    avg: Math.round(avg * 10) / 10,
    total,
    latest: scores[scores.length - 1],
  };
}
