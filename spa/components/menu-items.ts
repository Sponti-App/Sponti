import {
  FileText,
  HelpCircle,
  Info,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react"

export const menuItems = [
  {
    href: "/menu/about-sponti",
    label: "about sponti",
    description: "what sponti is for",
    icon: Info,
  },
  {
    href: "/menu/faq-feedback",
    label: "faq & feedback",
    description: "answers and product feedback",
    icon: HelpCircle,
  },
  {
    href: "/menu/privacy",
    label: "privacy note",
    description: "what we keep and who can see it",
    icon: ShieldCheck,
  },
  {
    href: "/menu/terms",
    label: "terms of service",
    description: "terms and community basics",
    icon: FileText,
  },
  {
    href: "/menu/support",
    label: "support",
    description: "help, feedback and safety reports",
    icon: LifeBuoy,
  },
] as const
