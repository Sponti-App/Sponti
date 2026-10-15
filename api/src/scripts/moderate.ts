// Hand moderation for the tester round (#542). See moderation.ts for what each
// command does, and deploy/netcup/MODERATION.md for when to use them.
//
// Dry run by default: prints what it would change. Pass --apply to change it.
// Reads MONGO_URI and DB_NAME from the environment:
//
//   npm run moderate -- suspend @someone              # dry run, uses api/.env
//   node dist/scripts/moderate.js suspend @someone --apply   # built image
//   node dist/scripts/moderate.js unsuspend @someone --apply
//   node dist/scripts/moderate.js hide-flare <flare id> --apply
import mongoose from "mongoose";
import { hideFlare, suspendUser, unsuspendUser } from "./moderation.js";

const USAGE =
  "usage: moderate (suspend <username> | unsuspend <username> | hide-flare <flare id>) [--apply]";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [command, target, ...rest] = args.filter((arg) => arg !== "--apply");
const commands = { suspend: suspendUser, unsuspend: unsuspendUser, "hide-flare": hideFlare };

if (!command || !target || rest.length > 0 || !(command in commands)) {
  console.error(USAGE);
  process.exit(2);
}

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
console.log(`mode: ${apply ? "apply" : "dry-run"}`);

try {
  // autoIndex off: this script must not create or change indexes.
  await mongoose.connect(mongoUri, { dbName, autoIndex: false });
  const result = await commands[command as keyof typeof commands](target, apply);
  for (const line of result.lines) console.log(line);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
