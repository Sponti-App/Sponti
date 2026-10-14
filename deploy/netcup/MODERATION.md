# Moderation runbook (tester round)

What to do when someone posts something harmful or behaves badly, while sign-up is open and there is no report button (#542). Reports arrive at `hello@sponti.fun`; whoever reads that inbox acts on them here.

Every command runs on the server, in `/opt/sponti/deploy/netcup`, through the api container. Each one is a **dry run by default**: it prints what it would change. Add `--apply` to change it.

```sh
ssh root@152.53.198.143
cd /opt/sponti/deploy/netcup
```

## Remove one flare

For a flare with a harmful title, description or place. Get its id from the link (`app.sponti.fun/event/<id>`) or from the reporter.

```sh
docker compose exec api node dist/scripts/moderate.js hide-flare <flare id>
docker compose exec api node dist/scripts/moderate.js hide-flare <flare id> --apply
```

The flare is set to `completed`. It leaves every map, list and the calendar, and its page and chat stop opening, even by direct link, for everyone except its host. The host can't reactivate it, and guests aren't notified.

## Stop an account

For a person, not just one flare: harassment, repeated harmful flares, spam.

```sh
docker compose exec api node dist/scripts/moderate.js suspend @username
docker compose exec api node dist/scripts/moderate.js suspend @username --apply
```

This sets `suspendedAt` on the account and deletes its refresh tokens:
- It can't sign in again (password or Google). The message tells them to write to `hello@sponti.fun`.
- The session it has ends when its access token runs out, within 15 minutes.
- All its flares disappear for everyone, signed in or out, straight away.

It does not delete anything. Their connections, circles and memberships stay, so unsuspending restores the account as it was.

## Undo a suspension

```sh
docker compose exec api node dist/scripts/moderate.js unsuspend @username --apply
```

There is no undo command for `hide-flare`. If one was hidden by mistake, set its `status` back to `active` in Atlas.

## Afterwards

- Reply to the reporter from `hello@sponti.fun`, saying what was done.
- Note the case (date, username or flare id, what was done, why) where the team keeps tester-round notes, outside this repo.
- Suspending doesn't stop someone from signing up again with another email. If that happens, suspend the new account too and tell the team.

## Not covered here

Deleting an account and its personal data is #449. Until that ships, a deletion request is acknowledged by email and handled once the delete path exists.
