// The one inbox for support, feedback, privacy requests and safety reports
// (#129, #126). Provisional: it's the only place the address is written, so
// swapping it later is this one line.
export const CONTACT_EMAIL = "hello@sponti.fun"

// Who runs Sponti: the provider named in the terms, the controller named in
// the privacy note, and the person the Impressum (§5 DDG) points to (#293).
// The only place the name and address are written.
export const PROVIDER = {
  name: "Patrick Caire",
  street: "Schwedenstr. 3A",
  postalCode: "13357",
  city: "Berlin",
  country: "Germany",
} as const

// "Patrick Caire, Schwedenstr. 3A, 13357 Berlin, Germany" on one line.
export const PROVIDER_ADDRESS_LINE = `${PROVIDER.street}, ${PROVIDER.postalCode} ${PROVIDER.city}, ${PROVIDER.country}`
