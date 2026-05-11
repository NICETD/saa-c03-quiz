import fs from "node:fs";
const en = JSON.parse(fs.readFileSync("../data/questions.en.json", "utf-8"));
const zh = JSON.parse(fs.readFileSync("../data/questions.zh.json", "utf-8"));

const enQ200 = en[199];
console.log("EN Q200 stem:", enQ200.stem.slice(0, 150));

const zhMatches = zh.filter(
  (q) => q.stem.includes("VPC 对等") || q.stem.includes("VPCA") || q.stem.includes("VPCB"),
);
console.log("ZH containing VPC 对等/VPCA/VPCB:", zhMatches.length);
for (const m of zhMatches.slice(0, 5)) console.log("  ZH Q" + m.id + ":", m.stem.slice(0, 100));

const zhQ200 = zh[199];
console.log("\nZH Q200 stem:", zhQ200.stem.slice(0, 150));
const enMatches = en.filter(
  (q) => q.stem.includes("monitoring devices") || (q.stem.includes("API") && q.stem.includes("RDS DB instance")),
);
console.log("EN matching ZH Q200 keywords:", enMatches.length);
for (const m of enMatches.slice(0, 5)) console.log("  EN Q" + m.id + ":", m.stem.slice(0, 100));

// Try to map each ZH question to an EN one by stem keyword sets — see how many can be matched.
// Use a simple bag-of-AWS-service-names heuristic.
const services = [
  "S3", "EC2", "RDS", "Aurora", "Lambda", "DynamoDB", "Kinesis", "EFS", "EBS", "FSx", "Glue", "Athena",
  "Redshift", "EKS", "ECS", "Cognito", "SQS", "SNS", "API Gateway", "CloudFront", "Route 53", "VPC",
  "DirectConnect", "CloudWatch", "EventBridge", "Step Functions", "SageMaker", "QuickSight",
  "Snowball", "DMS", "CloudFormation", "Auto Scaling", "ELB", "ALB", "NLB", "CloudTrail", "GuardDuty",
];
function bag(text) {
  const set = new Set();
  for (const s of services) {
    const enHit = text.includes(s) || text.includes(s.replace(/\s/g, ""));
    if (enHit) set.add(s);
  }
  return set;
}
function score(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

let bestMatchSamePosition = 0;
let bestMatchAny = 0;
for (let i = 0; i < zh.length; i++) {
  const z = zh[i];
  const zb = bag(z.stem);
  if (zb.size === 0) continue;
  // Find best EN match
  let best = -1, bestS = 0;
  for (let j = 0; j < en.length; j++) {
    const eb = bag(en[j].stem);
    const s = score(zb, eb);
    if (s > bestS) { bestS = s; best = j; }
  }
  if (best === i) bestMatchSamePosition++;
  if (bestS > 0.5) bestMatchAny++;
}
console.log("\nZH→EN best match at same position:", bestMatchSamePosition, "/", zh.length);
console.log("ZH→EN best match has score > 0.5:", bestMatchAny, "/", zh.length);
