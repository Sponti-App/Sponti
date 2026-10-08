# Backends on the netcup server

`api` and `auth-server` run on the team's netcup VPS (152.53.198.143) with Docker Compose. Caddy sits in front, gets HTTPS certificates on its own, and proxies to them. The SPA stays on Vercel, and the database stays on MongoDB Atlas. This replaces the Render free tier, whose services spun down after about 15 minutes idle.

| Service | Public URL (for now) | Container port |
| --- | --- | --- |
| api | https://api.sponti.fun | 4000 |
| auth-server | https://auth.sponti.fun | 3001 |

The hosts are A records at the domain registrar (Infomaniak) pointing at the server IP. Caddy gets the certificates itself. To move a host, change `API_HOST`/`AUTH_HOST` in `.env`, run `deploy.sh`, and update `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_AUTH_BASE_URL` on Vercel.

## Files on the server (`/opt/sponti/deploy/netcup/`, never in git)

- `.env`: `API_HOST`, `AUTH_HOST`, `DEPLOY_BRANCH` (from `env.example`)
- `api.env`, `auth.env`: secrets (from `api.env.example` / `auth.env.example`), mode 600

## First-time setup

1. Authorize an SSH key for root (netcup delivers password login): `ssh-copy-id root@152.53.198.143`.
2. On the server: `BRANCH=<branch> sh -c "$(curl -fsSL https://raw.githubusercontent.com/Sponti-App/Sponti/<branch>/deploy/netcup/setup.sh)"`. This installs Docker, enables the firewall (SSH, 80, 443), clones the repo to `/opt/sponti` and creates the env files.
3. Fill in `api.env` and `auth.env` with the values from the Render dashboard or the vault. `api` and `auth-server` must share `MONGO_URI`, `DB_NAME` and `ACCESS_JWT_SECRET`.
4. Run `/opt/sponti/deploy/netcup/deploy.sh`, then check `curl https://api.sponti.fun/health` and `curl https://auth.sponti.fun/health`.
5. Atlas → Network Access: allow 152.53.198.143. Once Render is off, remove `0.0.0.0/0`.
6. Vercel project `sponti` (Production and the `dev` branch): set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_AUTH_BASE_URL` to the URLs above and redeploy. `NEXT_PUBLIC_*` values are baked in at build time.
7. Once the core loop works (sign in → light a flare → a friend sees it → RSVP), suspend the Render services.
8. Install the 14-day log retention, see [Logs](#logs).

## Deploying

**Automatic:** every merge into `dev` that touches `api/`, `auth-server/` or `deploy/netcup/` runs `.github/workflows/deploy-backends.yml`, which runs `deploy.sh` over SSH and then checks both `/health` URLs. You can also trigger it by hand from the Actions tab ("Deploy backends" → Run workflow). The server runs `DEPLOY_BRANCH=dev`.

The workflow's key (`NETCUP_DEPLOY_KEY` repo secret) is restricted on the server: its `authorized_keys` line has `command="/opt/sponti/deploy/netcup/deploy.sh",restrict`, so it can only deploy. To rotate it, generate a new key, replace that line, and update the secret.

**Manual:**

```sh
ssh root@152.53.198.143 /opt/sponti/deploy/netcup/deploy.sh
```

This pulls `DEPLOY_BRANCH`, rebuilds both images and restarts only what changed. Useful commands in `/opt/sponti/deploy/netcup`:
- `docker compose logs -f api` (or `auth`, `caddy`), see [Logs](#logs)
- `docker compose ps`
- `docker compose restart auth`

## Logs

`api`, `auth` and `caddy` log to the host's journald (`logging.driver: journald` in `docker-compose.yml`), each with a tag: `sponti-api`, `sponti-auth`, `sponti-caddy`. The privacy note promises that technical logs (IP address, time, requested path) are deleted after 14 days at the latest, so the host's journald is set to keep 14 days. Caddy writes no access log; its own startup and error output is what lands in `sponti-caddy`.

**The 14-day limit is only enforced once the one-time host step below has been run.** Until then journald keeps logs by size only (no time limit). The step is not part of `deploy.sh`: it changes the host, not the app.

### One-time host step (as root, after the deploy that brings the compose change)

The deploy copies `journald-retention.conf` to `/opt/sponti/deploy/netcup/` first, so merge to `dev` (or run `deploy.sh`) before this. Then, on the server:

```sh
install -D -m 644 /opt/sponti/deploy/netcup/journald-retention.conf /etc/systemd/journald.conf.d/sponti-retention.conf
systemctl restart systemd-journald
journalctl --rotate && journalctl --vacuum-time=14d
systemd-analyze cat-config systemd/journald.conf | grep -E 'MaxRetentionSec|MaxFileSec'
```

1. `install` puts the drop-in in place. It is safe to re-run, and it overwrites the file with the repo's version.
2. Restarting journald makes it read the drop-in.
3. `--rotate` closes the current journal files and `--vacuum-time=14d` deletes everything older than 14 days right away (otherwise that waits for the next rotation).
4. The last line should show `MaxRetentionSec=14day` and `MaxFileSec=1day`.

journald only deletes whole journal files, so `MaxFileSec=1day` makes it start a new file every day. Without it a file can stay open for a month, and the entries in it would be kept past 14 days. This applies to the host's whole journal (sshd and the rest too), not just the containers.

### Reading logs

In `/opt/sponti/deploy/netcup`:

- `docker compose logs -f api` (or `auth`, `caddy`), `docker compose logs --since 1h api`
- `journalctl CONTAINER_TAG=sponti-api --since "1 hour ago"` (or `sponti-auth`, `sponti-caddy`), add `-f` to follow
- `journalctl CONTAINER_TAG=sponti-api -p err` for errors only

Only the last 14 days exist. Switching the driver recreates the containers on the next deploy, and the logs of the old containers (Docker's default `json-file`) go with them.
