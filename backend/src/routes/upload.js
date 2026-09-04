import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { buildUploadSignature } from "../services/cloudinary.js";

const router = Router();

// Returns a signed upload payload the browser uses to upload a file directly
// to Cloudinary. Requires an authenticated officer so the signing secret is
// never exposed to unauthenticated clients.
router.post("/signature", authRequired, (req, res, next) => {
  try {
    const { publicId, folder } = req.body || {};
    const payload = buildUploadSignature({ publicId, folder });
    res.json({ endpoint: `https://api.cloudinary.com/v1_1/${payload.cloudName}/auto/upload`, ...payload });
  } catch (e) {
    next(e);
  }
});

export default router;
