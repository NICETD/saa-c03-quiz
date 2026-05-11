// localStorage-backed store for progress, favorites, language, exam history.
//
// Schema:
//   saa.progress[id] = { picked: string[], correct: boolean, ts: number, mode: string }
//   saa.favorites   = number[]
//   saa.lang        = "en" | "zh" | "both"
//   saa.exams       = ExamRecord[]
//   saa.lastQuiz    = { source, ids, idx } | null   // for resume

const K = {
  progress: "saa.progress",
  favorites: "saa.favorites",
  lang: "saa.lang",
  exams: "saa.exams",
  lastQuiz: "saa.lastQuiz",
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getProgress() {
  return read(K.progress, {});
}

export function recordAnswer(id, picked, correct, mode = "practice") {
  const p = getProgress();
  // Keep the most recent attempt + the attempt history (for stats).
  const prev = p[id];
  const history = prev?.history || [];
  if (prev) history.push({ picked: prev.picked, correct: prev.correct, ts: prev.ts, mode: prev.mode });
  p[id] = { picked, correct, ts: Date.now(), mode, history };
  write(K.progress, p);
}

export function clearProgress(id) {
  const p = getProgress();
  delete p[id];
  write(K.progress, p);
}

export function getFavorites() {
  return new Set(read(K.favorites, []));
}
export function toggleFavorite(id) {
  const s = getFavorites();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  write(K.favorites, [...s]);
  return s.has(id);
}
export function isFavorite(id) {
  return getFavorites().has(id);
}

export function getLang() {
  return read(K.lang, "zh");
}
export function setLang(v) {
  write(K.lang, v);
}

export function getExams() {
  return read(K.exams, []);
}
export function addExam(record) {
  const arr = getExams();
  arr.push(record);
  write(K.exams, arr);
}

export function getLastQuiz() {
  return read(K.lastQuiz, null);
}
export function setLastQuiz(v) {
  if (v == null) localStorage.removeItem(K.lastQuiz);
  else write(K.lastQuiz, v);
}

/**
 * Aggregate stats across all answered questions.
 * @param {number} total Total number of questions in the bank.
 */
export function getStats(total) {
  const p = getProgress();
  const answered = Object.keys(p);
  let correct = 0;
  for (const id of answered) if (p[id].correct) correct++;
  const incorrect = answered.length - correct;
  const rate = answered.length === 0 ? 0 : (correct / answered.length) * 100;
  return {
    total,
    answered: answered.length,
    correct,
    incorrect,
    rate,
  };
}

/**
 * Returns the list of ids for a given review filter.
 * @param {"all"|"wrong"|"right"|"favorites"} filter
 * @param {number[]} allIds
 */
export function getReviewIds(filter, allIds) {
  const p = getProgress();
  if (filter === "favorites") return [...getFavorites()].sort((a, b) => a - b);
  if (filter === "all") return allIds.filter((id) => p[id] !== undefined);
  if (filter === "wrong") return allIds.filter((id) => p[id] && !p[id].correct);
  if (filter === "right") return allIds.filter((id) => p[id] && p[id].correct);
  return [];
}

/** Reset everything. Used by a "danger zone" button on stats page. */
export function resetAll() {
  for (const k of Object.values(K)) localStorage.removeItem(k);
}
