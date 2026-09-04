import { api } from "./api";

// Requests a signed upload payload from the backend, then uploads the file
// directly to Cloudinary from the browser. Returns the secure URL of the
// uploaded asset. The Cloudinary API secret only ever lives on the server.
export async function uploadToCloudinary(file: File, folder = "salesmaintain"): Promise<string> {
  const sig = await api.post<{
    endpoint: string;
    cloudName: string;
    apiKey: string;
    signature: string;
    timestamp: number;
    folder: string;
    publicId?: string;
  }>("/api/upload/signature", { folder });

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);

  const res = await fetch(sig.endpoint, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `আপলোড ব্যর্থ হয়েছে (${res.status})`);
  }
  return data.secure_url as string;
}
