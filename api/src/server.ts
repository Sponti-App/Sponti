import { app } from "#app";
import { env } from "#config/env";
import { connectDB } from "#db/connect";
import { startAccountPurge } from "#services/accountPurgeService";

await connectDB();
// #449: erases accounts deleted on the auth-server, every few minutes.
startAccountPurge();

app.listen(env.PORT, () => {
  console.log(`Sponti API server listening on port ${env.PORT}`);
});
