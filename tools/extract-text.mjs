// Extract clean text from PDF.
// Strategy:
//   1. Within each page, group pdfjs items into "runs" (delimited by hasEOL=true).
//   2. Join runs with smartJoin: insert "\n" if the previous run ends with
//      terminal punctuation; insert "" (no space) if the boundary is mid-word
//      (e.g., "L" + "ambda" or CJK + CJK); insert " " otherwise.
//   3. Across pages, apply the same smartJoin so cross-page word splits fuse.
//
// Usage: node extract-text.mjs en|zh [--pages 1-5]

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PDFS = {
  en: path.join(ROOT, "questions", "AWS SAA-C03 英文 1019Q.pdf"),
  zh: path.join(ROOT, "questions", "AWS认证 SAA-C03 中文真题题库.pdf"),
};

const which = process.argv[2];
if (!which || !PDFS[which]) {
  console.error("Usage: node extract-text.mjs en|zh [--pages 1-5]");
  process.exit(1);
}

let pageRange = null;
const idx = process.argv.indexOf("--pages");
if (idx !== -1 && process.argv[idx + 1]) {
  const m = process.argv[idx + 1].match(/^(\d+)-(\d+)$/);
  if (m) pageRange = [Number(m[1]), Number(m[2])];
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(await fs.readFile(PDFS[which]));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const start = pageRange ? pageRange[0] : 1;
const end = pageRange ? pageRange[1] : doc.numPages;
console.error(`PDF: ${PDFS[which]}; pages ${start}..${end} of ${doc.numPages}`);

const TERMINAL_PUNCT = /[.!?。！？)\]}>:;，；,]\s*$/;
const CJK_RANGE = /[　-〿一-鿿＀-￯]/;

function smartJoin(prev, next) {
  if (!prev) return next || "";
  if (!next) return prev;
  const p = prev.replace(/\s+$/, "");
  const n = next.replace(/^\s+/, "");
  if (!p) return n;
  if (!n) return p;
  if (TERMINAL_PUNCT.test(p)) return p + "\n" + n;
  const last = p.slice(-1);
  const first = n.charAt(0);
  // mid-word break: short Latin tail + lowercase continuation
  const tail = p.match(/[A-Za-z]+$/)?.[0] || "";
  if (tail.length > 0 && tail.length <= 2 && /[a-z]/.test(first)) return p + n;
  // CJK adjacency: never insert a space
  if (CJK_RANGE.test(last) || CJK_RANGE.test(first)) return p + n;
  return p + " " + n;
}

function pageText(items) {
  const runs = [];
  let cur = "";
  for (const it of items) {
    if (!("str" in it)) continue;
    cur += it.str;
    if (it.hasEOL) {
      runs.push(cur);
      cur = "";
    }
  }
  if (cur) runs.push(cur);
  return runs.reduce((acc, r, i) => (i === 0 ? r : smartJoin(acc, r)), "");
}

let out = "";
for (let p = start; p <= end; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const text = pageText(content.items);
  out = out ? smartJoin(out, text) : text;
}

const outPath = path.join(__dirname, `raw-${which}.txt`);
await fs.writeFile(outPath, out);
console.error(`Wrote ${outPath} (${out.length} chars)`);
