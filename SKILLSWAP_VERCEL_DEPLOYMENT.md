# SkillSwap Vercel Deployment

The current deployment target is one Vercel project rooted at the repository root:

- `/` serves the Vite SPA from `client/dist`;
- `/api/*` invokes the exported Express application through `api/index.js`;
- npm workspaces install root, client, and server dependencies from the root lockfile.

Do **not** set the Vercel Root Directory to `client`. Leave it blank (`.`), use `npm ci`, run `npm run build`, and set the output directory to `client/dist`. The committed root `vercel.json` is authoritative.

Production uses same-origin relative `/api` requests, so `VITE_API_URL` should remain unset. Traditional Socket.IO is disabled unless a separate verified realtime service is configured; REST messaging polls while realtime is unavailable.

See [SKILLSWAP_SINGLE_VERCEL_DEPLOYMENT.md](SKILLSWAP_SINGLE_VERCEL_DEPLOYMENT.md) for environment variables, MongoDB reuse, cookies, CORS/CSRF, cron scheduling, Cloudinary uploads, realtime limitations, dashboard settings, and the production smoke checklist.
