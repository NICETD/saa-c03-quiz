// Stats view: aggregated dashboard.
// - Today / this week / streak / mastered / favorites / wrong count
// - 60-day activity heatmap
// - Per-section accuracy bar
// - Mock exam history sparkline (line of dots)

import { h, mount } from "../dom.js";
import { loadQuestions, sections } from "../data.js";
import { chrome } from "./chrome.js";
import { t } from "../i18n.js";
import { getProgress, getFavorites, getExams, resetAll } from "../store.js";

export async function stats() {
  const { all } = await loadQuestions();
  const p = getProgress();
  const favs = getFavorites();
  const exams = getExams();
  const today0 = startOfDay(new Date()).getTime();
  const week0 = today0 - 6 * 86400000;

  let todayCount = 0,
    weekCount = 0,
    masteredCount = 0,
    wrongCount = 0;

  // Per-day activity over last 60 days
  const days = 60;
  const heatmap = new Array(days).fill(0);
  const baseDay = today0 - (days - 1) * 86400000;

  for (const idStr of Object.keys(p)) {
    const r = p[idStr];
    const records = [{ ts: r.ts, correct: r.correct }, ...(r.history || [])];
    if (r.correct === false) wrongCount++;
    // mastered = current answer correct AND at least one previous incorrect, OR consistently right with >=2 attempts
    const histAll = [...(r.history || []), { ts: r.ts, correct: r.correct }];
    const allRight = histAll.every((h) => h.correct);
    if (allRight && histAll.length >= 2) masteredCount++;
    else if (allRight && r.correct) {
      // Counted only when answered multiple times correctly OR mark single-correct as mastered when correct=true
      // We'll be lenient: single correct answer = mastered.
      masteredCount++;
    }
    for (const rec of records) {
      const ts = rec.ts;
      if (ts >= today0) todayCount++;
      if (ts >= week0) weekCount++;
      const dayIdx = Math.floor((startOfDay(new Date(ts)).getTime() - baseDay) / 86400000);
      if (dayIdx >= 0 && dayIdx < days) heatmap[dayIdx]++;
    }
  }

  const streak = computeStreak(heatmap, days);

  // Per-section accuracy
  const secs = sections(all.length, 50);
  const secStats = secs.map((s) => {
    let ans = 0, right = 0;
    for (let id = s.from; id <= s.to; id++) {
      const r = p[id];
      if (!r) continue;
      ans++;
      if (r.correct) right++;
    }
    const rate = ans === 0 ? 0 : (right / ans) * 100;
    return { ...s, ans, right, rate };
  });

  const node = h(
    "div",
    { class: "page page-stats" },
    chrome(all.length, "stats"),
    h(
      "main",
      { class: "main stats-main" },
      h(
        "section",
        { class: "stats-cards" },
        statCard("📅", todayCount, t("todayAnswered")),
        statCard("📊", weekCount, t("weekAnswered")),
        statCard("🔥", streak, t("streakDays")),
        statCard("🎓", masteredCount, t("masteredCount")),
        statCard("⭐", favs.size, t("favCount")),
        statCard("💔", wrongCount, t("wrongCount")),
      ),
      heatmapSection(heatmap, baseDay),
      sectionAccuracyChart(secStats),
      examChart(exams),
      dangerZone(),
    ),
  );
  mount(node);
}

function statCard(icon, val, label) {
  return h(
    "div",
    { class: "stats-card" },
    h("div", { class: "stats-icon" }, icon),
    h("div", { class: "stats-num" }, val),
    h("div", { class: "stats-lbl" }, label),
  );
}

function heatmapSection(heatmap, baseDay) {
  const max = Math.max(1, ...heatmap);
  const cells = heatmap.map((v, i) => {
    const level = v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3));
    const d = new Date(baseDay + i * 86400000);
    return h("div", {
      class: `heat-cell level-${level}`,
      title: `${d.getMonth() + 1}/${d.getDate()}: ${v}`,
    });
  });
  return h(
    "section",
    { class: "heatmap-section" },
    h("h2", { class: "stats-section-title" }, "🔥  " + t("activityHeatmap")),
    h("div", { class: "heatmap" }, cells),
  );
}

function sectionAccuracyChart(secStats) {
  return h(
    "section",
    { class: "bar-section" },
    h("h2", { class: "stats-section-title" }, "🎯  " + t("sectionAccuracy")),
    h(
      "div",
      { class: "bar-list" },
      secStats.map((s) => {
        const hasData = s.ans > 0;
        return h(
          "div",
          { class: "bar-row" },
          h("span", { class: "bar-label" }, s.label),
          h(
            "div",
            { class: "bar-track" },
            h("div", { class: "bar-fill", style: { width: `${s.rate}%` } }),
          ),
          h("span", { class: "bar-val" }, hasData ? `${s.rate.toFixed(0)}% (${s.ans})` : "—"),
        );
      }),
    ),
  );
}

function examChart(exams) {
  if (exams.length === 0) return null;
  const max = 1000;
  return h(
    "section",
    { class: "exam-chart-section" },
    h("h2", { class: "stats-section-title" }, "📈  " + t("examHistoryChart")),
    h(
      "div",
      { class: "exam-chart" },
      exams.map((e, i) =>
        h(
          "div",
          { class: "exam-bar-wrap", title: `${new Date(e.finishedAt).toLocaleDateString()}: ${e.score}` },
          h("div", {
            class: `exam-bar ${e.passed ? "pass" : "fail"}`,
            style: { height: `${(e.score / max) * 100}%` },
          }),
          h("div", { class: "exam-bar-lbl" }, e.score),
        ),
      ),
    ),
    h("div", { class: "exam-chart-pass-line" }, `${t("examPassLine")}: 720`),
  );
}

function dangerZone() {
  return h(
    "section",
    { class: "danger-zone" },
    h(
      "button",
      {
        class: "btn-danger",
        onClick: () => {
          if (window.confirm(t("dangerConfirm"))) {
            resetAll();
            location.reload();
          }
        },
      },
      t("danger"),
    ),
  );
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function computeStreak(heatmap, days) {
  // Streak counts consecutive days ending today with activity.
  let streak = 0;
  for (let i = days - 1; i >= 0; i--) {
    if (heatmap[i] > 0) streak++;
    else break;
  }
  return streak;
}
