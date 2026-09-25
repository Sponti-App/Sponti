import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SettingsPage from "./page"
import type { AuthUser } from "@/lib/auth-store"
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
    expect(screen.getByRole("radio", { name: "only inner circle is free" })).toBeDisabled()
    expect(screen.getByRole("slider")).toBeDisabled()
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0)
  })
})
