// Practice view: Section grid + custom range + order toggle.

import { h, mount } from "../dom.js";
import { loadQuestions, sections } from "../data.js";
import { chrome } from "./chrome.js";
import { t } from "../i18n.js";
import { getProgress } from "../store.js";

export async function practice() {
  const { all } = await loadQuestions();
  const progress = getProgress();
  const secs = sections(all.length, 50);

  let order = "sequential";

  const orderBtn = (val, label) => {
    const b = h(
      "button",
      {
        class: `seg-btn ${order === val ? "active" : ""}`,
        onClick: () => {
          order = val;
          // Re-render the order segment
          rerender();
        },
      },
      label,
    );
    return b;
  };

  const fromInput = h("input", { type: "number", min: "1", max: String(all.length), value: "1", class: "range-input" });
  const toInput = h("input", { type: "number", min: "1", max: String(all.length), value: String(all.length), class: "range-input" });

  const orderRow = h(
    "div",
    { class: "order-row", id: "order-row" },
    h("span", { class: "field-label" }, t("order") + ":"),
    orderBtn("sequential", t("sequential")),
    orderBtn("random", t("random")),
  );

  function rerender() {
    const old = document.getElementById("order-row");
    if (old) old.replaceWith(orderRow);
    // Bypass: we just re-rendered the buttons via reactive class updates.
    // Simplest: just update class names on existing buttons.
    for (const btn of orderRow.querySelectorAll(".seg-btn")) {
      btn.classList.toggle("active", btn.textContent === (order === "sequential" ? t("sequential") : t("random")));
    }
  }

  const startSection = (s) => {
    const url = `#/quiz?source=section&from=${s.from}&to=${s.to}&order=${order}`;
    location.hash = url;
  };

  const startCustom = () => {
    const from = Math.max(1, Math.min(all.length, Number(fromInput.value) || 1));
    const to = Math.max(from, Math.min(all.length, Number(toInput.value) || all.length));
    location.hash = `#/quiz?source=range&from=${from}&to=${to}&order=${order}`;
  };

  const node = h(
    "div",
    { class: "page page-practice" },
    chrome(all.length, "practice"),
    h(
      "main",
      { class: "main" },
      h("h2", { class: "section-title" }, "🗂  " + t("section")),
      h(
        "div",
        { class: "section-grid" },
        secs.map((s) => sectionCard(s, progress, startSection)),
      ),
      h("h2", { class: "section-title" }, "✏️  " + t("customRange")),
      h(
        "div",
        { class: "range-row" },
        h("span", { class: "field-label" }, t("rangeFrom") + ":"),
        fromInput,
        h("span", { class: "field-label" }, t("rangeTo") + ":"),
        toInput,
        h("button", { class: "btn-primary", onClick: startCustom }, t("startQuiz")),
      ),
      orderRow,
    ),
  );
  mount(node);
}

function sectionCard(s, progress, onStart) {
  let answered = 0, correct = 0;
  for (let id = s.from; id <= s.to; id++) {
    const p = progress[id];
    if (!p) continue;
    answered++;
    if (p.correct) correct++;
  }
  const total = s.to - s.from + 1;
  const rate = answered === 0 ? 0 : (correct / answered) * 100;
  const pct = (answered / total) * 100;

  const done = pct >= 100;
  const rateClass = answered === 0 ? "" : rate >= 80 ? "rate-good" : rate >= 60 ? "rate-mid" : "rate-bad";
  return h(
    "div",
    { class: `section-card ${done ? "section-done" : ""}` , onClick: () => onStart(s) },
    h(
      "div",
      { class: "sec-head" },
      h("div", { class: "sec-title" }, s.label),
      done ? h("span", { class: "sec-badge" }, "🏆") : null,
    ),
    h(
      "div",
      { class: "sec-stats" },
      h("div", { class: "sec-stat" }, h("span", { class: "sec-num" }, `${answered}/${total}`), h("span", { class: "sec-lbl" }, t("completed"))),
      h("div", { class: `sec-stat ${rateClass}` }, h("span", { class: "sec-num" }, `${rate.toFixed(0)}%`), h("span", { class: "sec-lbl" }, t("accuracy"))),
    ),
    h(
      "div",
      { class: "sec-bar" },
      h("div", { class: "sec-bar-fill", style: { width: `${pct}%` } }),
    ),
  );
}
