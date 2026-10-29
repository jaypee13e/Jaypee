const $ = (s) => document.querySelector(s);
let token = sessionStorage.getItem("rv_token") || "";
let all = [];
let tab = "pending";

async function api(path, method = "GET") {
  const r = await fetch(path, {
    method,
    headers: { Authorization: "Bearer " + token },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Object.assign(new Error(j.error || "Request failed"), {
      status: r.status,
    });
  return j;
}

async function load() {
  try {
    all = (await api("/api/admin/reviews")).reviews;
    $("#login").hidden = true;
    $("#panel").hidden = false;
    draw();
  } catch (e) {
    if (e.status === 401) {
      sessionStorage.removeItem("rv_token");
      token = "";
    }
    $("#login").hidden = false;
    $("#panel").hidden = true;
    $("#err").textContent =
      e.status === 401
        ? "Wrong password."
        : e.status === 503
          ? "ADMIN_TOKEN is not set on the server."
          : e.status === 429
            ? "Too many attempts. Try again in a few minutes."
            : "Could not reach the server.";
  }
}

function draw() {
  const pending = all.filter((r) => !r.approved).length;
  $("#sum").textContent =
    pending + " pending · " + (all.length - pending) + " published";
  const rows = all.filter((r) => (tab === "approved") === !!r.approved);
  const box = $("#list");
  box.replaceChildren();

  if (!rows.length) {
    const m = document.createElement("p");
    m.className = "mut";
    m.textContent =
      tab === "pending"
        ? "Nothing waiting for approval."
        : "No published reviews yet.";
    box.append(m);
    return;
  }

  rows.forEach((r) => {
    const c = document.createElement("div");
    c.className = "glass";
    const n = Math.min(5, Math.max(0, Number(r.rating) || 0));
    const s = document.createElement("span");
    s.className = "stars";
    s.textContent = "★".repeat(n) + "☆".repeat(5 - n);
    const q = document.createElement("q");
    q.textContent = r.quote;
    const m = document.createElement("div");
    m.className = "mut";
    m.textContent = [r.name, r.business, r.work].filter(Boolean).join(" · ");
    const e = document.createElement("div");
    e.className = "mut";
    e.textContent = r.email + " · " + new Date(r.createdAt).toLocaleString();
    const row = document.createElement("div");
    row.className = "row";

    const add = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "btn " + cls;
      b.textContent = label;
      b.onclick = () => run(b, fn);
      row.append(b);
    };
    if (!r.approved)
      add("Approve", "", () =>
        api("/api/admin/reviews/" + r.id + "/approve", "POST"),
      );
    else
      add("Unpublish", "alt", () =>
        api("/api/admin/reviews/" + r.id + "/unpublish", "POST"),
      );
    add("Delete", "bad", () =>
      confirm("Delete this review permanently?")
        ? api("/api/admin/reviews/" + r.id, "DELETE")
        : null,
    );

    c.append(s, q, m, e, row);
    box.append(c);
  });
}

async function run(btn, fn) {
  btn.disabled = true;
  try {
    const res = await fn();
    if (res) await load();
    else btn.disabled = false;
  } catch (e) {
    alert(e.message);
    btn.disabled = false;
  }
}

$("#go").onclick = () => {
  token = $("#tk").value.trim();
  sessionStorage.setItem("rv_token", token);
  $("#err").textContent = "";
  load();
};
$("#tk").onkeydown = (e) => {
  if (e.key === "Enter") $("#go").click();
};
$("#ref").onclick = load;
$("#out").onclick = () => {
  sessionStorage.removeItem("rv_token");
  token = "";
  $("#tk").value = "";
  $("#panel").hidden = true;
  $("#login").hidden = false;
};
document.querySelectorAll(".tabs button").forEach((b) => {
  b.onclick = () => {
    tab = b.dataset.t;
    document
      .querySelectorAll(".tabs button")
      .forEach((x) => x.classList.toggle("on", x === b));
    draw();
  };
});
if (token) load();
