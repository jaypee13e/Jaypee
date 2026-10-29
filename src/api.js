export const EMAIL = "Jaypoem0@gmail.com";
const say = (el, text, kind) => {
  el.textContent = text;
  el.className = "st " + (kind || "");
};

// Resolves with parsed JSON, or rejects with an Error carrying `status`, `fields` and
// `json` (true when the server answered with JSON, i.e. it is really our API).
async function call(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    throw Object.assign(new Error((j && j.error) || "Request failed"), {
      status: r.status,
      fields: j && j.fields,
      json: !!j,
    });
  }
  return j;
}
const post = (url, body) =>
  call(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const FORM_KEY = "b525fd1f-8267-4663-a827-ea09817db084";
async function sendDirect(d, subject) {
  const r = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: FORM_KEY,
      subject,
      name: d.name,
      email: d.email,
      type: d.type,
      budget: d.budget,
      message: d.message,
      ...(d.website ? { botcheck: true } : {}),
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.success)
    throw Object.assign(new Error("Send failed"), { json: false });
  return { ok: true };
}

function bind(form, url, okMsg, mailSubject) {
  if (!form) return;
  const st = form.querySelector(".st"),
    btn = form.querySelector("button[type=submit]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.consent = form.elements.consent
      ? form.elements.consent.checked
      : undefined;
    btn.disabled = true;
    say(st, "Sending…");
    try {
      const res =
        url === "api/inquiry" && FORM_KEY && !FORM_KEY.startsWith("PASTE")
          ? await sendDirect(data, mailSubject)
          : await post(url, data);
      if (!res.ok)
        throw Object.assign(new Error("Unexpected response"), { json: false });
      form.reset();
      say(st, okMsg, "ok");
    } catch (err) {
      // Our API answered and said what is wrong: show that.
      if (err.fields) return say(st, Object.values(err.fields)[0], "bad");
      if (
        err.json &&
        (err.status === 400 || err.status === 413 || err.status === 429)
      )
        return say(st, err.message, "bad");
      // API unreachable or not there (e.g. static hosting): fall back to an email draft.
      const body = Object.entries(data)
        .filter(([k, v]) => k !== "website" && v !== undefined)
        .map(([k, v]) => k + ": " + v)
        .join("\n");
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`;
      say(st, "Opening your email", "ok");
    } finally {
      btn.disabled = false;
    }
  });
}

// Shows only approved reviews: the server never sends pending ones.
async function loadReviews() {
  const list = document.getElementById("rv-list"),
    empty = document.getElementById("rv-empty");
  if (!list) return;
  let items = [];
  try {
    items = (await call("api/reviews")).reviews || [];
  } catch {}
  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  items.forEach((r) => {
    const c = document.createElement("figure");
    c.className = "glass rv";
    c.style.margin = 0;
    const n = Math.min(5, Math.max(0, Number(r.rating) || 0));
    const s = document.createElement("span");
    s.className = "stars";
    s.textContent = "★".repeat(n) + "☆".repeat(5 - n);
    const q = document.createElement("q");
    q.textContent = r.quote;
    const m = document.createElement("small");
    m.textContent = [r.name, r.business, r.work].filter(Boolean).join(" · ");
    c.append(s, q, m);
    list.append(c);
  });
}

export function initForms() {
  bind(
    document.getElementById("inquiry"),
    "api/inquiry",
    "Thank you! Your inquiry was sent. I will reply soon.",
    "Website project inquiry",
  );
  bind(
    document.getElementById("review"),
    "api/reviews",
    "Thank you! Your review was received and will appear after I check it.",
    "Client review",
  );
  loadReviews();
}
