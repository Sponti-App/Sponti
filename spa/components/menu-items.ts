import {
  FileTextIcon,
  QuestionIcon,
  InfoIcon,
  LifebuoyIcon,
  ScalesIcon,
  ShieldCheckIcon,
} from "@/components/icons"

export const menuItems = [
  {
    href: "/menu/about-sponti",
    label: "about sponti",
    description: "what sponti is for",
    icon: InfoIcon,
  },
  {
    href: "/menu/faq-feedback",
    label: "faq & feedback",
    description: "answers and product feedback",
    icon: QuestionIcon,
  },
  {
    href: "/menu/privacy",
    label: "privacy note",
    description: "what we keep and who can see it",
    icon: ShieldCheckIcon,
  },
  {
    href: "/menu/terms",
    label: "terms of service",
    description: "terms and community basics",
    icon: FileTextIcon,
  },
  {
    href: "/menu/impressum",
    label: "impressum",
    description: "who runs sponti",
    icon: ScalesIcon,
  },
  {
    href: "/menu/support",
    label: "support",
    description: "help, feedback and safety reports",
    icon: LifebuoyIcon,
  },
] as const
