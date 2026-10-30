// Web push (#640). Registered by lib/push.ts when someone turns push on; it
// does nothing else (no caching, no offline).

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A push we can't read still has to show something, or Safari revokes it.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "sponti", {
      body: data.body || "",
      // A newer push with the same tag (more joins on one flare) replaces the
      // older one instead of stacking.
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "/", self.location.origin)
    .href
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) => w.url.startsWith(self.location.origin))
        if (open) return open.focus().then((w) => w.navigate(url))
        return self.clients.openWindow(url)
      })
  )
})
