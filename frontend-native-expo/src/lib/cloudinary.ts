import { api } from "./api";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "";

export async function uploadToCloudinary(file: { uri: string; type?: string; name?: string }, folder = "salesmaintain"): Promise<string> {
  const sig = await api.post<{
    endpoint: string;
    cloudName: string;
    apiKey: string;
    signature: string;
    timestamp: number;
    folder: string;
  }>("/api/upload/signature", { folder });

  const fd = new FormData();
  fd.append("file", {
    uri: file.uri,
    type: file.type || "image/jpeg",
    name: file.name || "photo.jpg",
  } as any);
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
