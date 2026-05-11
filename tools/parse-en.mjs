// Parse raw-en.txt → data/questions.en.json
//
// Approach: anchor on `答案：[A-Z]+` markers (1019 of them).
// For each question i, the segment containing its stem+options runs from the
// end of question (i-1) to the start of `答案：` for question i.
// Within a segment, we find the LAST `<digits>.` before the first option
// marker `A、` — that's the question start. Stem ends at the first `A、`.
// Options A..E are parsed by walking marker positions.
// Explanation (when present) follows `解析：` and ends at the next question's
// stem-number marker.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const text = await fs.readFile(path.join(__dirname, "raw-en.txt"), "utf-8");

// Find all answer markers (1019 expected)
const answerRe = /答案：\s*([A-Z]+)/g;
const answers = [];
for (const m of text.matchAll(answerRe)) {
  answers.push({ index: m.index, end: m.index + m[0].length, letters: m[1] });
}
console.error(`Found ${answers.length} answer markers in EN text.`);

const explanRe = /解析\s*：\s*/g;
const explanMarkers = [];
for (const m of text.matchAll(explanRe)) {
  explanMarkers.push({ index: m.index, end: m.index + m[0].length });
}
console.error(`Found ${explanMarkers.length} explanation markers in EN text.`);

const questions = [];
const issues = [];

for (let i = 0; i < answers.length; i++) {
  const ans = answers[i];
  const segStart = i === 0 ? 0 : findExplanationEndOrAnswerEnd(i - 1);
  const segEnd = ans.index;
  const segment = text.slice(segStart, segEnd);

  // Find first option marker A within this segment.
  // Pattern: a capital letter A-E followed by a Chinese comma (with optional surrounding whitespace).
  const optMarkerRe = /([A-F])\s*[、,]\s*/g;
  const optMarkers = [];
  for (const m of segment.matchAll(optMarkerRe)) {
    optMarkers.push({ key: m[1], start: m.index, end: m.index + m[0].length });
  }

  // Filter: keep only markers in expected order (A, B, C, D, possibly E),
  // each subsequent one appearing AFTER the previous one's end.
  const expectedKeys = ["A", "B", "C", "D", "E", "F"];
  const validMarkers = [];
  let nextExpected = 0;
  for (const m of optMarkers) {
    if (m.key === expectedKeys[nextExpected]) {
      validMarkers.push(m);
      nextExpected++;
    }
  }

  // Find the question-number prefix. The segment starts right at the question
  // number (computed by findExplanationEndOrAnswerEnd), so the FIRST `<digits>.`
  // followed by an uppercase letter / CJK char is the question marker.
  const stemEnd = validMarkers.length > 0 ? validMarkers[0].start : segment.length;
  const stemArea = segment.slice(0, stemEnd);
  const numRe = /(?:^|[\s\n])(\d+)\.\s*(?=[A-Z一-鿿])/g;
  const firstNum = stemArea.matchAll(numRe).next().value;
  let questionNumStart = 0;
  if (firstNum) {
    const digitOffset = firstNum[0].startsWith(" ") || firstNum[0].startsWith("\n") ? 1 : 0;
    questionNumStart = firstNum.index + digitOffset + firstNum[1].length + 1;
  }
  const stem = stemArea.slice(questionNumStart).trim();

  // Parse options
  const options = [];
  for (let j = 0; j < validMarkers.length; j++) {
    const m = validMarkers[j];
    const next = j + 1 < validMarkers.length ? validMarkers[j + 1].start : segment.length;
    options.push({ key: m.key, text: segment.slice(m.end, next).trim() });
  }

  const type = ans.letters.length > 1 ? "multiple" : "single";
  const answerLetters = ans.letters.split("");

  // Sanity check: each answer letter must correspond to an option key.
  const optKeys = new Set(options.map((o) => o.key));
  const missingAnswerOption = answerLetters.find((l) => !optKeys.has(l));
  if (missingAnswerOption) {
    issues.push({
      id: i + 1,
      kind: "answer-letter-missing-option",
      letter: missingAnswerOption,
      optKeys: [...optKeys],
    });
  }
  if (!stem) issues.push({ id: i + 1, kind: "empty-stem" });
  if (options.length < 2) issues.push({ id: i + 1, kind: "too-few-options", count: options.length });

  questions.push({
    id: i + 1,
    type,
    stem,
    options,
    answer: answerLetters,
    explanation: "", // filled in second pass below
  });
}

// Boundary helper: where does question (qIndex+1)'s stem begin?
function findExplanationEndOrAnswerEnd(qIndex) {
  // Returns the position where question qIndex's content ENDS — i.e., where
  // question (qIndex+1)'s stem begins.
  const ans = answers[qIndex];
  const next = answers[qIndex + 1];
  if (!next) return text.length;
  const explan = explanMarkers.find((em) => em.index >= ans.end && em.index < next.index);
  // Search for the LAST plausible question-start `<digits>.` between
  // (explan.end || ans.end) and next.index.
  const from = explan ? explan.end : ans.end;
  const region = text.slice(from, next.index);
  const numRe = /(?:^|\s)(\d+)\./g;
  let bestStart = -1;
  for (const m of region.matchAll(numRe)) {
    // Check that what follows looks like a stem (English capital letter or CJK).
    const after = region.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (/^[A-Z一-鿿]/.test(after)) {
      bestStart = m.index + (m[0].startsWith(" ") || m[0].startsWith("\n") ? 1 : 0);
    }
  }
  if (bestStart >= 0) return from + bestStart;
  return ans.end;
}

// Now fill explanations
for (let i = 0; i < answers.length; i++) {
  const ans = answers[i];
  const next = answers[i + 1];
  const upper = next ? next.index : text.length;
  const explan = explanMarkers.find((em) => em.index >= ans.end && em.index < upper);
  if (!explan) continue;
  const stemStart = next ? findExplanationEndOrAnswerEnd(i) : text.length;
  const explanationText = text.slice(explan.end, stemStart).trim();
  questions[i].explanation = explanationText;
}

await fs.mkdir(path.join(__dirname, "..", "data"), { recursive: true });
const outPath = path.join(__dirname, "..", "data", "questions.en.json");
await fs.writeFile(outPath, JSON.stringify(questions, null, 2));
console.error(`Wrote ${outPath} (${questions.length} questions)`);

if (issues.length > 0) {
  console.error(`\nIssues found: ${issues.length}`);
  for (const issue of issues.slice(0, 20)) console.error("  ", JSON.stringify(issue));
  if (issues.length > 20) console.error(`  ... and ${issues.length - 20} more`);
}
