# Jaypee – 3D Portfolio (full stack)

**Frontend:** Vite + Three.js (a dark cyan 3D room: hologram portrait, one monitor per project, drag-to-orbit) · **Backend:** Node + Express (inquiry form, moderated reviews, optional SMTP email) · **Deploy:** Docker or any Node host.

## Run it
```bash
npm install
cp .env.example .env     # set ADMIN_TOKEN at least
npm run dev              # site on http://localhost:5173, API on :3001
```
Production: `npm run build && npm start` (Express serves `dist/` and the API on one port), or `docker build -t portfolio . && docker run -p 3001:3001 -v portfolio-data:/data --env-file .env portfolio`.

## Where things live
| Path | What |
|---|---|
| `src/data/projects.js` | Your 10 projects. Add/edit here; drop screenshots in `public/assets/` |
| `src/main.js` | 3D scene, camera moves, project carousel, music, nav |
| `src/api.js` | Inquiry + review forms (falls back to a mailto draft if the API is offline) |
| `src/style.css` | All styling and colour tokens (`:root` at the top) |
| `server/index.js` | API: validation, rate limiting, honeypot, helmet, SMTP notify |
| `server/store.js` | JSON-file storage (swap for a DB later if you need one) |

## API
- `POST /api/inquiry` – save a project inquiry (emails you if SMTP is set)
- `GET /api/reviews` – approved reviews only · `POST /api/reviews` – submit (held for approval)
- Admin, header `Authorization: Bearer $ADMIN_TOKEN`: `GET /api/admin/inquiries`, `GET /api/admin/reviews`, `POST /api/admin/reviews/:id/approve`, `DELETE /api/admin/reviews/:id`

Approve a review: `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/api/admin/reviews/<id>/approve`

## Deploy
- **Full stack (Docker / any Node host):** see "Run it" above. Set `ADMIN_TOKEN`, optionally `SMTP_*`, and `TRUST_PROXY=1` behind a proxy.
- **Cloudflare (static front end):** `npm run deploy` (builds, then `wrangler deploy` using `wrangler.json`). There is no API on that host, so the forms open a pre-filled email draft instead.
- **Any static host (GitHub Pages, Netlify...):** `npm run build` and upload `dist/`. Same email-draft fallback.

## Assets you need to add
Put these in `public/assets/` (they are not in the repo, so the scene shows grey monitors and no portrait until you do):
`jaypee.webp` (portrait, 768x1056), `123.png`, `1234.png`, `12345.png`, `4.png` ... `10.png` (project screenshots, one per project), and `audio/theme.mp3`.

## Notes
- Three.js is pinned to r128 so the scene looks identical to the preview.
- The music file is `public/assets/audio/theme.mp3`.
