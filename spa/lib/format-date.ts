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

/** Clock time in the viewer's locale, lowercased: "12:42 pm". */
export function formatClock(value: DateInput): string {
  return toDate(value)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
}

/** Short weekday: "sun". */
export function formatWeekdayShort(value: DateInput): string {
  return toDate(value)
    .toLocaleDateString(undefined, { weekday: "short" })
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
export function formatWeekdayClock(value: DateInput): string {
  return `${formatWeekdayShort(value)} ${formatClock(value)}`
}
