import * as contactPreviewService from "#services/contactPreviewService";
import { asyncHandler } from "#utils/asyncHandler";

export const getContactPreview = asyncHandler(async (req, res) => {
  const data = await contactPreviewService.getContactPreview(req.body);

  res.set("Cache-Control", "no-store");
  res.json({ data });
});
