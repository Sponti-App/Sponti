import { z } from "zod";

export const createQrContactTokenBodySchema = z.object({}).strict();

export const resolveQrContactTokenBodySchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();
