// Quiz view: shared by practice, review, and exam (exam has timer + deferred grading).
//
// URL params:
//   source=section|range|review|exam
//   from, to             (for section / range)
//   order=sequential|random
//   filter=all|wrong|right|favorites  (for review)
//   start=<idx>          (for review item click)
//   mode=exam            (for mock exam — defer answer reveal)
//
// The view computes the id list once, walks through it via a local `idx` state,
// and renders the current question. Selecting an answer records progress and
// reveals the correct answer + explanation (except in exam mode).

import { h, mount } from "../dom.js";
import { loadQuestions, sections, shuffle, pickRandom } from "../data.js";
import { chrome, langSwitch } from "./chrome.js";
import { t } from "../i18n.js";
import {
  getLang,
  recordAnswer,
  toggleFavorite,
  isFavorite,
  getReviewIds,
  addExam,
  setLastQuiz,
} from "../store.js";
import { go } from "../router.js";

export async function quiz(params) {
  const { all, byId } = await loadQuestions();
  const allIds = all.map((q) => q.id);

  // Build the ID list for this session.
  let ids = [];
  const source = params.source || "section";
  if (source === "section" || source === "range") {
    const from = Math.max(1, Number(params.from) || 1);
    const to = Math.min(all.length, Number(params.to) || all.length);
    for (let i = from; i <= to; i++) ids.push(i);
    if (params.order === "random") ids = shuffle(ids);
  } else if (source === "review") {
    const filter = params.filter || "wrong";
    ids = getReviewIds(filter, allIds);
  } else if (source === "exam") {
    ids = pickRandom(allIds, 65);
  }

  if (ids.length === 0) {
    mount(
      h(
        "div",
        { class: "page page-quiz" },
        chrome(all.length),
        h("main", { class: "main" }, h("div", { class: "empty-state" }, t("noQuestions"))),
      ),
    );
    return;
  }

  const isExam = source === "exam";
  let idx = Math.max(0, Math.min(ids.length - 1, Number(params.start) || 0));

  // Exam state: temporary picks (not committed to store until 交卷).
  const examPicks = isExam ? new Array(ids.length).fill(null) : null;
  const examStartTs = isExam ? Date.now() : 0;
  const EXAM_DURATION_MS = 130 * 60 * 1000;
  let examTimer = null;
  let submitted = false;

  function persistLastQuiz() {
    if (isExam) return; // don't auto-save mock exam state
    setLastQuiz({ source, params: { ...params }, ids, idx });
  }

  function render() {
    persistLastQuiz();
    const id = ids[idx];
    const q = byId.get(id);
    const lang = getLang();

    // Top progress bar + nav controls
    const top = h(
      "div",
      { class: "quiz-top" },
      h(
        "div",
        { class: "quiz-progress-info" },
        h("span", null, `${t("questionN").replace("X", String(idx + 1))} ${t("of")} ${ids.length}`),
        h("span", { class: "qid-badge" }, `#${id}`),
        isFavorite(id) ? h("span", { class: "fav-mark", title: t("unfav") }, "★") : null,
      ),
      h(
        "div",
        { class: "quiz-bar" },
        h("div", { class: "quiz-bar-fill", style: { width: `${((idx + 1) / ids.length) * 100}%` } }),
      ),
      isExam
        ? h("div", { class: "exam-timer", id: "exam-timer" }, "")
        : null,
    );

    const stemSection = renderStem(q, lang);
    const optsSection = renderOptions(q, lang, isExam, examPicks, idx, onPick, onConfirmMulti);
    const explanSection = h("div", { class: "explan-area", id: "explan-area" });
    const navSection = renderNav(idx, ids.length);
    // In-place language switch: re-renders the current question without
    // touching the URL, so the question index and exam picks are preserved.
    const lswitch = langSwitch(() => render());

    const container = h(
      "div",
      { class: "page page-quiz" },
      chrome(all.length),
      h(
        "main",
        { class: "main quiz-main" },
        top,
        lswitch,
        stemSection,
        optsSection,
        explanSection,
        navSection,
      ),
    );
    mount(container);

    if (isExam) startExamTimer();

    // For non-exam: if this question is already answered, show the result.
    if (!isExam) {
      const prog = getStoreProg();
      const p = prog[id];
      if (p) {
        revealAnswer(q, lang, p.picked, p.correct);
        // Mark options as locked
        for (const cb of document.querySelectorAll(".opt-input")) cb.disabled = true;
        // Highlight selections
        for (const cb of document.querySelectorAll(".opt-input")) {
          const key = cb.value;
          const li = cb.closest(".opt");
          if (p.picked.includes(key)) li.classList.add("picked");
          if (q.answer.includes(key)) li.classList.add("correct");
          if (p.picked.includes(key) && !q.answer.includes(key)) li.classList.add("wrong");
        }
      }
    } else if (examPicks[idx] !== null) {
      // Restore the picks visually (no reveal in exam mode)
      const picked = examPicks[idx];
      for (const cb of document.querySelectorAll(".opt-input")) {
        const li = cb.closest(".opt");
        if (picked.includes(cb.value)) {
          cb.checked = true;
          li.classList.add("picked");
        }
      }
    }
  }

  function getStoreProg() {
    // Lazy import-free read for fewer imports
    try {
      return JSON.parse(localStorage.getItem("saa.progress") || "{}");
    } catch {
      return {};
    }
  }

  function onPick(q, picked) {
    // Single-choice path: pick instantly.
    if (isExam) {
      examPicks[idx] = picked;
      // Visual update only — no reveal.
      for (const cb of document.querySelectorAll(".opt-input")) {
        const li = cb.closest(".opt");
        li.classList.toggle("picked", picked.includes(cb.value));
      }
      return;
    }
    const correct = arrayEq(picked, q.answer);
    recordAnswer(q.id, picked, correct, "practice");
    const lang = getLang();
    revealAnswer(q, lang, picked, correct);
    for (const cb of document.querySelectorAll(".opt-input")) {
      cb.disabled = true;
      const li = cb.closest(".opt");
      if (picked.includes(cb.value)) li.classList.add("picked");
      if (q.answer.includes(cb.value)) li.classList.add("correct");
      if (picked.includes(cb.value) && !q.answer.includes(cb.value)) li.classList.add("wrong");
    }
  }

  function onConfirmMulti(q) {
    const picked = [...document.querySelectorAll(".opt-input:checked")].map((cb) => cb.value).sort();
    if (picked.length === 0) return;
    if (isExam) {
      examPicks[idx] = picked;
      for (const cb of document.querySelectorAll(".opt-input")) {
        const li = cb.closest(".opt");
        li.classList.toggle("picked", picked.includes(cb.value));
      }
      return;
    }
    const correct = arrayEq(picked, [...q.answer].sort());
    recordAnswer(q.id, picked, correct, "practice");
    const lang = getLang();
    revealAnswer(q, lang, picked, correct);
    for (const cb of document.querySelectorAll(".opt-input")) {
      cb.disabled = true;
      const li = cb.closest(".opt");
      if (picked.includes(cb.value)) li.classList.add("picked");
      if (q.answer.includes(cb.value)) li.classList.add("correct");
      if (picked.includes(cb.value) && !q.answer.includes(cb.value)) li.classList.add("wrong");
    }
  }

  function renderNav(i, n) {
    const prevBtn = h(
      "button",
      {
        class: "btn-ghost",
        disabled: i === 0 ? "true" : null,
        onClick: () => {
          if (idx > 0) {
            idx--;
            render();
          }
        },
      },
      "← " + t("prev"),
    );
    const nextBtn = h(
      "button",
      {
        class: "btn-ghost",
        disabled: i === n - 1 ? "true" : null,
        onClick: () => {
          if (idx < n - 1) {
            idx++;
            render();
          } else if (!isExam) {
            // Finished
            location.hash = "#/";
          }
        },
      },
      t("next") + " →",
    );
    const id = ids[idx];
    const favBtn = h(
      "button",
      {
        class: "btn-ghost",
        onClick: () => {
          toggleFavorite(id);
          render();
        },
      },
      isFavorite(id) ? "★ " + t("unfav") : "☆ " + t("fav"),
    );
    const controls = [prevBtn, favBtn, nextBtn];
    if (isExam) {
      controls.push(h("button", { class: "btn-primary", onClick: confirmSubmit }, "📨 " + t("submit")));
    }
    return h("div", { class: "quiz-nav" }, ...controls);
  }

  function startExamTimer() {
    if (examTimer) clearInterval(examTimer);
    const tick = () => {
      const remain = EXAM_DURATION_MS - (Date.now() - examStartTs);
      const el = document.getElementById("exam-timer");
      if (!el) return;
      if (remain <= 0) {
        el.textContent = "00:00";
        clearInterval(examTimer);
        submitExam(true);
        return;
      }
      const m = Math.floor(remain / 60000);
      const s = Math.floor((remain % 60000) / 1000);
      el.textContent = `⏱ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      el.classList.toggle("danger", remain < 5 * 60 * 1000);
    };
    tick();
    examTimer = setInterval(tick, 1000);
  }

  function confirmSubmit() {
    if (submitted) return;
    if (!window.confirm(t("submitConfirm"))) return;
    submitExam(false);
  }

  function submitExam(timeUp) {
    if (submitted) return;
    submitted = true;
    if (examTimer) clearInterval(examTimer);

    let right = 0;
    const detail = [];
    for (let k = 0; k < ids.length; k++) {
      const q = byId.get(ids[k]);
      const picked = examPicks[k] || [];
      const correct = arrayEq([...picked].sort(), [...q.answer].sort()) && picked.length > 0;
      if (correct) right++;
      detail.push({ id: q.id, picked, correct });
      // Record into progress so the question shows up in "wrong list"
      recordAnswer(q.id, picked, correct, "exam");
    }
    const score = Math.round((right / ids.length) * 1000);
    const passed = score >= 720;
    const finishedAt = Date.now();
    addExam({
      startedAt: examStartTs,
      finishedAt,
      duration: finishedAt - examStartTs,
      total: ids.length,
      right,
      score,
      passed,
      timeUp,
      detail,
    });
    renderExamResult({ right, score, passed, total: ids.length, timeUp, duration: finishedAt - examStartTs, detail });
  }

  function renderExamResult(r) {
    const minutes = Math.floor(r.duration / 60000);
    const seconds = Math.floor((r.duration % 60000) / 1000);
    const wrongIds = r.detail.filter((d) => !d.correct).map((d) => d.id);

    const node = h(
      "div",
      { class: "page page-exam-result" },
      chrome(all.length),
      h(
        "main",
        { class: "main exam-result-main" },
        h(
          "div",
          { class: `result-card ${r.passed ? "passed" : "failed"}` },
          h("h1", { class: "result-title" }, r.passed ? "🎉 " + t("passed") : "😔 " + t("notPassed")),
          r.timeUp ? h("div", { class: "timeup-note" }, t("timeUp")) : null,
          h(
            "div",
            { class: "result-stats" },
            h(
              "div",
              { class: "result-stat" },
              h("div", { class: "result-num" }, r.score),
              h("div", { class: "result-lbl" }, t("yourScore") + " / 1000"),
            ),
            h(
              "div",
              { class: "result-stat" },
              h("div", { class: "result-num" }, `${r.right}/${r.total}`),
              h("div", { class: "result-lbl" }, t("rightCount")),
            ),
            h(
              "div",
              { class: "result-stat" },
              h("div", { class: "result-num" }, `${minutes}:${String(seconds).padStart(2, "0")}`),
              h("div", { class: "result-lbl" }, t("timeUsed")),
            ),
          ),
          h(
            "div",
            { class: "result-actions" },
            wrongIds.length > 0
              ? h(
                  "button",
                  {
                    class: "btn-primary",
                    onClick: () => {
                      // Stash wrong ids in URL via a temporary review mode
                      // Use review filter "wrong" — those just-added wrong answers are now in the wrong list.
                      location.hash = "#/quiz?source=review&filter=wrong";
                    },
                  },
                  t("reviewIncorrect"),
                )
              : null,
            h("a", { class: "btn-ghost", href: "#/" }, t("backToHome")),
          ),
        ),
      ),
    );
    mount(node);
  }
  render();
}

function renderStem(q, lang) {
  const enStem = q.en.stem;
  const zhStem = q.zh ? q.zh.stem : null;

  if (lang === "both" && zhStem) {
    return h(
      "section",
      { class: "stem stem-both" },
      h("div", { class: "stem-zh" }, zhStem),
      h("div", { class: "stem-en" }, enStem),
    );
  }
  if (lang === "zh" && zhStem) {
    return h("section", { class: "stem" }, zhStem);
  }
  if (lang === "zh" && !zhStem) {
    return h(
      "section",
      { class: "stem stem-both" },
      h("div", { class: "stem-note" }, t("noTranslation")),
      h("div", { class: "stem-en" }, enStem),
    );
  }
  // EN only
  return h("section", { class: "stem" }, enStem);
}

function renderOptions(q, lang, isExam, examPicks, idx, onPick, onConfirmMulti) {
  const multi = q.type === "multiple";
  const inputType = multi ? "checkbox" : "radio";

  // Option text: for both mode, show ZH on top + EN below; else lang-only
  const optEl = (opt) => {
    const zhOpt = q.zh ? q.zh.options.find((o) => o.key === opt.key) : null;
    if (lang === "both" && zhOpt) {
      return h(
        "label",
        { class: "opt" },
        h("input", {
          class: "opt-input",
          type: inputType,
          name: "opt",
          value: opt.key,
          onChange: multi ? null : () => onPick(q, [opt.key]),
        }),
        h(
          "span",
          { class: "opt-content" },
          h("span", { class: "opt-key" }, opt.key + "."),
          h("div", { class: "opt-text-both" }, h("div", { class: "opt-text-zh" }, zhOpt.text), h("div", { class: "opt-text-en" }, opt.text)),
        ),
      );
    }
    const txt = lang === "zh" && zhOpt ? zhOpt.text : opt.text;
    return h(
      "label",
      { class: "opt" },
      h("input", {
        class: "opt-input",
        type: inputType,
        name: "opt",
        value: opt.key,
        onChange: multi ? null : () => onPick(q, [opt.key]),
      }),
      h(
        "span",
        { class: "opt-content" },
        h("span", { class: "opt-key" }, opt.key + "."),
        h("span", { class: "opt-text" }, txt),
      ),
    );
  };

  const header = h(
    "div",
    { class: "opt-header" },
    multi
      ? h(
          "span",
          { class: "multi-hint" },
          "📝 ",
          t("chooseN").replace("N", String(q.answer.length)),
        )
      : null,
  );
  const confirmBtn = multi
    ? h(
        "button",
        { class: "btn-confirm", onClick: () => onConfirmMulti(q) },
        t("confirm"),
      )
    : null;

  return h(
    "section",
    { class: "opts" },
    header,
    h("div", { class: "opt-list" }, q.en.options.map(optEl)),
    confirmBtn,
  );
}

function revealAnswer(q, lang, picked, correct) {
  const area = document.getElementById("explan-area");
  if (!area) return;
  const yourA = picked.join(", ") || "—";
  const correctA = q.answer.join(", ");
  area.innerHTML = "";
  area.appendChild(
    h(
      "div",
      { class: `reveal ${correct ? "right" : "wrong"}` },
      h(
        "div",
        { class: "reveal-verdict" },
        h("span", { class: "reveal-emoji" }, correct ? "🎉" : "💔"),
        h("span", { class: "reveal-verdict-text" }, correct ? "答对了" : "答错了"),
      ),
      h(
        "div",
        { class: "reveal-row" },
        h("span", { class: "reveal-label" }, t("yourAnswer") + ":"),
        h("span", { class: "reveal-val" }, yourA),
        h("span", { class: "reveal-label" }, t("correctAnswer") + ":"),
        h("span", { class: "reveal-val reveal-val-correct" }, correctA),
      ),
      h(
        "div",
        { class: "reveal-explan" },
        h("div", { class: "explan-title" }, "💡 " + t("explanation")),
        q.en.explanation
          ? h("div", { class: "explan-body" }, q.en.explanation)
          : h("div", { class: "explan-body explan-empty" }, t("noExplanation")),
      ),
    ),
  );
}

function arrayEq(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}
