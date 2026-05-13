import { objectIdSchema } from "@/types/utils";
import { LucideProps } from "lucide-react";
import React from "react";
import { z } from "zod";

type EventsType = {
  type: "hangout" | "sports" | "drinks" | "food"
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>
}

const eventRoleInputSchema = z.enum(["admin", "guest"]);


const eventMemberInviteSchema = z
  .object({
    userId: objectIdSchema,
    role: eventRoleInputSchema.default("guest"),
    canInviteGuests: z.boolean().optional(),
  })
  .strict();

type eventMemberInvite = z.infer<typeof eventMemberInviteSchema>

// TODO: If it's necessary create the request DTO

// Response DTO ?

export interface EventItem {
  id: number
  title: string // TODO: in the spa the title is not entered by the user, but created out of a combination of EventsType.type, user displayName and location's name.
  type: EventsType
  status: "active" | "cancelled" | "completed"
  start: // TODO: decide the type,
  end: // TODO: decide the type,
  host: {
    name: string
    avatar: string
    color: string
    note: string
  }
  location: { // TODO: for now use a static mock data, google maps API is not set yet. 
    name: string
    area: string
    distance: string
    walkTime: string
  }
  attendees: Array<eventMemberInvite> // TODO: attendees has to be change to members to match data model
  going: number, // TODO: The API has to use eventId to retrieve all the event_members rsvpStatus is going
  guestLimit: number
}
