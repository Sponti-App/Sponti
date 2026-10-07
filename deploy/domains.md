# Domains: sponti.fun and app.sponti.fun

The landing page lives on the apex `sponti.fun` and the app on `app.sponti.fun`, both served by the one Vercel project `sponti` (#467). `spa/proxy.ts` tells them apart by host: on a landing host, `/` shows the landing page, the legal pages (`/menu/impressum`, `/menu/privacy`, `/menu/terms`) and the link-preview images are served, and every other path redirects (307) to the app with its path and query, so old links such as `sponti.fun/invite/<token>` keep working. Until both variables below are set, nothing changes, and the landing page is still reachable at `/landing` on any host for review.

## Steps

1. **Vercel domains** (project `sponti` → Settings → Domains): add `sponti.fun`, `www.sponti.fun` and `app.sponti.fun`, all on the production branch (`main`). Don't let Vercel redirect `sponti.fun` to `www` or the other way round; the proxy handles both.
2. **DNS** at the registrar: the records Vercel shows for each domain, usually an `A` record for the apex (`76.76.21.21`) and `CNAME cname.vercel-dns.com` for `www` and `app`. Remove whatever serves the current sponti.fun landing page.
3. **Vercel env** (Production):
   - `LANDING_HOSTS=sponti.fun,www.sponti.fun`
   - `APP_ORIGIN=https://app.sponti.fun` (also where the landing's "open sponti" and its QR code go)
   - `NEXT_PUBLIC_SITE_URL=https://app.sponti.fun` (invite and QR links, link-preview urls)

   Then redeploy: the landing page is rendered at build time and `NEXT_PUBLIC_*` values are baked in.
4. **Google OAuth** (Google Cloud console → the web client in `NEXT_PUBLIC_GOOGLE_CLIENT_ID`): add `https://app.sponti.fun` to the authorized JavaScript origins.
5. **Google Maps browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): add `https://app.sponti.fun/*` to its HTTP referrers.
6. **netcup server** (`/opt/sponti/deploy/netcup/`, see [netcup/README.md](netcup/README.md)):
   - `api.env`: add `https://app.sponti.fun` to `CORS_ORIGINS`, set `CLIENT_BASE_URL=https://app.sponti.fun`
   - `auth.env`: add `https://app.sponti.fun` to `CORS_ORIGINS`, set `APP_URL=https://app.sponti.fun` (password-reset links)
   - then run `deploy.sh`
7. **Check:** `sponti.fun` shows the landing page and "open sponti" opens `app.sponti.fun`; `sponti.fun/menu/impressum` shows the impressum; `sponti.fun/login` lands on `app.sponti.fun/login`; signing in (email and Google), the map and an invite link work on `app.sponti.fun`.

Keep `sponti-flame.vercel.app` in `CORS_ORIGINS` and the OAuth origins until testers have moved over. `NEXT_PUBLIC_PUBLIC_APP_URL` (the "join me on sponti" share text) falls back to `https://sponti.fun`, which is now the landing page, so it can stay unset.
