// Home view: 4 mode cards.

import { h, mount } from "../dom.js";
import { loadQuestions } from "../data.js";
import { chrome } from "./chrome.js";
import { t } from "../i18n.js";
import { getLastQuiz } from "../store.js";

export async function home() {
  const { all } = await loadQuestions();
  const last = getLastQuiz();
  const node = h(
    "div",
    { class: "page page-home" },
    chrome(all.length, "home"),
    h(
      "main",
      { class: "main" },
      last
        ? h(
            "div",
            { class: "resume-banner" },
            h("span", { class: "resume-text" },
              h("span", { class: "resume-icon" }, "📌"),
              `${t("continue")} · ${last.source} (${last.idx + 1}/${last.ids.length})`,
            ),
            h("a", { class: "btn-primary", href: "#/quiz/resume" }, "▶  " + t("continue")),
          )
        : null,
      h(
        "section",
        { class: "mode-grid" },
        modeCard("practice", t("practice"), "📚", "按题号范围 / Section 顺序或随机刷题"),
        modeCard("exam", t("exam"), "⏱", "65 题 · 130 分钟 · 720 分通过线"),
        modeCard("review", t("review"), "🔁", "复习错题 / 答对题 / 收藏题"),
        modeCard("stats", t("stats"), "📊", "热力图、Section 正确率、考试历史"),
      ),
      bankInfo(all),
    ),
  );
  mount(node);
}

function modeCard(slug, label, icon, sub) {
  return h(
    "a",
    { class: "mode-card", href: `#/${slug}` },
    h("div", { class: "mode-icon" }, icon),
    h("div", { class: "mode-text" }, h("div", { class: "mode-title" }, label), h("div", { class: "mode-sub" }, sub)),
  );
}

function bankInfo(all) {
  const bilingual = all.filter((q) => q.zh).length;
  const explained = all.filter((q) => q.en.explanation).length;
  return h(
    "section",
    { class: "bank-info" },
    h(
      "div",
      { class: "bank-row" },
      h("span", null, h("span", { class: "bank-icon" }, "📚"), " ", t("bankSize")),
      h("strong", null, all.length),
    ),
    h(
      "div",
      { class: "bank-row" },
      h("span", null, h("span", { class: "bank-icon" }, "🌐"), " ", t("bilingualCount")),
      h("strong", null, `${bilingual} (${((bilingual / all.length) * 100).toFixed(0)}%)`),
    ),
    h(
      "div",
      { class: "bank-row" },
      h("span", null, h("span", { class: "bank-icon" }, "💡"), " ", t("explanationCount")),
      h("strong", null, `${explained} (${((explained / all.length) * 100).toFixed(0)}%)`),
    ),
  );
}
