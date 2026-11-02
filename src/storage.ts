// Joining still works when private browsing disables persistent site storage.
const memory = new Map<string, string>();
export function storage(kind: "localStorage" | "sessionStorage") {
  return {
    getItem(key: string): string | null {
      try {
        return (
          window[kind].getItem(key) ?? memory.get(`${kind}:${key}`) ?? null
        );
      } catch {
        return memory.get(`${kind}:${key}`) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(`${kind}:${key}`, value);
      try {
        window[kind].setItem(key, value);
      } catch {
        /* Page-only recovery. */
      }
    },
    removeItem(key: string) {
      memory.delete(`${kind}:${key}`);
      try {
        window[kind].removeItem(key);
      } catch {
        /* Storage is optional. */
      }
    },
    available() {
      try {
        const key = "imposter.storage-check";
        window[kind].setItem(key, "1");
        window[kind].removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
export const preferences = storage("localStorage");
// randomUUID needs HTTPS; getRandomValues also works on local HTTP.
export function requestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
