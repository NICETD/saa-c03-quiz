// Cross-check EN and ZH JSON for consistency and produce a sampling report.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");

const en = JSON.parse(await fs.readFile(path.join(dataDir, "questions.en.json"), "utf-8"));
const zh = JSON.parse(await fs.readFile(path.join(dataDir, "questions.zh.json"), "utf-8"));

const lines = [];
const log = (s = "") => lines.push(s);

log(`# SAA-C03 题库解析报告\n`);
log(`生成时间: ${new Date().toISOString()}\n`);

log(`## 总览`);
log(`- 英文题数: ${en.length}`);
log(`- 中文题数: ${zh.length}`);
log(`- 中英对应关系: 按题号 1:1 (索引相同 → 同一题)\n`);

// Type breakdown
const typeBreakdown = (arr) => {
  const types = arr.reduce((acc, q) => ((acc[q.type] = (acc[q.type] || 0) + 1), acc), {});
  return types;
};
log(`## 题型分布`);
log(`- 英文: ${JSON.stringify(typeBreakdown(en))}`);
log(`- 中文: ${JSON.stringify(typeBreakdown(zh))}\n`);

// Answer mismatches between EN and ZH
const answerMismatches = [];
for (let i = 0; i < Math.min(en.length, zh.length); i++) {
  const a = en[i].answer.join("");
  const b = zh[i].answer.join("");
  if (a !== b) answerMismatches.push({ id: i + 1, en: a, zh: b });
}
log(`## 中英答案对照`);
log(`- 完全一致: ${en.length - answerMismatches.length} / ${en.length}`);
log(`- 不一致: ${answerMismatches.length}`);
if (answerMismatches.length > 0) {
  log(`\n前 20 条不一致样本:`);
  for (const m of answerMismatches.slice(0, 20)) {
    log(`  - 题 ${m.id}: EN=${m.en}, ZH=${m.zh}`);
  }
}
log("");

// Type mismatches (single vs multiple)
const typeMismatches = [];
for (let i = 0; i < Math.min(en.length, zh.length); i++) {
  if (en[i].type !== zh[i].type) {
    typeMismatches.push({ id: i + 1, en: en[i].type, zh: zh[i].type });
  }
}
log(`## 中英题型对照`);
log(`- 完全一致: ${en.length - typeMismatches.length} / ${en.length}`);
log(`- 不一致: ${typeMismatches.length}`);
if (typeMismatches.length > 0) {
  log(`\n样本 (前 10):`);
  for (const m of typeMismatches.slice(0, 10)) {
    log(`  - 题 ${m.id}: EN=${m.en}, ZH=${m.zh}`);
  }
}
log("");

// Option count breakdown
const optCounts = (arr) => {
  const counts = {};
  for (const q of arr) counts[q.options.length] = (counts[q.options.length] || 0) + 1;
  return counts;
};
log(`## 选项数量分布`);
log(`- 英文: ${JSON.stringify(optCounts(en))}`);
log(`- 中文: ${JSON.stringify(optCounts(zh))}\n`);

// Coverage of explanations
const enWithExplan = en.filter((q) => q.explanation.length > 0).length;
const zhWithExplan = zh.filter((q) => q.explanation.length > 0).length;
log(`## 解析覆盖率`);
log(`- 英文有解析: ${enWithExplan} / ${en.length}`);
log(`- 中文有解析: ${zhWithExplan} / ${zh.length}\n`);

// Sample questions side-by-side
log(`## 抽样比对 (题号 1, 50, 200, 500, 800, 1019)`);
const samples = [1, 50, 200, 500, 800, 1019];
for (const id of samples) {
  const e = en[id - 1];
  const z = zh[id - 1];
  log(`\n---\n### 题 ${id} (${e.type}, 答案: ${e.answer.join("/")})\n`);
  log(`**EN stem:** ${e.stem.slice(0, 280)}${e.stem.length > 280 ? "…" : ""}`);
  log(`\n**ZH stem:** ${z.stem.slice(0, 280)}${z.stem.length > 280 ? "…" : ""}`);
  log(`\n**EN options:**`);
  for (const o of e.options) {
    const t = o.text.slice(0, 140) + (o.text.length > 140 ? "…" : "");
    log(`  - ${o.key}. ${t}`);
  }
  log(`\n**ZH options:**`);
  for (const o of z.options) {
    const t = o.text.slice(0, 140) + (o.text.length > 140 ? "…" : "");
    log(`  - ${o.key}. ${t}`);
  }
  if (e.explanation) {
    log(`\n**EN explanation (前 320 字):** ${e.explanation.slice(0, 320)}${e.explanation.length > 320 ? "…" : ""}`);
  }
}
log("");

// Suspicious questions: empty stem, very short stem, mismatched options
log(`## 可疑数据点`);
const suspicious = [];
for (let i = 0; i < en.length; i++) {
  const e = en[i];
  const z = zh[i];
  if (!e.stem) suspicious.push({ id: i + 1, kind: "EN empty stem" });
  if (!z.stem) suspicious.push({ id: i + 1, kind: "ZH empty stem" });
  if (e.stem.length < 30) suspicious.push({ id: i + 1, kind: `EN stem too short (${e.stem.length} chars)`, stem: e.stem });
  if (z.stem.length < 20) suspicious.push({ id: i + 1, kind: `ZH stem too short (${z.stem.length} chars)`, stem: z.stem });
  if (e.options.length < 2) suspicious.push({ id: i + 1, kind: `EN <2 options (${e.options.length})` });
  if (z.options.length < 2) suspicious.push({ id: i + 1, kind: `ZH <2 options (${z.options.length})` });
  if (e.options.length !== z.options.length) {
    suspicious.push({ id: i + 1, kind: `EN/ZH option count mismatch`, en: e.options.length, zh: z.options.length });
  }
}
log(`- 可疑条数: ${suspicious.length}`);
if (suspicious.length > 0) {
  log(`\n样本 (前 30):`);
  for (const s of suspicious.slice(0, 30)) log(`  - ${JSON.stringify(s)}`);
}

const reportPath = path.join(__dirname, "REPORT.md");
await fs.writeFile(reportPath, lines.join("\n"));
console.error(`Wrote ${reportPath}`);
console.error(`Mismatches: answer=${answerMismatches.length}, type=${typeMismatches.length}, suspicious=${suspicious.length}`);
