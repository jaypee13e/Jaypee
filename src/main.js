import * as THREE from "three";
import { P, SHOT } from "./data/projects.js";
import { initForms, EMAIL } from "./api.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const IMG = { me: "assets/jaypee.webp" };
const $ = (s) => document.querySelector(s),
  still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
/* ---------- 3D room ---------- */
const cv = $("#gl");
let R = null;
try {
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(
    Math.min(devicePixelRatio, matchMedia("(pointer: fine)").matches ? 2 : 1.5),
  );
  R.setClearColor(0x04070d, 1);
} catch (err) {
  console.warn("WebGL unavailable, 3D scene disabled.", err);
}
const S = new THREE.Scene();
S.fog = new THREE.FogExp2(0x04070d, 0.026);
const C = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
C.position.set(0, 3, 7.6);
const AC = 0x39e0ff,
  AC2 = 0x7a8cff,
  fine = matchMedia("(pointer: fine)").matches,
  N = P.length;
let cur = 0,
  sec = "hero",
  mx = 0,
  my = 0,
  moved = 0,
  dn = [0, 0];
const mobile = () => innerWidth <= 860,
  secs = [...document.querySelectorAll("main section")];
const controls = new OrbitControls(C, cv);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.07,
  enableZoom: false,
  enablePan: false,
  minPolarAngle: 0.75,
  maxPolarAngle: 1.6,
  enabled: fine,
  autoRotateSpeed: 0.5,
});
controls.target.set(0, 2.2, 0);
cv.style.cursor = fine ? "grab" : "default";
cv.style.touchAction = matchMedia("(any-pointer: coarse)").matches
  ? "pan-y"
  : "none";
const goal = { t: new THREE.Vector3(0, 2.2, 0), p: null };
// room shell, floor, grid, LED rails
{
  const sh = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 22, 14, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x08111f,
      side: THREE.BackSide,
      roughness: 0.9,
    }),
  );
  sh.position.y = 6;
  S.add(sh);
}
{
  const f = new THREE.Mesh(
    new THREE.CircleGeometry(22, 64),
    new THREE.MeshStandardMaterial({
      color: 0x050a14,
      roughness: 0.4,
      metalness: 0.6,
    }),
  );
  f.rotation.x = -Math.PI / 2;
  S.add(f);
  const g = new THREE.GridHelper(44, 44, AC, 0x12335a);
  g.position.y = 0.02;
  g.material.transparent = true;
  g.material.opacity = 0.3;
  S.add(g);
  [0.06, 12.8].forEach((y) => {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(21.6, 0.07, 8, 96),
      new THREE.MeshBasicMaterial({ color: AC }),
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    S.add(r);
  });
}
S.add(new THREE.AmbientLight(0x7a9ccc, 0.55));
const top = new THREE.PointLight(AC, 1.1, 34);
top.position.set(0, 10, 0);
S.add(top);
const ml = new THREE.PointLight(AC, 1.6, 16);
ml.position.set(0, 4, 5);
S.add(ml);
// dust
let dust;
{
  const n = 650,
    g = new THREE.BufferGeometry(),
    a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * 19,
      t = Math.random() * 6.283;
    a[i * 3] = Math.cos(t) * r;
    a[i * 3 + 1] = Math.random() * 12;
    a[i * 3 + 2] = Math.sin(t) * r;
  }
  g.setAttribute("position", new THREE.BufferAttribute(a, 3));
  S.add(
    (dust = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0x7fdcff,
        size: 0.06,
        transparent: true,
        opacity: 0.6,
      }),
    )),
  );
}
// hologram portrait on a pad at the centre of the room
const loader = new THREE.TextureLoader(),
  holo = new THREE.Group(),
  PH = 3.9;
S.add(holo);
{
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.7, 0.12, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0b1426,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  pad.position.y = 0.06;
  holo.add(pad);
  [1.55, 1.05].forEach((r) => {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.03, 8, 80),
      new THREE.MeshBasicMaterial({ color: AC }),
    );
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.14;
    holo.add(t);
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.5, 4.4, 40, 1, true),
    new THREE.MeshBasicMaterial({
      color: AC,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = 2.3;
  holo.add(beam);
}
const me = new THREE.Mesh(
  new THREE.PlaneGeometry((PH * 768) / 1056, PH),
  new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    color: 0xdff6ff,
  }),
);
me.position.y = 0.18 + PH / 2;
me.visible = false;
holo.add(me);
loader.load(
  IMG.me,
  (t) => {
    t.anisotropy = 8;
    me.material.map = t;
    me.material.color.set(0xffffff);
    me.material.needsUpdate = true;
    me.visible = true;
  },
  undefined,
  () => console.warn("Portrait not found: public/assets/jaypee.webp"),
);
// desk of monitors: one per project, in an arc around the hologram
const RR = 10,
  panels = [],
  A0 = Math.PI - 1.92,
  A1 = Math.PI + 1.92;
const dark = new THREE.MeshStandardMaterial({
  color: 0x0b1426,
  roughness: 0.35,
  metalness: 0.7,
});
P.forEach((p, i) => {
  const th = A0 + ((A1 - A0) * i) / (N - 1),
    g = new THREE.Group(),
    bx = Math.sin(th) * RR,
    bz = Math.cos(th) * RR;
  g.position.set(bx, 0, bz);
  g.lookAt(0, 0, 0);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 3), dark);
  slab.position.set(0, 0.83, -0.5);
  g.add(slab);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.03, 0.03),
    new THREE.MeshBasicMaterial({ color: AC }),
  );
  led.position.set(0, 0.78, 1);
  g.add(led);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.14, 1.2, 12),
    dark,
  );
  stand.position.y = 1.5;
  g.add(stand);
  const scr = new THREE.Group();
  scr.position.y = 2.55;
  g.add(scr);
  scr.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 1.9, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x0a1222,
        roughness: 0.4,
        metalness: 0.6,
      }),
    ),
  );
  const ed = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(3.15, 1.9, 0.1)),
    new THREE.LineBasicMaterial({ color: AC, transparent: true, opacity: 0.4 }),
  );
  scr.add(ed);
  const sc = new THREE.Mesh(
    new THREE.PlaneGeometry(2.98, 1.73),
    new THREE.MeshBasicMaterial({ color: 0x44566e }),
  );
  sc.position.z = 0.06;
  scr.add(sc);
  loader.load(
    SHOT[p[3]],
    (t) => {
      t.anisotropy = 8;
      sc.material.map = t;
      sc.material.color.set(0x44566e);
      sc.material.needsUpdate = true;
    },
    undefined,
    () => console.warn("Screenshot not found: " + SHOT[p[3]]),
  );
  g.userData = { i, th, bx, bz, k: 0, scr, ed, sc };
  S.add(g);
  panels.push(g);
});
const dim = new THREE.Color(0x5b6b80),
  lit = new THREE.Color(0xffffff);
function focus(i) {
  const m = panels[i].userData,
    k = mobile() ? 0.3 : 0.42;
  goal.t.set(m.bx, mobile() ? 1.7 : 2.5, m.bz);
  goal.p = new THREE.Vector3(m.bx * k, 3.2, m.bz * k);
}
function onSec() {
  controls.autoRotate = !still && !(sec == "hero" || sec == "work");
  if (sec == "hero") {
    goal.t.set(0, 2.2, 0);
    goal.p = new THREE.Vector3(0, 3, mobile() ? 10 : 7.6);
  } else if (sec == "work") focus(cur);
  else {
    goal.t.set(0, 2.2, 0);
    goal.p = null;
  }
}
function resize() {
  if (R) R.setSize(innerWidth, innerHeight, false);
  C.aspect = innerWidth / innerHeight;
  C.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
addEventListener("pointerdown", (e) => {
  dn = [e.clientX, e.clientY];
  moved = 0;
  if (fine) cv.style.cursor = "grabbing";
});
addEventListener("pointerup", () => {
  if (fine) cv.style.cursor = "grab";
});
addEventListener(
  "pointermove",
  (e) => {
    mx = e.clientX / innerWidth - 0.5;
    my = e.clientY / innerHeight - 0.5;
    if (e.buttons) moved = Math.hypot(e.clientX - dn[0], e.clientY - dn[1]);
  },
  { passive: true },
);
const clock = new THREE.Timer();
let vo = 0;
const MOVE = 1; // monitor idle motion: 0 = none, 1 = gentle, 2 = livelier
function frame() {
  clock.update();
  const t = clock.getElapsed();
  controls.target.lerp(goal.t, 0.06);
  if (goal.p) {
    C.position.lerp(goal.p, 0.06);
    if (C.position.distanceTo(goal.p) < 0.05) goal.p = null;
  }
  controls.update();
  // shift the room so the subject sits right of the text column
  const tv = !mobile() && (sec == "hero" || sec == "work") ? -0.17 : 0;
  vo += (tv - vo) * 0.06;
  if (Math.abs(vo) > 0.0004 || tv) {
    C.setViewOffset(
      innerWidth,
      innerHeight,
      vo * innerWidth,
      0,
      innerWidth,
      innerHeight,
    );
  } else C.clearViewOffset();
  me.rotation.y =
    Math.atan2(C.position.x, C.position.z) + (still ? 0 : mx * 0.3);
  me.rotation.x = still ? 0 : my * 0.08;
  holo.position.y = Math.sin(t * 1.1) * 0.06;
  me.material.opacity = mobile() ? (sec == "hero" ? 0.5 : 0.12) : 1;
  ml.position.x += (mx * 12 - ml.position.x) * 0.05;
  ml.position.y = 4 - my * 3;
  panels.forEach((g) => {
    const u = g.userData,
      on = u.i == cur;
    u.k += ((on ? 1 : 0) - u.k) * 0.08;

    // idle motion: the selected monitor holds still, the others float
    const calm = still ? 0 : (1 - u.k) * MOVE;
    const a = u.th + Math.sin(t * 0.25 + u.i * 0.9) * 0.05 * calm; // drift along the arc
    const bx = Math.sin(a) * RR,
      bz = Math.cos(a) * RR;
    g.position.set(bx * (1 - 0.1 * u.k), 0, bz * (1 - 0.1 * u.k));
    g.lookAt(0, 0, 0);
    u.scr.position.y = 2.55 + Math.sin(t * 0.9 + u.i * 1.3) * 0.2 * calm; // float up and down
    u.scr.rotation.z = Math.sin(t * 0.6 + u.i) * 0.03 * calm; // slight tilt
    u.scr.rotation.y = Math.sin(t * 0.4 + u.i * 1.7) * 0.08 * calm; // slight turn

    u.sc.material.color.copy(dim).lerp(lit, u.k);
    u.ed.material.opacity = 0.35 + 0.65 * u.k;
    u.scr.scale.setScalar(1 + 0.1 * u.k);
  });
  dust.rotation.y = t * 0.01;
  dust.position.y = Math.sin(t * 0.2) * 0.3;
  R.render(S, C);
  requestAnimationFrame(frame);
}
if (R) frame();
/* ---------- projects UI ---------- */
const tabs = $("#tabs"),
  info = $("#info");
P.forEach((p, i) => {
  const b = document.createElement("button");
  b.setAttribute("role", "tab");
  b.textContent = p[0];
  b.onclick = () => go(i);
  tabs.append(b);
});
let ready = false;
function go(n) {
  const dir = n >= cur ? 1 : -1; // later project = from the right, earlier = from the left
  cur = (n + N) % N;
  const p = P[cur];
  if (sec == "work") focus(cur);
  [...tabs.children].forEach((b, i) => {
    b.classList.toggle("on", i == cur);
    b.setAttribute("aria-selected", i == cur);
  });
  {
    const b = tabs.children[cur],
      tr = tabs.getBoundingClientRect(),
      br = b.getBoundingClientRect();
    tabs.scrollTo({
      left: tabs.scrollLeft + (br.left - tr.left) - (tr.width - br.width) / 2,
      behavior: still ? "auto" : "smooth",
    });
  }
  $("#ct").textContent =
    String(cur + 1).padStart(2, "0") + " / " + String(N).padStart(2, "0");
  info.innerHTML = `<div class="pt"><p class="cat">${esc(p[2])} · ${esc(p[1])}</p><h3>${esc(p[0])}</h3><p><b>Problem:</b> ${esc(p[4])}</p><p><b>What I did:</b> ${esc(p[5])}</p><p><b>Result:</b> ${esc(p[6])}</p><ul class="tags">${p[7].map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p class="acts"><a class="btn" href="${esc(p[8])}" target="_blank" rel="noopener">Live site</a><a class="btn alt" href="${esc(p[9])}" target="_blank" rel="noopener">Source code</a></p></div><div class="pv"><figure class="mon"><div class="scr"><img src="${esc(SHOT[p[3]])}" alt="Screenshot of ${esc(p[0])}"></div><span class="stand"></span></figure></div>`;

  if (ready && !still) {
    info.animate(
      [
        { opacity: 0, transform: `translateX(${dir * 60}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }
}
$("#pv").onclick = () => go(cur - 1);
$("#nx").onclick = () => go(cur + 1);
let sx = 0,
  sy = 0;
info.addEventListener(
  "touchstart",
  (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  },
  { passive: true },
);
info.addEventListener(
  "touchend",
  (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(cur + (dx < 0 ? 1 : -1));
  },
  { passive: true },
);
addEventListener("keydown", (e) => {
  if (sec != "work" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key == "ArrowRight") go(cur + 1);
  if (e.key == "ArrowLeft") go(cur - 1);
});
// click a monitor in 3D
const ray = new THREE.Raycaster(),
  mv = new THREE.Vector2();
addEventListener("click", (e) => {
  if (
    moved > 6 ||
    e.target.closest(
      "#info,.ctl,#tabs,header,#rec,.glass,a,button,summary,input,select,textarea",
    )
  )
    return;
  mv.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mv, C);
  const h = ray.intersectObjects(
    panels.map((g) => g.userData.scr),
    true,
  )[0];
  if (h) {
    let o = h.object;
    while (o && o.userData.i === undefined) o = o.parent;
    if (o) go(o.userData.i);
  }
});
go(0);
ready = true;
/* ---------- page behaviour ---------- */
const links = [...document.querySelectorAll("nav a")];
const spy = new IntersectionObserver(
  (es) =>
    es.forEach((e) => {
      if (e.isIntersecting) {
        sec = e.target.id;
        onSec();
        links.forEach((a) => a.classList.toggle("on", a.hash == "#" + sec));
      }
    }),
  { rootMargin: "-45% 0px -50% 0px" },
);
secs.forEach((s) => spy.observe(s));
addEventListener(
  "scroll",
  () => {
    const d = document.documentElement;
    $("#bar").style.transform =
      `scaleX(${d.scrollTop / Math.max(1, d.scrollHeight - innerHeight)})`;
  },
  { passive: true },
);
const nav = $("#nav"),
  mb = $("#mb");
mb.onclick = () => {
  const o = nav.classList.toggle("open");
  mb.setAttribute("aria-expanded", o);
  mb.textContent = o ? "Close" : "Menu";
};
nav.onclick = (e) => {
  if (e.target.closest("a")) {
    nav.classList.remove("open");
    mb.textContent = "Menu";
  }
};
$("#copy").onclick = async (e) => {
  const b = e.target;
  try {
    await navigator.clipboard.writeText($("#mail").textContent.trim());
    b.textContent = "Copied";
  } catch {
    b.textContent = "Press Ctrl+C on the email above";
  }
  setTimeout(() => (b.textContent = "Copy email"), 2000);
};
document.querySelectorAll("a[data-t]").forEach((a) =>
  a.addEventListener("click", () => {
    $("#inq").href =
      "mailto:" +
      EMAIL +
      "?subject=" +
      encodeURIComponent("Quote request: " + a.dataset.t);
  }),
);
// "Book a Discovery Call": jump to the inquiry form with the type and a starter message filled in
document.querySelectorAll("[data-discovery]").forEach((a) =>
  a.addEventListener("click", () => {
    const f = $("#inquiry");
    f.elements.type.value = "Discovery call";
    const m = f.elements.message;
    if (!m.value.trim())
      m.value =
        "I'd like to book a discovery call. Best days and times for me: ";
    if (fine)
      setTimeout(() => {
        m.focus({ preventScroll: true });
        m.setSelectionRange(m.value.length, m.value.length);
      }, 400);
  }),
);
document.querySelectorAll("[data-mail]").forEach((a) => {
  a.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(a.dataset.mail);
});
$("#mail").textContent = EMAIL;

if (!fine) $(".hint").textContent = "Scroll to explore";
initForms();
