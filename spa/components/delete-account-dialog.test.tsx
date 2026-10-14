import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const deleteAccount = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api/auth", () => ({ deleteAccount }))

import { HttpError } from "@/lib/http"
import { DeleteAccountDialog } from "./delete-account-dialog"

// #449: the confirmation the dialog sends depends on the account.
describe("DeleteAccountDialog", () => {
  it("a Google-only account confirms with its @username", async () => {
    const user = userEvent.setup()
    deleteAccount.mockResolvedValueOnce(undefined)
    const onDeleted = vi.fn()
    render(
      <DeleteAccountDialog
        username="sarah"
        hasPassword={false}
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />
    )

    const field = screen.getByLabelText("your @username")
    expect(field).toHaveAttribute("placeholder", "type @sarah to confirm")
    await user.type(field, "@sarah")
    await user.click(screen.getByRole("button", { name: "delete" }))

    expect(deleteAccount).toHaveBeenCalledWith({ confirmUsername: "@sarah" })
    expect(onDeleted).toHaveBeenCalledOnce()
  })

  it("shows the server's refusal and stays open", async () => {
    const user = userEvent.setup()
    deleteAccount.mockRejectedValueOnce(
      new HttpError(403, "type your @username to confirm")
    )
    const onDeleted = vi.fn()
    render(
      <DeleteAccountDialog
        username="sarah"
        hasPassword={false}
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />
    )

    await user.type(screen.getByLabelText("your @username"), "someone")
    await user.click(screen.getByRole("button", { name: "delete" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "type your @username to confirm"
    )
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "delete" })).toBeEnabled()
  })

  it("a network failure gets a generic message", async () => {
    const user = userEvent.setup()
    deleteAccount.mockRejectedValueOnce(new Error("offline"))
    render(
      <DeleteAccountDialog
        username="sarah"
        hasPassword
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.type(screen.getByLabelText("your password"), "secret")
    await user.click(screen.getByRole("button", { name: "delete" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn't delete your account. try again"
    )
  })
})
