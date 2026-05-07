"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Coffee,
  Heart,
  Home as HomeIcon,
  MapPin,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
  ChevronDown,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { saveDraftEvent, type Audience, type Recurrence } from "@/lib/draft-events"

type Mode = "now" | "scheduled"
type WhereType = "current" | "home" | "coffee" | "search" | "custom"
type Visibility = "private" | "public"

type Friend = { id: string; name: string }

const MOCK_FRIENDS: Friend[] = [
  { id: "maya", name: "Maya R." },
  { id: "jordan", name: "Jordan T." },
  { id: "sam", name: "Sam K." },
  { id: "avery", name: "Avery L." },
  { id: "noah", name: "Noah P." },
  { id: "riley", name: "Riley M." },
  { id: "eli", name: "Eli S." },
  { id: "tay", name: "Tay W." },
  { id: "kai", name: "Kai B." },
  { id: "nina", name: "Nina O." },
]

const DURATION_OPTIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
] as const

// "right now" mode caps start at +6h to keep the flow imminent —
// anything further out belongs in "pick a time".
const START_OFFSET_OPTIONS = [
  { label: "now", minutes: 0 },
  { label: "+15m", minutes: 15 },
  { label: "+30m", minutes: 30 },
  { label: "+1h", minutes: 60 },
  { label: "+2h", minutes: 120 },
  { label: "+4h", minutes: 240 },
  { label: "+6h", minutes: 360 },
] as const

const WHERE_OPTIONS: { value: WhereType; label: string; icon: typeof MapPin }[] = [
  { value: "current", label: "current loc", icon: MapPin },
  { value: "home", label: "home", icon: HomeIcon },
  { value: "coffee", label: "coffee", icon: Coffee },
  { value: "search", label: "search", icon: Search },
]

const GUEST_LIMITS = [
  { label: "unlimited", value: null },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
] as const

// Mocked friend lists — real lists arrive with the friend-lists feature (roadmap item 4).
const AUDIENCE_OPTIONS: {
  value: Exclude<Audience, "custom">
  label: string
  sublabel: string
  icon: typeof Heart
}[] = [
  { value: "close-friends", label: "close friends", sublabel: "your tighter group", icon: Sparkles },
  { value: "all-friends", label: "all friends", sublabel: "everyone you follow", icon: Users },
]

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "no repeat" },
  { value: "daily", label: "daily" },
  { value: "weekly", label: "weekly" },
  { value: "monthly", label: "monthly" },
]

function weekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return ""
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" })
}

function recurrenceSummary(value: Recurrence, dateStr: string): string {
  if (value === "none") return "one-off — does not repeat"
  if (value === "daily") return "repeats every day"
  if (value === "weekly") {
    const day = weekdayName(dateStr)
    return day ? `repeats weekly on ${day}` : "repeats weekly"
  }
  return "repeats monthly"
}

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function formatRelative(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${minutes}m`
}

export default function NewEventPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("now")
  const [what, setWhat] = useState("")
  const [durationMinutes, setDurationMinutes] = useState<number>(60)
  const [startOffsetMinutes, setStartOffsetMinutes] = useState<number>(0)
  const [startDate, setStartDate] = useState(formatDateInput(new Date()))
  const [startTime, setStartTime] = useState("19:00")
  const [whereType, setWhereType] = useState<WhereType>("current")
  const [customWhere, setCustomWhere] = useState("")
  const [title, setTitle] = useState("")
  const [guestLimit, setGuestLimit] = useState<number | null>(null)
  const [audience, setAudience] = useState<Audience>("close-friends")
  const [recurrence, setRecurrence] = useState<Recurrence>("none")
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [customListName, setCustomListName] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>("private")
  const [allowForward, setAllowForward] = useState(false)
  const [allowPlusOne, setAllowPlusOne] = useState(true)

  const canSubmit = what.trim().length > 0
  const ctaLabel = mode === "now" ? "go live" : "post plan"

  const handleSubmit = () => {
    if (!canSubmit) return
    saveDraftEvent({
      mode,
      what: what.trim(),
      durationMinutes,
      startOffsetMinutes: mode === "now" ? startOffsetMinutes : undefined,
      startDate: mode === "scheduled" ? startDate : undefined,
      startTime: mode === "scheduled" ? startTime : undefined,
      recurrence: mode === "scheduled" ? recurrence : undefined,
      whereType,
      customWhere: whereType === "search" ? customWhere : undefined,
      title: title.trim() || undefined,
      guestLimit,
      audience,
      selectedFriendIds: audience === "custom" ? selectedFriendIds : undefined,
      customListName:
        audience === "custom" && customListName.trim() ? customListName.trim() : undefined,
      visibility,
      allowForward,
      allowPlusOne,
      createdAt: new Date().toISOString(),
    })
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Mobile Frame — mirrors app/page.tsx */}
      <div className="w-[390px] h-[844px] bg-background rounded-[40px] border-[8px] border-foreground relative overflow-hidden flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 shrink-0">
          <span className="text-sm font-medium">9:41</span>
          <div className="w-[80px] h-[24px] bg-foreground rounded-full" />
          <div className="flex items-center gap-1">
            <span className="text-xs">•••</span>
            <span className="text-xs">◗</span>
            <span className="text-xs">▌</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => router.push("/")}
            aria-label="Back"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-base font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>light a flare</span>
          </div>
          <div className="h-9 w-9" aria-hidden />
        </div>

        {/* Scrollable form body — pads bottom for sticky CTA + nav */}
        <div className="flex-1 overflow-y-auto px-4 pb-44">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="now">right now</TabsTrigger>
              <TabsTrigger value="scheduled">pick a time</TabsTrigger>
            </TabsList>

            {/* WHAT */}
            <Section label="what">
              <Input
                placeholder="what r u up to"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                maxLength={80}
              />
            </Section>

            {/* WHEN */}
            <TabsContent value="now" className="m-0">
              <Section label="starts">
                <ChipRow>
                  {START_OFFSET_OPTIONS.map((s) => (
                    <Chip
                      key={s.minutes}
                      selected={startOffsetMinutes === s.minutes}
                      onClick={() => setStartOffsetMinutes(s.minutes)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </ChipRow>
              </Section>
              <Section label="how long">
                <ChipRow>
                  {DURATION_OPTIONS.map((d) => (
                    <Chip
                      key={d.minutes}
                      selected={durationMinutes === d.minutes}
                      onClick={() => setDurationMinutes(d.minutes)}
                    >
                      {d.label}
                    </Chip>
                  ))}
                </ChipRow>
                <p className="text-xs text-muted-foreground mt-2">
                  {startOffsetMinutes === 0 ? "starts now" : `starts in ${formatRelative(startOffsetMinutes)}`}
                  {" · "}runs for {formatRelative(durationMinutes)}
                </p>
              </Section>
            </TabsContent>

            <TabsContent value="scheduled" className="m-0">
              <Section label="when">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                      date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                      start
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <Label className="text-xs text-muted-foreground mt-3 block">duration</Label>
                <ChipRow>
                  {DURATION_OPTIONS.map((d) => (
                    <Chip
                      key={d.minutes}
                      selected={durationMinutes === d.minutes}
                      onClick={() => setDurationMinutes(d.minutes)}
                    >
                      {d.label}
                    </Chip>
                  ))}
                </ChipRow>
              </Section>

              <Section label="repeat">
                <ChipRow>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <Chip
                      key={r.value}
                      selected={recurrence === r.value}
                      onClick={() => setRecurrence(r.value)}
                    >
                      {r.label}
                    </Chip>
                  ))}
                </ChipRow>
                <p className="text-xs text-muted-foreground mt-2">
                  {recurrenceSummary(recurrence, startDate)}
                </p>
              </Section>
            </TabsContent>

            {/* WHERE */}
            <Section label="where">
              <ChipRow>
                {WHERE_OPTIONS.map((w) => {
                  const Icon = w.icon
                  return (
                    <Chip
                      key={w.value}
                      selected={whereType === w.value}
                      onClick={() => setWhereType(w.value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {w.label}
                    </Chip>
                  )
                })}
              </ChipRow>
              {whereType === "search" && (
                <Input
                  className="mt-2"
                  placeholder="search address or place"
                  value={customWhere}
                  onChange={(e) => setCustomWhere(e.target.value)}
                />
              )}
            </Section>

            {/* TITLE (optional) */}
            <Section label="title (optional)">
              <Input
                placeholder="give it a name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
              />
            </Section>

            {/* GUEST LIMIT */}
            <Section label="guest limit">
              <ChipRow>
                {GUEST_LIMITS.map((g) => (
                  <Chip
                    key={g.label}
                    selected={guestLimit === g.value}
                    onClick={() => setGuestLimit(g.value)}
                  >
                    {g.label}
                  </Chip>
                ))}
              </ChipRow>
            </Section>

            {/* BROADCAST TO */}
            <Section label="broadcast to">
              <div className="flex flex-col gap-2">
                {AUDIENCE_OPTIONS.map((a) => (
                  <AudienceCard
                    key={a.value}
                    icon={a.icon}
                    label={a.label}
                    sublabel={a.sublabel}
                    selected={audience === a.value}
                    onClick={() => setAudience(a.value)}
                  />
                ))}
                <AudienceCard
                  icon={UserPlus}
                  label={customListName.trim() || "pick friends"}
                  sublabel={
                    audience === "custom"
                      ? selectedFriendIds.length === 0
                        ? "no one selected"
                        : `${selectedFriendIds.length} ${selectedFriendIds.length === 1 ? "person" : "people"}${
                            customListName.trim() ? " · saved as list" : ""
                          }`
                      : "invite specific people or save a list"
                  }
                  selected={audience === "custom"}
                  onClick={() => {
                    setAudience("custom")
                    setPickerOpen(true)
                  }}
                />
              </div>
            </Section>

            {/* MORE OPTIONS — collapsed by default */}
            <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="mt-6">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground"
                >
                  <span>more options</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* VISIBILITY */}
                <Section label="visibility">
                  <RadioGroup
                    value={visibility}
                    onValueChange={(v) => setVisibility(v as Visibility)}
                    className="flex flex-col gap-2"
                  >
                    <VisibilityOption
                      value="private"
                      title="private"
                      description="only the people you invite see this flare"
                      checked={visibility === "private"}
                    />
                    <VisibilityOption
                      value="public"
                      title="public"
                      description="anyone in your network can find it"
                      checked={visibility === "public"}
                    />
                  </RadioGroup>
                </Section>

                {/* GUEST CONTROLS */}
                <Section label="guest controls">
                  <div className="flex flex-col gap-3">
                    <ToggleRow
                      label="let guests forward invite"
                      description="they can share with people not on your list"
                      checked={allowForward}
                      onCheckedChange={setAllowForward}
                    />
                    <ToggleRow
                      label="let guests bring +1"
                      description="adds a single guest each, no questions asked"
                      checked={allowPlusOne}
                      onCheckedChange={setAllowPlusOne}
                    />
                  </div>
                </Section>
              </CollapsibleContent>
            </Collapsible>
          </Tabs>
        </div>

        {/* Sticky CTA */}
        <div className="absolute bottom-24 left-0 right-0 px-4 z-20">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            {ctaLabel}
          </Button>
        </div>

        {/* Bottom Nav */}
        <div className="absolute bottom-6 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNav />
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div className="w-32 h-1 bg-foreground rounded-full" />
        </div>

        {pickerOpen && (
          <FriendPicker
            friends={MOCK_FRIENDS}
            selectedIds={selectedFriendIds}
            listName={customListName}
            onListNameChange={setCustomListName}
            onToggle={(id) =>
              setSelectedFriendIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            onCancel={() => {
              setPickerOpen(false)
              if (selectedFriendIds.length === 0 && !customListName.trim()) {
                setAudience("close-friends")
              }
            }}
            onConfirm={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function FriendPicker({
  friends,
  selectedIds,
  listName,
  onListNameChange,
  onToggle,
  onCancel,
  onConfirm,
}: {
  friends: Friend[]
  selectedIds: string[]
  listName: string
  onListNameChange: (v: string) => void
  onToggle: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter((f) => f.name.toLowerCase().includes(q))
  }, [friends, query])

  const count = selectedIds.length
  const willSave = listName.trim().length > 0
  const ctaLabel =
    count === 0
      ? "select friends"
      : willSave
        ? `save list · ${count}`
        : `invite ${count} ${count === 1 ? "person" : "people"}`

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto bg-card rounded-t-3xl border-t border-border shadow-2xl flex flex-col max-h-[88%]">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground">
            broadcast to
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close picker"
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-2 shrink-0">
          <Label htmlFor="list-name" className="text-xs text-muted-foreground mb-1 block">
            save as list (optional)
          </Label>
          <Input
            id="list-name"
            placeholder="list name (e.g. studio crew)"
            value={listName}
            onChange={(e) => onListNameChange(e.target.value)}
            maxLength={40}
            className="border-accent/40"
          />
        </div>

        <div className="px-4 pb-2 shrink-0">
          <Input
            placeholder="add individuals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4">no matches</p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((f) => {
                const checked = selectedIds.includes(f.id)
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(f.id)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary text-left"
                    >
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "border-accent bg-accent text-accent-foreground" : "border-border"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="text-sm">{f.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 rounded-full"
          >
            cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={count === 0}
            className="flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AudienceCard({
  icon: Icon,
  label,
  sublabel,
  selected,
  onClick,
}: {
  icon: typeof Heart
  label: string
  sublabel: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        selected ? "border-accent bg-accent/5" : "border-border bg-background"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-accent" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {sublabel}
        </div>
      </div>
      {selected && <Check className="h-4 w-4 text-accent shrink-0" />}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <Label className="text-[11px] tracking-wide uppercase text-muted-foreground mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  )
}

function VisibilityOption({
  value,
  title,
  description,
  checked,
}: {
  value: string
  title: string
  description: string
  checked: boolean
}) {
  return (
    <Label
      htmlFor={`vis-${value}`}
      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
        checked ? "border-accent bg-accent/5" : "border-border"
      }`}
    >
      <RadioGroupItem id={`vis-${value}`} value={value} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </Label>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

