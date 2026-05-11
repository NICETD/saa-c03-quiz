// Merge en/zh question banks using alignment.json into the runtime data file
// data/questions.json. Each entry: { id, type, en: {...}, zh: {...} | null, score }.
// id corresponds to the EN question position (1..1019), since EN has explanations.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const en = JSON.parse(await fs.readFile(path.join(dataDir, "questions.en.json"), "utf-8"));
const zh = JSON.parse(await fs.readFile(path.join(dataDir, "questions.zh.json"), "utf-8"));
const align = JSON.parse(await fs.readFile(path.join(__dirname, "alignment.json"), "utf-8"));

const merged = en.map((e, i) => {
  const a = align[i];
  let zhData = null;
  if (a && a.zhId) {
    const z = zh[a.zhId - 1];
    zhData = {
      stem: z.stem,
      options: z.options,
      // ZH answer letters may differ from EN if option order is different.
      // We do NOT use ZH answer; EN answer is authoritative.
      answer: z.answer,
    };
  }
  return {
    id: e.id,
    type: e.type,
    answer: e.answer,
    en: { stem: e.stem, options: e.options, explanation: e.explanation },
    zh: zhData,
    matchScore: a ? a.score : 0,
  };
});

const outPath = path.join(dataDir, "questions.json");
await fs.writeFile(outPath, JSON.stringify(merged));
console.error(`Wrote ${outPath} (${merged.length} questions, ${merged.filter((q) => q.zh).length} bilingual)`);

// Also produce a minified version (no whitespace) — same content.
// Useful if served directly as JSON.

// Stats
const types = merged.reduce((acc, q) => ((acc[q.type] = (acc[q.type] || 0) + 1), acc), {});
console.error("Types:", types);
console.error("With ZH translation:", merged.filter((q) => q.zh).length);
console.error("Without ZH:", merged.filter((q) => !q.zh).length);
console.error("With explanation:", merged.filter((q) => q.en.explanation).length);
