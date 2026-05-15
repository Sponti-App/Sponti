type NotificationHookPayload = Record<string, unknown>;

const logDevelopmentHook = (name: string, payload: NotificationHookPayload) => {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[notification-hook:${name}]`, payload);
  }
};

export const notificationHooks = {
  async onConnectionRequestCreated(payload: NotificationHookPayload) {
    // TODO: Replace with async notification dispatch when queues are introduced.
    logDevelopmentHook("connection-request-created", payload);
  },

  async onEventInvitationsCreated(payload: NotificationHookPayload) {
    // TODO: Replace with async notification dispatch when queues are introduced.
    logDevelopmentHook("event-invitations-created", payload);
  },

  async onEventCancelled(payload: NotificationHookPayload) {
    // TODO: Replace with async notification dispatch when queues are introduced.
    logDevelopmentHook("event-cancelled", payload);
  },

  async onEventReactivated(payload: NotificationHookPayload) {
    // TODO: Replace with async notification dispatch when queues are introduced.
    logDevelopmentHook("event-reactivated", payload);
  },
};
