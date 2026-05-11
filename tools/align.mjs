// Best-effort content alignment between EN and ZH banks via local search.
// Strategy: for each EN question, look up the best ZH match within a sliding
// window around the same position, scoring on shared distinctive tokens.
// Then iterate to balance.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const en = JSON.parse(await fs.readFile(path.join(dataDir, "questions.en.json"), "utf-8"));
const zh = JSON.parse(await fs.readFile(path.join(dataDir, "questions.zh.json"), "utf-8"));

// Extract distinctive tokens from a stem.
//   - AWS service names (case-insensitive, strip spaces)
//   - Standalone numbers (10, 70, 100, 500, etc.)
//   - Numbers + units (TB, GB, MB, hours, minutes, %, /sec, etc.)
//   - CIDR-like patterns (10.0.0.0/16, 192.168.x.x, etc.)
//   - Capitalized acronyms (3+ chars) like CIDR, NACL, OAuth

const SERVICES = [
  "S3", "EC2", "RDS", "Aurora", "Lambda", "DynamoDB", "Kinesis", "EFS", "EBS", "FSx",
  "Glue", "Athena", "Redshift", "EKS", "ECS", "Cognito", "SQS", "SNS", "API Gateway",
  "CloudFront", "Route 53", "VPC", "Direct Connect", "CloudWatch", "EventBridge",
  "Step Functions", "SageMaker", "QuickSight", "Snowball", "DMS", "CloudFormation",
  "Auto Scaling", "ELB", "ALB", "NLB", "CloudTrail", "GuardDuty", "Config", "Inspector",
  "Trusted Advisor", "Budgets", "Cost Explorer", "Organizations", "IAM", "KMS",
  "Secrets Manager", "Systems Manager", "Elastic Beanstalk", "Fargate", "Outposts",
  "Storage Gateway", "DataSync", "Transfer Family", "Backup", "Macie", "Shield", "WAF",
  "OpenSearch", "ElastiCache", "Neptune", "DocumentDB", "Aurora Serverless", "S3 Glacier",
  "MSK", "MQ", "AppSync", "AppFlow", "Polly", "Rekognition", "Comprehend", "Translate",
  "Transcribe", "Forecast", "Personalize", "AppConfig", "ECR", "EBS Snapshot",
  "PrivateLink", "Transit Gateway", "Global Accelerator", "Route53", "ACM", "Network Firewall",
];

const SERVICE_PATTERNS = SERVICES.map((s) => ({
  name: s,
  patterns: [s, s.replace(/\s+/g, ""), "Amazon" + s.replace(/\s+/g, ""), "AWS" + s.replace(/\s+/g, "")],
}));

function tokens(stem) {
  const set = new Set();
  // services
  for (const sp of SERVICE_PATTERNS) {
    for (const p of sp.patterns) {
      if (stem.includes(p)) {
        set.add("svc:" + sp.name);
        break;
      }
    }
  }
  // numbers + units (combined)
  for (const m of stem.matchAll(/(\d+(?:[,.]\d+)*)\s*(TB|GB|MB|KB|PB|TiB|GiB|MiB|hours?|minutes?|seconds?|days?|weeks?|months?|years?|%|\/?sec)/gi)) {
    set.add("num:" + m[1].replace(/[,.]/g, "") + m[2].toLowerCase());
  }
  // CIDR or IP
  for (const m of stem.matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?)/g)) {
    set.add("cidr:" + m[1]);
  }
  // standalone large numbers
  for (const m of stem.matchAll(/\b(\d{3,}(?:,\d{3})*)\b/g)) {
    set.add("num:" + m[1].replace(/,/g, ""));
  }
  // acronyms 3-5 capital letters
  for (const m of stem.matchAll(/\b([A-Z]{3,5})\b/g)) {
    set.add("acr:" + m[1]);
  }
  return set;
}

function score(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

// Pre-compute token sets
const enTokens = en.map((q) => tokens(q.stem));
const zhTokens = zh.map((q) => tokens(q.stem));

// For each EN i, score all ZH within sliding window and rank.
const W = 200;
const candidates = []; // candidates[i] = sorted list of {zhId, score}
for (let i = 0; i < en.length; i++) {
  const list = [];
  const lo = Math.max(0, i - W), hi = Math.min(zh.length - 1, i + W);
  for (let j = lo; j <= hi; j++) {
    let s = score(enTokens[i], zhTokens[j]);
    if (en[i].answer.join("") === zh[j].answer.join("")) s += 0.15;
    if (en[i].options.length === zh[j].options.length) s += 0.05;
    if (en[i].type === zh[j].type) s += 0.05;
    if (s >= 0.3) list.push({ zhId: j + 1, score: s });
  }
  list.sort((a, b) => b.score - a.score);
  candidates.push(list);
}

// Iterative greedy bipartite matching:
//   Each EN holds a "current pick" (their top unclaimed candidate).
//   When two ENs claim the same ZH, the one with higher score wins; the loser
//   advances to its next-best candidate. Iterate until stable.
const enPick = new Array(en.length).fill(0); // index into candidates[i]
const zhOwner = new Map(); // zhId → enIndex
let changed = true;
let iterations = 0;
while (changed && iterations < 50) {
  changed = false;
  iterations++;
  for (let i = 0; i < en.length; i++) {
    while (enPick[i] < candidates[i].length) {
      const cur = candidates[i][enPick[i]];
      const owner = zhOwner.get(cur.zhId);
      if (owner === undefined) {
        zhOwner.set(cur.zhId, i);
        break;
      }
      if (owner === i) break;
      const ownerScore = candidates[owner][enPick[owner]].score;
      if (cur.score > ownerScore) {
        // Steal
        zhOwner.set(cur.zhId, i);
        enPick[owner]++;
        changed = true;
        break;
      } else {
        enPick[i]++;
        changed = true;
      }
    }
  }
}
console.log(`Iterations: ${iterations}`);

let highScore = 0, midScore = 0, lowScore = 0;
const matches = [];
for (let i = 0; i < en.length; i++) {
  if (enPick[i] < candidates[i].length) {
    const m = candidates[i][enPick[i]];
    matches.push({ enId: i + 1, zhId: m.zhId, score: m.score });
    if (m.score >= 0.6) highScore++;
    else if (m.score >= 0.35) midScore++;
    else lowScore++;
  } else {
    matches.push({ enId: i + 1, zhId: 0, score: candidates[i][0]?.score || 0 });
    lowScore++;
  }
}
console.log(`After matching: high=${highScore}, mid=${midScore}, low/none=${lowScore}`);

const mapping = matches.map((m) => {
  if (m.zhId && m.score >= 0.35) {
    return { enId: m.enId, zhId: m.zhId, score: Number(m.score.toFixed(3)) };
  }
  return { enId: m.enId, zhId: null, score: Number(m.score.toFixed(3)) };
});
const matched = mapping.filter((m) => m.zhId !== null).length;
console.log(`Final paired questions: ${matched} / ${en.length}`);

// How many ZH questions remain unmatched?
const zhMatched = new Set(mapping.filter((m) => m.zhId).map((m) => m.zhId));
console.log(`ZH unmatched: ${zh.length - zhMatched.size}`);

// Sample some matched and unmatched pairs
console.log("\nSample matches (top 5 by score):");
const sorted = [...mapping].filter((m) => m.zhId).sort((a, b) => b.score - a.score);
for (const m of sorted.slice(0, 5)) {
  console.log(`  EN${m.enId} ↔ ZH${m.zhId} (${m.score})  EN: ${en[m.enId - 1].stem.slice(0, 70)}`);
}
console.log("\nSample low-confidence (worst 5 of matched):");
for (const m of sorted.slice(-5).reverse()) {
  console.log(`  EN${m.enId} ↔ ZH${m.zhId} (${m.score})  EN: ${en[m.enId - 1].stem.slice(0, 70)}`);
  console.log(`     ZH: ${zh[m.zhId - 1].stem.slice(0, 70)}`);
}
console.log("\nSample unmatched EN (first 5):");
for (const m of mapping.filter((m) => !m.zhId).slice(0, 5)) {
  console.log(`  EN${m.enId} (best score ${m.score})  ${en[m.enId - 1].stem.slice(0, 80)}`);
}

await fs.writeFile(path.join(__dirname, "alignment.json"), JSON.stringify(mapping, null, 2));
console.log("\nWrote alignment.json");
