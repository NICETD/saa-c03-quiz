// Loads and caches the merged question bank.

let cached = null;

export async function loadQuestions() {
  if (cached) return cached;
  const res = await fetch("./data/questions.json", { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load questions.json: ${res.status}`);
  const arr = await res.json();
  // Build index by id for O(1) lookup
  const byId = new Map();
  for (const q of arr) byId.set(q.id, q);
  cached = { all: arr, byId };
  return cached;
}

/**
 * Compute the section list given total question count and section size.
 * Returns [{from, to, label}].
 */
export function sections(total, size = 50) {
  const out = [];
  for (let from = 1; from <= total; from += size) {
    const to = Math.min(from + size - 1, total);
    out.push({ from, to, label: `${from}–${to}` });
  }
  return out;
}

/** Fisher–Yates shuffle (in place). */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick n unique random elements from arr. */
export function pickRandom(arr, n) {
  return shuffle([...arr]).slice(0, n);
}
