import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import path from "node:path";
import { existsSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { store } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "..", "dist");
const PORT = Number(process.env.PORT) || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const MAIL_TO = process.env.MAIL_TO || "Jaypoem0@gmail.com";

const app = express();
app.disable("x-powered-by");
// Behind a proxy/load balancer set TRUST_PROXY=1 so rate limits see the real client IP.
if (process.env.TRUST_PROXY)
  app.set(
    "trust proxy",
    /^\d+$/.test(process.env.TRUST_PROXY)
      ? Number(process.env.TRUST_PROXY)
      : process.env.TRUST_PROXY,
  );

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "style-src": [
          "'self'",
          "https://fonts.googleapis.com",
          "'unsafe-inline'",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'"],
        // Plain-http deployments (e.g. `docker run -p 3001:3001`) would otherwise break every asset.
        "upgrade-insecure-requests": null,
      },
    },
  }),
);
app.use(express.json({ limit: "10kb" }));

/* ---------- optional email notification ---------- */
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure:
        process.env.SMTP_SECURE === "true" ||
        Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

async function notify(subject, lines, replyTo) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || MAIL_TO,
      to: MAIL_TO,
      replyTo,
      subject: subject.replace(/[\r\n]+/g, " ").slice(0, 150),
      text: lines.join("\n"),
    });
  } catch (e) {
    console.error("Email notification failed:", e.message); // the submission is already saved
  }
}

/* ---------- validation ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

function check(rules) {
  const fields = {};
  for (const [key, ok, msg] of rules) if (!ok) fields[key] = msg;
  return Object.keys(fields).length ? fields : null;
}

const bad = (res, fields) =>
  res.status(400).json({ error: Object.values(fields)[0], fields });

/* ---------- rate limits ---------- */
const json429 = {
  error: "Too many requests. Please try again in a few minutes.",
};
// skipFailedRequests: a visitor who mistypes a field is not locked out; only accepted submissions count.
const formLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipFailedRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429,
});
const readLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429,
});

/* ---------- public API ---------- */
app.post("/api/inquiry", formLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (str(b.website)) return res.json({ ok: true }); // honeypot: pretend success, save nothing
    const d = {
      name: str(b.name),
      email: str(b.email),
      type: str(b.type).slice(0, 60),
      budget: str(b.budget).slice(0, 80),
      message: str(b.message),
    };
    const fields = check([
      [
        "name",
        d.name.length >= 2 && d.name.length <= 100,
        "Please enter your name.",
      ],
      [
        "email",
        EMAIL_RE.test(d.email) && d.email.length <= 200,
        "Please enter a valid email address.",
      ],
      [
        "message",
        d.message.length >= 10 && d.message.length <= 3000,
        "Please describe your project (at least 10 characters).",
      ],
    ]);
    if (fields) return bad(res, fields);
    const saved = await store.add("inquiries", d);
    notify(
      "New project inquiry from " + d.name,
      [
        `Name: ${d.name}`,
        `Email: ${d.email}`,
        `Type: ${d.type}`,
        `Budget: ${d.budget || "-"}`,
        "",
        d.message,
      ],
      d.email,
    );
    res.json({ ok: true, id: saved.id });
  } catch (e) {
    next(e);
  }
});

app.get("/api/reviews", readLimit, async (_req, res, next) => {
  try {
    const rows = await store.list("reviews");
    res.json({
      reviews: rows
        .filter((r) => r.approved)
        .reverse()
        .map(({ rating, quote, name, business, work }) => ({
          rating,
          quote,
          name,
          business,
          work,
        })), // never expose email
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/reviews", formLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (str(b.website)) return res.json({ ok: true });
    const rating = Number(b.rating);
    const d = {
      name: str(b.name),
      email: str(b.email),
      business: str(b.business).slice(0, 100),
      work: str(b.work),
      rating,
      quote: str(b.quote),
    };
    const fields = check([
      [
        "name",
        d.name.length >= 2 && d.name.length <= 100,
        "Please enter your name.",
      ],
      [
        "email",
        EMAIL_RE.test(d.email) && d.email.length <= 200,
        "Please enter a valid email address.",
      ],
      [
        "work",
        d.work.length >= 2 && d.work.length <= 150,
        "Please say what I built for you.",
      ],
      [
        "rating",
        Number.isInteger(rating) && rating >= 1 && rating <= 5,
        "Please choose a rating from 1 to 5.",
      ],
      [
        "quote",
        d.quote.length >= 10 && d.quote.length <= 1500,
        "Please write a review (at least 10 characters).",
      ],
      [
        "consent",
        b.consent === true,
        "Please tick the box to allow your review to be shown.",
      ],
    ]);
    if (fields) return bad(res, fields);
    const saved = await store.add("reviews", { ...d, approved: false });
    notify(
      "New review awaiting approval from " + d.name,
      [
        `Name: ${d.name}`,
        `Email: ${d.email}`,
        `Business: ${d.business || "-"}`,
        `Work: ${d.work}`,
        `Rating: ${d.rating}/5`,
        "",
        d.quote,
        "",
        `Approve: POST /api/admin/reviews/${saved.id}/approve`,
      ],
      d.email,
    );
    res.json({ ok: true, id: saved.id });
  } catch (e) {
    next(e);
  }
});

/* ---------- admin API (Authorization: Bearer $ADMIN_TOKEN) ---------- */
const digest = (s) => createHash("sha256").update(s).digest();
function admin(req, res, next) {
  if (!ADMIN_TOKEN)
    return res
      .status(503)
      .json({ error: "Admin API is disabled: set ADMIN_TOKEN." });
  const m = /^Bearer (.+)$/.exec(req.get("authorization") || "");
  if (!m || !timingSafeEqual(digest(m[1]), digest(ADMIN_TOKEN)))
    return res.status(401).json({ error: "Unauthorized" });
  next();
}
const adminLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429,
});

app.get("/api/admin/inquiries", adminLimit, admin, async (_req, res, next) => {
  try {
    res.json({ inquiries: (await store.list("inquiries")).reverse() });
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/reviews", adminLimit, admin, async (_req, res, next) => {
  try {
    res.json({ reviews: (await store.list("reviews")).reverse() });
  } catch (e) {
    next(e);
  }
});
app.post(
  "/api/admin/reviews/:id/approve",
  adminLimit,
  admin,
  async (req, res, next) => {
    try {
      const row = await store.update("reviews", req.params.id, {
        approved: true,
      });
      row
        ? res.json({ ok: true, review: row })
        : res.status(404).json({ error: "Review not found" });
    } catch (e) {
      next(e);
    }
  },
);
app.post(
  "/api/admin/reviews/:id/unpublish",
  adminLimit,
  admin,
  async (req, res, next) => {
    try {
      const row = await store.update("reviews", req.params.id, {
        approved: false,
      });
      row
        ? res.json({ ok: true, review: row })
        : res.status(404).json({ error: "Review not found" });
    } catch (e) {
      next(e);
    }
  },
);
app.delete(
  "/api/admin/reviews/:id",
  adminLimit,
  admin,
  async (req, res, next) => {
    try {
      (await store.remove("reviews", req.params.id))
        ? res.json({ ok: true })
        : res.status(404).json({ error: "Review not found" });
    } catch (e) {
      next(e);
    }
  },
);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

/* ---------- static front end (production) ---------- */
if (existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: "index.html" }));
}

/* ---------- errors ---------- */
app.use((err, _req, res, _next) => {
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "Message is too long." });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid request." });
  console.error(err);
  res
    .status(500)
    .json({ error: "Something went wrong. Please try again later." });
});

app.listen(PORT, () => {
  console.log(
    `API on http://localhost:${PORT}` +
      (existsSync(dist) ? " (serving dist/)" : ""),
  );
  if (!ADMIN_TOKEN)
    console.warn("ADMIN_TOKEN is not set: the admin endpoints are disabled.");
  if (!mailer)
    console.log("SMTP not configured: submissions are saved but not emailed.");
});
