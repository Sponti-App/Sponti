import { describe, expect, it } from "vitest"
import {
  cameraTransform,
  NO_GATE,
  project,
  renderTakeover,
  restCamera,
  TAKEOVER,
  takeoverClock,
  veilMax,
  whenLabel,
  type Camera,
  type TakeoverKit,
} from "./takeover"

const anchor = { x: 195, y: 300 }

describe("the camera (#376)", () => {
  it("is the identity at rest", () => {
    const rest = restCamera(anchor)
    expect(project(rest, anchor, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(cameraTransform(rest, anchor)).toBe(
      "translate3d(195px, 300px, 0) scale(1) translate(-195px, -300px)"
    )
  })

  it("keeps the flare's spot at the focus while it zooms and tilts", () => {
    const cam: Camera = { focus: { x: 195, y: 570 }, scale: 1.6, tilt: 52 }
    expect(project(cam, anchor, anchor)).toEqual({ x: 195, y: 570 })
    // A point further up the map recedes: it moves less than 1.6× up.
    const up = project(cam, anchor, { x: 195, y: 200 })
    expect(570 - up.y).toBeGreaterThan(0)
    expect(570 - up.y).toBeLessThan(160)
    expect(cameraTransform(cam, anchor)).toContain("rotateX(52deg)")
  })

  it("accounts for where the moved element sits on screen", () => {
    const t = cameraTransform(restCamera(anchor), anchor, { x: 0, y: 40 })
    expect(t).toBe(
      "translate3d(195px, 260px, 0) scale(1) translate(-195px, -260px)"
    )
  })
})

describe("takeoverClock: the strike starts it, the api gates it", () => {
  const gate = TAKEOVER.gate(false)

  it("runs freely up to the gate", () => {
    const { t, gate: g } = takeoverClock({
      real: gate - 100,
      reduced: false,
      answeredAt: null,
      failedAt: null,
    })
    expect(t).toBe(gate - 100)
    expect(g.wait).toBe(0)
  })

  it("holds at the gate until the api has answered", () => {
    const { t, gate: g } = takeoverClock({
      real: gate + 2000,
      reduced: false,
      answeredAt: null,
      failedAt: null,
    })
    expect(t).toBe(gate)
    expect(g.wait).toBe(2000)
    expect(g.waitEnd).toBe(Infinity)
  })

  it("runs on from the gate once it has, never skipping ahead", () => {
    const answeredAt = gate + 1500
    const { t } = takeoverClock({
      real: answeredAt + 200,
      reduced: false,
      answeredAt,
      failedAt: null,
    })
    expect(t).toBe(gate + 200)
  })

  it("doesn't wait at all when the api answered before the gate", () => {
    const { t } = takeoverClock({
      real: gate + 300,
      reduced: false,
      answeredAt: 400,
      failedAt: null,
    })
    expect(t).toBe(gate + 300)
  })

  it("freezes and dismisses when the api fails", () => {
    const failedAt = 600
    const at = (real: number) =>
      takeoverClock({ real, reduced: false, answeredAt: null, failedAt })
    expect(at(failedAt + 500).t).toBe(failedAt)
    expect(at(failedAt).gate.dismiss).toBe(0)
    expect(at(failedAt + TAKEOVER.dismissMs / 2).gate.dismiss).toBeCloseTo(0.5)
    expect(at(failedAt + TAKEOVER.dismissMs).gate.dismiss).toBe(1)
  })

  it("gates much earlier under reduced motion", () => {
    expect(TAKEOVER.gate(true)).toBeLessThan(TAKEOVER.gate(false))
    expect(TAKEOVER.duration(true)).toBeLessThan(TAKEOVER.duration(false))
  })
})

describe("whenLabel: the flare's when, lowercase", () => {
  const now = new Date(2026, 9, 13, 18, 0).getTime()

  it("says live now for a flare that has started", () => {
    expect(whenLabel(now - 60_000, now)).toBe("live now")
    expect(whenLabel(now, now)).toBe("live now")
  })

  it("counts minutes within the hour", () => {
    expect(whenLabel(now + 15 * 60_000, now)).toBe("in 15 min")
  })

  it("gives the clock later today, tomorrow and on other days", () => {
    expect(whenLabel(new Date(2026, 9, 13, 21, 30).getTime(), now)).toMatch(
      /^at \d/
    )
    expect(whenLabel(new Date(2026, 9, 14, 9, 0).getTime(), now)).toMatch(
      /^tomorrow \d/
    )
    const later = whenLabel(new Date(2026, 9, 16, 9, 0).getTime(), now)
    expect(later).toBe(later.toLowerCase())
    expect(later).not.toMatch(/^(at|tomorrow) /)
  })
})

/** A kit that records what each frame set. */
function recordingKit(dark = true) {
  const frame: Record<string, unknown> = {}
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "createRadialGradient"
          ? () => ({ addColorStop: () => {} })
          : () => {},
      set: () => true,
    }
  ) as CanvasRenderingContext2D
  const kit: TakeoverKit = {
    W: 390,
    H: 844,
    rest: restCamera(anchor),
    palette: {
      peach: "oklch(0.8 0.1 50)",
      ember: "oklch(0.8 0.1 50)",
      cream: "oklch(0.9 0.1 50)",
      smoke: "oklch(0.9 0 0)",
      flash: "oklch(1 0 0)",
    },
    burst: "full",
    dark,
    ctx,
    camera: (c) => (frame.camera = c),
    pinAt: (c) => project(c, anchor, anchor),
    scrim: (a, spot) => (frame.scrim = { a, spot }),
    tint: (a) => (frame.tint = a),
    hero: (o) => (frame.hero = o),
    text: (show) => (frame.text = show),
    canvasAlpha: (a) => (frame.canvas = a),
    fade: (a) => (frame.fade = a),
  }
  return { kit, frame }
}

describe("renderTakeover: night flare", () => {
  const end = TAKEOVER.duration(false)

  it("moves the map, then puts it back at rest with the veil gone", () => {
    const { kit, frame } = recordingKit()
    renderTakeover(1200, kit, false, NO_GATE)
    const mid = frame.camera as Camera
    expect(mid.tilt).toBeGreaterThan(40)
    expect(mid.scale).toBeGreaterThan(1.4)
    renderTakeover(end, kit, false, NO_GATE)
    expect(frame.camera).toEqual(restCamera(anchor))
    expect((frame.scrim as { a: number }).a).toBeLessThanOrEqual(0)
    // The pin lands lit, with its own label, ready to hand over.
    expect(frame.hero).toMatchObject({ show: 1, scale: 1, lit: 1, chip: 1 })
    expect(frame.text).toBe(0)
  })

  it("keeps the flare unlit until it catches", () => {
    const { kit, frame } = recordingKit()
    renderTakeover(TAKEOVER.ignition(false) - 1, kit, false, NO_GATE)
    expect((frame.hero as { lit: number }).lit).toBe(0)
    renderTakeover(TAKEOVER.ignition(false) + 200, kit, false, NO_GATE)
    expect((frame.hero as { lit: number }).lit).toBe(1)
  })

  it("gives light mode a lighter veil than dark mode's night", () => {
    expect(veilMax(false)).toBeLessThan(veilMax(true))
    const { kit, frame } = recordingKit(false)
    renderTakeover(700, kit, false, NO_GATE)
    expect((frame.scrim as { a: number }).a).toBeLessThanOrEqual(veilMax(false))
  })

  it("fades everything out and the map back when the api fails", () => {
    const { kit, frame } = recordingKit()
    renderTakeover(800, kit, false, { wait: 0, waitEnd: 0, dismiss: 1 })
    expect(frame.fade).toBe(0)
    expect(frame.camera).toEqual(restCamera(anchor))
  })

  it("never moves the map under reduced motion", () => {
    const { kit, frame } = recordingKit()
    for (let t = 0; t <= TAKEOVER.duration(true); t += 50) {
      renderTakeover(t, kit, true, NO_GATE)
      expect(frame.camera).toEqual(restCamera(anchor))
      expect((frame.hero as { scale: number }).scale).toBe(1)
      expect(frame.canvas).toBe(0)
    }
  })
})
