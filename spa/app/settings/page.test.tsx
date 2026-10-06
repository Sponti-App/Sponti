import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SettingsPage from "./page"
import type { AuthUser } from "@/lib/auth-store"
import { resetNewOnboardingMemory } from "@/lib/onboarding-flags"
import type { NotificationSettings } from "@/lib/api/notification-settings"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  logout: vi.fn(),
  showActionFeedback: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  fetchNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    username: "martin",
    displayName: "Martin",
    email: "martin@sponti.test",
    avatarUrl: null,
    profileVisibility: "public",
    socialBattery: 100,
    bio: null,
    instagram: null,
    telegram: null,
    createdAt: "2099-01-01T00:00:00.000Z",
    updatedAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  }
}

let currentUser: AuthUser = baseUser()

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: currentUser, logout: mocks.logout }),
}))

vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>()
  return {
    ...actual,
    updateProfile: mocks.updateProfile,
    uploadAvatar: mocks.uploadAvatar,
  }
})

vi.mock("@/lib/api/notification-settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/notification-settings")>()
  return {
    ...actual,
    fetchNotificationSettings: mocks.fetchNotificationSettings,
    updateNotificationSettings: mocks.updateNotificationSettings,
  }
})

function notificationSettings(
  overrides: Partial<NotificationSettings> = {}
): NotificationSettings {
  return {
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    eventReminders: true,
    invitationNotifications: true,
    ...overrides,
  }
}

describe("SettingsPage account tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    resetNewOnboardingMemory()
    currentUser = baseUser()
    mocks.fetchNotificationSettings.mockResolvedValue(notificationSettings())
    mocks.updateProfile.mockResolvedValue({
      user: baseUser({ profileVisibility: "private" }),
    })
  })

  it("loads the account's current profile visibility", () => {
    currentUser = baseUser({ profileVisibility: "private" })
    render(<SettingsPage />)

    expect(screen.getByRole("radio", { name: /^Private/ })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("saves the chosen visibility to PATCH /auth/me/profile", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByRole("radio", { name: /^Private/ }))
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ profileVisibility: "private" })
      )
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("profile saved")
  })

  it("switches ideas on the map off and on, on this device only (#245)", async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem("sponti.ideas.hidden.v1")
    render(<SettingsPage />)

    const toggle = screen.getByRole("switch", { name: "show ideas on the map" })
    expect(toggle).toHaveAttribute("aria-checked", "true")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(window.localStorage.getItem("sponti.ideas.hidden.v1")).toBe("1")
    // Nothing goes to the backend.
    expect(mocks.updateProfile).not.toHaveBeenCalled()
    expect(mocks.updateNotificationSettings).not.toHaveBeenCalled()

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(window.localStorage.getItem("sponti.ideas.hidden.v1")).toBeNull()
  })

  it("switches the new onboarding on and off, on this device only (#482)", async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem("sponti.new-onboarding.v1")
    render(<SettingsPage />)

    const toggle = screen.getByRole("switch", { name: "new onboarding" })
    expect(toggle).toHaveAttribute("aria-checked", "false")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(window.localStorage.getItem("sponti.new-onboarding.v1")).toBe("on")
    expect(mocks.updateProfile).not.toHaveBeenCalled()
    expect(mocks.updateNotificationSettings).not.toHaveBeenCalled()

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(window.localStorage.getItem("sponti.new-onboarding.v1")).toBeNull()
  })

  it("replay intro resets the slides and the first-run intro, and says so (#482)", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem("sponti.intro-slides.v1", "seen")
    window.localStorage.setItem("sponti.onboarding.v1", "done")
    window.localStorage.setItem(
      "sponti.location-choice.v1",
      '{"kind":"location"}'
    )
    render(<SettingsPage />)

    await user.click(screen.getByRole("button", { name: "replay intro" }))

    expect(window.localStorage.getItem("sponti.intro-slides.v1")).toBeNull()
    expect(window.localStorage.getItem("sponti.onboarding.v1")).toBe("pending")
    // The map tips are a separate button.
    expect(
      window.localStorage.getItem("sponti.location-choice.v1")
    ).not.toBeNull()
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      expect.stringContaining("intro reset")
    )
  })

  it("replay map tips resets the location choice, and says to sign out (#482)", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem("sponti.intro-slides.v1", "seen")
    window.localStorage.setItem(
      "sponti.location-choice.v1",
      '{"kind":"location"}'
    )
    render(<SettingsPage />)

    await user.click(screen.getByRole("switch", { name: "new onboarding" }))
    await user.click(screen.getByRole("button", { name: "replay map tips" }))

    expect(window.localStorage.getItem("sponti.location-choice.v1")).toBeNull()
    expect(window.localStorage.getItem("sponti.intro-slides.v1")).toBe("seen")
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "map tips reset. sign out to see them again"
    )
  })

  it("links to the edit profile page and no longer holds handles itself (#289)", () => {
    render(<SettingsPage />)

    expect(screen.getByRole("link", { name: /edit profile/ })).toHaveAttribute(
      "href",
      "/settings/profile"
    )
    expect(screen.queryByLabelText(/instagram/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/telegram/i)).not.toBeInTheDocument()
  })

  it("does not send handles or bio when saving the account", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      "sponti.profile.extras.v1",
      JSON.stringify({ "user-1": { instagram: "old", telegram: "older" } })
    )
    render(<SettingsPage />)

    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalled())
    const payload = mocks.updateProfile.mock.calls[0][0]
    expect(payload).not.toHaveProperty("instagram")
    expect(payload).not.toHaveProperty("telegram")
    expect(payload).not.toHaveProperty("bio")
    // The settings page leaves the old device copy for the edit page's offer.
    expect(
      window.localStorage.getItem("sponti.profile.extras.v1")
    ).not.toBeNull()
    window.localStorage.removeItem("sponti.profile.extras.v1")
  })

  it("disables the connections-only option — not a real backend value yet", () => {
    render(<SettingsPage />)

    expect(
      screen.getByRole("radio", { name: /^Connections only/ })
    ).toBeDisabled()
  })

  it("shows feedback when saving the profile fails", async () => {
    const user = userEvent.setup()
    mocks.updateProfile.mockRejectedValue(new Error("network went quiet"))
    render(<SettingsPage />)

    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't save that",
        { tone: "error" }
      )
    )
  })

  it("hides password change behind coming soon — no backend endpoint", () => {
    render(<SettingsPage />)

    expect(
      screen.queryByRole("button", { name: /update password/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })
})

describe("SettingsPage notifications tab", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    currentUser = baseUser()
    mocks.fetchNotificationSettings.mockResolvedValue(
      notificationSettings({ quietHoursEnabled: true, eventReminders: false })
    )
  })

  async function openNotificationsTab() {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await user.click(screen.getByRole("tab", { name: /notifications/i }))
    return user
  }

  it("loads current values from GET /notification-settings/me", async () => {
    await openNotificationsTab()

    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "enable quiet hours" })
      ).toHaveAttribute("aria-checked", "true")
    )
    expect(
      screen.getByRole("switch", { name: "Event reminders" })
    ).toHaveAttribute("aria-checked", "false")
  })

  it("auto-saves a toggle to PATCH /notification-settings/me", async () => {
    mocks.updateNotificationSettings.mockResolvedValue(
      notificationSettings({ quietHoursEnabled: true, eventReminders: true })
    )
    const user = await openNotificationsTab()

    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Event reminders" })
      ).toHaveAttribute("aria-checked", "false")
    )
    await user.click(screen.getByRole("switch", { name: "Event reminders" }))

    await waitFor(() =>
      expect(mocks.updateNotificationSettings).toHaveBeenCalledWith({
        eventReminders: true,
      })
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("preferences saved")
  })

  it("reverts the toggle and shows feedback when saving fails", async () => {
    mocks.updateNotificationSettings.mockRejectedValue(
      new Error("network went quiet")
    )
    const user = await openNotificationsTab()

    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Event reminders" })
      ).toHaveAttribute("aria-checked", "false")
    )
    await user.click(screen.getByRole("switch", { name: "Event reminders" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't save that",
        { tone: "error" }
      )
    )
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Event reminders" })
      ).toHaveAttribute("aria-checked", "false")
    )
  })

  it("disables notify-when and max-distance — no backend field for either", async () => {
    await openNotificationsTab()

    expect(
      await screen.findByRole("radio", { name: "any friend is free" })
    ).toBeDisabled()
    expect(
      screen.getByRole("radio", { name: "only inner circle is free" })
    ).toBeDisabled()
    expect(screen.getByRole("slider")).toBeDisabled()
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0)
  })
})
