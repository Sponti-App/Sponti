"use client"

// PROTOTYPE (#345): every Lucide icon the app imports today, with its closest
// match in Iconoir and in Phosphor. `gap` marks a library with no real match,
// where the preview shows the nearest stand-in.

import * as L from "lucide-react"
import * as IO from "iconoir-react"
import * as PH from "@phosphor-icons/react"
import type { ComponentType, SVGProps } from "react"

export type LibKey = "lucide" | "iconoir" | "phosphor"
export type Weight = "light" | "regular" | "bold"

type AnyIcon = ComponentType<SVGProps<SVGSVGElement> & Record<string, unknown>>

type Entry = {
  name: string
  lucide: AnyIcon
  iconoir: AnyIcon
  phosphor: AnyIcon
  gap?: Partial<Record<LibKey, string>>
}

const e = (
  name: string,
  lucide: unknown,
  iconoir: unknown,
  phosphor: unknown,
  gap?: Entry["gap"]
): Entry => ({
  name,
  lucide: lucide as AnyIcon,
  iconoir: iconoir as AnyIcon,
  phosphor: phosphor as AnyIcon,
  gap,
})

export const ICONS = {
  // nav and chrome
  home: e("home", L.Home, IO.HomeSimple, PH.House),
  feed: e("feed", L.Bell, IO.Bell, PH.Bell),
  flare: e("flare", L.Flame, IO.FireFlame, PH.Fire),
  circles: e("circles", L.Users, IO.Group, PH.Users),
  myFlares: e("my flares", L.Zap, IO.Flash, PH.Lightning),
  back: e("back", L.ArrowLeft, IO.ArrowLeft, PH.ArrowLeft),
  close: e("close", L.X, IO.Xmark, PH.X),
  more: e("more", L.MoreHorizontal, IO.MoreHoriz, PH.DotsThree),
  edit: e("edit", L.Pencil, IO.EditPencil, PH.PencilSimple),
  share: e("share", L.Share2, IO.ShareAndroid, PH.ShareNetwork),
  chevronRight: e(
    "chevron right",
    L.ChevronRight,
    IO.NavArrowRight,
    PH.CaretRight
  ),
  chevronLeft: e("chevron left", L.ChevronLeft, IO.NavArrowLeft, PH.CaretLeft),
  chevronDown: e("chevron down", L.ChevronDown, IO.NavArrowDown, PH.CaretDown),
  menu: e("menu", L.Menu, IO.Menu, PH.List),
  search: e("search", L.Search, IO.Search, PH.MagnifyingGlass),
  filter: e("filter", L.ListFilter, IO.FilterList, PH.FunnelSimple),
  plus: e("plus", L.Plus, IO.Plus, PH.Plus),
  minus: e("minus", L.Minus, IO.Minus, PH.Minus),
  check: e("check", L.Check, IO.Check, PH.Check),
  loader: e("loading", L.Loader2, IO.Refresh, PH.CircleNotch, {
    iconoir: "no spinner; keep a custom one",
  }),
  // flare facts
  pin: e("place", L.MapPin, IO.MapPin, PH.MapPin),
  clock: e("time", L.Clock, IO.Clock, PH.Clock),
  calendar: e("calendar", L.Calendar, IO.Calendar, PH.CalendarBlank),
  map: e("map", L.Map, IO.Map, PH.MapTrifold),
  navigate: e("directions", L.Navigation, IO.Navigator, PH.NavigationArrow),
  locate: e("locate me", L.LocateFixed, IO.Gps, PH.GpsFix),
  lock: e("invite only", L.Lock, IO.Lock, PH.Lock),
  globe: e("open to all", L.Globe, IO.Globe, PH.Globe),
  sparkles: e("idea", L.Sparkles, IO.Sparks, PH.Sparkle),
  repeat: e("repeat", L.Repeat, IO.Repeat, PH.Repeat),
  // people
  user: e("user", L.User, IO.User, PH.User),
  userCircle: e("profile", L.UserCircle, IO.UserCircle, PH.UserCircle),
  userPlus: e("add friend", L.UserPlus, IO.UserPlus, PH.UserPlus),
  userMinus: e("remove friend", L.UserMinus, IO.UserXmark, PH.UserMinus),
  userCheck: e("connected", L.UserCheck, IO.UserBadgeCheck, PH.UserCheck),
  at: e("username", L.AtSign, IO.AtSign, PH.At),
  qr: e("qr code", L.QrCode, IO.QrCode, PH.QrCode),
  link: e("link", L.Link2, IO.Link, PH.Link),
  send: e("send", L.Send, IO.Send, PH.PaperPlaneRight),
  message: e("message", L.MessageSquare, IO.ChatBubble, PH.Chat),
  messageText: e("thread", L.MessageSquareText, IO.ChatLines, PH.ChatText),
  mail: e("email", L.Mail, IO.Mail, PH.Envelope),
  camera: e("photo", L.Camera, IO.Camera, PH.Camera),
  upload: e("upload", L.Upload, IO.Upload, PH.UploadSimple),
  // settings and states
  settings: e("settings", L.Settings, IO.Settings, PH.Gear),
  sun: e("light", L.Sun, IO.SunLight, PH.Sun),
  moon: e("dark", L.Moon, IO.HalfMoon, PH.Moon),
  eyeOff: e("hidden", L.EyeOff, IO.EyeClosed, PH.EyeSlash),
  shield: e("privacy", L.Shield, IO.Shield, PH.Shield),
  shieldCheck: e("verified", L.ShieldCheck, IO.ShieldCheck, PH.ShieldCheck),
  shieldAlert: e("block", L.ShieldAlert, IO.ShieldAlert, PH.ShieldWarning),
  help: e("help", L.HelpCircle, IO.HelpCircle, PH.Question),
  lifebuoy: e("support", L.LifeBuoy, IO.Lifebelt, PH.Lifebuoy),
  info: e("info", L.Info, IO.InfoCircle, PH.Info),
  bug: e("report a bug", L.Bug, IO.Bug, PH.Bug),
  megaphone: e("feedback", L.Megaphone, IO.Megaphone, PH.Megaphone),
  flag: e("report", L.Flag, IO.WhiteFlag, PH.Flag),
  file: e("terms", L.FileText, IO.Page, PH.FileText),
  scale: e("legal", L.Scale, IO.BookStack, PH.Scales, {
    iconoir: "no scales icon",
  }),
  logout: e("sign out", L.LogOut, IO.LogOut, PH.SignOut),
  trash: e("delete", L.Trash2, IO.Trash, PH.Trash),
  undo: e("undo", L.RotateCcw, IO.Undo, PH.ArrowCounterClockwise),
  alert: e("error", L.AlertCircle, IO.WarningCircle, PH.WarningCircle),
  warning: e("warning", L.AlertTriangle, IO.WarningTriangle, PH.Warning),
  xCircle: e("cancelled", L.XCircle, IO.XmarkCircle, PH.XCircle),
  external: e(
    "open outside",
    L.ExternalLink,
    IO.OpenNewWindow,
    PH.ArrowSquareOut
  ),
  expand: e("expand", L.Expand, IO.Expand, PH.ArrowsOut),
  arrowRight: e("next", L.ArrowRight, IO.ArrowRight, PH.ArrowRight),
} satisfies Record<string, Entry>

export type IconKey = keyof typeof ICONS

// The seven flare categories (EVENT_TYPES).
export const CATEGORIES: { label: string; entry: Entry }[] = [
  { label: "hang out", entry: e("hang out", L.Users, IO.Group, PH.Users) },
  {
    label: "drinks",
    entry: e("drinks", L.Wine, IO.GlassHalf, PH.Wine, {
      iconoir: "no wine or cocktail glass",
    }),
  },
  {
    label: "food",
    entry: e("food", L.UtensilsCrossed, IO.Cutlery, PH.ForkKnife),
  },
  {
    label: "party",
    entry: e("party", L.PartyPopper, IO.Sparks, PH.Confetti, {
      iconoir: "no party icon",
    }),
  },
  { label: "sports", entry: e("sports", L.Dumbbell, IO.Gym, PH.Barbell) },
  { label: "culture", entry: e("culture", L.Landmark, IO.Bank, PH.Bank) },
  { label: "hobby", entry: e("hobby", L.Palette, IO.Palette, PH.Palette) },
]

// Each library's own stroke model: Lucide and Iconoir take a stroke width,
// Phosphor has named weights. "regular" is each library's default.
const LUCIDE_STROKE: Record<Weight, number> = {
  light: 1.5,
  regular: 2,
  bold: 2.5,
}
const ICONOIR_STROKE: Record<Weight, number> = {
  light: 1.2,
  regular: 1.5,
  bold: 2,
}

export function Icon({
  entry,
  lib,
  weight,
  className,
  fill = false,
}: {
  entry: Entry
  lib: LibKey
  weight: Weight
  className?: string
  /** Phosphor only: its filled weight, e.g. for an active nav item. */
  fill?: boolean
}) {
  const C = entry[lib]
  if (lib === "phosphor") {
    return (
      <C
        aria-hidden="true"
        className={className}
        weight={fill ? "fill" : weight}
      />
    )
  }
  const strokeWidth =
    lib === "lucide" ? LUCIDE_STROKE[weight] : ICONOIR_STROKE[weight]
  return (
    <C aria-hidden="true" className={className} strokeWidth={strokeWidth} />
  )
}

export const LIBS: Record<
  LibKey,
  { name: string; version: string; note: string }
> = {
  lucide: {
    name: "lucide (today)",
    version: "lucide-react 1.14",
    note: "~1,600 icons · 24px grid · 2px stroke · round caps",
  },
  iconoir: {
    name: "iconoir",
    version: "iconoir-react 7.12",
    note: "~1,670 icons · 24px grid · 1.5px stroke · some solid variants · MIT",
  },
  phosphor: {
    name: "phosphor",
    version: "@phosphor-icons/react 2.1",
    note: "~1,500 icons × 6 weights (thin, light, regular, bold, fill, duotone) · MIT",
  },
}
