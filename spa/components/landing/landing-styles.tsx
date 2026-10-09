// #506: the landing page's palette, type and keyframes, scoped to it.
//
// The landing speaks in the brand exploration's palette (cream, indigo and
// one coral flare, docs: the 2026-10-07 brand brief) and stays light in both
// colour schemes: "light before darkness". The app itself keeps BRAND.md's
// tokens, so the phone previews reset them: `lp-app` is the app's light look
// and `lp-app-dark` its dark one (copies of globals.css's :root and .dark).

export function LandingStyles() {
  return (
    <style>{`
      [data-landing] {
        --cream: #f7f0e6; --indigo: #2e205f; --coral: #ff986b;
        /* Coral that passes contrast on cream: large text, then body text. */
        --coral-ink: #d65d2c; --coral-text: #a84a22;
        --background: var(--cream);
        --foreground: var(--indigo);
        --card: #fcf8f2;
        --card-foreground: var(--indigo);
        --muted: color-mix(in oklch, var(--indigo) 7%, var(--cream));
        --muted-foreground: color-mix(in oklch, var(--indigo) 72%, var(--cream));
        --border: color-mix(in oklch, var(--indigo) 13%, var(--cream));
        --primary: var(--coral);
        --accent: var(--coral);
        --accent-foreground: var(--indigo);
        --accent-ink: var(--coral-text);
        --ring: var(--coral);
        --flare-open: oklch(0.87 0.07 185);
        color-scheme: light;
        background: var(--background);
        color: var(--foreground);
      }
      [data-landing] .lp-indigo {
        --background: var(--indigo);
        --foreground: var(--cream);
        --muted-foreground: color-mix(in oklch, var(--cream) 72%, var(--indigo));
        --coral-ink: var(--coral);
        background: var(--indigo); color: var(--cream);
      }
      [data-landing] .lp-app {
        --background: oklch(0.97 0.015 346); --foreground: oklch(0.25 0.06 346);
        --card: oklch(0.99 0.007 346); --muted: oklch(0.93 0.02 346);
        --muted-foreground: oklch(0.5 0.04 346); --border: oklch(0.88 0.025 346);
        --primary: oklch(0.8041 0.126 52.09); --accent: oklch(0.8041 0.126 52.09);
        --accent-foreground: oklch(0.25 0.06 50);
        --flare-invite: oklch(0.87 0.07 315); --flare-invite-ink: oklch(0.36 0.09 315);
        --flare-open: oklch(0.87 0.07 185); --flare-open-ink: oklch(0.36 0.09 185);
        --flare-invite-tint: oklch(0.94 0.035 315); --flare-open-tint: oklch(0.94 0.035 185);
        color: var(--foreground);
      }
      [data-landing] .lp-app-dark {
        --background: oklch(0.2178 0.0145 266.91); --foreground: oklch(0.96 0.02 60);
        --card: oklch(0.3082 0.0255 262.72); --muted: oklch(0.28 0.02 266);
        --muted-foreground: oklch(0.74 0.025 60); --border: oklch(0.35 0.025 266);
        --flare-invite: oklch(0.45 0.08 315); --flare-invite-ink: oklch(0.95 0.03 315);
        --flare-open: oklch(0.45 0.08 185); --flare-open-ink: oklch(0.95 0.03 185);
        --flare-invite-tint: oklch(0.34 0.05 315); --flare-open-tint: oklch(0.34 0.05 185);
        color: var(--foreground);
      }

      /* No hanging words: headlines balance their lines, body text avoids a
         lone last word, and short centred lines (.text-center) balance too. */
      [data-landing] :is(h1, h2, h3) { text-wrap: balance; }
      [data-landing] p { text-wrap: pretty; }
      [data-landing] .text-center p, [data-landing] p.text-center { text-wrap: balance; }

      .lp-display {
        font-family: var(--font-display), var(--font-sans), sans-serif;
        font-stretch: 82%; font-variation-settings: "wdth" 82, "opsz" 96;
        font-weight: 650; line-height: .95; letter-spacing: -0.012em;
      }
      .lp-eyebrow { font-size: .875rem; font-weight: 600; color: var(--coral-text); }
      .lp-indigo .lp-eyebrow { color: var(--coral); }
      .lp-coral { color: var(--coral-ink); }

      /* A scene covers its box like object-fit: cover, as a box of the image's
         own ratio, so blooms placed in % of the image stay on their spot. */
      .lp-scene { container-type: size; }
      .lp-scene-box { aspect-ratio: var(--ratio); width: max(100cqw, 100cqh * var(--ratio)); }
      .lp-bloom {
        position: absolute; aspect-ratio: 1; translate: -50% -50%; border-radius: 9999px;
        pointer-events: none; mix-blend-mode: screen;
        background: radial-gradient(circle, rgb(255 250 235 / .9) 0, rgb(255 200 150 / .5) 22%, rgb(255 152 107 / .18) 48%, transparent 70%);
        animation: lp-bloom 5.5s ease-in-out infinite;
      }
      @keyframes lp-bloom { 0%,100% { scale: .85; opacity: .65 } 50% { scale: 1.15; opacity: 1 } }

      /* The hero's embers rise from the flare and fade. --dx spreads where
         each starts, --drift bends it sideways, --rise sets how high. */
      .lp-ember {
        position: absolute; left: var(--dx); top: 0; border-radius: 9999px;
        background: #fff3df; box-shadow: 0 0 8px 2px rgb(255 190 140 / .8);
        mix-blend-mode: screen; opacity: 0;
        animation: lp-ember 6s cubic-bezier(.3,.1,.6,1) infinite;
      }
      @keyframes lp-ember {
        0% { translate: 0 0; opacity: 0 }
        15% { opacity: 1 }
        70% { opacity: .8 }
        100% { translate: var(--drift) calc(-1 * var(--rise)); opacity: 0; scale: .4 }
      }
      /* The flare's light filling the frame over the hero's pin: a cream
         circle centred on the flare that widens until it covers the frame,
         its soft edge travelling outwards from the flare. */
      .lp-hero-wash {
        /* Sized from the frame (about its diagonal), not the image, so it
           covers a tall phone and a wide desktop at the same pace. */
        position: absolute; width: calc((100cqmax + 40cqmin) * 0.176); aspect-ratio: 1; translate: -50% -50%;
        border-radius: 9999px; pointer-events: none;
        background: radial-gradient(circle, var(--cream) 0 48%, color-mix(in oklch, var(--cream) 65%, transparent) 60%, transparent 71%);
        opacity: clamp(0, calc((var(--q, 0) - 0.1) * 3), 1);
        scale: calc(0.3 + clamp(0, calc(var(--q, 0) - 0.15), 1) * 9);
      }

      .lp-reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
      .lp-reveal[data-shown="true"] { opacity: 1; transform: none; }
      @keyframes lp-pop { from { transform: scale(.4); opacity: 0 } to { transform: none; opacity: 1 } }
      .lp-pop { animation: lp-pop .35s cubic-bezier(.3,1.4,.5,1) both; }
      @keyframes lp-float { 0%,100% { translate: 0 0 } 50% { translate: 0 -8px } }
      .lp-float { animation: lp-float 6s ease-in-out infinite; }
      @keyframes lp-caret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      .lp-caret { animation: lp-caret 1s steps(1) infinite; }

      /* The problem section's flare: a soft orb that lights once the five
         apps have folded into it. */
      .lp-orb {
        background: radial-gradient(circle at 50% 45%, #fff6ea 0%, #ffd2b0 32%, var(--coral) 70%);
        box-shadow: 0 0 50px -10px var(--coral);
        transition: box-shadow .8s ease;
      }
      .lp-orb[data-lit="true"] {
        box-shadow: 0 0 120px 30px rgb(255 152 107 / .45), 0 0 50px 8px rgb(255 200 150 / .7);
        animation: lp-orb-glow 3.2s ease-in-out .6s infinite;
      }
      @keyframes lp-orb-glow {
        0%,100% { box-shadow: 0 0 120px 30px rgb(255 152 107 / .45), 0 0 50px 8px rgb(255 200 150 / .7) }
        50% { box-shadow: 0 0 170px 50px rgb(255 152 107 / .32), 0 0 60px 14px rgb(255 200 150 / .8) }
      }
      .lp-orb-ring { position: absolute; inset: 0; border-radius: 9999px; background: radial-gradient(circle, transparent 55%, rgb(255 152 107 / .45) 70%, transparent 72%); opacity: 0; pointer-events: none; }
      .lp-orb[data-lit="true"] .lp-orb-ring { animation: lp-spread 1.6s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes lp-spread { from { transform: scale(1); opacity: 1 } to { transform: scale(2.8); opacity: 0 } }
      .lp-orb-icon { transition: transform .5s cubic-bezier(.3,1.6,.5,1); }
      .lp-orb[data-lit="true"] .lp-orb-icon { transform: scale(1.12); animation: lp-flicker 2.2s ease-in-out .6s infinite; transform-origin: 50% 85%; }
      @keyframes lp-flicker { 0%,100% { transform: scale(1.12) rotate(0) } 25% { transform: scale(1.16,1.08) rotate(-3deg) } 50% { transform: scale(1.1,1.16) rotate(2deg) } 75% { transform: scale(1.15,1.1) rotate(-1deg) } }

      @media (prefers-reduced-motion: reduce) {
        .lp-reveal { opacity: 1; transform: none; }
        .lp-ember { display: none; }
        .lp-bloom, .lp-pop, .lp-float, .lp-caret, .lp-orb[data-lit="true"],
        .lp-orb[data-lit="true"] .lp-orb-ring, .lp-orb[data-lit="true"] .lp-orb-icon { animation: none; }
        [data-landing] * { transition-duration: 0s !important; transition-delay: 0s !important; }
      }
    `}</style>
  )
}
