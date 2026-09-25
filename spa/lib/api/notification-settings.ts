import { apiFetch } from "@/lib/http"

// Mirrors api/src/models/NotificationSettings.ts exactly. `notifyWhen` and
// `maxDistanceMiles` shown in the settings UI are NOT part of this schema —
// don't add them here without a backend change first (the PATCH schema is
// `.strict()` and will reject unknown fields).
export type NotificationSettings = {
  quietHoursEnabled: boolean
  quietHoursStart: string // "HH:MM"
  quietHoursEnd: string // "HH:MM"
  eventReminders: boolean
  invitationNotifications: boolean
}

export type UpdateNotificationSettingsPayload = Partial<NotificationSettings>

type NotificationSettingsResponse = {
  data: NotificationSettings
}

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return apiFetch<NotificationSettingsResponse>("/notification-settings/me").then(
    (res) => res.data
  )
}

export function updateNotificationSettings(
  payload: UpdateNotificationSettingsPayload
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettingsResponse>("/notification-settings/me", {
    method: "PATCH",
    body: payload,
  }).then((res) => res.data)
}
