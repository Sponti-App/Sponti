// #641: not a client module, so the server layout can inline it.

/**
 * An inline script in the root layout's <head> stashes the install prompt on
 * `window` before React hydrates, so an early `beforeinstallprompt` isn't
 * missed; `captureInstallPrompt` (lib/home-screen) picks it up.
 */
export const EARLY_CAPTURE_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__spontiInstallPrompt=e})`
