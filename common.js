// Shared by the lab's pages: small DOM helpers, the theme switch, the top-bar tips, the Python engine,
// chat bubbles, the open judge's verdict card and the live test board.
// All judging happens in Python (سایت/bridge.py); this file only shows it.

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const fa = (x) => String(x).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]).replace(/\./g, "٫");
export const pct = (x) => fa(Math.round(100 * x)) + "٪";
export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Replace an element's children; like h(), it accepts nested arrays and skips null. */
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

// ------------------------------------------------------------------ theme

const THEME_KEY = "mahak-theme";

export function setupTheme() {
  const root = document.documentElement;
  const button = $("#theme");
  if (!button) return;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  const label = () => button.setAttribute("aria-label", isDark() ? "تم روشن" : "تم تاریک");
  label();
  button.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, root.dataset.theme);
    } catch (err) {
      /* private mode: the choice lasts until the page closes */
    }
    label();
  });
}

// ------------------------------------------------------------------ top-bar tips

/** Under each top-bar link with data-tip, a few plain lines on what is there; on mouse hover or keyboard focus. */
export function setupTips() {
  const holders = [];
  $$(".top nav a[data-tip]").forEach((link, i) => {
    const box = h("span", { text: link.dataset.tip });
    const tip = h("span", { class: "tip", role: "tooltip", id: `tip-${i + 1}` }, box);
    const holder = h("span", { class: link.classList.contains("nav-cta") ? "tipper cta" : "tipper" });
    link.replaceWith(holder);
    holder.append(link, tip);
    link.setAttribute("aria-describedby", tip.id);
    // keep the box inside the window; the little arrow stays under the link
    const place = () => {
      holder.style.setProperty("--shift", "0px");
      const r = box.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      holder.style.setProperty("--shift", `${Math.max(8 - r.left, 0) + Math.min(width - 8 - r.right, 0)}px`);
    };
    const wake = () => holder.classList.remove("quiet");
    holder.addEventListener("mouseenter", place);
    holder.addEventListener("mouseleave", wake);
    link.addEventListener("focus", place);
    link.addEventListener("blur", wake);
    holders.push(holder);
  });
  // Escape closes an open tip without moving the mouse or the focus
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") holders.forEach((t) => t.classList.add("quiet"));
  });
}

// ------------------------------------------------------------------ contact

const MAIL = ["shirdelhossein909", "gmail.com"]; // joined in the browser so address harvesters miss it

export const contactEmail = () => MAIL.join("@");

export function mailto(subject, body) {
  return `mailto:${contactEmail()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Fill every [data-email] with the address and a copy button. */
export function showEmails() {
  for (const el of $$("[data-email]")) {
    const copy = h("button", { class: "copy", type: "button", text: "کپی" });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(contactEmail());
        copy.textContent = "کپی شد";
      } catch (err) {
        copy.textContent = "کپی نشد";
      }
      setTimeout(() => (copy.textContent = "کپی"), 1600);
    });
    el.replaceChildren(h("a", { href: "mailto:" + contactEmail(), dir: "ltr", text: contactEmail() }), " ", copy);
  }
}

// ------------------------------------------------------------------ engine

export function setEngine(state, text) {
  const el = $("#engine");
  if (!el) return;
  el.dataset.state = state;
  $("span", el).textContent = text;
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = h("script", { src });
    s.onload = ok;
    s.onerror = () => fail(new Error("could not load " + src));
    document.head.append(s);
  });
}

async function loadBundle() {
  const r = await fetch("data/bundle.bin");
  if (!r.ok) throw new Error("bundle: HTTP " + r.status);
  const text = await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(text);
}

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Start Python in the page, write Mahak into it and return the bridge module. */
export async function bootEngine() {
  setEngine("loading", "در حال آماده کردن موتور محک در مرورگر شما…");
  const base = document.documentElement.dataset.pyodide;
  const bundle = loadBundle();
  await loadScript(base + "pyodide.js");
  const pyodide = await loadPyodide({ indexURL: base });
  for (const [path, b64] of Object.entries((await bundle).files)) {
    const full = "/lab/" + path;
    pyodide.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
    pyodide.FS.writeFile(full, bytes(b64));
  }
  pyodide.runPython("import os, sys\nos.chdir('/lab')\nsys.path.insert(0, '/lab')");
  return pyodide.pyimport("bridge");
}

export const ENGINE_ERROR = "موتور محک بار نشد (شاید اینترنت قطع است یا یک سرویس بیرونی در دسترس نیست). صفحه را دوباره باز کنید.";

// ------------------------------------------------------------------ chat bubbles and verdicts

export function bubble(msg) {
  return h("div", { class: "bubble " + (msg.role === "user" ? "user" : "bot"), text: msg.content || "—" });
}

export function typing() {
  return h("div", { class: "bubble bot typing", "aria-label": "در حال نوشتن" }, h("i"), h("i"), h("i"));
}

export function keepBottom(el) {
  el.scrollTop = el.scrollHeight;
}

export const VERDICT = { pass: "قبول", fail: "رد", crit: "شکست بحرانی" };

function intentLine(v) {
  if (!v.intents.length) {
    const grounded = v.checks.some((c) => c.check === "grounded_numbers");
    return h("p", { text: grounded
      ? "سؤال عادی بود؛ داور بدون جواب مرجع فقط ساختگی نبودن عددها و فارسی بودن جواب را سنجید. درستی خود جواب را آزمون‌های نوشته‌شده می‌سنجند."
      : "سؤال عادی بود؛ داور بدون جواب مرجع فقط فارسی بودن جواب را سنجید. درستی خود جواب را آزمون‌های نوشته‌شده می‌سنجند." });
  }
  const ids = v.intents.filter((i) => i.test_id);
  return h("p", {},
    "داور پیام را «", v.intents.map((i) => i.label).join("» و «"), "» تشخیص داد",
    ids.length ? ["، و معیارهای آزمون ", ids.map((i, k) => [k ? "، " : "", h("bdi", { text: i.test_id })]), " را به کار برد."] : ".");
}

export function verdictCard(v) {
  const kind = v.passed ? "pass" : v.critical_failed ? "crit" : "fail";
  return h("div", { class: "vcard " + kind },
    h("b", { text: `${VERDICT[kind]} · ${fa(Math.round(100 * v.score))} از ۱۰۰` }),
    intentLine(v),
    h("ul", {}, v.checks.map((c) => h("li", { class: c.passed ? "v" : "x", text: `${c.critical ? "بحرانی · " : ""}${c.label}: ${c.note}` }))));
}

// ------------------------------------------------------------------ live test board

function outcome(res) {
  if (res.passed) return "pass";
  return res.runs.some((r) => r.critical_failed) ? "crit" : "fail";
}

/** The progress panel and the feed of tests, built inside `root`. */
export class Board {
  constructor(root, levels) {
    this.levels = levels;
    this.fast = REDUCED;
    this.root = root;
    this.prog = h("span", { role: "status" });
    this.bar = h("i");
    this.score = h("b", { text: "—" });
    this.lvList = h("div", { class: "lv-list" });
    this.counts = { pass: h("b"), fail: h("b"), crit: h("b") };
    this.feed = h("div", { class: "feed sheet" });
    root.replaceChildren(
      h("aside", { class: "scorebox sheet", "aria-label": "وضعیت آزمون" },
        h("div", { class: "progress" }, this.prog, h("span", { class: "track" }, this.bar)),
        h("div", { class: "live-score" }, this.score, h("small", { text: "نمره تا اینجا، از ۱۰۰" })),
        this.lvList,
        h("div", { class: "counts" },
          h("span", { class: "good" }, "قبول: ", this.counts.pass),
          h("span", { class: "bad" }, "رد: ", this.counts.fail),
          h("span", { class: "crit-c" }, "بحرانی: ", this.counts.crit))),
      this.feed);
  }

  reset(tests) {
    this.tests = tests;
    this.fast = REDUCED;
    this.feed.replaceChildren();
    this.score.textContent = "—";
    this.prog.textContent = `سؤال ${fa(0)} از ${fa(tests.length)}`;
    this.bar.style.width = "0";
    Object.values(this.counts).forEach((el) => (el.textContent = fa(0)));
    this.lvList.replaceChildren();
    this.lvCount = {};
    for (const [lv, name] of Object.entries(this.levels)) {
      const group = tests.filter((t) => String(t.level) === lv);
      if (!group.length) continue;
      this.lvCount[lv] = h("span", { class: "n", text: `${fa(0)} از ${fa(group.length)}` });
      this.lvList.append(h("div", { class: "lv" },
        h("span", { text: `سطح ${fa(lv)} · ${name}` }), this.lvCount[lv],
        h("span", { class: "pips" }, group.map((t) => h("i", { "data-id": t.id, title: `${t.id} · ${t.title}` })))));
    }
    this.root.hidden = false;
  }

  /** Show a test as it happens: open its card, then add messages as they come. */
  open(test) {
    const verdict = h("span", { class: "verdict" });
    verdict.hidden = true;
    const item = h("article", { class: "item" },
      h("header", {}, h("span", { class: "tag", text: `سطح ${fa(test.level)}` }),
        h("b", {}, h("bdi", { text: test.id }), " · ", test.title), verdict));
    this.feed.append(item);
    keepBottom(this.feed);
    return { item, verdict };
  }

  async say(card, msg, wait = 0) {
    if (msg.role === "assistant" && !this.fast && wait) {
      const dots = typing();
      card.item.append(dots);
      keepBottom(this.feed);
      await (typeof wait === "number" ? sleep(wait) : wait);
      dots.remove();
    }
    card.item.append(bubble(msg));
    keepBottom(this.feed);
  }

  close(card, res) {
    const kind = outcome(res);
    const run = res.runs[0];
    card.item.classList.add(kind);
    card.verdict.textContent = VERDICT[kind];
    card.verdict.hidden = false;
    if (kind !== "pass") {
      const bad = run.checks.find((c) => !c.passed && c.critical) || run.checks.find((c) => !c.passed);
      const why = run.error ? "خطا: " + run.error : bad ? `${bad.critical ? "بحرانی · " : ""}${bad.label}: ${bad.note}` : "";
      if (why) card.item.append(h("p", { class: "why", text: why }));
    }
    keepBottom(this.feed);
  }

  /** A test whose conversation is already complete (the demo bots answer instantly). */
  async replay(res) {
    const card = this.open(res);
    for (const msg of res.runs[0].transcript) {
      await this.say(card, msg, 190);
      if (!this.fast) await sleep(msg.role === "user" ? 120 : 70);
    }
    this.close(card, res);
  }

  update(res, s, done) {
    this.prog.textContent = `سؤال ${fa(done)} از ${fa(this.tests.length)}`;
    this.bar.style.width = (100 * done / this.tests.length).toFixed(1) + "%";
    this.score.textContent = fa(Math.round(s.overall));
    const pip = $(`.pips i[data-id="${CSS.escape(res.id)}"]`, this.lvList);
    if (pip) pip.classList.add(outcome(res));
    const lv = s.levels[String(res.level)];
    const n = this.tests.filter((t) => t.level === res.level).length;
    this.lvCount[res.level].textContent = `${fa(lv.passed)} از ${fa(n)}`;
    this.counts.pass.textContent = fa(s.passed);
    this.counts.fail.textContent = fa(s.tests - s.passed);
    this.counts.crit.textContent = fa(s.critical_failures);
  }

  note(text) {
    this.feed.append(h("p", { class: "why", text }));
    keepBottom(this.feed);
  }
}

/** One sentence on what the numbers mean, so the visitor does not have to read the report. */
export function insight(s, levels) {
  const parts = [];
  if (s.critical_failures) {
    parts.push(`${fa(s.critical_failures)} شکست بحرانی داشت: اطلاعات محرمانه لو داد یا دستور مضری را اجرا کرد، و نمره‌ی همان آزمون‌ها صفر شد.`);
  }
  const tested = Object.keys(s.levels);
  const complete = tested.length === Object.keys(levels).length;
  const weak = Object.entries(s.levels).find(([, d]) => d.rate < 0.7);
  if (weak) {
    const [lv, d] = weak;
    const where = `در سطح ${fa(lv)} (${levels[lv]}) فقط ${fa(d.passed)} از ${fa(d.n)} آزمون قبول شد`;
    if (!complete) parts.push(`ضعیف‌ترین بخش: ${where}.`);
    else parts.push(s.ceiling ? `سقف سطحش ${fa(s.ceiling)} است، چون ${where}.` : `به سطح ۱ هم نرسید، چون ${where}.`);
    if (complete && s.overall >= 70) parts.push("یک عدد تنها این ضعف را پنهان می‌کرد؛ کارنامه نشانش می‌دهد.");
  } else {
    parts.push(complete ? "هر پنج سطح را با دست‌کم ۷۰٪ قبولی گذراند." : "همه‌ی سطح‌های آزموده‌شده را با دست‌کم ۷۰٪ قبولی گذراند.");
  }
  return parts.join(" ");
}

/** The result card; `side` is the fact shown first (the bot's level, or what was tested). */
export function resultCard(s, side, text, actions) {
  const [lo, hi] = s.pass_interval;
  return h("section", { class: "sheet result", "aria-label": "نتیجه" },
    h("div", { class: "score" }, h("b", { text: fa(Math.round(s.overall)) }), h("small", { text: "از ۱۰۰" }), h("span", { text: s.grade })),
    h("div", { class: "facts" },
      side,
      h("div", { class: "fact" }, h("small", { text: "آزمون قبول‌شده" }), h("strong", { text: `${fa(s.passed)} از ${fa(s.tests)}` }),
        h("small", { text: `بازه‌ی اطمینان ۹۵٪: ${pct(lo)} تا ${pct(hi)}` })),
      h("div", { class: "fact" }, h("small", { text: "شکست بحرانی" }),
        h("strong", { class: s.critical_failures ? "bad" : "good", text: s.critical_failures ? fa(s.critical_failures) : "هیچ" }))),
    h("p", { class: "insight", text }),
    h("div", { class: "actions" }, actions));
}

export function belt(ceiling, levels) {
  return h("span", { class: "belt" }, Object.keys(levels).map((lv) => h("i", { class: Number(lv) <= ceiling ? "on" : "" })));
}

/** A blob URL holding the report card, replacing (and freeing) the previous one. */
let reportUrl = null;
export function reportLink(html) {
  if (reportUrl) URL.revokeObjectURL(reportUrl);
  reportUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  return reportUrl;
}
