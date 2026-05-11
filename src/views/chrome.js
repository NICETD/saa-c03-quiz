// Shared top chrome: brand + dashboard + nav.
// Language switching is per-quiz-page, not in the chrome — see langSwitch().

import { h } from "../dom.js";
import { go } from "../router.js";
import { getStats, getLang, setLang } from "../store.js";
import { t, setUiLang } from "../i18n.js";

export function chrome(total, current = "home") {
  // UI chrome always uses ZH (the user's primary language). Question content
  // display lang is selected per-quiz-page via langSwitch().
  setUiLang("zh");

  const stats = getStats(total);

  const navItem = (key, label) =>
    h(
      "a",
      {
        class: `nav-item ${current === key ? "active" : ""}`,
        href: `#/${key === "home" ? "" : key}`,
      },
      label,
    );

  return h(
    "header",
    { class: "chrome" },
    h(
      "div",
      { class: "chrome-top" },
      h(
        "div",
        { class: "brand", onClick: () => go("#/") },
        h("span", { class: "brand-mark" }, "SAA"),
        h("span", { class: "brand-name" }, t("appTitle")),
      ),
    ),
    dashboard(stats),
    h(
      "nav",
      { class: "nav" },
      navItem("home", t("home")),
      navItem("practice", t("practice")),
      navItem("exam", t("exam")),
      navItem("review", t("review")),
      navItem("stats", t("stats")),
    ),
  );
}

/**
 * In-place language switch component (used on the quiz page, above the stem).
 * onChange receives the new lang and should re-render the quiz UI in place
 * (without changing the URL) so question index / picks are preserved.
 */
export function langSwitch(onChange) {
  const lang = getLang();
  const btn = (val, label) =>
    h(
      "button",
      {
        class: `lang-btn ${lang === val ? "active" : ""}`,
        onClick: () => {
          if (getLang() === val) return;
          setLang(val);
          onChange(val);
        },
      },
      label,
    );
  return h(
    "div",
    { class: "lang-switch lang-switch-inline" },
    btn("zh", t("langZh")),
    btn("en", t("langEn")),
    btn("both", t("langBoth")),
  );
}

function dashboard(s) {
  const rate = s.rate.toFixed(1);
  return h(
    "div",
    { class: "dashboard" },
    statCard("📚", t("total"), s.total, "neutral"),
    statCard("✏️", t("answered"), s.answered, "info"),
    statCard("✅", t("correct"), s.correct, "good"),
    statCard("❌", t("incorrect"), s.incorrect, "bad"),
    statCard("🎯", t("rate"), rate + "%", rate >= 70 ? "good" : rate >= 50 ? "info" : "bad"),
  );
}

function statCard(icon, label, val, tone) {
  return h(
    "div",
    { class: `stat-card stat-${tone}` },
    h("div", { class: "stat-icon" }, icon),
    h(
      "div",
      { class: "stat-body" },
      h("div", { class: "stat-val" }, String(val)),
      h("div", { class: "stat-label" }, label),
    ),
  );
}
