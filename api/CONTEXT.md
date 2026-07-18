# API

The core business-logic service. Owns flares (events), circles, connections, RSVPs, and the in-app notification feed. Mongo + Mongoose, layered controller → service → model.

## Language

**Flare**:
A single event object a user broadcasts to their network. The same flare surfaces in the map view (now / imminent) and the calendar view (upcoming) — timing alone decides which. There is no separate "spontaneous" vs "planned" type.
_Avoid_: Meetup, hangout, post, plan (when referring to the object).

**Circle**:
A user-owned grouping of connections used as an audience target when lighting a flare (e.g. "close", "inner", "all", or a custom one). The canonical word for this concept in both UI and code.
_Avoid_: List, friend list, group.

**Connection**:
An accepted, mutual friend relationship between two users. A pending request is not yet a connection.
_Avoid_: Friend (as a stored entity), follower, contact.

**RSVP**:
A user's participation response to a flare (the join action). Carries an arrival-time intent (ETA) for imminent flares.
_Avoid_: Join status, attendance (as the stored field name).

**In-app notification**:
An entry in the user's notification feed/inbox, persisted as a `Notification` and surfaced in the app's notifications popover. This is what exists today.
_Avoid_: Push, alert (when you mean the feed entry).

**Push notification**:
A device-level APNs/FCM delivery. Distinct from the in-app feed, requires the native shell, and is **not yet built**. Reserve this term strictly for device push so it never gets conflated with the in-app feed.
_Avoid_: Notification (unqualified), alert.
