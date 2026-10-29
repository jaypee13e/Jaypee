// worker.js — Cloudflare Worker endpoint: POST /api/quote
// 1) validates the request  2) recomputes the price on the server (can't be faked)
// 3) emails YOU the request + quote  4) emails the CLIENT a copy of their quote
//
// Setup (once):
//   npx wrangler secret put RESEND_API_KEY      (free key from resend.com)
// In wrangler.toml add:
//   [vars]
//   OWNER_EMAIL = "you@example.com"
//   FROM_EMAIL  = "Jaypee <quotes@yourdomain.com>"   # a sender verified in Resend
//
// Static files (your site) keep being served by your existing assets setup;
// this Worker only intercepts /api/quote and passes everything else through.



const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

function quoteTable(q) {
  const rows = q.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(l.label)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${formatMoney(l.amount, q.currency)}</td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}
    <tr><td style="padding:10px 12px"><b>${q.isRange ? "Estimated range" : "Total"}</b></td><td style="padding:10px 12px;text-align:right"><b>${formatTotal(q)}</b></td></tr></table>`;
}

async function sendEmail(env, { to, subject, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      html,
      reply_to: replyTo,
    }),
  });
  if (!res.ok) throw new Error("Email failed: " + (await res.text()));
}

export async function handleQuote(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = String(body.name || "")
    .trim()
    .slice(0, 100);
  const email = String(body.email || "")
    .trim()
    .slice(0, 150);
  const message = String(body.message || "")
    .trim()
    .slice(0, 2000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return json({ error: "Name and a valid email are required." }, 400);

  // Honeypot: bots fill this hidden field
  if (body.website) return json({ ok: true });

  let quote;
  try {
    quote = computeQuote(body);
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  const summary = quoteTable(quote);
  const details = `<p><b>Name:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>Package:</b> ${esc(quote.package)}<br><b>Pages:</b> ${quote.pages}</p><p><b>Message:</b><br>${esc(message).replace(/\n/g, "<br>")}</p>`;

  try {
    await sendEmail(env, {
      to: env.OWNER_EMAIL,
      replyTo: email,
      subject: `New quote request: ${name} — ${formatTotal(quote)}`,
      html: details + summary,
    });
    await sendEmail(env, {
      to: email,
      replyTo: env.OWNER_EMAIL,
      subject: "Your website quotation",
      html: `<p>Hi ${esc(name)}, thanks for your request! Here is your automatic estimate:</p>${summary}
             <p style="color:#666;font-size:13px">This is an estimate based on the details you provided. The final price is confirmed after a short conversation about your project.</p>`,
    });
  } catch (e) {
    return json(
      { error: "Could not send the request. Please try again." },
      502,
    );
  }

  return json({ ok: true, quote });
}

// No default export here on purpose: your existing worker keeps its own fetch handler
// and just calls handleQuote() for the /api/quote route (see the snippet in the chat).
