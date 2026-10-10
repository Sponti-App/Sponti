import multer from "multer";

// #539: decoded raster formats only. SVG can carry script, so it's refused
// even though it is an image type.
const ALLOWED_AVATAR_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
]);

export const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
            return callback(
                new Error("only jpeg, png, webp, gif or heic photos can be uploaded", {
                    cause: { status: 400 },
                })
            );
        }
        callback(null, true);
    },
});
