import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Credentials, DeviceStatus, SessionData } from "./types";
import { parseInvitation } from "./invitation";
import { requestId, storage } from "./storage";

export const native = isTauri();
export const webGuest =
  !native &&
  (location.pathname === "/join" ||
    location.pathname === "/play" ||
    !import.meta.env.DEV);
const key = webGuest ? "imposter.web.session.v1" : "imposter.session.v1";
const sessionStore = storage(
  native || webGuest ? "localStorage" : "sessionStorage",
);
const pendingJoinKey = "imposter.web.join.v1";
export const persistentResume = () => sessionStore.available();
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
let active: Credentials | null = null;
let claimed = false;
let controller = "";
let resumeRequest: Promise<SessionData> | null = null;
let joinAttempt: { invitation: string; player: string; id: string } | null =
  null;
export function entryInvitation(): string {
  if (location.hash.startsWith("#invite=")) return location.href;
  return storedSession()?.credentials.invitation || "";
}
async function post<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: abort.signal,
      cache: "no-store",
      credentials: "omit",
    });
    const value = await response.json();
    if (!response.ok)
      throw new ApiError(
        value.error || "The host rejected this request.",
        value.code || "rejected",
        response.status,
      );
    return value as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Can’t reach the host. Connect to the shared Wi-Fi and keep the host app open.",
      "unreachable",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
function browserInvite(text: string) {
  const parsed = parseInvitation(text);
  if (
    !parsed.browser ||
    new URL(parsed.browser.endpoint).origin !== location.origin
  )
    throw Error("Open this invitation on the host’s local party page.");
  return parsed;
}
function browserHeaders(
  credentials?: Credentials,
  withController = false,
): Record<string, string> {
  const headers: Record<string, string> = { "X-Imposter-Client": "web-v1" };
  if (credentials) {
    headers.Authorization = `Bearer ${credentials.token}`;
    headers["X-Imposter-Party"] = browserInvite(
      credentials.invitation,
    ).native.party_id;
    if (withController) headers["X-Imposter-Controller"] = controller;
  }
  return headers;
}
function controllerId() {
  return (controller ||= requestId());
}
async function resumeBrowser(credentials: Credentials): Promise<SessionData> {
  if (resumeRequest) return resumeRequest;
  const parsed = browserInvite(credentials.invitation);
  resumeRequest = post<SessionData>(
    "/guest/resume",
    {
      party_id: parsed.native.party_id,
      player_id: credentials.player_id,
      controller: controllerId(),
    },
    browserHeaders(credentials),
  );
  try {
    const session = await resumeRequest;
    active = session.credentials;
    claimed = true;
    saveSession(session);
    return session;
  } finally {
    resumeRequest = null;
  }
}
async function browserApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (method === "inspect") {
    const parsed = browserInvite(String(body.invitation));
    return post<T>(
      "/guest/bootstrap",
      {
        party_id: parsed.native.party_id,
        admission: parsed.browser!.admission,
      },
      browserHeaders(),
    );
  }
  if (method === "join") {
    const text = String(body.invitation),
      player = String(body.player);
    const parsed = browserInvite(text);
    if (!joinAttempt) {
      try {
        const saved = JSON.parse(
          sessionStore.getItem(pendingJoinKey) || "null",
        );
        if (
          saved &&
          typeof saved.invitation === "string" &&
          typeof saved.player === "string" &&
          typeof saved.id === "string" &&
          /^[a-f0-9-]{36}$/i.test(saved.id)
        )
          joinAttempt = saved;
      } catch {
        /* Blocked/corrupt storage still allows a fresh join. */
      }
    }
    if (
      !joinAttempt ||
      joinAttempt.invitation !== text ||
      joinAttempt.player !== player
    )
      joinAttempt = { invitation: text, player, id: requestId() };
    sessionStore.setItem(pendingJoinKey, JSON.stringify(joinAttempt));
    const session = await post<SessionData>(
      "/guest/join",
      {
        party_id: parsed.native.party_id,
        admission: parsed.browser!.admission,
        name: player,
        request_id: joinAttempt.id,
        controller: controllerId(),
      },
      browserHeaders(),
    );
    active = session.credentials;
    claimed = true;
    saveSession(session);
    sessionStore.removeItem(pendingJoinKey);
    joinAttempt = null;
    return session as T;
  }
  if (method === "resume")
    return (await resumeBrowser(body as unknown as Credentials)) as T;
  if (method === "close") {
    active = null;
    claimed = false;
    joinAttempt = null;
    return {} as T;
  }
  if (method !== "state" && method !== "action")
    throw Error("Only the installed Android host can do that.");
  const credentials = active || storedSession()?.credentials;
  if (!credentials)
    throw new ApiError(
      "Your saved place is missing. Join from the host’s QR.",
      "no_player",
      401,
    );
  if (!claimed) {
    const session = await resumeBrowser(credentials);
    if (method === "state") return session.view as T;
  }
  return post<T>(
    `/guest/${method}`,
    method === "action" ? body.action : {},
    browserHeaders(credentials, true),
  );
}
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
  if (webGuest) return browserApi<T>(method, body);
  return post<T>(`/api/${method}`, body, { "X-Imposter-Dev": "1" });
}
export async function device(operation: string): Promise<DeviceStatus> {
  if (native) return invoke("native_action", { operation });
  if (operation !== "status")
    throw Error("Use your phone’s settings to change Wi-Fi.");
  return {
    platform: webGuest ? "web" : "browser",
    wifi: true,
    wifi_name: "Shared Wi-Fi",
    ip: "",
    battery_unrestricted: false,
    background_supported: false,
  };
}
export function saveSession(session: SessionData) {
  sessionStore.setItem(
    key,
    JSON.stringify({
      session_id: session.session_id,
      credentials: session.credentials,
    }),
  );
  if (webGuest) {
    active = session.credentials;
    history.replaceState(null, "", "/play");
  }
}
export function storedSession(): Omit<SessionData, "view"> | null {
  try {
    const saved = JSON.parse(sessionStore.getItem(key) || "null");
    if (
      webGuest &&
      location.hash.startsWith("#invite=") &&
      saved &&
      parseInvitation(location.href).native.party_id !==
        parseInvitation(saved.credentials.invitation).native.party_id
    )
      return null;
    return saved;
  } catch {
    return null;
  }
}
export function clearSession() {
  sessionStore.removeItem(key);
  sessionStore.removeItem(pendingJoinKey);
  active = null;
  claimed = false;
}
export function previewPage() {
  return import.meta.env.DEV
    ? new URLSearchParams(location.search).get("screen")
    : null;
}
