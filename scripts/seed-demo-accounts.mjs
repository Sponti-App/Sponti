#!/usr/bin/env node
// Creates a small cast of demo accounts and wires up connections between them
// through the real auth-server and api endpoints (register -> request ->
// accept), so nothing here can drift from the real schemas. Safe to re-run:
// existing accounts are logged in instead of re-created, and existing
// connections / circle members are left alone.
//
//   node scripts/seed-demo-accounts.mjs
//
// Env: SEED_AUTH_URL (default http://localhost:3002), SEED_API_URL (default
// http://localhost:4000). Whatever database those servers use is where the
// demo users land, so point them at a local database first (scripts/dev-local.sh
// does this for you).

const AUTH_URL = process.env.SEED_AUTH_URL ?? "http://localhost:3002"
const API_URL = process.env.SEED_API_URL ?? "http://localhost:4000"
const PASSWORD = "sponti-demo-1"

const isLocal = (url) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname)
if (![AUTH_URL, API_URL].every(isLocal) && !process.argv.includes("--allow-remote")) {
  console.error(
    `refusing to seed ${AUTH_URL} / ${API_URL}: not localhost. Pass --allow-remote if you really mean it.`
  )
  process.exit(1)
}

// Who exists. Emails are <name>@demo.sponti.test (a reserved, undeliverable TLD).
const ACCOUNTS = [
  { name: "ava", displayName: "Ava Demo" },
  { name: "ben", displayName: "Ben Demo" },
  { name: "cleo", displayName: "Cleo Demo" },
  { name: "dan", displayName: "Dan Demo" },
  { name: "eli", displayName: "Eli Demo" },
  { name: "fay", displayName: "Fay Demo" },
  { name: "gus", displayName: "Gus Demo" },
]

// [from, to]: `from` sends, `to` accepts.
const FRIENDS = [
  ["ava", "ben"],
  ["ava", "cleo"],
  ["ava", "dan"],
  ["ben", "cleo"],
]

// [from, to]: request left pending so the accept / decline UI has something to act on.
const PENDING = [
  ["eli", "ava"], // ava has an incoming request from eli
  ["ava", "fay"], // ava has an outgoing request to fay
]

// owner's built-in circles -> members (all must already be friends of the owner).
const CIRCLES = [
  { owner: "ava", circle: "close", members: ["ben", "cleo"] },
  { owner: "ava", circle: "inner", members: ["ben"] },
]

const email = (name) => `${name}@demo.sponti.test`

async function call(method, url, { body, token } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // non-JSON error page; fall through with the raw text
  }
  return { status: res.status, ok: res.ok, json, text }
}

function fail(what, res) {
  const detail = res.json?.error?.message ?? res.json?.message ?? res.text.slice(0, 200)
  console.error(`\n${what} failed (${res.status}): ${detail}`)
  process.exit(1)
}

async function ensureAccount({ name, displayName }) {
  const creds = { email: email(name), password: PASSWORD }
  const created = await call("POST", `${AUTH_URL}/auth/register`, {
    body: { username: name, displayName, ...creds },
  })
  if (created.ok) return { ...toSession(created.json), name, fresh: true }
  if (created.status !== 409) fail(`register ${name}`, created)

  const login = await call("POST", `${AUTH_URL}/auth/login`, { body: creds })
  if (!login.ok) fail(`login ${name} (exists, but not with the demo password?)`, login)
  return { ...toSession(login.json), name, fresh: false }
}

const toSession = (json) => ({ id: json.user.id, token: json.accessToken })

const api = (path) => `${API_URL}/api/v1${path}`

async function sendRequest(from, to) {
  const res = await call("POST", api("/connections/request"), {
    token: from.token,
    body: { receiverId: to.id, type: "shared_invitation" },
  })
  if (!res.ok) fail(`${from.name} -> ${to.name} request`, res)
}

async function acceptFrom(receiver, requester) {
  const list = await call("GET", api("/connections?direction=incoming&status=pending&limit=100"), {
    token: receiver.token,
  })
  if (!list.ok) fail(`${receiver.name} list requests`, list)
  const pending = list.json.data.find((c) => String(c.requesterId) === requester.id)
  if (!pending) return // already accepted on an earlier run (or auto-accepted)
  const res = await call("PATCH", api(`/connections/${pending._id}/respond`), {
    token: receiver.token,
    body: { status: "accepted" },
  })
  if (!res.ok) fail(`${receiver.name} accept ${requester.name}`, res)
}

async function addToCircles(byName) {
  for (const { owner, circle, members } of CIRCLES) {
    const ownerSession = byName[owner]
    const circles = await call("GET", api("/circles"), { token: ownerSession.token })
    if (!circles.ok) fail(`${owner} list circles`, circles)
    const target = circles.json.data.find((c) => c.type === circle)
    if (!target) fail(`${owner} find "${circle}" circle`, circles)
    const have = new Set((target.members ?? []).map((m) => String(m.userId)))
    for (const member of members) {
      if (have.has(byName[member].id)) continue
      const res = await call("POST", api(`/circles/${target._id}/members`), {
        token: ownerSession.token,
        body: { userId: byName[member].id },
      })
      if (!res.ok) fail(`${owner} add ${member} to ${circle}`, res)
    }
  }
}

const byName = {}
for (const account of ACCOUNTS) {
  byName[account.name] = await ensureAccount(account)
  process.stdout.write(byName[account.name].fresh ? "+" : ".")
}

for (const [from, to] of FRIENDS) {
  await sendRequest(byName[from], byName[to])
  await acceptFrom(byName[to], byName[from])
}
for (const [from, to] of PENDING) await sendRequest(byName[from], byName[to])
await addToCircles(byName)

console.log(`\n\ndemo accounts ready (password for all: ${PASSWORD})\n`)
for (const { name } of ACCOUNTS) console.log(`  ${email(name).padEnd(26)} @${name}`)
console.log(`
who's connected to whom
  ava    hub: friends with ben, cleo, dan
         close friends: ben, cleo · inner circle: ben
         has an incoming request from eli, an outgoing one to fay (both pending)
  ben    friends with ava, cleo
  cleo   friends with ava, ben
  dan    friends with ava
  eli    sent a request to ava (pending)
  fay    received a request from ava (pending)
  gus    no connections: use to test sending a fresh request or a QR scan
`)
