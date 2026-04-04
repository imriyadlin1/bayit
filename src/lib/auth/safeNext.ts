export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return fallback;
  return t || fallback;
}
