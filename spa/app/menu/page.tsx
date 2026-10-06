import { MenuContents } from "@/components/menu-contents"
import { MenuPageShell } from "@/components/menu-page-shell"

// #369: the fallback page for the home drawer, with the same contents.
export default function MenuPage() {
  return (
    <MenuPageShell title="menu" backHref="/" backLabel="Back to home">
      <MenuContents />
    </MenuPageShell>
  )
}
