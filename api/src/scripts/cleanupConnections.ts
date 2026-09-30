// One-off cleanup of one-sided and blocked-pair connection rows (#260). See
// connectionCleanup.ts for what it removes.
//
// Dry run by default: prints counts and ids, deletes nothing. Pass --apply to
// delete. Reads MONGO_URI and DB_NAME from the environment:
//
//   npm run cleanup:connections              # dry run, uses api/.env
//   npm run cleanup:connections -- --apply   # delete
//   node dist/scripts/cleanupConnections.js [--apply]   # built image
import mongoose from "mongoose";
import { runConnectionCleanup } from "./connectionCleanup.js";

const USAGE = "usage: cleanupConnections [--apply]";

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--apply");

if (unknown.length > 0) {
  console.error(`unknown argument: ${unknown.join(" ")}\n${USAGE}`);
  process.exit(2);
}

const apply = args.includes("--apply");
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

if (!mongoUri || !dbName) {
  console.error("MONGO_URI and DB_NAME must be set.");
  process.exit(2);
}

// Say where this is pointed, without printing credentials.
let host = "unknown host";
try {
  host = new URL(mongoUri).host;
} catch {
  // mongodb+srv URIs with odd characters: fall back to the placeholder.
}
console.log(`database: ${dbName} on ${host}`);

try {
  // autoIndex off: this script must not create or change indexes.
  await mongoose.connect(mongoUri, { dbName, autoIndex: false });
  await runConnectionCleanup({ apply });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
