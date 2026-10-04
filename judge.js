// «داور را داوری کن»: a person labels answers; Mahak's agreement module (in Python) compares
// those labels with the judge's verdicts, which stay in Python until the person asks for the result.
import { $, ENGINE_ERROR, bootEngine, bubble, fa, fill, h, pct, setEngine, setupTheme, showEmails } from "./common.js";

const STORE = "mahak-labels-v1";
let py = null;
let ITEMS = [];
let labels = {};
let pos = 0;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch (err) {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(labels));
  } catch (err) {
    /* private mode: labels last until the page closes */
  }
}

const labelled = () => ITEMS.filter((i) => i.key in labels).length;

function show() {
  const item = ITEMS[pos];
  const done = labelled();
  $("#lab-prog").textContent = `${fa(done)} از ${fa(ITEMS.length)} جواب داوری شده`;
  $("#lab-bar").style.width = (100 * done / ITEMS.length).toFixed(1) + "%";
  $("#lab-result").disabled = done < 5;
  $("#lab-back").disabled = pos === 0;
  if (!item) return showResult();
  fill($("#lab-item"),
    h("header", {}, h("span", { class: "tag", text: `سطح ${fa(item.level)}` }), h("b", { text: item.title }),
      h("span", { class: "note", text: `جواب ${fa(pos + 1)} از ${fa(ITEMS.length)}` })),
    item.transcript.map(bubble),
    item.reference ? h("p", { class: "reference" }, h("b", { text: "رفتار درست، از نظر نویسنده‌ی آزمون: " }), item.reference) : null);
  $("#say-yes").classList.toggle("chosen", labels[item.key] === true);
  $("#say-no").classList.toggle("chosen", labels[item.key] === false);
}

function answer(value) {
  const item = ITEMS[pos];
  if (!item) return;
  if (value === null) delete labels[item.key];
  else labels[item.key] = value;
  save();
  pos += 1;
  show();
}

function showResult() {
  const a = JSON.parse(py.label_agreement(JSON.stringify({ labels })));
  const t = a.table;
  const out = $("#lab-out");
  const download = h("a", { class: "btn", text: "دانلود داوری‌های من",
    href: URL.createObjectURL(new Blob([JSON.stringify({ labels, at: new Date().toISOString(), answers: a.n }, null, 1)], { type: "application/json" })),
    download: "mahak-labels.json" });
  fill(out, h("section", { class: "sheet result", "aria-label": "نتیجه" },
    h("div", { class: "score" }, h("b", { text: a.n ? pct(a.rate) : "—" }), h("small", { text: "هم‌نظری" })),
    h("div", { class: "facts" },
      h("div", { class: "fact" }, h("small", { text: "جواب‌های داوری‌شده" }), h("strong", { text: fa(a.n) })),
      h("div", { class: "fact" }, h("small", { text: "کاپای کوهن (هم‌نظری بیش از شانس)" }),
        h("strong", { text: a.kappa === null ? "—" : `${fa(a.kappa.toFixed(2))} · ${a.kappa_words}` })),
      h("div", { class: "fact" }, h("small", { text: "جایی که هم‌نظر نبودید" }), h("strong", { class: a.disagreements.length ? "bad" : "good", text: fa(a.disagreements.length) }))),
    h("table", { class: "matrix" },
      h("thead", {}, h("tr", {}, h("th"), h("th", { text: "شما: درست" }), h("th", { text: "شما: نادرست" }))),
      h("tbody", {},
        h("tr", {}, h("th", { text: "داور: قبول" }), h("td", { class: "good", text: fa(t.both_pass) }), h("td", { class: "bad", text: fa(t.judge_only) })),
        h("tr", {}, h("th", { text: "داور: رد" }), h("td", { class: "bad", text: fa(t.human_only) }), h("td", { class: "good", text: fa(t.both_fail) })))),
    h("p", { class: "insight", text: a.n < 20
      ? "با کمتر از ۲۰ جواب، این عددها هنوز خیلی قطعی نیستند. هر چه بیشتر داوری کنید، تصویر دقیق‌تر می‌شود."
      : "کاپا یعنی هم‌نظری بیش از آنچه شانس می‌دهد: ۱ یعنی کاملاً هم‌نظر و ۰ یعنی در حد شانس. جواب‌هایی که هم‌نظر نبودید، همان جاهایی است که قانون‌های داور باید بهتر شوند." }),
    h("div", { class: "actions" }, download,
      h("button", { class: "btn ghost", type: "button", text: "ادامه‌ی داوری", onclick: resume }),
      h("button", { class: "btn ghost", type: "button", text: "از اول", onclick: restart }))),
  a.disagreements.length ? h("h2", { class: "sub", text: "جاهایی که هم‌نظر نبودید" }) : null,
  a.disagreements.map((d) => h("article", { class: "item " + (d.judge ? "pass" : "fail") },
    h("header", {}, h("span", { class: "tag", text: `سطح ${fa(d.level)}` }), h("b", { text: d.title }),
      h("span", { class: "verdict", text: `داور: ${d.judge ? "قبول" : "رد"} · شما: ${d.human ? "درست" : "نادرست"}` })),
    d.transcript.slice(-2).map(bubble))));
  out.hidden = false;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resume() {
  const next = ITEMS.findIndex((i) => !(i.key in labels));
  pos = next === -1 ? 0 : next;
  $("#lab-out").hidden = true;
  show();
  $("#labeler").scrollIntoView({ behavior: "smooth", block: "start" });
}

function restart() {
  labels = {};
  save();
  resume();
}

setupTheme();
showEmails();
$("#say-yes").addEventListener("click", () => answer(true));
$("#say-no").addEventListener("click", () => answer(false));
$("#say-skip").addEventListener("click", () => answer(null));
$("#lab-back").addEventListener("click", () => { pos = Math.max(0, pos - 1); show(); });
$("#lab-result").addEventListener("click", showResult);
document.addEventListener("keydown", (e) => {
  if ($("#labeler").hidden || e.target.closest("input, textarea")) return;
  const k = { "1": true, "۱": true, "2": false, "۲": false, "3": null, "۳": null }[e.key];
  if (k !== undefined) answer(k);
});

bootEngine().then((bridge) => {
  py = bridge;
  ITEMS = JSON.parse(py.label_items());
  labels = load();
  setEngine("ready", `آماده است: ${fa(ITEMS.length)} جواب برای داوری`);
  $("#labeler").hidden = false;
  resume();
}).catch((err) => {
  console.error(err);
  setEngine("error", ENGINE_ERROR);
});
