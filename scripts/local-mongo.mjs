#!/usr/bin/env node
// Runs a single-node MongoDB replica set on 127.0.0.1:27018, with data kept in
// .local-mongo/ so it survives restarts. A replica set is needed because the
// api uses transactions. Uses the mongodb-memory-server that api/ already has
// as a devDependency (the first run downloads a mongod binary).
//
//   node scripts/local-mongo.mjs          # run in the foreground
//   rm -rf .local-mongo                   # wipe it

import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const { MongoMemoryReplSet } = createRequire(path.join(root, "api", "package.json"))(
  "mongodb-memory-server"
)

const PORT = 27018
const dbPath = path.join(root, ".local-mongo")
mkdirSync(dbPath, { recursive: true })

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger", name: "rs0" },
  instanceOpts: [{ port: PORT, dbPath, storageEngine: "wiredTiger" }],
})

console.log(`local mongo ready: mongodb://127.0.0.1:${PORT}/?replicaSet=rs0 (data in .local-mongo/)`)

const stop = async () => {
  await replSet.stop({ doCleanup: false })
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
setInterval(() => {}, 1 << 30)
