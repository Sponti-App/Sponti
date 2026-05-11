"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShieldOff,
  UserMinus,
  UserPlus,
  UserX,
  X,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { CircleStackIcon } from "@/components/circle-stack-icon"
import { QrShareSheet } from "@/components/qr-share-sheet"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatBlockedAt,
  initials,
  MOCK_BLOCKED,
  MOCK_CIRCLES,
  MOCK_CONNECTIONS,
  MOCK_DISCOVERABLE,
  MOCK_REQUESTS,
  type BlockedUser,
  type Circle,
  type Connection,
  type ConnectionRequest,
} from "@/lib/circles"

type Tab = "circles" | "people" | "blocked"

export default function CirclesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("circles")
  const [qrOpen, setQrOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [discoverable, setDiscoverable] = useState<Connection[]>(MOCK_DISCOVERABLE)
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([])

  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS)
  const [requests, setRequests] = useState<ConnectionRequest[]>(MOCK_REQUESTS)
  const [blocked, setBlocked] = useState<BlockedUser[]>(MOCK_BLOCKED)

  const [circles, setCircles] = useState<Circle[]>(MOCK_CIRCLES)
  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id ?? "")
  const [isEditing, setIsEditing] = useState(false)
  const [memberQuery, setMemberQuery] = useState("")
  const [newCircleOpen, setNewCircleOpen] = useState(false)
  const [newCircleName, setNewCircleName] = useState("")
  const [newCircleMemberIds, setNewCircleMemberIds] = useState<string[]>([])

  const selectedCircle = circles.find((c) => c.id === selectedCircleId) ?? circles[0]

  const connectionsById = useMemo(() => {
    const map = new Map<string, Connection>()
    connections.forEach((c) => map.set(c.id, c))
    return map
  }, [connections])

  const selectedMembers = useMemo(
    () =>
      selectedCircle
        ? selectedCircle.memberIds
            .map((id) => connectionsById.get(id))
            .filter((c): c is Connection => Boolean(c))
        : [],
    [selectedCircle, connectionsById],
  )

  const memberlessConnections = useMemo(() => {
    if (!selectedCircle) return []
    const q = memberQuery.trim().toLowerCase()
    return connections.filter((c) => {
      if (selectedCircle.memberIds.includes(c.id)) return false
      if (!q) return true
      return (
        c.displayName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
      )
    })
  }, [selectedCircle, connections, memberQuery])

  const matchingDiscoverable = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "")
    if (!q) return [] as Connection[]
    return discoverable.filter(
      (d) =>
        d.username.toLowerCase().includes(q) ||
        d.displayName.toLowerCase().includes(q),
    )
  }, [searchQuery, discoverable])

  // ----- handlers -----

  const sendRequest = (target: Connection): void => {
    setDiscoverable((prev) => prev.filter((d) => d.id !== target.id))
    setSentRequestIds((prev) => [...prev, target.id])
    setSearchQuery("")
  }

  const acceptRequest = (req: ConnectionRequest): void => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
    setConnections((prev) => [...prev, req.user])
  }

  const declineRequest = (req: ConnectionRequest): void => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
  }

  const removeConnection = (target: Connection): void => {
    setConnections((prev) => prev.filter((c) => c.id !== target.id))
    setCircles((prev) =>
      prev.map((circle) => ({
        ...circle,
        memberIds: circle.memberIds.filter((id) => id !== target.id),
      })),
    )
  }

  const blockConnection = (target: Connection): void => {
    removeConnection(target)
    setBlocked((prev) => [
      { id: target.id, displayName: target.displayName, username: target.username, blockedAt: new Date().toISOString() },
      ...prev,
    ])
  }

  const unblock = (target: BlockedUser): void => {
    setBlocked((prev) => prev.filter((b) => b.id !== target.id))
  }

  const updateSelectedCircle = (updater: (c: Circle) => Circle): void => {
    if (!selectedCircle) return
    setCircles((prev) => prev.map((c) => (c.id === selectedCircle.id ? updater(c) : c)))
  }

  const toggleNewCircleMember = (id: string): void => {
    setNewCircleMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const createCircle = (): void => {
    const name = newCircleName.trim()
    if (!name) return
    const next: Circle = {
      id: `custom-${Date.now()}`,
      name,
      description: "custom circle",
      tier: 2,
      memberIds: newCircleMemberIds,
    }
    setCircles((prev) => [...prev, next])
    setSelectedCircleId(next.id)
    setIsEditing(true)
    setNewCircleName("")
    setNewCircleMemberIds([])
    setNewCircleOpen(false)
  }

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => router.push("/")}
            aria-label="Back"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold">circles</span>
          <button
            onClick={() => setQrOpen(true)}
            aria-label="Show your QR"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <QrCode className="h-4 w-4" />
          </button>
        </div>

        {/* Add by handle */}
        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="add by @handle"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchQuery.trim() && (
            <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
              {matchingDiscoverable.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">
                  no matches for &ldquo;{searchQuery}&rdquo;
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {matchingDiscoverable.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                      <Avatar name={d.displayName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{d.username}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendRequest(d)}
                        className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-3 h-8 text-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {sentRequestIds.length > 0 && !searchQuery.trim() && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {sentRequestIds.length} request{sentRequestIds.length === 1 ? "" : "s"} sent
            </p>
          )}
        </div>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-4 shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="circles">circles</TabsTrigger>
              <TabsTrigger value="people">
                people
                {requests.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
                    {requests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="blocked">blocked</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-32 mt-3">
            {/* CIRCLES TAB */}
            <TabsContent value="circles" className="m-0 flex flex-col gap-3">
              {circles.map((circle) => {
                const selected = circle.id === selectedCircle?.id
                const previewNames = circle.memberIds
                  .slice(0, 3)
                  .map((id) => connectionsById.get(id)?.displayName)
                  .filter(Boolean)
                  .join(", ")
                return (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => {
                      setSelectedCircleId(circle.id)
                      setIsEditing(false)
                      setMemberQuery("")
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-accent bg-accent/5"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    <CircleStackIcon
                      tier={circle.tier}
                      className={`h-6 w-6 shrink-0 ${
                        selected ? "text-accent" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{circle.name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {circle.description}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {circle.memberIds.length} {circle.memberIds.length === 1 ? "person" : "people"}
                        {previewNames ? ` · ${previewNames}` : ""}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setNewCircleOpen((v) => !v)}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
                <span>create custom circle</span>
              </button>

              {newCircleOpen && (
                <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">new circle</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        name it and pick the first members.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewCircleOpen(false)}
                      aria-label="Close"
                      className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-secondary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="new-circle-name" className="text-xs text-muted-foreground">
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
                    <Label className="text-xs text-muted-foreground">add friends</Label>
                    <ul className="flex flex-col">
                      {connections.map((c) => {
                        const checked = newCircleMemberIds.includes(c.id)
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => toggleNewCircleMember(c.id)}
                              className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary"
                            >
                              <span
                                className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                  checked
                                    ? "border-accent bg-accent text-accent-foreground"
                                    : "border-border"
                                }`}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              <span className="text-sm">{c.displayName}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
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

              {/* Selected circle editor */}
              {selectedCircle && (
                <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-3 mt-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        editing
                      </p>
                      {isEditing ? (
                        <Input
                          value={selectedCircle.name}
                          onChange={(e) =>
                            updateSelectedCircle((c) => ({ ...c, name: e.target.value }))
                          }
                          aria-label="circle name"
                          className="mt-1 text-base font-semibold"
                        />
                      ) : (
                        <p className="text-base font-semibold mt-0.5">{selectedCircle.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedCircle.memberIds.length}{" "}
                        {selectedCircle.memberIds.length === 1 ? "person" : "people"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing((v) => !v)
                        setMemberQuery("")
                      }}
                      className="rounded-full h-8 text-xs shrink-0"
                    >
                      {isEditing ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          edit
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="h-px bg-border" />

                  {selectedMembers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                      this circle is empty.
                    </p>
                  ) : (
                    <ul className="flex flex-col">
                      {selectedMembers.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 px-1 py-2"
                        >
                          <Avatar name={m.displayName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              @{m.username}
                            </p>
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedCircle((c) => ({
                                  ...c,
                                  memberIds: c.memberIds.filter((id) => id !== m.id),
                                }))
                              }
                              aria-label={`remove ${m.displayName}`}
                              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {isEditing && (
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="add a friend to this circle…"
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <ul className="flex flex-col">
                        {memberlessConnections.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-1 py-2">
                            no more friends to add.
                          </p>
                        ) : (
                          memberlessConnections.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedCircle((circle) => ({
                                    ...circle,
                                    memberIds: [...circle.memberIds, c.id],
                                  }))
                                  setMemberQuery("")
                                }}
                                className="w-full flex items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-secondary"
                              >
                                <span className="h-9 w-9 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                                  <Plus className="h-4 w-4" />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm font-medium truncate">
                                    {c.displayName}
                                  </span>
                                  <span className="block text-xs text-muted-foreground truncate">
                                    @{c.username}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* PEOPLE TAB */}
            <TabsContent value="people" className="m-0 flex flex-col gap-4">
              {requests.length > 0 && (
                <section>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                    requests
                  </p>
                  <ul className="flex flex-col gap-2">
                    {requests.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                      >
                        <Avatar name={req.user.displayName} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {req.user.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{req.user.username}
                            {req.user.note ? ` · ${req.user.note}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => acceptRequest(req)}
                            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 h-8 px-3 text-xs"
                          >
                            accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => declineRequest(req)}
                            className="rounded-full h-8 px-3 text-xs"
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    your people
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {connections.length}
                  </span>
                </div>
                {connections.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                    add friends with their @handle or QR code.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {connections.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 px-1 py-2 border-b border-border last:border-b-0"
                      >
                        <Avatar name={c.displayName} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{c.username}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeConnection(c)}
                          aria-label={`remove ${c.displayName}`}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => blockConnection(c)}
                          aria-label={`block ${c.displayName}`}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-destructive"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </TabsContent>

            {/* BLOCKED TAB */}
            <TabsContent value="blocked" className="m-0">
              {blocked.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                  no one is blocked.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {blocked.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 px-1 py-2 border-b border-border last:border-b-0"
                    >
                      <Avatar name={b.displayName} muted />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{b.username} · blocked {formatBlockedAt(b.blockedAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unblock(b)}
                        className="rounded-full h-8 px-3 text-xs"
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-1" />
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
        <div className="absolute bottom-6 left-0 right-0 z-10 pointer-events-none">
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
    </div>
  )
}

function Avatar({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span
      className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
        muted
          ? "bg-secondary text-muted-foreground"
          : "bg-accent/10 text-accent border border-accent/20"
      }`}
    >
      {initials(name)}
    </span>
  )
}
