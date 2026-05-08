import { Router } from "express";
import blockRoutes from "./blockRoutes.js";
import circleRoutes from "./circleRoutes.js";
import connectionRoutes from "./connectionRoutes.js";
import eventRoutes from "./eventRoutes.js";
import inboxRoutes from "./inboxRoutes.js";
import notificationSettingsRoutes from "./notificationSettingsRoutes.js";
import qrContactTokenRoutes from "./qrContactTokenRoutes.js";
import userSearchRoutes from "./userSearchRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/events", eventRoutes);
apiRoutes.use("/connections", connectionRoutes);
apiRoutes.use("/blocks", blockRoutes);
apiRoutes.use("/circles", circleRoutes);
apiRoutes.use("/notification-settings", notificationSettingsRoutes);
apiRoutes.use("/qr-contact-tokens", qrContactTokenRoutes);
apiRoutes.use("/inbox", inboxRoutes);
apiRoutes.use("/users", userSearchRoutes);
