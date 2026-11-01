import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DeviceStatus, SessionData } from "./types";
export const native = isTauri();
export async function api<T>(
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  if (native) {
    const args = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        v,
      ]),
    );
    return invoke<T>(`game_${method}`, args);
  }
  const response = await fetch(`/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Imposter-Dev": "1" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "Unable to reach your party.");
  return value as T;
}
export async function device(operation: string): Promise<DeviceStatus> {
  if (native) return invoke("native_action", { operation });
  if (operation !== "status")
    throw new Error(
      "Open this in the installed Android app to use device settings.",
    );
  return {
    platform: "browser",
    wifi: true,
    wifi_name: "Local network",
    ip: "127.0.0.1",
    battery_unrestricted: false,
    background_supported: false,
  };
}
const key = "imposter.session.v1";
// Native activity recreation keeps the player's identity. Separate browser tabs
// remain independent players when previewing a party on one computer.
const sessionStore = native ? localStorage : sessionStorage;
export function saveSession(s: SessionData) {
  sessionStore.setItem(
    key,
    JSON.stringify({ session_id: s.session_id, credentials: s.credentials }),
  );
}
export function storedSession(): Omit<SessionData, "view"> | null {
  try {
    return JSON.parse(sessionStore.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function clearSession() {
  sessionStore.removeItem(key);
}
export function previewPage() {
  return import.meta.env.DEV
    ? new URLSearchParams(location.search).get("screen")
    : null;
}
