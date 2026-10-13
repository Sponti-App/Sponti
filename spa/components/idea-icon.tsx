import { IDEA_ICONS, MapPinIcon, type IconProps } from "@/components/icons"
import type { IdeaIconKey } from "@/lib/idea-icons"
import { EVENT_TYPES } from "@/types/utils"

/** #524: an idea's own icon, else its category's. */
export function IdeaIcon({
  idea,
  ...props
}: IconProps & { idea: { icon?: IdeaIconKey; category: string } }) {
  const Glyph = idea.icon
    ? IDEA_ICONS[idea.icon]
    : (EVENT_TYPES.find((t) => t.value === idea.category)?.icon ?? MapPinIcon)
  return <Glyph {...props} />
}
