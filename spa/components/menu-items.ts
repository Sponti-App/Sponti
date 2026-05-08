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
    label: "About Sponti",
    description: "What Sponti is for",
    icon: Info,
  },
  {
    href: "/menu/faq-feedback",
    label: "FAQ & Feedback",
    description: "Answers and product feedback",
    icon: HelpCircle,
  },
  {
    href: "/menu/privacy",
    label: "Privacy Policy",
    description: "How Sponti handles personal data",
    icon: ShieldCheck,
  },
  {
    href: "/menu/terms",
    label: "Terms of Service",
    description: "Terms and community basics",
    icon: FileText,
  },
  {
    href: "/menu/support",
    label: "Support",
    description: "Help and safety contact paths",
    icon: LifeBuoy,
  },
] as const
