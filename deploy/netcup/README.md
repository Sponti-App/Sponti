# Backends on the netcup server

`api` and `auth-server` run on the team's netcup VPS (152.53.198.143) with Docker Compose. Caddy sits in front, gets HTTPS certificates on its own, and proxies to them. The SPA stays on Vercel, and the database stays on MongoDB Atlas. This replaces the Render free tier, whose services spun down after about 15 minutes idle.

| Service | Public URL (for now) | Container port |
| --- | --- | --- |
| api | https://api.152-53-198-143.sslip.io | 4000 |
| auth-server | https://auth.152-53-198-143.sslip.io | 3001 |

sslip.io resolves `<name>.<ip-with-dashes>.sslip.io` to that IP, so there's no DNS to set up. To move to real subdomains later (e.g. `api.sponti.fun`), point A records at the IP, change `API_HOST`/`AUTH_HOST` in `.env`, run `deploy.sh`, and update the SPA's env on Vercel.

## Files on the server (`/opt/sponti/deploy/netcup/`, never in git)

- `.env`: `API_HOST`, `AUTH_HOST`, `DEPLOY_BRANCH` (from `env.example`)
- `api.env`, `auth.env`: secrets (from `api.env.example` / `auth.env.example`), mode 600

## First-time setup

1. Authorize an SSH key for root (netcup delivers password login): `ssh-copy-id root@152.53.198.143`.
2. On the server: `BRANCH=<branch> sh -c "$(curl -fsSL https://raw.githubusercontent.com/Sponti-App/Sponti/<branch>/deploy/netcup/setup.sh)"`. This installs Docker, enables the firewall (SSH, 80, 443), clones the repo to `/opt/sponti` and creates the env files.
3. Fill in `api.env` and `auth.env` with the values from the Render dashboard or the vault. `api` and `auth-server` must share `MONGO_URI`, `DB_NAME` and `ACCESS_JWT_SECRET`.
4. Run `/opt/sponti/deploy/netcup/deploy.sh`, then check `curl https://api.152-53-198-143.sslip.io/health` and `curl https://auth.152-53-198-143.sslip.io/health`.
5. Atlas → Network Access: allow 152.53.198.143. Once Render is off, remove `0.0.0.0/0`.
6. Vercel project `sponti` (Production and the `dev` branch): set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_AUTH_BASE_URL` to the URLs above and redeploy. `NEXT_PUBLIC_*` values are baked in at build time.
7. Once the core loop works (sign in → light a flare → a friend sees it → RSVP), suspend the Render services.

## Deploying

```sh
ssh root@152.53.198.143 /opt/sponti/deploy/netcup/deploy.sh
```

This pulls `DEPLOY_BRANCH`, rebuilds both images and restarts only what changed. Useful commands in `/opt/sponti/deploy/netcup`:
- `docker compose logs -f api` (or `auth`, `caddy`)
- `docker compose ps`
- `docker compose restart auth`
