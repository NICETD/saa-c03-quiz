// App entry: register routes and dispatch.

import { on, dispatch, go } from "./src/router.js";
import { home } from "./src/views/home.js";
import { practice } from "./src/views/practice.js";
import { review } from "./src/views/review.js";
import { exam } from "./src/views/exam.js";
import { stats } from "./src/views/stats.js";
import { quiz } from "./src/views/quiz.js";
import { getLastQuiz } from "./src/store.js";

on("#/", home);
on("#/practice", practice);
on("#/review", review);
on("#/exam", exam);
on("#/stats", stats);
on("#/quiz", quiz);
on("#/quiz/resume", () => {
  const last = getLastQuiz();
  if (!last) {
    go("#/");
    return;
  }
  const qs = new URLSearchParams(last.params).toString();
  location.hash = `#/quiz?${qs}&start=${last.idx}`;
});

// type="module" scripts are deferred; the DOM is already parsed by the time
// this runs, so DOMContentLoaded may have already fired. Call dispatch directly.
dispatch();
