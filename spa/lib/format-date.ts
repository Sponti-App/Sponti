// The one place a date or time becomes a label. Product copy is lowercase
// (BRAND.md), and `toLocale*String` returns "Sunday", "October" and "PM", so
// every date and time shown to a user goes through one of these instead of
// calling `toLocale*String` on a screen. Only the output is lowercased; the
// locale still picks the order and the 12/24 hour clock.
//
//   formatClock(d)        "12:42 pm"
//   formatWeekdayShort(d) "sun"
//   formatDayShort(d)     "sun, oct 4"
//   formatDayLong(d)      "sunday, oct 4"
//   formatMonthName(d)    "october"
//
// User-generated text (titles, names, bios) never goes through here.

type DateInput = Date | string | number

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/**
 * Where a label is made for nobody in particular (a link preview rendered on
 * the server, #616): the zone and locale to write it in. Left out, the label
 * follows the viewer's own device, which is what every screen wants.
 */
export type DateLabelZone = { timeZone: string; locale: string }

/** Clock time in the viewer's locale, lowercased: "12:42 pm". */
export function formatClock(value: DateInput, zone?: DateLabelZone): string {
  return toDate(value)
    .toLocaleTimeString(zone?.locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone?.timeZone,
    })
    .toLowerCase()
}

/** Short weekday: "sun". */
export function formatWeekdayShort(
  value: DateInput,
  zone?: DateLabelZone
): string {
  return toDate(value)
    .toLocaleDateString(zone?.locale, {
      weekday: "short",
      timeZone: zone?.timeZone,
    })
    .toLowerCase()
}

/** Short weekday, month and day: "sun, oct 4". */
export function formatDayShort(value: DateInput): string {
  return toDate(value)
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase()
}

/** Long weekday, short month and day: "sunday, oct 4". */
export function formatDayLong(value: DateInput): string {
  return toDate(value)
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toLowerCase()
}

/** Full month name: "october". */
export function formatMonthName(value: DateInput): string {
  return toDate(value)
    .toLocaleDateString(undefined, { month: "long" })
    .toLowerCase()
}

/** Short weekday and clock time: "sun 12:42 pm". */
export function formatWeekdayClock(
  value: DateInput,
  zone?: DateLabelZone
): string {
  return `${formatWeekdayShort(value, zone)} ${formatClock(value, zone)}`
}
