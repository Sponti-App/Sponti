"use client"

import { useState } from "react"
import { APIProvider, Map, AdvancedMarker, APILoadingStatus, useApiLoadingStatus } from "@vis.gl/react-google-maps"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight, MapPin, Coffee, Flame, Check } from "lucide-react"

// Sample events data
const events = [
  {
    id: 1,
    title: "coffee at Reuben's",
    type: "coffee",
    status: "happening now",
    host: {
      name: "Mira",
      avatar: "M",
      color: "bg-orange-500",
      note: "grabbing a latte before my 4pm — pop by if you're around ☕",
    },
    location: {
      name: "Reuben's Espresso",
      area: "Fillmore",
      distance: "0.4 mi",
      walkTime: "8 min walk",
    },
    attendees: [
      { name: "Mira", avatar: "M", color: "bg-orange-500" },
      { name: "Sam", avatar: "S", color: "bg-stone-300" },
    ],
    going: 2,
    position: { lat: 37.7855, lng: -122.4364 },
  },
  {
    id: 2,
    title: "group hang",
    type: "hang",
    status: "7pm",
    host: {
      name: "Sam",
      avatar: "S",
      color: "bg-stone-800",
      note: "patio hangs at my place, bring snacks!",
    },
    location: {
      name: "the patio",
      area: "Castro",
      distance: "0.6 mi",
      walkTime: "12 min walk",
    },
    attendees: [
      { name: "Sam", avatar: "S", color: "bg-stone-800" },
      { name: "K", avatar: "K", color: "bg-stone-300" },
    ],
    going: 4,
    position: { lat: 37.7825, lng: -122.4324 },
  },
]

// User location (center of map)
const userLocation = { lat: 37.7849, lng: -122.4344 }

const etaOptions = ["5 min", "15 min", "30 min", "1 hr"]

function StaticMapFallback({ onEventClick }: { onEventClick: (event: (typeof events)[0]) => void }) {
  return (
    <div className="w-full h-full bg-[#d5d0c8] relative">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, #b8b3ab 1px, transparent 1px),
            linear-gradient(to bottom, #b8b3ab 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 390 500">
        <path d="M-20 120 Q120 160 200 100 Q280 40 420 80" stroke="#c4bfb7" strokeWidth="28" fill="none" />
        <path d="M-20 320 Q100 280 180 220 Q260 160 420 140" stroke="#c4bfb7" strokeWidth="28" fill="none" />
        <path d="M140 -20 Q170 120 150 220 Q130 320 170 520" stroke="#c4bfb7" strokeWidth="24" fill="none" />
        <path d="M300 -20 Q280 100 290 200 Q300 300 260 520" stroke="#c4bfb7" strokeWidth="20" fill="none" />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
      </div>
      <button
        onClick={() => onEventClick(events[0])}
        className="absolute top-[32%] left-[28%] flex flex-col items-center cursor-pointer"
      >
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-lg">M</div>
        <div className="mt-1 px-2 py-1 bg-white rounded-lg text-xs shadow-md text-center">
          <span className="font-medium italic">Mira</span><br />
          <span className="text-muted-foreground italic">0.2 mi</span>
        </div>
      </button>
      <button
        onClick={() => onEventClick(events[1])}
        className="absolute top-[52%] right-[12%] flex flex-col items-center cursor-pointer"
      >
        <div className="w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-white shadow-lg">
          <span className="text-xs">👥</span>
        </div>
        <div className="mt-1 px-2 py-1 bg-stone-800 rounded-lg text-xs font-medium text-white shadow-md text-center italic">
          Sam<br />+3
        </div>
      </button>
    </div>
  )
}

function GoogleMapContent({ onEventClick }: { onEventClick: (event: (typeof events)[0]) => void }) {
  const status = useApiLoadingStatus()

  if (status === APILoadingStatus.FAILED) {
    return <StaticMapFallback onEventClick={onEventClick} />
  }

  return (
    <Map
      defaultCenter={userLocation}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      disableDefaultUI={true}
      className="w-full h-full"
    >
      <AdvancedMarker position={userLocation}>
        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
      </AdvancedMarker>
      {events.map((event) => (
        <AdvancedMarker
          key={event.id}
          position={event.position}
          onClick={() => onEventClick(event)}
        >
          <div className="flex flex-col items-center cursor-pointer">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shadow-lg ${event.host.color}`}>
              {event.host.avatar}
            </div>
            <div className="mt-1 px-2 py-0.5 bg-white rounded text-xs font-medium shadow">
              {event.location.distance}
            </div>
          </div>
        </AdvancedMarker>
      ))}
    </Map>
  )
}

export function MapView() {
  const [selectedEvent, setSelectedEvent] = useState<(typeof events)[0] | null>(null)
  const [selectedEta, setSelectedEta] = useState<string | null>(null)
  const [hostNotified, setHostNotified] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const handleEventClick = (event: (typeof events)[0]) => {
    setSelectedEvent(event)
    setSelectedEta(null)
    setHostNotified(false)
  }

  const handleEtaSelect = (eta: string) => {
    setSelectedEta(eta)
    setHostNotified(true)
  }

  const handleClose = () => {
    setSelectedEvent(null)
    setSelectedEta(null)
    setHostNotified(false)
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMapContent onEventClick={handleEventClick} />
        </APIProvider>
      ) : (
        <StaticMapFallback onEventClick={handleEventClick} />
      )}

      {/* Bottom Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out ${
          selectedEvent ? "h-[70%]" : "h-[32%]"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {selectedEvent ? (
          /* Expanded Event Details */
          <div className="px-4 pb-4 overflow-y-auto h-[calc(100%-48px)]">
            {/* Event Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Coffee className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{selectedEvent.title}</h2>
                <div className="flex items-center gap-1 text-orange-500 text-sm">
                  <Flame className="w-4 h-4" />
                  <span>{selectedEvent.status}</span>
                </div>
              </div>
            </div>

            {/* Host Note */}
            <Card className="p-3 mb-4 bg-stone-100 border-0">
              <div className="flex items-start gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${selectedEvent.host.color}`}
                >
                  {selectedEvent.host.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.host.name} · host note
                  </p>
                  <p className="text-sm italic">{selectedEvent.host.note}</p>
                </div>
              </div>
            </Card>

            {/* Where */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Where</span>
                <span className="text-xs text-muted-foreground">
                  {selectedEvent.location.walkTime}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{selectedEvent.location.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.location.area} · {selectedEvent.location.distance} ·{" "}
                    {selectedEvent.location.walkTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Who's Going */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Who&apos;s going
              </p>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {selectedEvent.attendees.map((attendee, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs border-2 border-background ${attendee.color}`}
                    >
                      {attendee.avatar}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium">
                    {selectedEvent.attendees.map((a) => a.name).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedEvent.going} going</p>
                </div>
              </div>
            </div>

            {/* ETA Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Let host know
                </span>
                {hostNotified && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="w-3 h-3" /> host notified
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {etaOptions.map((eta) => (
                  <Button
                    key={eta}
                    variant={selectedEta === eta ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 rounded-full ${
                      selectedEta === eta
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground"
                    }`}
                    onClick={() => handleEtaSelect(eta)}
                  >
                    {eta}
                  </Button>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <Button
              className={`w-full rounded-full py-6 text-base ${
                selectedEta
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={!selectedEta}
              onClick={handleClose}
            >
              {selectedEta ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> on the way · {selectedEta}
                </span>
              ) : (
                "Select ETA to join"
              )}
            </Button>
          </div>
        ) : (
          /* Collapsed - Flares List */
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Flares near you</h2>
              <span className="text-sm text-muted-foreground">{events.length} active</span>
            </div>
            <div className="space-y-2">
              {events.map((event) => (
                <FlareCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FlareCard({
  event,
  onClick,
}: {
  event: (typeof events)[0]
  onClick: () => void
}) {
  return (
    <Card
      className="p-3 flex-row items-center gap-3 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${event.host.color}`}
      >
        {event.host.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-orange-500 truncate">
          {event.type} · {event.host.name}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {event.status} · {event.location.name} · {event.location.distance}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </Card>
  )
}
