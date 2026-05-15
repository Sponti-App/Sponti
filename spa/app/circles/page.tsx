"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  ShieldOff,
  UserPlus,
  X,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { CircleStackIcon } from "@/components/circle-stack-icon"
import { QrShareSheet } from "@/components/qr-share-sheet"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatBlockedAt,
  initials,
  type BlockedUser,
  type Circle,
  type Connection,
  type ConnectionRequest,
} from "@/lib/circles"
import {
  addMemberToCircle,
  moveConnectionToCircle,
  removeMemberFromCircle,
  setCircles,
  useCircles,
} from "@/lib/circles-store"
import {
  acceptRequest as acceptRequestAction,
  blockConnection as blockConnectionAction,
  cancelSentRequest as cancelSentRequestAction,
  declineRequest as declineRequestAction,
  sendRequest as sendRequestAction,
  unblock as unblockAction,
  useConnectionsState,
} from "@/lib/connections-store"

type Tab = "circles" | "people" | "blocked"

export default function CirclesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("circles")
  const [qrOpen, setQrOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const { connections, requests, blocked, discoverable, sentRequests } =
    useConnectionsState()
  const circles = useCircles()
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null)
  const [circleSort, setCircleSort] = useState<Record<string, "alpha" | "recent">>({})
  const [memberQuery, setMemberQuery] = useState("")
  const [newCircleOpen, setNewCircleOpen] = useState(false)
  const [newCircleName, setNewCircleName] = useState("")
  const [pendingBlock, setPendingBlock] = useState<Connection | null>(null)
  const [newCircleMemberIds, setNewCircleMemberIds] = useState<string[]>([])

  const connectionsById = useMemo(() => {
    const map = new Map<string, Connection>()
    connections.forEach((c) => map.set(c.id, c))
    return map
  }, [connections])

  const matchingDiscoverable = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "")
    if (!q) return [] as Connection[]
    return discoverable.filter(
      (d) =>
        d.username.toLowerCase().includes(q) ||
        d.displayName.toLowerCase().includes(q)
    )
  }, [searchQuery, discoverable])

  // ----- handlers -----

  const sendRequest = (target: Connection): void => {
    sendRequestAction(target)
    setSearchQuery("")
  }

  const acceptRequest = (req: ConnectionRequest): void => {
    acceptRequestAction(req.id)
  }

  const declineRequest = (req: ConnectionRequest): void => {
    declineRequestAction(req.id)
  }

  const blockConnection = (target: Connection): void => {
    blockConnectionAction(target)
  }

  const cancelSentRequest = (targetId: string): void => {
    cancelSentRequestAction(targetId)
  }

  const unblock = (target: BlockedUser): void => {
    unblockAction(target.id)
  }

  const toggleNewCircleMember = (id: string): void => {
    setNewCircleMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const createCircle = (): void => {
    const name = newCircleName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const next: Circle = {
      id: `custom-${Date.now()}`,
      name,
      description: "custom circle",
      type: "custom",
      memberIds: newCircleMemberIds,
      memberAddedAt: Object.fromEntries(newCircleMemberIds.map((id) => [id, now])),
    }
    setCircles((prev) => [...prev, next])
    setExpandedCircleId(next.id)
    setNewCircleName("")
    setNewCircleMemberIds([])
    setNewCircleOpen(false)
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">circles</span>
        <button
          onClick={() => setQrOpen(true)}
          aria-label="Show your QR"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
        >
          <QrCode className="h-4 w-4" />
        </button>
      </div>

      {/* Add by handle */}
      <div className="shrink-0 px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="add by @handle"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery.trim() && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            {matchingDiscoverable.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                no matches for &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {matchingDiscoverable.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={d.displayName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {d.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{d.username}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => sendRequest(d)}
                      className="h-8 rounded-full bg-accent px-3 text-xs text-accent-foreground hover:bg-accent/90"
                    >
                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                      add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {sentRequests.length > 0 && !searchQuery.trim() && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            <p className="px-3 pt-2.5 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              pending
            </p>
            <ul className="divide-y divide-border">
              {sentRequests.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={r.displayName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{r.username}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelSentRequest(r.id)}
                    className="h-8 shrink-0 rounded-full px-3 text-xs"
                  >
                    cancel
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 px-4">
          <TabsList className="w-full">
            <TabsTrigger value="circles">circles</TabsTrigger>
            <TabsTrigger value="people">
              people
              {requests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="blocked">blocked</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-4 pb-32">
          {/* CIRCLES TAB */}
          <TabsContent value="circles" className="m-0 flex flex-col gap-3">
            {circles.map((circle) => {
              const isExpanded = expandedCircleId === circle.id
              const isAllFriends = circle.id === "all"
              const sort = circleSort[circle.id] ?? "recent"

              const memberCount = isAllFriends ? connections.length : circle.memberIds.length
              const previewNames = circle.memberIds
                .slice(0, 3)
                .map((id) => connectionsById.get(id)?.displayName)
                .filter(Boolean)
                .join(", ")

              const rawMembers = isAllFriends
                ? connections
                : circle.memberIds
                    .map((id) => connectionsById.get(id))
                    .filter((c): c is Connection => Boolean(c))

              const sortedMembers = [...rawMembers].sort((a, b) => {
                if (sort === "alpha") return a.displayName.localeCompare(b.displayName)
                const aAt = circle.memberAddedAt?.[a.id] ?? ""
                const bAt = circle.memberAddedAt?.[b.id] ?? ""
                return bAt > aAt ? -1 : aAt > bAt ? 1 : 0
              })

              const memberSet = new Set(circle.memberIds)
              const q = memberQuery.trim().toLowerCase()
              const addable = connections.filter((c) => {
                if (memberSet.has(c.id)) return false
                if (!q) return true
                return (
                  c.displayName.toLowerCase().includes(q) ||
                  c.username.toLowerCase().includes(q)
                )
              })

              return (
                <div
                  key={circle.id}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    isExpanded ? "border-accent bg-card" : "border-border bg-background"
                  }`}
                >
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedCircleId((prev) => {
                        if (prev === circle.id) return null
                        setMemberQuery("")
                        return circle.id
                      })
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <CircleStackIcon
                      type={circle.type}
                      className={`h-6 w-6 shrink-0 ${
                        isExpanded ? "text-accent" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{circle.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {memberCount} {memberCount === 1 ? "person" : "people"}
                        {previewNames ? ` · ${previewNames}` : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Accordion body — CSS grid trick for smooth height animation */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: isExpanded ? "1fr" : "0fr",
                      transition: "grid-template-rows 200ms ease",
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 pb-3">
                        {/* Editable name (not for "all") */}
                        {!isAllFriends && (
                          <Input
                            value={circle.name}
                            onChange={(e) =>
                              setCircles((prev) =>
                                prev.map((c) =>
                                  c.id === circle.id
                                    ? { ...c, name: e.target.value }
                                    : c,
                                ),
                              )
                            }
                            aria-label="circle name"
                            className="font-medium"
                          />
                        )}

                        {/* Sort pills */}
                        <div className="flex items-center gap-1.5">
                          <p className="mr-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                            sort
                          </p>
                          {(["recent", "alpha"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                setCircleSort((prev) => ({
                                  ...prev,
                                  [circle.id]: s,
                                }))
                              }
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                sort === s
                                  ? "bg-foreground text-background"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {s === "recent" ? "recent" : "a–z"}
                            </button>
                          ))}
                        </div>

                        {/* Member list */}
                        {sortedMembers.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                            this circle is empty.
                          </p>
                        ) : (
                          <ul
                            className="flex flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border"
                            style={{ maxHeight: "220px" }}
                          >
                            {sortedMembers.map((m) => {
                              const movableCircles = isAllFriends
                                ? []
                                : circles.filter(
                                    (c) =>
                                      c.id !== circle.id &&
                                      !c.memberIds.includes(m.id),
                                  )
                              return (
                                <li
                                  key={m.id}
                                  className="flex items-center gap-2 px-2 py-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(`/profile/${m.username}`)
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  >
                                    <Avatar name={m.displayName} />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {m.displayName}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        @{m.username}
                                      </p>
                                    </div>
                                  </button>
                                  {!isAllFriends && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          aria-label={`options for ${m.displayName}`}
                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                                        >
                                          <MoreHorizontal className="h-3.5 w-3.5" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {movableCircles.map((target) => (
                                          <DropdownMenuItem
                                            key={target.id}
                                            onClick={() =>
                                              moveConnectionToCircle(
                                                m.id,
                                                circle.id,
                                                target.id,
                                              )
                                            }
                                          >
                                            move to {target.name}
                                          </DropdownMenuItem>
                                        ))}
                                        {movableCircles.length > 0 && (
                                          <DropdownMenuSeparator />
                                        )}
                                        <DropdownMenuItem
                                          onClick={() =>
                                            removeMemberFromCircle(
                                              circle.id,
                                              m.id,
                                            )
                                          }
                                          className="text-destructive focus:text-destructive"
                                        >
                                          remove
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}

                        {/* Add member search (not for "all") */}
                        {!isAllFriends && (
                          <div className="flex flex-col gap-1.5">
                            <div className="relative">
                              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="add a friend…"
                                value={memberQuery}
                                onChange={(e) => setMemberQuery(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            {memberQuery.trim() && (
                              <ul className="overflow-hidden rounded-lg border border-border">
                                {addable.length === 0 ? (
                                  <li className="px-3 py-2.5 text-xs text-muted-foreground">
                                    no matches
                                  </li>
                                ) : (
                                  addable.map((c) => (
                                    <li key={c.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          addMemberToCircle(circle.id, c.id)
                                          setMemberQuery("")
                                        }}
                                        className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-secondary"
                                      >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                                          <Plus className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-sm font-medium">
                                            {c.displayName}
                                          </span>
                                          <span className="block truncate text-xs text-muted-foreground">
                                            @{c.username}
                                          </span>
                                        </span>
                                      </button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Create custom circle */}
            <button
              type="button"
              onClick={() => setNewCircleOpen((v) => !v)}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
              <span>create custom circle</span>
            </button>

            {newCircleOpen && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">new circle</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      name it and pick the first members.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewCircleOpen(false)}
                    aria-label="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="new-circle-name"
                    className="text-xs text-muted-foreground"
                  >
                    circle name
                  </Label>
                  <Input
                    id="new-circle-name"
                    placeholder="studio crew"
                    value={newCircleName}
                    onChange={(e) => setNewCircleName(e.target.value)}
                    maxLength={40}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">
                    add friends
                  </Label>
                  <ul className="flex flex-col">
                    {connections.map((c) => {
                      const checked = newCircleMemberIds.includes(c.id)
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => toggleNewCircleMember(c.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                checked
                                  ? "border-accent bg-accent text-accent-foreground"
                                  : "border-border"
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="text-sm">{c.displayName}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              @{c.username}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <Button
                  onClick={createCircle}
                  disabled={!newCircleName.trim()}
                  className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
                >
                  create circle
                </Button>
              </div>
            )}
          </TabsContent>

          {/* PEOPLE TAB */}
          <TabsContent value="people" className="m-0 flex flex-col gap-4">
            {requests.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
                  requests
                </p>
                <ul className="flex flex-col gap-2">
                  {requests.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/profile/${req.user.username}`)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Avatar name={req.user.displayName} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {req.user.displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{req.user.username}
                            {req.user.note ? ` · ${req.user.note}` : ""}
                          </p>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => acceptRequest(req)}
                          className="h-8 rounded-full bg-accent px-3 text-xs text-accent-foreground hover:bg-accent/90"
                        >
                          accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => declineRequest(req)}
                          className="h-8 rounded-full px-3 text-xs"
                        >
                          decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  your people
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {connections.length}
                </span>
              </div>
              {connections.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  add friends with their @handle or QR code.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {connections.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-border px-1 py-2 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${c.username}`)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Avatar name={c.displayName} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {c.displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{c.username}
                          </p>
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`options for ${c.displayName}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/profile/${c.username}`)
                            }
                          >
                            view profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setPendingBlock(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            block
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          {/* BLOCKED TAB */}
          <TabsContent value="blocked" className="m-0">
            {blocked.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                no one is blocked.
              </p>
            ) : (
              <ul className="flex flex-col">
                {blocked.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 border-b border-border px-1 py-2 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/profile/${b.username}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar name={b.displayName} muted />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {b.displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{b.username} · blocked {formatBlockedAt(b.blockedAt)}
                        </p>
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unblock(b)}
                      className="h-8 rounded-full px-3 text-xs"
                    >
                      <ShieldOff className="mr-1 h-3.5 w-3.5" />
                      unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Bottom Nav */}
      <div className="pointer-events-none absolute right-0 bottom-6 left-0 z-10">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>

      {qrOpen && (
        <QrShareSheet
          displayName={user?.displayName ?? "you"}
          handle={user?.username ?? "you"}
          onClose={() => setQrOpen(false)}
        />
      )}

      {pendingBlock && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-black/40"
          onClick={() => setPendingBlock(null)}
        >
          <div
            className="flex w-full flex-col gap-4 rounded-t-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-base font-semibold">
                block {pendingBlock.displayName}?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                They won&apos;t appear in your circles or see your flares. You
                can unblock them later from the blocked tab.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  blockConnection(pendingBlock)
                  setPendingBlock(null)
                }}
                className="w-full rounded-full bg-destructive text-white hover:bg-destructive/90"
              >
                block
              </Button>
              <Button
                variant="outline"
                onClick={() => setPendingBlock(null)}
                className="w-full rounded-full"
              >
                cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
        muted
          ? "bg-secondary text-muted-foreground"
          : "border border-accent/20 bg-accent/10 text-accent"
      }`}
    >
      {initials(name)}
    </span>
  )
}
