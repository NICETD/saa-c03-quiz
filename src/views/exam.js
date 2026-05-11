// Exam entry view: rules + start button + past exams.
// The actual quiz session is rendered by quiz.js with source=exam.

import { h, mount } from "../dom.js";
import { loadQuestions } from "../data.js";
import { chrome } from "./chrome.js";
import { t } from "../i18n.js";
import { getExams } from "../store.js";

export async function exam() {
  const { all } = await loadQuestions();
  const exams = getExams();

  const startExam = () => {
    if (!window.confirm(t("examStartConfirm"))) return;
    location.hash = "#/quiz?source=exam";
  };

  const node = h(
    "div",
    { class: "page page-exam" },
    chrome(all.length, "exam"),
    h(
      "main",
      { class: "main" },
      h(
        "section",
        { class: "exam-rules" },
        h("h2", null, "⏱  " + t("examRules")),
        h(
          "ul",
          { class: "rules-list" },
          h("li", null, h("span", { class: "rule-icon" }, "📋"), `65 ${t("examQ")}`),
          h("li", null, h("span", { class: "rule-icon" }, "⏰"), `130 ${t("examMinutes")}`),
          h("li", null, h("span", { class: "rule-icon" }, "🎯"), `${t("examPassLine")}: 720 ${t("examPoint")} / 1000`),
        ),
        h("button", { class: "btn-primary big", onClick: startExam }, "🚀  " + t("examStart")),
      ),
      h(
        "section",
        { class: "exam-history" },
        h("h2", null, "📜  " + t("examHistory")),
        exams.length === 0
          ? h("div", { class: "empty-state" }, t("noQuestions"))
          : h(
              "table",
              { class: "exam-table" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  h("th", null, t("examTime")),
                  h("th", null, t("rightCount")),
                  h("th", null, t("examScore")),
                  h("th", null, ""),
                  h("th", null, t("timeUsed")),
                ),
              ),
              h(
                "tbody",
                null,
                [...exams].reverse().map((e) => examRow(e)),
              ),
            ),
      ),
    ),
  );
  mount(node);
}

function examRow(e) {
  const d = new Date(e.finishedAt);
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const min = Math.floor(e.duration / 60000);
  const sec = Math.floor((e.duration % 60000) / 1000);
  return h(
    "tr",
    { class: e.passed ? "row-pass" : "row-fail" },
    h("td", null, dateStr),
    h("td", null, `${e.right}/${e.total}`),
    h("td", null, e.score),
    h("td", null, e.passed ? "✅" : "❌"),
    h("td", null, `${min}:${String(sec).padStart(2, "0")}`),
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}
