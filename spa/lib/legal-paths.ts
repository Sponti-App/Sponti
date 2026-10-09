// #457: the Impressum, privacy note and terms, plus the about page, which the
// landing's footer links to. Public in auth-gate, never behind the mobile
// gate, and also served on the landing host (#467, lib/landing-host.ts). A
// plain module, so proxy.ts can read it too. (The about page isn't legal text;
// it rides this list because it needs exactly the same three exemptions.)
export const LEGAL_PATHS = [
  "/menu/terms",
  "/menu/privacy",
  "/menu/impressum",
  "/menu/about-sponti",
]
