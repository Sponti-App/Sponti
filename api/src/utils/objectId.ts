import { Types } from "mongoose";
import { z } from "zod";

export const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), "Invalid MongoDB ObjectId");

export const toObjectId = (value: string) => new Types.ObjectId(value);

export const uniqueObjectIdStrings = (values: string[]) => Array.from(new Set(values));
