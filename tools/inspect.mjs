// Inspect raw text items on a single page to understand pdfjs geometry.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const which = process.argv[2] || "en";
const pageNum = Number(process.argv[3] || 476);
const filter = process.argv[4] || null; // optional substring filter

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const PDFS = {
  en: path.join(ROOT, "questions", "AWS SAA-C03 英文 1019Q.pdf"),
  zh: path.join(ROOT, "questions", "AWS认证 SAA-C03 中文真题题库.pdf"),
};
const data = new Uint8Array(await fs.readFile(PDFS[which]));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(pageNum);
const content = await page.getTextContent();

console.log(`Page ${pageNum} of ${which}, ${content.items.length} items:`);
let prev = null;
for (let i = 0; i < content.items.length; i++) {
  const it = content.items[i];
  const line = `[${i}] ${JSON.stringify(it.str)} x=${it.transform[4].toFixed(1)} y=${it.transform[5].toFixed(1)} w=${(it.width || 0).toFixed(1)} hasEOL=${it.hasEOL || false}`;
  if (filter) {
    // Check both this item and neighbors
    const window = content.items
      .slice(Math.max(0, i - 2), Math.min(content.items.length, i + 3))
      .map((x) => x.str)
      .join("");
    if (window.includes(filter)) console.log(line);
  } else {
    console.log(line);
  }
}
