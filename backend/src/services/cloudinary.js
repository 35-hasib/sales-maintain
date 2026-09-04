import crypto from "crypto";

// Minimal Cloudinary helper for client-side (signed) direct uploads.
// It only generates upload signatures using the API secret. The actual file
// upload happens directly from the browser to Cloudinary, so the API secret
// never leaves the server.
//
// Requires these env vars:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

function requireEnv() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error("Cloudinary is not configured");
    err.status = 500;
    throw err;
  }
  return { cloudName, apiKey, apiSecret };
}

// Builds a signed upload payload for a specific file upload request.
// Returns everything the browser needs to POST the file to Cloudinary.
export function buildUploadSignature({ folder = "salesmaintain", publicId, timestamp = Math.floor(Date.now() / 1000), eager } = {}) {
  const { cloudName, apiKey, apiSecret } = requireEnv();

  const params = { timestamp, folder };
  if (publicId) params.public_id = publicId;
  if (eager) params.eager = eager;

  // Cloudinary signs the parameters sorted by key, joined as key=value&key=value.
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");

  return { cloudName, apiKey, signature, timestamp, folder, publicId: publicId || undefined };
}
