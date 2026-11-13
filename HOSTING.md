# Hosting on Render (recommended)

Your **code** lives on GitHub; your **data** lives on a persistent disk on the server. Updating the code never touches the data.

## One-time setup
1. Make a free account at github.com and create a **private** repository named `maras-stock`.
2. In VS Code terminal (inside this folder):
   ```
   git init
   git add .
   git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/maras-stock.git
   git push -u origin main
   ```
   (`data/db.json` and `node_modules` are ignored automatically.)
3. Make an account at render.com → **New → Blueprint** → pick your repo. It reads `render.yaml`.
4. When asked, type strong passwords for `OWNER_PASSWORD` and `STAFF_PASSWORD`.
5. Deploy. Render gives you a link like `https://maras-stock.onrender.com`: share that with your worker.

> The passwords are only used the **first time** the database is created. Afterwards change them inside the app.

## Changing the code later
Edit in VS Code, test locally with `npm start`, then:
```
git add .
git commit -m "what I changed"
git push
```
Render redeploys automatically in a minute or two. Data stays on the disk.

## Keeping your data safe
- Owner → **Settings → Download backup** every week. Save the file in Google Drive or email it to yourself.
- To restore: stop the app, put the backup file in the disk as `db.json` (Render → Shell), restart.
- Never delete the disk in Render.

## Notes
- Persistent disks need Render's paid plan (check current pricing on render.com). Free plans lose files on restart, so do not use free for this app.
- Only ONE server instance should run (the data is a single file).
- Other hosts work too if they offer a persistent volume (Railway, Fly.io): mount it and set `DATA_DIR` to its path.
