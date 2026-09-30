import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

// A long-lived (7 day), reusable, revocable link a user pastes into group
// chats (#124). Opening it only *sends a connection request* — unlike a QR
// contact token, it never connects instantly. Kept as its own collection
// rather than a `kind` on qr_contact_tokens so an invite token can never be
// fed to the instant-connect QR path by mistake.
//
// The token is stored as-is (not hashed like QR tokens): the owner has to be
// able to see and re-share the same link for its whole lifetime, and all it
// grants is a request the owner still has to accept plus their display name.
const inviteLinkSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "invite_links",
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

inviteLinkSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });

export type InviteLinkDocument = InferSchemaType<typeof inviteLinkSchema>;

export const InviteLink: Model<InviteLinkDocument> =
  (mongoose.models.InviteLink as Model<InviteLinkDocument>) ||
  model<InviteLinkDocument>("InviteLink", inviteLinkSchema);
