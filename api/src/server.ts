import { app } from "#app";
import { env } from "#config/env";
import { connectDB } from "#db/connect";
import { backfillLiveUntil } from "#models/Event";
import { startAccountPurge } from "#services/accountPurgeService";

await connectDB();
// #614: flares saved before `liveUntil` existed get it once.
const backfilled = await backfillLiveUntil();
if (backfilled > 0) console.log(`Backfilled liveUntil on ${backfilled} flares`);
// #449: erases accounts deleted on the auth-server, every few minutes.
startAccountPurge();

app.listen(env.PORT, () => {
  console.log(`Sponti API server listening on port ${env.PORT}`);
});
