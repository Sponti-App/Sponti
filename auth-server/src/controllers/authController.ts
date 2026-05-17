import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Request, Response } from "express";
import { OAuth2Client, type LoginTicket } from "google-auth-library";
import {
  User,
  Circle,
  NotificationSettings,
  RefreshToken,
  PasswordResetToken,
} from "#models";
import { sendPasswordResetEmail } from "#lib/email";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "#lib/tokens";
import cloudinary from "#lib/cloudinary";
import streamfier from "streamifier";

const googleClient = new OAuth2Client();

const toUserResponse = (user: InstanceType<typeof User>) => ({
  id: user._id.toString(),
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  avatarUrl: user.avatarUrl,
  avatarPublicId: user.avatarPublicId,
  profileVisibility: user.profileVisibility,
  socialBattery: user.socialBattery,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const deleteExpiredRefreshTokens = (userId: string) =>
  RefreshToken.deleteMany({
    userId,
    expiresAt: { $lte: new Date() },
  });

const saveRefreshToken = async (userId: string, refreshToken: string) => {
  const tokenHash = await hashRefreshToken(refreshToken);
  const refreshPayload = verifyRefreshToken(refreshToken);
  const expiresAt = refreshPayload.exp
    ? new Date(refreshPayload.exp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
  });
};

const createDefaultUserRecords = async (userId: string) => {
  await Circle.create([
    {
      ownerId: userId,
      name: "close friends",
      color: "#00FF00", // Green
      type: "close",
    },
    {
      ownerId: userId,
      name: "all friends",
      color: "#FF0000", // Red
      type: "all",
    },
    {
      ownerId: userId,
      name: "inner circle",
      color: "#FF0000", // Red
      type: "inner",
    },
  ]);
  await NotificationSettings.create({
    userId,
  });
};

const createSessionResponse = async (user: InstanceType<typeof User>) => {
  const userId = user._id.toString();
  const accessToken = createAccessToken(userId);
  const refreshToken = createRefreshToken(userId);
  await deleteExpiredRefreshTokens(userId);
  await saveRefreshToken(userId, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: toUserResponse(user),
  };
};

const normalizeUsernameBase = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);

  return normalized.length >= 3 ? normalized : "user";
};

const generateUsername = async (email: string, displayName: string) => {
  const [emailName = ""] = email.split("@");
  const base = normalizeUsernameBase(emailName || displayName);

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : String(index + 1);
    const username = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    const exists = await User.exists({ username });

    if (!exists) return username;
  }

  throw new Error("Could not generate a username", { cause: { status: 500 } });
};

export const register = async (req: Request, res: Response) => {
  const { username, displayName, email, password } = req.body;

  const normalizedEmail = email.toLowerCase();
  const userExists = await User.exists({ email: normalizedEmail });

  if (userExists) {
    throw new Error("User with this email already exists", {
      cause: { status: 409 },
    });
  }

  const usernameExists = await User.exists({ username });

  if (usernameExists) {
    throw new Error("Username already taken", { cause: { status: 409 } });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    displayName,
    email: normalizedEmail,
    passwordHash,
  });
  await createDefaultUserRecords(user._id.toString());

  const session = await createSessionResponse(user);

  res.status(201).json({
    ...session,
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error("Invalid email or password", { cause: { status: 401 } });
  }

  if (!user.passwordHash) {
    throw new Error("Invalid email or password", { cause: { status: 401 } });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("Invalid email or password", { cause: { status: 401 } });
  }

  const session = await createSessionResponse(user);

  res.json({
    ...session,
  });
};

export const googleLogin = async (req: Request, res: Response) => {
  const { credential } = req.body as { credential: string };
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured", {
      cause: { status: 500 },
    });
  }

  let ticket: LoginTicket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
  } catch {
    throw new Error("Invalid Google credential", { cause: { status: 401 } });
  }
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google credential", { cause: { status: 401 } });
  }

  if (!payload.email_verified) {
    throw new Error("Google email is not verified", { cause: { status: 401 } });
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = await User.findOne({
    $or: [{ googleId: payload.sub }, { email: normalizedEmail }],
  });
  let isNewUser = false;

  if (user) {
    if (!user.googleId) user.googleId = payload.sub;
    if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
    await user.save();
  } else {
    isNewUser = true;
    const displayName =
      payload.name?.trim() || normalizedEmail.split("@")[0] || "Sponti user";
    const username = await generateUsername(normalizedEmail, displayName);

    user = await User.create({
      username,
      displayName,
      email: normalizedEmail,
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
    });
    await createDefaultUserRecords(user._id.toString());
  }

  const session = await createSessionResponse(user);

  res.json({
    ...session,
    isNewUser,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  let refreshPayload: ReturnType<typeof verifyRefreshToken>;

  try {
    refreshPayload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error("Invalid refresh token", { cause: { status: 401 } });
  }

  const activeTokens = await RefreshToken.find({
    userId: refreshPayload.userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  let matchedToken: InstanceType<typeof RefreshToken> | null = null;

  for (const tokenDoc of activeTokens) {
    const matches = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);

    if (matches) {
      matchedToken = tokenDoc;
      break;
    }
  }

  if (!matchedToken) {
    throw new Error("Invalid refresh token", { cause: { status: 401 } });
  }

  const consumedToken = await RefreshToken.findOneAndDelete({
    _id: matchedToken._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!consumedToken) {
    throw new Error("Invalid refresh token", { cause: { status: 401 } });
  }

  const accessToken = createAccessToken(refreshPayload.userId);
  const nextRefreshToken = createRefreshToken(refreshPayload.userId);
  await deleteExpiredRefreshTokens(refreshPayload.userId);
  await saveRefreshToken(refreshPayload.userId, nextRefreshToken);

  res.json({
    accessToken,
    refreshToken: nextRefreshToken,
  });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  let refreshPayload: ReturnType<typeof verifyRefreshToken>;

  try {
    refreshPayload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error("Invalid refresh token", { cause: { status: 401 } });
  }

  const activeTokens = await RefreshToken.find({
    userId: refreshPayload.userId,
    revokedAt: null,
  }).sort({ createdAt: -1 });

  let matchedToken: InstanceType<typeof RefreshToken> | null = null;

  for (const tokenDoc of activeTokens) {
    const matches = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);

    if (matches) {
      matchedToken = tokenDoc;
      break;
    }
  }

  if (matchedToken) await matchedToken.deleteOne();

  res.json({ success: true });
};

export const me = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new Error("User not found", { cause: { status: 404 } });
  }

  res.json({
    user: toUserResponse(user),
  });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });

  // Always respond 200 to avoid leaking whether an account exists
  if (!user) {
    res.json({
      message:
        "If that email is registered you will receive a reset link shortly.",
    });
    return;
  }

  // Invalidate any existing unused tokens for this user
  await PasswordResetToken.updateMany(
    { userId: user._id, used: false },
    { used: true },
  );

  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${plainToken}`;

  await sendPasswordResetEmail(normalizedEmail, resetUrl);

  res.json({
    message:
      "If that email is registered you will receive a reset link shortly.",
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await PasswordResetToken.findOne({ tokenHash, used: false });

  if (!record || record.expiresAt < new Date()) {
    throw new Error("Reset link is invalid or has expired", {
      cause: { status: 400 },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.findByIdAndUpdate(record.userId, { passwordHash });
  await PasswordResetToken.findByIdAndUpdate(record._id, { used: true });

  res.json({ message: "Password updated successfully." });
};

export const updateAvatar = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new Error("User not found", { cause: { status: 404 } });
  }

  if (!req.file) {
    throw new Error("No file uploaded", { cause: { status: 400 } });
  }

  const fileBuffer = req.file.buffer;
  const uploadResult = await cloudinary.uploader.upload_stream(
    {
      folder: "avatars",
      public_id: `${user._id}-${Date.now()}`,
      overwrite: true,
      resource_type: "image",
    },
    async (error, result) => {
      if (error || !result) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Failed to upload avatar", { cause: { status: 500 } });
      }

      const oldPublicId = user.avatarPublicId;

      user.avatarUrl = result.secure_url;
      user.avatarPublicId = result.public_id;
      await user.save();

      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId);
      }

      res.json({ avatarUrl: user.avatarUrl });
    },
  );

  streamfier.createReadStream(fileBuffer).pipe(uploadResult);
};

export const updateProfile = async (req: Request, res: Response) => {
    const { displayName, username, email, profileVisibility } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
        throw new Error("User not found", { cause: { status: 404 } });
    }

    if (username && username !== user.username) {
        const usernameExists = await User.exists({ username });

        if (usernameExists) {
            throw new Error("Username already taken", { cause: { status: 409 } });
        }
        user.username = username;
    }

    if (email && email.toLowerCase() !== user.email) {
        const normalizedEmail = email.toLowerCase();
        const emailExists = await User.exists({ email: normalizedEmail });
        if (emailExists) {
            throw new Error("Email already in use", { cause: { status: 409 } });
        }
        user.email = normalizedEmail;
    }

    if (displayName) user.displayName = displayName;
    if (profileVisibility) user.profileVisibility = profileVisibility;

    await user.save();

    res.json({ user: toUserResponse(user) });
}; 
