import { env } from "#config/env";
import type { ComputeRouteBody } from "#schemas/mapsSchemas";
import { AppError } from "#utils/AppError";

// Thin wrapper around Google's Routes API v2 (`computeRoutes`). Keeps the API
// key server-side and exposes only the fields the SPA needs.
//
// Why server-side: the key is held in API env, never sent to the client.
// Quota and abuse can be enforced here (rate-limit by user id is a follow-up).

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

export type ComputeRouteResult = {
  encodedPolyline: string;
  durationSeconds: number;
  distanceMeters: number;
};

const parseDurationSeconds = (value: string | undefined): number => {
  if (!value) return 0;
  const match = /^(\d+)s$/.exec(value);
  return match ? Number(match[1]) : 0;
};

export const computeRoute = async (
  input: ComputeRouteBody
): Promise<ComputeRouteResult> => {
  if (!env.GOOGLE_MAPS_API_KEY) {
    throw new AppError(
      "Maps integration is not configured",
      503,
      "MAPS_KEY_MISSING"
    );
  }

  const body = {
    origin: {
      location: {
        latLng: { latitude: input.origin.lat, longitude: input.origin.lng },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: input.destination.lat,
          longitude: input.destination.lng,
        },
      },
    },
    travelMode: input.travelMode,
    // Traffic-aware routing only applies to DRIVE; Google ignores it otherwise.
    ...(input.travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
    polylineQuality: "OVERVIEW",
    languageCode: "en-US",
    units: "IMPERIAL",
  };

  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AppError(
      `Routes API error ${response.status}: ${text || response.statusText}`,
      502,
      "ROUTES_API_ERROR"
    );
  }

  const json = (await response.json()) as {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const route = json.routes?.[0];

  if (!route?.polyline?.encodedPolyline) {
    throw new AppError("No route found", 404, "ROUTE_NOT_FOUND");
  }

  return {
    encodedPolyline: route.polyline.encodedPolyline,
    durationSeconds: parseDurationSeconds(route.duration),
    distanceMeters: route.distanceMeters ?? 0,
  };
};
