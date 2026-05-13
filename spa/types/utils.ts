import { Types } from "mongoose"
import { z } from "zod"

export const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), "Invalid MongoDB ObjectId")
