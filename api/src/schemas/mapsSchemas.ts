import { z } from "zod";

// Request body for POST /maps/route. Matches the Google Routes API origin /
// destination shape so the controller is a thin pass-through.

const latLngSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

export const travelModeSchema = z.enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT"]);

export const computeRouteBodySchema = z
  .object({
    origin: latLngSchema,
    destination: latLngSchema,
    travelMode: travelModeSchema.default("WALK"),
  })
  .strict();

export type ComputeRouteBody = z.infer<typeof computeRouteBodySchema>;
