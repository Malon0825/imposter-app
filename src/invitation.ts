export interface NativeInvitation {
  version: number;
  endpoint: string;
  party_id: string;
  party_name: string;
  wifi: string;
  admission: string;
  certificate: string;
  expires: number;
}
export interface ParsedInvitation {
  native: NativeInvitation;
  nativeLink: string;
  browser?: { endpoint: string; admission: string };
  text: string;
}
function decode(text: string): unknown {
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
      ),
    ),
  );
}
function encode(value: unknown): string {
  return btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function localAddress(host: string) {
  const parts = host.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)
  )
    return false;
  const [a, b] = parts.map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}
export function parseInvitation(input: string): ParsedInvitation {
  const text = input.trim();
  if (text.length > 10000) throw Error("This invitation is too long.");
  try {
    let native: NativeInvitation;
    let browser: ParsedInvitation["browser"];
    if (text.startsWith("imposter://join/"))
      native = decode(
        text.slice("imposter://join/".length),
      ) as NativeInvitation;
    else {
      const url = new URL(text);
      if (
        url.protocol !== "http:" ||
        !localAddress(url.hostname) ||
        !url.port ||
        url.pathname !== "/join" ||
        url.search ||
        url.username ||
        url.password ||
        !url.hash.startsWith("#invite=")
      )
        throw Error();
      const shared = decode(url.hash.slice(8)) as {
        version: number;
        native: NativeInvitation;
        browser: NonNullable<ParsedInvitation["browser"]>;
      };
      if (
        shared.version !== 2 ||
        !shared.browser ||
        shared.browser.endpoint !== `${url.origin}/` ||
        typeof shared.browser.admission !== "string" ||
        shared.browser.admission.length !== 36
      )
        throw Error();
      native = shared.native;
      browser = shared.browser;
      if (new URL(native.endpoint).hostname !== url.hostname) throw Error();
    }
    const endpoint = new URL(native.endpoint);
    if (
      native.version !== 1 ||
      endpoint.protocol !== "https:" ||
      !localAddress(endpoint.hostname) ||
      !endpoint.port ||
      endpoint.pathname !== "/" ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.username ||
      endpoint.password ||
      ![
        native.party_id,
        native.party_name,
        native.wifi,
        native.admission,
        native.certificate,
      ].every((v) => typeof v === "string" && v.length > 0) ||
      native.admission.length !== 36 ||
      native.certificate.length > 3000 ||
      !Number.isFinite(native.expires)
    )
      throw Error();
    if (native.expires * 1000 < Date.now())
      throw Error("This invitation expired. Scan the host’s current QR.");
    return {
      native,
      nativeLink: `imposter://join/${encode(native)}`,
      browser,
      text,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("This invitation expired")
    )
      throw error;
    throw Error(
      "Use the QR or invitation from an IMPOSTER party on your shared Wi-Fi.",
    );
  }
}
export function androidAppLink(invitation: string): string {
  const parsed = parseInvitation(invitation);
  const payload = parsed.nativeLink.slice("imposter://join/".length);
  return `intent://join/${payload}#Intent;scheme=imposter;package=com.imposter.party;S.browser_fallback_url=${encodeURIComponent(parsed.text)};end`;
}
