// The support chat: the round button in the corner, or «پشتیبانی» in the top bar, opens a small chat
// with Mahak's support bot. The page only shows the conversation; the bot and its DeepSeek key live on a
// server (پشتیبان/worker.js on Cloudflare for the public site, پشتیبان/server.py on one's own computer).
// The server's address comes from build.py; without one, neither the button nor the menu item appears.
import { $, $$, h, bubble, typing, keepBottom, contactEmail } from "./common.js";

const BASE = (document.documentElement.dataset.support || "").replace(/\/+$/, "");
const SAVED = "mahak-support-chat"; // sessionStorage: the conversation follows the visitor between pages
const IDEAS = ["محک چیست؟", "کلید API من کجا می‌رود؟", "چت‌باتم را چطور بسنجم؟"];
const HELLO = "سلام! من پشتیبان خودکار محک هستم. درباره‌ی محک و سنجیدن چت‌بات‌ها هر سؤالی دارید بپرسید.";
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/><circle cx="8.5" cy="9.5" r="1.1"/><circle cx="12" cy="9.5" r="1.1"/><circle cx="15.5" cy="9.5" r="1.1"/></svg>';

let history = [];
let panel, log, input, go, fab;

function load() {
  try {
    history = JSON.parse(sessionStorage.getItem(SAVED)) || [];
  } catch (err) {
    history = [];
  }
}

function save() {
  try {
    sessionStorage.setItem(SAVED, JSON.stringify(history.slice(-20)));
  } catch (err) {
    // private windows may refuse; the chat still works for this page
  }
}

function show() {
  log.replaceChildren(bubble({ role: "assistant", content: HELLO }), ...history.map(bubble));
  keepBottom(log);
}

function failed(reason) {
  return h("div", { class: "bubble bot err" },
    "جواب نیامد. چند لحظه بعد دوباره بفرستید؛ اگر باز هم نشد، به ",
    h("a", { href: "mailto:" + contactEmail(), dir: "ltr", text: contactEmail() }), " بنویسید.",
    reason && h("small", { class: "sup-why", text: "علت: " + reason }));
}

async function ask(text) {
  text = text.trim();
  if (!text || go.disabled) return;
  input.value = "";
  history.push({ role: "user", content: text });
  save();
  log.append(bubble({ role: "user", content: text }));
  const wait = typing();
  log.append(wait);
  keepBottom(log);
  go.disabled = true;
  try {
    const r = await fetch(BASE + "/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "mahak-support", messages: history }),
    });
    const data = await r.json().catch(() => ({}));
    const answer = r.ok && data.choices?.[0]?.message?.content;
    if (!answer) throw new Error((data.error && data.error.message) || "سرور پشتیبانی جواب درستی نداد (" + r.status + ")");
    history.push({ role: "assistant", content: answer });
    save();
    wait.replaceWith(bubble({ role: "assistant", content: answer }));
  } catch (err) {
    console.error("support:", err);
    history.pop(); // the question can simply be sent again
    save();
    // fetch itself failing means the bot's server could not be reached at all (offline, filtered, or down)
    wait.replaceWith(failed(err instanceof TypeError ? "به سرور پشتیبانی وصل نشد (اینترنت، فیلترینگ یا خاموش بودن سرور)." : err.message));
  } finally {
    go.disabled = false;
    keepBottom(log);
    input.focus();
  }
}

function open() {
  panel.hidden = false;
  fab.setAttribute("aria-expanded", "true");
  keepBottom(log);
  input.focus();
}

function close() {
  panel.hidden = true;
  fab.setAttribute("aria-expanded", "false");
  fab.focus();
}

function build() {
  log = h("div", { class: "sup-log", "aria-live": "polite" });
  input = h("input", { type: "text", maxlength: "1000", autocomplete: "off", "aria-label": "پیام", placeholder: "سؤالتان را بنویسید…" });
  go = h("button", { class: "btn primary", type: "submit", text: "بفرست" });
  const fresh = h("button", { class: "sup-icon", type: "button", title: "گفت‌وگوی تازه", "aria-label": "گفت‌وگوی تازه", text: "↺",
    onclick: () => { history = []; save(); show(); input.focus(); } });
  const shut = h("button", { class: "sup-icon", type: "button", title: "بستن", "aria-label": "بستن", text: "×", onclick: close });
  panel = h("section", { class: "sup-panel sheet", id: "support-chat", role: "dialog", "aria-label": "پشتیبانی محک", hidden: true },
    h("header", {},
      h("span", { class: "sup-dot", "aria-hidden": "true" }),
      h("div", {}, h("b", { text: "پشتیبان محک" }), h("small", { text: "دستیار خودکار؛ معمولاً در چند ثانیه جواب می‌دهد" })),
      fresh, shut),
    log,
    h("div", { class: "sup-chips" }, IDEAS.map((t) => h("button", { class: "chip", type: "button", text: t, onclick: () => ask(t) }))),
    h("form", { class: "sup-form", onsubmit: (e) => { e.preventDefault(); ask(input.value); } }, input, go));
  fab = h("button", { class: "sup-fab", type: "button", "aria-controls": "support-chat", "aria-expanded": "false",
    "aria-label": "گفت‌وگو با پشتیبانی", title: "پشتیبانی",
    onclick: () => (panel.hidden ? open() : close()) });
  fab.innerHTML = ICON;
  document.body.append(panel, fab);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

export function setupSupport() {
  // the menu items that open the chat; not [data-support], which <html> carries for the address
  const links = $$("a[data-support-open]");
  if (!BASE) {
    links.forEach((a) => (a.closest(".tipper") || a).remove());
    return;
  }
  load();
  build();
  show();
  links.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); open(); }));
}

if (!$("#support-chat")) setupSupport();
