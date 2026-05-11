// Parse raw-zh.txt → data/questions.zh.json
//
// ZH PDF has clean global numbering 1..1019. Options use `A.` style (period).
// No 解析 (explanations) in the ZH PDF.
//
// Approach: anchor on `答案：[A-Z]+` markers. Same segment-walk strategy as EN.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const text = await fs.readFile(path.join(__dirname, "raw-zh.txt"), "utf-8");

const answerRe = /答案：\s*([A-Z]+)/g;
const answers = [];
for (const m of text.matchAll(answerRe)) {
  answers.push({ index: m.index, end: m.index + m[0].length, letters: m[1] });
}
console.error(`Found ${answers.length} answer markers in ZH text.`);

const questions = [];
const issues = [];

for (let i = 0; i < answers.length; i++) {
  const ans = answers[i];
  const segStart = i === 0 ? 0 : answers[i - 1].end;
  const segEnd = ans.index;
  const segment = text.slice(segStart, segEnd);

  // ZH option marker: capital letter A-F followed by a period, preceded by
  // line start, whitespace, or another period (since options often run on
  // one fused line separated by ". A. ... . B. ...").
  // Use a lookbehind-free pattern: capture preceding char in group 0,
  // accept it if the char is line-start, whitespace, or period.
  // Match option markers anywhere — order filter below removes false positives.
  // ZH options often run together with no separator: "...档B.配置..."
  const optMarkerRe = /([A-F])\.(?=\s*\S)/g;
  const optMarkers = [];
  for (const m of segment.matchAll(optMarkerRe)) {
    optMarkers.push({
      key: m[1],
      start: m.index,
      end: m.index + 2, // letter + period
    });
  }

  // Filter: keep only markers in expected order A, B, C, D, [E, F].
  const expectedKeys = ["A", "B", "C", "D", "E", "F"];
  const validMarkers = [];
  let nextExpected = 0;
  for (const m of optMarkers) {
    if (m.key === expectedKeys[nextExpected]) {
      validMarkers.push(m);
      nextExpected++;
    }
  }

  // Find question-number prefix. Prefer the match whose number equals i+1.
  // Fallback: first `<digits>.` in the segment.
  const stemEnd = validMarkers.length > 0 ? validMarkers[0].start : segment.length;
  const stemArea = segment.slice(0, stemEnd);
  const numRe = /(?:^|\s)(\d+)\./g;
  let questionNumStart = 0;
  let parsedNum = null;
  const allNums = [...stemArea.matchAll(numRe)];
  const expected = i + 1;
  let chosen = allNums.find((m) => Number(m[1]) === expected);
  if (!chosen && allNums.length > 0) chosen = allNums[0];
  if (chosen) {
    const digitOffset = chosen[0].startsWith(" ") || chosen[0].startsWith("\n") ? 1 : 0;
    questionNumStart = chosen.index + digitOffset + chosen[1].length + 1;
    parsedNum = Number(chosen[1]);
  }
  const stem = stemArea.slice(questionNumStart).trim();

  // Parse options (advance past the marker letter + period + optional whitespace).
  const options = [];
  for (let j = 0; j < validMarkers.length; j++) {
    const m = validMarkers[j];
    const next = j + 1 < validMarkers.length ? validMarkers[j + 1].start : segment.length;
    // skip the letter+period+optional whitespace
    const textStart = m.end + (segment[m.end] === " " ? 1 : 0);
    options.push({ key: m.key, text: segment.slice(textStart, next).trim() });
  }

  const type = ans.letters.length > 1 ? "multiple" : "single";
  const answerLetters = ans.letters.split("");

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
  if (parsedNum !== null && parsedNum !== i + 1) {
    issues.push({ id: i + 1, kind: "number-mismatch", parsedNum });
  }

  questions.push({
    id: i + 1,
    type,
    stem,
    options,
    answer: answerLetters,
    explanation: "", // ZH has no explanations
  });
}

await fs.mkdir(path.join(__dirname, "..", "data"), { recursive: true });
const outPath = path.join(__dirname, "..", "data", "questions.zh.json");
await fs.writeFile(outPath, JSON.stringify(questions, null, 2));
console.error(`Wrote ${outPath} (${questions.length} questions)`);

if (issues.length > 0) {
  console.error(`\nIssues found: ${issues.length}`);
  for (const issue of issues.slice(0, 30)) console.error("  ", JSON.stringify(issue));
  if (issues.length > 30) console.error(`  ... and ${issues.length - 30} more`);
}
