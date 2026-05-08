import { app } from "#app";
import { env } from "#config/env";
import { connectDB } from "#db/connect";

await connectDB();

app.listen(env.PORT, () => {
  console.log(`Sponti API server listening on port ${env.PORT}`);
});
