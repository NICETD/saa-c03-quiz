// Review view: filter (all/wrong/right/favorites) + list + "刷此列表" button.

import { h, mount } from "../dom.js";
import { loadQuestions } from "../data.js";
import { chrome } from "./chrome.js";
import { t } from "../i18n.js";
import { getReviewIds, getLang } from "../store.js";

export async function review(params) {
  const { all } = await loadQuestions();
  const filter = params.filter || "wrong";
  const allIds = all.map((q) => q.id);
  const ids = getReviewIds(filter, allIds);
  const lang = getLang();

  const FILTER_META = {
    all: { icon: "📋", label: t("filterAll") },
    wrong: { icon: "💔", label: t("filterWrong") },
    right: { icon: "✅", label: t("filterRight") },
    favorites: { icon: "⭐", label: t("filterFav") },
  };
  const filterBtn = (val) => {
    const meta = FILTER_META[val];
    return h(
      "a",
      {
        class: `seg-btn seg-btn-icon ${filter === val ? "active" : ""}`,
        href: `#/review?filter=${val}`,
      },
      h("span", { class: "seg-icon" }, meta.icon),
      h("span", null, meta.label),
    );
  };

  const startReviewQuiz = () => {
    if (ids.length === 0) return;
    const url = `#/quiz?source=review&filter=${filter}`;
    location.hash = url;
  };

  const node = h(
    "div",
    { class: "page page-review" },
    chrome(all.length, "review"),
    h(
      "main",
      { class: "main" },
      h(
        "div",
        { class: "filter-row" },
        filterBtn("all"),
        filterBtn("wrong"),
        filterBtn("right"),
        filterBtn("favorites"),
      ),
      h(
        "div",
        { class: "review-action" },
        h(
          "span",
          { class: "review-count" },
          `${ids.length} ${t("questionN").replace("X", "").trim()}`,
        ),
        ids.length > 0
          ? h("button", { class: "btn-primary", onClick: startReviewQuiz }, t("startQuiz"))
          : null,
      ),
      ids.length === 0
        ? h(
            "div",
            { class: "empty-state" },
            h("div", { class: "empty-icon" }, FILTER_META[filter]?.icon || "📭"),
            h("div", { class: "empty-text" }, emptyHint(filter)),
          )
        : h(
            "ul",
            { class: "review-list" },
            ids.map((id, idx) => reviewItem(id, all.find((q) => q.id === id), lang, idx)),
          ),
    ),
  );
  mount(node);
}

function reviewItem(id, q, lang, idx) {
  // Render only stem, no options. Lang follows global pref.
  let stem = "";
  if (lang === "en" || !q.zh) stem = q.en.stem;
  else if (lang === "zh") stem = q.zh.stem;
  else stem = `${q.zh.stem}\n${q.en.stem}`; // both
  const url = `#/quiz?source=review&filter=${getFilterFromHash()}&start=${idx}`;
  return h(
    "li",
    {
      class: "review-item",
      onClick: () => (location.hash = url),
    },
    h("span", { class: "review-num" }, "#" + id),
    h("span", { class: "review-stem" }, stem.slice(0, 220) + (stem.length > 220 ? "…" : "")),
  );
}

function getFilterFromHash() {
  const m = location.hash.match(/filter=([^&]+)/);
  return m ? m[1] : "wrong";
}

function emptyHint(filter) {
  switch (filter) {
    case "wrong": return "目前没有错题，继续保持 💪";
    case "right": return "还没有答对的题，开始练习吧 🚀";
    case "favorites": return "还没有收藏题目，刷题时点 ☆ 收藏";
    default: return "还没有作答过的题目，去练习页开始吧 📚";
  }
}
