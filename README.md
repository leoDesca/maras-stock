# Maras Beauty Stock App

Stock, sales, cash book and analytics for the shop. Two roles, enforced by the server:

| | Staff (`/shop`) | Owner (`/owner`) |
|---|---|---|
| Sell items, see own sales today | ✅ | ✅ |
| Submit stock counts | ✅ | ✅ |
| See cost prices / profit | ❌ | ✅ |
| Discounts above the limit | ❌ | ✅ |
| Edit items, prices, restock | ❌ | ✅ |
| Void sales, cash book, approve counts | ❌ | ✅ |
| Analytics dashboard, staff, settings, logs | ❌ | ✅ |

## Run it (VS Code)
1. Install Node.js 18+ from nodejs.org.
2. Open this folder in VS Code → Terminal → `npm install` then `npm start`.
3. Visit http://localhost:3000

**First logins:** `owner / owner123` and `staff / staff123`. Change both straight away (Password button; owner can reset staff passwords under Staff).

## Where things are
- `server.js` — all rules and API (roles, discounts, analytics). Starting stock lives in `seed()`.
- `views/shop.html` — employee page · `views/owner.html` — owner pages and dashboard
- `public/` — shared styles and helpers · `data/db.json` — all your data (created on first run; **back this file up**)

To start over, stop the server and delete `data/db.json`.

## Using it on the shop phone/other devices
Run it on one computer; other devices on the same Wi-Fi open `http://<that-computer's-IP>:3000`. For internet access, deploy to a host such as Render/Railway and set the `PORT` env variable. Use HTTPS if you do.

## Hosting online (data safe, code still editable)
See `HOSTING.md`. In short: push this folder to a private GitHub repo, connect it to Render with a persistent disk,
set `DATA_DIR`, `OWNER_PASSWORD`, `STAFF_PASSWORD`. Edit code in VS Code → `git push` → the site updates itself, and your data is untouched.
