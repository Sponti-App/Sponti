// PROTOTYPE (#369) — mock data only. Nothing here talks to the api or
// auth-server; delete with the route once a direction is picked.

export const ME = {
  displayName: "Lena Weber",
  username: "lena",
}

export const FRIENDS = [
  { id: "f1", displayName: "Mia Koch", username: "mia.k" },
  { id: "f2", displayName: "Sam Ortiz", username: "samsam" },
  { id: "f3", displayName: "Jonas Brandt", username: "jonas.b" },
]

// Shapes of the real contact links (lib/contact-links.ts): /invite/<token>
// for the 7-day link, /qr/<token> for the 15-minute code.
export const INVITE_URL = "https://sponti-flame.vercel.app/invite/k3x9q2mf"
export const QR_URL = "https://sponti-flame.vercel.app/qr/7fd2a1c08e"

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
