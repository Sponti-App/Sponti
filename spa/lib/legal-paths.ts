// #457: the Impressum, privacy note and terms. Public in auth-gate, never
// behind the mobile gate, and also served on the landing host (#467,
// lib/landing-host.ts). A plain module, so proxy.ts can read it too.
export const LEGAL_PATHS = ["/menu/terms", "/menu/privacy", "/menu/impressum"]
