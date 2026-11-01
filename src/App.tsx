import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import {
  api,
  clearSession,
  device,
  native,
  saveSession,
  storedSession,
} from "./api";
import type {
  Credentials,
  DeviceStatus,
  Player,
  SessionData,
  Topic,
  View,
} from "./types";
import { Icon } from "./icons";
import {
  MOTION,
  useDelayedBusy,
  usePageVisible,
  type ScreenMotion,
} from "./motion";
import {
  CheckStroke,
  ExpandSection,
  LockedVoteArt,
  MotionSheet,
  ProgressDots,
  ScoreValue,
  ScreenTransition,
  SelectionCheck,
} from "./motion-ui";
import {
  Confetti,
  ConnectionIllustration,
  DareArrow,
  PawStamp,
  Rays,
  TopicArt,
} from "./illustrations";

type Page =
  | "home"
  | "create"
  | "host_setup"
  | "scan"
  | "invitation"
  | "wifi"
  | "identity"
  | "topics"
  | "help"
  | null;
const errorText = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return "Could not complete that action. Please try again.";
};
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (
    parts.length === 1
      ? Array.from(parts[0]).slice(0, 2).join("")
      : parts
          .map((w) => Array.from(w)[0])
          .slice(0, 2)
          .join("")
  ).toUpperCase();
};
function Avatar({
  player,
  large = false,
  mine = false,
}: {
  player?: Pick<Player, "name" | "id">;
  large?: boolean;
  mine?: boolean;
}) {
  const tint = player
    ? [...player.name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3
    : 0;
  return (
    <span
      className={`avatar ${large ? "large" : ""} ${mine ? "mine" : `tint-${tint}`}`}
    >
      {initials(player?.name || "?")}
    </span>
  );
}
function Cards({ className = "" }: { className?: string }) {
  return (
    <img
      className={`cards-art ${className}`}
      src={
        className.includes("discussion-art")
          ? "/art/discussion-cards.png"
          : "/art/secret-cards.png"
      }
      alt="Three secret cards with watchful eyes"
      draggable={false}
    />
  );
}
function Button({
  children,
  onClick,
  kind = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "outline" | "text" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type={type}
      whileTap={disabled || reduced ? undefined : { scale: 0.975 }}
      transition={MOTION.press}
      className={`button ${kind} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
function Header({
  title,
  back,
  right,
}: {
  title?: string;
  back?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="appbar">
      {back ? (
        <button className="icon-button" onClick={back} aria-label="Go back">
          <Icon name="back" />
        </button>
      ) : (
        <span className="bar-spacer" />
      )}
      <span title={title}>{title}</span>
      <span className="bar-right">{right}</span>
    </header>
  );
}
function ConnectionArt({ broken = false }: { broken?: boolean }) {
  return (
    <div className={`connection-art ${broken ? "broken" : ""}`}>
      <ConnectionIllustration broken={broken} />
    </div>
  );
}
function CoffeeCup() {
  return (
    <div className="cup-art" aria-hidden="true">
      <Rays className="cup-rays" />
      <img src="/art/ceramic-cup.png" alt="" draggable={false} />
    </div>
  );
}

export default function App() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [page, setPage] = useState<Page>("home");
  const [direction, setDirection] = useState(1);
  const [returnPage, setReturnPage] = useState<Page>("home");
  const [view, setView] = useState<View | null>(null);
  const current = useRef<View | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState(false);
  const showBusy = useDelayedBusy(busy);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [name, setName] = useState(localStorage.getItem("imposter.name") || "");
  const [partyName, setPartyName] = useState("Friday night");
  const [wifi, setWifi] = useState("");
  const [invitation, setInvitation] = useState("");
  const [details, setDetails] = useState<{
    name: string;
    host_name: string;
    wifi: string;
  } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [showTopicSearch, setShowTopicSearch] = useState(false);
  const [editWifi, setEditWifi] = useState(false);
  const [vote, setVote] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    label: string;
    action: () => void;
  } | null>(null);
  const [background, setBackground] = useState(false);
  const pending = useRef(false);
  const scanVideo = useRef<HTMLVideoElement>(null);
  const scanCancelled = useRef(false);
  const cameraStream = useRef<MediaStream | null>(null);
  const polling = useRef(false);

  const accept = useCallback((v: View) => {
    if (current.current?.id === v.id && current.current.revision > v.revision)
      return;
    current.current = v;
    setView(v);
  }, []);
  const adopt = useCallback(
    (s: SessionData) => {
      saveSession(s);
      setSessionId(s.session_id);
      setCredentials(s.credentials);
      accept(s.view);
      setDirection(1);
      setPage(null);
      setDisconnected(false);
    },
    [accept],
  );
  const execute = async (fn: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const act = async (kind: string, value: unknown = null) => {
    if (!current.current) return;
    const v = await api<View>("action", {
      session_id: sessionId,
      action: {
        id: crypto.randomUUID(),
        round_id: current.current.round_id,
        kind,
        value,
      },
    });
    accept(v);
  };
  const send = (kind: string, value: unknown = null) =>
    execute(() => act(kind, value));
  const refreshDevice = useCallback(async () => {
    try {
      const s = await device("status");
      setStatus(s);
      setWifi((old) => old || s.wifi_name || "Home Wi-Fi");
    } catch {
      /* The explicit setup action reports device errors. */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    refreshDevice();
    const saved = storedSession();
    if (!saved) {
      setBooting(false);
      return;
    }
    (async () => {
      try {
        let s: SessionData;
        try {
          s = {
            ...saved,
            view: await api<View>("state", { session_id: saved.session_id }),
          };
        } catch {
          if (saved.credentials.is_host)
            throw new Error(
              "Your hosted party is no longer running. Create a new party.",
            );
          s = await api<SessionData>("resume", { ...saved.credentials });
        }
        if (mounted) adopt(s);
      } catch (e) {
        if (mounted) {
          clearSession();
          setError(errorText(e));
        }
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [adopt, refreshDevice]);

  useEffect(() => {
    if (!sessionId || view?.phase === "ended") return;
    let active = true;
    let failures = 0;
    const refresh = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const v = await api<View>("state", { session_id: sessionId });
        if (active) {
          accept(v);
          setDisconnected(false);
          failures = 0;
        }
      } catch {
        if (active && ++failures >= 2) {
          setDisconnected(true);
          setRevealed(false);
        }
      } finally {
        polling.current = false;
      }
    };
    const timer = window.setInterval(refresh, 600);
    const focus = () => {
      refreshDevice();
      refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [sessionId, view?.phase, accept, refreshDevice]);

  useEffect(() => {
    setRevealed(false);
    setVote("");
    setError("");
  }, [view?.round_id, view?.phase]);
  useEffect(() => {
    const hide = () => {
      document.documentElement.toggleAttribute(
        "data-motion-paused",
        document.hidden,
      );
      if (document.hidden) {
        document.documentElement.setAttribute("data-private-concealed", "");
        setRevealed(false);
      } else {
        refreshDevice();
      }
    };
    document.addEventListener("visibilitychange", hide);
    hide();
    return () => {
      document.removeEventListener("visibilitychange", hide);
      document.documentElement.removeAttribute("data-motion-paused");
    };
  }, [refreshDevice]);
  useEffect(() => {
    if (!credentials?.is_host) return;
    let alive = true;
    QRCode.toDataURL(credentials.invitation, {
      width: 700,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#141916", light: "#F4F1E8" },
    }).then((url) => {
      if (alive) setQr(url);
    });
    return () => {
      alive = false;
    };
  }, [credentials]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const handler = () => {
      if (busy) return;
      if (confirm) {
        setConfirm(null);
        return;
      }
      if (showQr) {
        setShowQr(false);
        return;
      }
      if (scanning) {
        void stopScan();
        return;
      }
      if (page === "help") {
        nav(returnPage, -1);
        return;
      }
      if (page && page !== "home") {
        const parent: Partial<Record<NonNullable<Page>, Page>> = {
          create: "home",
          host_setup: "create",
          scan: "home",
          invitation: "scan",
          wifi: "scan",
          identity: "wifi",
          topics: null,
        };
        nav(parent[page] ?? (view ? null : "home"));
        return;
      }
      if (view) {
        if (view.phase === "ended") void execute(close);
        else askLeave();
        return;
      }
      if (native) void device("minimize");
    };
    window.addEventListener("popstate", handler);
    window.addEventListener("imposter-back", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("imposter-back", handler);
    };
  });
  useEffect(
    () => () => {
      cameraStream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!confirm && !showQr) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(
      () =>
        document.querySelector<HTMLElement>(".bottom-sheet button")?.focus(),
      60,
    );
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pending.current) return;
        setConfirm(null);
        setShowQr(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          ".bottom-sheet button:not(:disabled)",
        ),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [confirm, showQr]);

  const nav = (p: Page, explicitDirection?: number) => {
    const depth: Record<string, number> = {
      home: 0,
      create: 1,
      host_setup: 2,
      scan: 1,
      invitation: 2,
      wifi: 3,
      identity: 4,
      topics: 1,
      help: 10,
    };
    setDirection(
      explicitDirection ??
        ((depth[p ?? "home"] ?? 0) < (depth[page ?? "home"] ?? 0) ? -1 : 1),
    );
    if (revealed) {
      document.documentElement.setAttribute("data-private-concealed", "");
      setRevealed(false);
    }
    setError("");
    setPage(p);
    setShowQr(false);
  };
  const help = () => {
    setReturnPage(page);
    nav("help");
  };
  const person = (id: string | null | undefined) =>
    view?.players.find((p) => p.id === id);
  const playerName = (id: string | null | undefined) =>
    person(id)?.name || "Player";
  const me = person(view?.my_id);
  const activePlayers = view?.players.filter((p) => !p.left) || [];
  const close = async () => {
    if (sessionId) await api("close", { session_id: sessionId });
    clearSession();
    setSessionId("");
    setCredentials(null);
    current.current = null;
    setView(null);
    setDisconnected(false);
    nav("home", -1);
  };
  const askLeave = () => {
    if (!view) return;
    if (revealed) {
      document.documentElement.setAttribute("data-private-concealed", "");
      setRevealed(false);
    }
    setConfirm({
      title: view.is_host ? "End this party?" : "Leave the party?",
      body: view.is_host
        ? "Everyone will see the final rankings. An unfinished round earns no points."
        : "Your place will be marked as left. An unfinished round will pause.",
      label: view.is_host ? "End party" : "Leave party",
      action: () =>
        execute(async () => {
          await act(view.is_host ? "end" : "leave");
          if (!view.is_host) await close();
          setConfirm(null);
        }),
    });
  };
  const create = async (useBackground: boolean) => {
    if (useBackground) {
      const s = await device("startHosting");
      if (!s.background_supported)
        throw new Error(
          "Background hosting is unavailable on this device. Keep the app open instead.",
        );
    }
    try {
      const s = await api<SessionData>("create", {
        name: partyName.trim(),
        player: name.trim(),
        wifi: wifi.trim() || "Home Wi-Fi",
      });
      localStorage.setItem("imposter.name", name.trim());
      adopt(s);
    } catch (e) {
      if (useBackground) await device("stopHosting").catch(() => {});
      throw e;
    }
  };
  const readInvitation = (text: string) => {
    if (!text.trim().startsWith("imposter://join/"))
      throw new Error("Use the QR or invitation from an IMPOSTER party.");
    if (text.length > 6000) throw new Error("This invitation is too long.");
    setInvitation(text.trim());
    setDetails(null);
    nav("wifi");
  };
  const stopScan = async () => {
    scanCancelled.current = true;
    cameraStream.current?.getTracks().forEach((t) => t.stop());
    cameraStream.current = null;
    if (native) {
      const { cancel } = await import("@tauri-apps/plugin-barcode-scanner");
      await cancel().catch(() => {});
    }
    setScanning(false);
    document.body.classList.remove("camera-active");
  };
  const scan = async () => {
    scanCancelled.current = false;
    setError("");
    setScanning(true);
    try {
      if (native) {
        const { scan, Format, checkPermissions, requestPermissions } =
          await import("@tauri-apps/plugin-barcode-scanner");
        let p = await checkPermissions();
        if (p !== "granted") p = await requestPermissions();
        if (p !== "granted")
          throw new Error(
            "Camera access is off. Enable it in app settings or paste an invitation.",
          );
        document.body.classList.add("camera-active");
        const result = await scan({ windowed: true, formats: [Format.QRCode] });
        readInvitation(result.content);
      } else {
        const detectorClass = (
          window as unknown as {
            BarcodeDetector?: new (options: { formats: string[] }) => {
              detect: (
                video: HTMLVideoElement,
              ) => Promise<{ rawValue: string }[]>;
            };
          }
        ).BarcodeDetector;
        if (!detectorClass)
          throw new Error(
            "QR scanning is unavailable in this browser. Paste the host invitation instead.",
          );
        cameraStream.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (scanVideo.current) {
          scanVideo.current.srcObject = cameraStream.current;
          await scanVideo.current.play();
        }
        const detector = new detectorClass({ formats: ["qr_code"] });
        while (cameraStream.current) {
          if (scanVideo.current) {
            const codes = await detector.detect(scanVideo.current);
            if (codes[0]) {
              readInvitation(codes[0].rawValue);
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } catch (e) {
      if (!scanCancelled.current) setError(errorText(e));
    } finally {
      await stopScan();
    }
  };

  function playersList() {
    return (
      <div className="players-list">
        {activePlayers.map((p, i) => (
          <motion.div
            className="player-row"
            key={p.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.035 }}
          >
            <Avatar player={p} mine={p.id === view?.host_id} />
            <div className="player-details">
              <strong>{p.name}</strong>
              <span>
                {p.id === view?.my_id && p.id !== view?.host_id && !p.ready ? (
                  "You"
                ) : (
                  <>
                    {p.id === view?.my_id ? "You · " : ""}
                    {p.id === view?.host_id
                      ? "Host"
                      : !p.connected
                        ? "Reconnecting"
                        : p.ready
                          ? "Ready"
                          : "Not ready yet"}
                  </>
                )}
              </span>
            </div>
            {p.id === view?.host_id ? (
              <Icon name="crown" className="lime" />
            ) : view?.phase === "lobby" && p.ready ? (
              <span className="ready-mark">
                <Icon name="check" size={17} />
              </span>
            ) : !p.connected ? (
              <span className="connection-dot offline" />
            ) : null}
            {view?.is_host && p.id !== view.my_id && view.phase === "lobby" && (
              <button
                className="player-manage"
                aria-label={`Manage ${p.name}`}
                onClick={() =>
                  setConfirm({
                    title: `Remove ${p.name}?`,
                    body: "They can scan the invitation to join again before a round starts.",
                    label: "Remove player",
                    action: () =>
                      execute(async () => {
                        await act("remove", p.id);
                        setConfirm(null);
                      }),
                  })
                }
              >
                <span className="sr-only">Manage {p.name}</span>
              </button>
            )}
          </motion.div>
        ))}
      </div>
    );
  }
  const footer = (children: ReactNode) => (
    <div className="actions">{children}</div>
  );
  const reconnect = () => (
    <>
      <div className="center-stage reconnecting-content">
        <ConnectionArt broken />
        <h1>Hold that thought.</h1>
        <p>
          Reconnecting to{" "}
          {view?.is_host
            ? "your party"
            : `${playerName(view?.host_id)}’s party`}
          .
        </p>
        <p className="muted">Your place and score are saved.</p>
        <div className="setting-row">
          <Icon name="wifi" />
          <div>
            <strong>{view?.wifi}</strong>
            <span>
              Checking connection
              <span className="spinner small-spinner" />
            </span>
          </div>
        </div>
      </div>
      {footer(
        <>
          <Button
            kind="outline"
            disabled={busy}
            onClick={() =>
              execute(async () => {
                const v = await api<View>("state", { session_id: sessionId });
                accept(v);
                setDisconnected(false);
              })
            }
          >
            Check connection
          </Button>
          <Button
            kind="text"
            onClick={() =>
              setConfirm({
                title: "Leave this connection?",
                body: "Your saved place on this phone will be cleared. The host may need to abandon the interrupted round.",
                label: "Return home",
                action: () => execute(close),
              })
            }
          >
            Leave party
          </Button>
        </>,
      )}
    </>
  );

  function screen(): ReactNode {
    if (booting)
      return (
        <div className="center-stage boot">
          <Cards />
          <span className="spinner" />
          <p className="muted">Finding your party…</p>
        </div>
      );
    if (page === "help")
      return (
        <>
          <Header back={() => nav(returnPage, -1)} />
          <div className="help-heading">
            <h1>Trust your clues.</h1>
            <Cards />
          </div>
          <p className="muted">How to play IMPOSTER.</p>
          <ol className="help-list">
            {[
              ["Join the same Wi-Fi", "Be in the same room."],
              [
                "Check your private role",
                "Civilians see the word. The imposter gets a hint.",
              ],
              [
                "Give clues. Spot the imposter.",
                "Talk, joke, and find the odd one out.",
              ],
              ["Vote in secret", "Everyone votes at the same time."],
              [
                "Drink or Dare. Check rankings.",
                "Keep playing to find a new word.",
              ],
            ].map(([title, copy], i) => (
              <li key={title}>
                <span className="step-number">{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="scoring-note">
            <Icon name="trophy" />
            <span>
              <b>+1</b> correct guess
              <br />
              <b>+2</b> imposter escape
            </span>
          </div>
          {footer(<Button onClick={() => nav(returnPage, -1)}>Got it</Button>)}
        </>
      );
    if (page === "home" || (!view && !page))
      return (
        <>
          <div className="welcome">
            <h1 className="wordmark">IMPOSTER</h1>
            <motion.div
              className="welcome-float"
              animate={
                !reduced && visible
                  ? { y: [0, -5, 0], rotate: [0, 0.8, 0] }
                  : { y: 0, rotate: 0 }
              }
              transition={{
                duration: !reduced && visible ? 7 : 0,
                repeat: !reduced && visible ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <Cards />
            </motion.div>
            <h2>Someone is bluffing.</h2>
            <p className="muted">One room. One secret. Trust no one.</p>
          </div>
          {footer(
            <>
              <Button onClick={() => nav("create")}>Host party</Button>
              <Button kind="outline" onClick={() => nav("scan")}>
                Join party
              </Button>
              <Button kind="text" onClick={help}>
                How to play
              </Button>
            </>,
          )}
        </>
      );
    if (page === "create")
      return (
        <>
          <Header back={() => nav("home")} />
          <h1>Make it your party</h1>
          <form
            className="fill-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !partyName.trim()) return;
              nav("host_setup");
            }}
          >
            <label>
              Your name
              <input
                autoComplete="nickname"
                required
                maxLength={28}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
              />
            </label>
            <label>
              Party name
              <input
                required
                maxLength={28}
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="setting-row inline-setting"
              aria-expanded={editWifi}
              onClick={() => setEditWifi((v) => !v)}
            >
              <Icon name="wifi" />
              <div>
                <strong>
                  {status?.wifi
                    ? wifi || "Wi-Fi connected"
                    : "Connect to Wi-Fi"}
                </strong>
                <span className={status?.wifi ? "lime" : "terra"}>
                  {status?.wifi ? "Connected" : "Connection needed"}
                </span>
              </div>
              <Icon name="chevron" size={19} />
            </button>
            <ExpandSection open={editWifi}>
              <label className="wifi-label">
                Wi-Fi name shown to guests
                <input
                  maxLength={28}
                  required
                  value={wifi}
                  onChange={(e) => setWifi(e.target.value)}
                  placeholder="Home Wi-Fi"
                />
                <small>This label helps your friends find the router.</small>
                {native && (
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() =>
                      execute(async () => {
                        await device("wifiSettings");
                      })
                    }
                  >
                    Open Wi-Fi settings
                  </button>
                )}
              </label>
            </ExpandSection>
            {footer(
              <Button
                type="submit"
                disabled={
                  !name.trim() ||
                  !partyName.trim() ||
                  !wifi.trim() ||
                  !status?.wifi
                }
              >
                Continue
              </Button>,
            )}
          </form>
        </>
      );
    if (page === "host_setup")
      return (
        <>
          <Header back={() => nav("create")} />
          <h1>
            Keep the party
            <br />
            connected
          </h1>
          <ConnectionArt />
          <p className="setup-copy">
            Allow background usage so your party stays connected.
          </p>
          <div className="setting-row">
            <Icon name="settings" size={29} />
            <div>
              <strong>Battery usage</strong>
              <span className={status?.battery_unrestricted ? "lime" : "terra"}>
                {status?.battery_unrestricted ? "Unrestricted" : "Setup needed"}
              </span>
            </div>
          </div>
          {background && (
            <p className="muted">
              Keep the hosting notification active during your party.
            </p>
          )}
          {footer(
            <>
              {native && status?.platform === "android" ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      execute(async () => {
                        if (!status.battery_unrestricted && !background) {
                          await device("batterySettings");
                          setBackground(true);
                        } else {
                          await create(true);
                        }
                      })
                    }
                  >
                    {status.battery_unrestricted || background
                      ? "Host in background"
                      : "Open battery settings"}
                  </Button>
                  <Button
                    kind="text"
                    disabled={busy}
                    onClick={() => execute(() => create(false))}
                  >
                    Keep app open instead
                  </Button>
                </>
              ) : (
                <>
                  <p className="muted compact">
                    Keep this app open while hosting on this device.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() => execute(() => create(false))}
                  >
                    Create party
                  </Button>
                </>
              )}
            </>,
          )}
        </>
      );
    if (page === "scan")
      return (
        <>
          <Header
            back={() => {
              stopScan();
              nav("home");
            }}
          />
          <h1>Find your party</h1>
          <p className="muted">Scan the QR on your host’s phone.</p>
          <div className={`scan-area ${scanning ? "scanning" : ""}`}>
            <video ref={scanVideo} playsInline muted />
            <div className="scan-frame">
              <i />
              <i />
              <i />
              <i />
            </div>
            {!scanning && (
              <div className="scan-idle">
                <Icon name="qr" size={90} />
                <p>Your host has the invitation.</p>
              </div>
            )}
          </div>
          {footer(
            <>
              <Button
                disabled={busy}
                onClick={() => (scanning ? stopScan() : scan())}
              >
                <Icon name={scanning ? "x" : "camera"} />
                {scanning ? "Cancel scan" : "Scan invitation"}
              </Button>
              <Button
                kind="text"
                onClick={() => {
                  stopScan();
                  nav("invitation");
                }}
              >
                Enter invitation instead
              </Button>
            </>,
          )}
        </>
      );
    if (page === "invitation")
      return (
        <>
          <Header back={() => nav("scan")} />
          <h1>Your invitation</h1>
          <p className="muted">
            Ask the host to copy their invitation and share it with you.
          </p>
          <form
            className="fill-form"
            onSubmit={(e) => {
              e.preventDefault();
              execute(async () => readInvitation(invitation));
            }}
          >
            <label>
              Party invitation
              <textarea
                value={invitation}
                onChange={(e) => setInvitation(e.target.value)}
                maxLength={6000}
                placeholder="imposter://join/…"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            {footer(
              <Button type="submit" disabled={busy || !invitation.trim()}>
                Continue
              </Button>,
            )}
          </form>
        </>
      );
    if (page === "wifi") {
      let label = "the host’s Wi-Fi";
      try {
        const raw = invitation.split("/").pop() || "";
        label =
          JSON.parse(
            new TextDecoder().decode(
              Uint8Array.from(
                atob(raw.replace(/-/g, "+").replace(/_/g, "/")),
                (c) => c.charCodeAt(0),
              ),
            ),
          ).wifi || label;
      } catch {
        /* Backend validates before admission. */
      }
      return (
        <>
          <Header back={() => nav("scan")} />
          <h1>
            Same room.
            <br />
            Same Wi-Fi.
          </h1>
          <p className="muted">Connect to the host’s router before joining.</p>
          <div className="setting-row spacious">
            <Icon name="wifi" size={30} />
            <div>
              <strong>{label}</strong>
              <span className={details ? "lime" : "terra"}>
                {details ? "Host reachable" : "Connection needed"}
              </span>
            </div>
          </div>
          <p className="muted compact">
            Internet isn’t required. Everyone needs the same local Wi-Fi.
          </p>
          {footer(
            <>
              {native && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    execute(async () => {
                      await device("wifiSettings");
                    })
                  }
                >
                  Open Wi-Fi settings
                </Button>
              )}
              <Button
                kind={details ? "primary" : native ? "outline" : "primary"}
                disabled={busy}
                onClick={() =>
                  execute(async () => {
                    if (details) {
                      nav("identity");
                      return;
                    }
                    const d = await api<{
                      name: string;
                      host_name: string;
                      wifi: string;
                    }>("inspect", { invitation });
                    setDetails(d);
                    setNotice("Host reachable. You’re on the right network.");
                  })
                }
              >
                {details
                  ? "Join party"
                  : busy
                    ? "Checking…"
                    : "Check connection"}
              </Button>
            </>,
          )}
        </>
      );
    }
    if (page === "identity")
      return (
        <>
          <Header back={() => nav("wifi")} />
          <div className="reach-status">
            <span className="success-disc">
              <Icon name="check" />
            </span>
            <div>
              <strong>Host reachable</strong>
              <p className="muted">
                {details?.name} · Host: {details?.host_name}
              </p>
            </div>
          </div>
          <h1>
            What should
            <br />
            we call you?
          </h1>
          <div className="identity-avatar">
            <Avatar player={{ id: "me", name: name || "?" }} large />
          </div>
          <form
            className="fill-form"
            onSubmit={(e) => {
              e.preventDefault();
              execute(async () => {
                const s = await api<SessionData>("join", {
                  invitation,
                  player: name.trim(),
                });
                localStorage.setItem("imposter.name", name.trim());
                adopt(s);
              });
            }}
          >
            <label>
              Your name
              <input
                required
                maxLength={28}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sam"
                autoComplete="nickname"
              />
            </label>
            {footer(
              <Button type="submit" disabled={busy || !name.trim()}>
                Join party
              </Button>,
            )}
          </form>
        </>
      );
    if (page === "topics" && view)
      return (
        <>
          <Header
            back={() => nav(null)}
            right={
              <button
                className="icon-button"
                aria-label={
                  showTopicSearch ? "Close topic search" : "Search topics"
                }
                onClick={() => {
                  setShowTopicSearch((v) => !v);
                  setTopicSearch("");
                }}
              >
                <Icon name={showTopicSearch ? "x" : "search"} size={21} />
              </button>
            }
          />
          <h1>Choose the mood</h1>
          <p className="muted">Pick one or more topics</p>
          <ExpandSection open={showTopicSearch}>
            <input
              className="search-input"
              aria-label="Search topics"
              placeholder="Find a topic…"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
            />
          </ExpandSection>
          <div className="topic-scroll">
            <div className="topic-grid">
              {view.catalog
                .slice()
                .sort((a, b) => {
                  const featured = [
                    "everyday",
                    "food",
                    "animals",
                    "memory",
                    "health",
                    "dating",
                  ];
                  const order = (id: string) => {
                    const i = featured.indexOf(id);
                    return i === -1 ? 6 : i;
                  };
                  return order(a.id) - order(b.id);
                })
                .filter((t) =>
                  t.name.toLowerCase().includes(topicSearch.toLowerCase()),
                )
                .map((t) => (
                  <motion.button
                    whileTap={reduced ? undefined : { scale: 0.975 }}
                    transition={MOTION.press}
                    className={`topic-tile ${selectedTopics.includes(t.id) ? "selected" : ""}`}
                    key={t.id}
                    onClick={() =>
                      setSelectedTopics((old) =>
                        old.includes(t.id)
                          ? old.filter((id) => id !== t.id)
                          : [...old, t.id],
                      )
                    }
                    aria-pressed={selectedTopics.includes(t.id)}
                  >
                    {t.opt_in && <small className="opt-in">Opt-in</small>}
                    {selectedTopics.includes(t.id) && (
                      <span className="topic-check">
                        <SelectionCheck>
                          <CheckStroke size={16} />
                        </SelectionCheck>
                      </span>
                    )}
                    <TopicArt name={t.id === "health" ? "education" : t.icon} />
                    <strong>{t.name}</strong>
                  </motion.button>
                ))}
            </div>
          </div>
          <div className="sticky-actions">
            <p className="muted center">
              {selectedTopics.length} topic
              {selectedTopics.length === 1 ? "" : "s"} selected
            </p>
            <Button
              disabled={busy || !selectedTopics.length}
              onClick={() =>
                execute(async () => {
                  await act("topics", selectedTopics);
                  nav(null);
                })
              }
            >
              Save topics
            </Button>
          </div>
        </>
      );
    if (!view) return null;
    if (disconnected) return reconnect();
    if (view.paused)
      return (
        <>
          <Header title={`Round ${view.round_id} · Paused`} />
          <div className="center-stage">
            <ConnectionArt
              broken={!!view.pause_reason?.includes("disconnect")}
            />
            <h1>A little pause.</h1>
            <p className="muted">{view.pause_reason}</p>
            <p>Your guesses and roles stay private.</p>
          </div>
          {footer(
            view.is_host ? (
              <>
                <Button
                  disabled={busy || activePlayers.some((p) => !p.connected)}
                  onClick={() => send("resume")}
                >
                  Resume round
                </Button>
                <Button
                  kind="outline"
                  onClick={() =>
                    setConfirm({
                      title: "Abandon this round?",
                      body: "No points will be awarded. Earlier scores stay the same.",
                      label: "Return to lobby",
                      action: () =>
                        execute(async () => {
                          await act("abandon");
                          setConfirm(null);
                        }),
                    })
                  }
                >
                  Abandon round
                </Button>
              </>
            ) : (
              <p className="muted center">Waiting for the host.</p>
            ),
          )}
        </>
      );
    if (view.phase === "lobby")
      return (
        <>
          <Header
            right={
              <button
                className="icon-button"
                onClick={askLeave}
                aria-label={view.is_host ? "End party" : "Leave party"}
              >
                <Icon name="logout" />
              </button>
            }
          />
          <div className="lobby-heading">
            <div>
              <h1>{view.name}</h1>
              <p className="network-line">
                <Icon name="wifi" size={18} />
                {view.is_host ? (
                  <>Hosting · {view.wifi}</>
                ) : (
                  <>
                    {view.wifi}
                    <span>·</span>
                    <strong className="lime">Connected</strong>
                  </>
                )}
              </p>
              {view.is_host && (
                <p className="compact">
                  {activePlayers.length} player
                  {activePlayers.length === 1 ? "" : "s"} · 1 imposter
                </p>
              )}
            </div>
            {view.is_host && qr && (
              <button
                className="mini-qr"
                aria-label="Show invitation QR code"
                onClick={() => setShowQr(true)}
              >
                <img src={qr} alt="Party invitation QR code" />
                <small>Scan to join</small>
              </button>
            )}
          </div>
          {playersList()}
          {activePlayers.length < 3 && (
            <p className="muted compact lobby-tip">
              Invite {3 - activePlayers.length} more player
              {3 - activePlayers.length === 1 ? "" : "s"} to start.
            </p>
          )}
          {!view.is_host && (
            <button
              className="topics-summary"
              disabled={!view.is_host}
              onClick={() => {
                setSelectedTopics(view.topics);
                nav("topics");
              }}
            >
              <Icon name="tag" />
              <span>
                <strong>Topics</strong>
                <small>
                  {view.topics
                    .map((id) => view.catalog.find((t) => t.id === id)?.name)
                    .join(" + ")}
                </small>
              </span>
              {view.is_host && <Icon name="chevron" size={20} />}
            </button>
          )}
          {footer(
            view.is_host ? (
              <>
                <Button
                  kind="outline"
                  onClick={() => {
                    setSelectedTopics(view.topics);
                    nav("topics");
                  }}
                >
                  Choose topics
                </Button>
                <Button
                  disabled={
                    busy ||
                    activePlayers.length < 3 ||
                    activePlayers.some((p) => !p.ready || !p.connected)
                  }
                  onClick={() => send("start")}
                >
                  Start round
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={busy}
                  kind={me?.ready ? "outline" : "primary"}
                  onClick={() => send("ready", !me?.ready)}
                >
                  {me?.ready ? (
                    <>
                      <Icon name="check" />
                      You’re ready
                    </>
                  ) : (
                    "I’m ready"
                  )}
                </Button>
                <p className="muted center compact">
                  Waiting for {playerName(view.host_id)} to start.
                </p>
              </>
            ),
          )}
        </>
      );
    if (view.phase === "roles")
      return (
        <>
          <Header
            back={askLeave}
            title={`Round ${view.round_id}${revealed ? ` · ${me?.name}` : ""}`}
            right={
              <button
                className="icon-button"
                onClick={help}
                aria-label="How to play"
              >
                <Icon name="info" size={21} />
              </button>
            }
          />
          {view.role_ready ? (
            <>
              <div className="center-stage">
                <Cards />
                <h1>Your secret is safe.</h1>
                <p className="muted">
                  {view.ready_count} of {activePlayers.length} players ready
                </p>
                <ProgressDots
                  count={activePlayers.length}
                  filled={view.ready_count}
                />
              </div>
              {footer(
                <p className="muted center">
                  Waiting for everyone to check their role.
                </p>,
              )}
            </>
          ) : (
            <>
              <div className={`role-heading ${revealed ? "revealed" : ""}`}>
                {revealed && view.private_role?.imposter && (
                  <span className="role-badge">IMPOSTER</span>
                )}
                <h1 className="role-title">
                  {revealed
                    ? view.private_role?.imposter
                      ? "You are the imposter"
                      : "You are a civilian"
                    : "For your eyes only."}
                </h1>
              </div>
              <motion.div
                className={`role-flip ${view.private_role?.imposter ? "is-imposter" : ""}`}
                animate={{ rotateY: revealed ? 180 : 0 }}
                transition={{
                  duration: reduced ? 0 : MOTION.roleReveal,
                  ease: MOTION.easeOut,
                }}
              >
                <div className="role-front">
                  <Cards />
                  <Icon name="lock" size={34} />
                </div>
                <div className="role-back" aria-hidden={!revealed}>
                  {revealed && (
                    <>
                      <p>
                        {view.private_role?.imposter
                          ? "Your starting hint"
                          : "Your secret word"}
                      </p>
                      <strong
                        className={`secret-word ${(view.private_role?.clue.length || 0) > 14 ? "long-word" : (view.private_role?.clue.length || 0) > 8 ? "medium-word" : ""}`}
                      >
                        {view.private_role?.clue}
                      </strong>
                      <PawStamp />
                    </>
                  )}
                </div>
              </motion.div>
              <p className="muted center role-reminder">
                {revealed
                  ? view.private_role?.imposter
                    ? "Blend in. Keep them guessing."
                    : "Give a clue. Don’t say the word."
                  : "Keep your screen private."}
              </p>
              {footer(
                <Button
                  disabled={busy}
                  onClick={() =>
                    revealed
                      ? execute(async () => {
                          setRevealed(false);
                          await act("role_ready");
                        })
                      : (() => {
                          if (!document.hidden) {
                            document.documentElement.removeAttribute(
                              "data-private-concealed",
                            );
                            setRevealed(true);
                          }
                        })()
                  }
                >
                  {revealed ? "Hide & ready" : "Reveal my role"}
                </Button>,
              )}
            </>
          )}
        </>
      );
    if (view.phase === "discussion")
      return (
        <>
          <Header
            back={askLeave}
            title={`Round ${view.round_id}`}
            right={
              <button
                className="icon-button"
                onClick={help}
                aria-label="How to play"
              >
                <Icon name="info" size={21} />
              </button>
            }
          />
          <h1>
            Who sounds
            <br />
            suspicious?
          </h1>
          <p className="muted">
            Take turns giving clues.
            <br />
            Discuss together.
          </p>
          <Cards className="discussion-art" />
          <p className="starting-name">
            {playerName(view.starting_id)} starts.
          </p>
          {playersList()}
          {footer(
            view.is_host ? (
              <>
                <Button disabled={busy} onClick={() => send("open_vote")}>
                  Open voting
                </Button>
                <Button
                  kind="text"
                  disabled={busy}
                  onClick={() => send("pause")}
                >
                  Pause round
                </Button>
              </>
            ) : (
              <p className="muted center">
                {playerName(view.host_id)} will open voting when you’re ready.
              </p>
            ),
          )}
        </>
      );
    if (view.phase === "voting" || view.phase === "runoff") {
      const runoff = view.phase === "runoff";
      const choices = activePlayers.filter(
        (p) => !runoff || view.candidates.includes(p.id),
      );
      return (
        <>
          <Header
            back={askLeave}
            title={`Round ${view.round_id} · ${runoff ? "Runoff" : "Vote"}`}
          />
          {view.my_vote ? (
            <>
              <div className="center-stage locked">
                <LockedVoteArt />
                <h1>Your vote is locked</h1>
                <p>
                  You voted for{" "}
                  <b className="terra">{playerName(view.my_vote)}</b>.
                </p>
                <p className="muted vote-progress">
                  {view.vote_count} of {activePlayers.length} votes received.
                </p>
                <ProgressDots
                  count={activePlayers.length}
                  filled={view.vote_count}
                  linked
                />
              </div>
              {footer(
                <>
                  <p className="center locked-wait">
                    Waiting for everyone
                    <br />
                    to finish voting…
                  </p>
                  <Button disabled className="waiting-button">
                    Waiting for everyone
                  </Button>
                </>,
              )}
            </>
          ) : (
            <>
              <h1>{runoff ? "One more vote." : "Who is the imposter?"}</h1>
              <p className="muted">
                {runoff
                  ? `${view.candidates.length <= 3 ? new Intl.ListFormat("en").format(view.candidates.map(playerName)) : "The top suspects"} tied. Choose again.`
                  : "Your vote stays private."}
              </p>
              <div className="ballot-list">
                {choices.map((p) => (
                  <motion.button
                    whileTap={
                      p.id === view.my_id || reduced
                        ? undefined
                        : { scale: 0.985 }
                    }
                    transition={MOTION.press}
                    className={`ballot-row ${vote === p.id ? "selected" : ""}`}
                    disabled={busy || p.id === view.my_id}
                    key={p.id}
                    onClick={() => setVote(p.id)}
                    aria-pressed={vote === p.id}
                  >
                    <Avatar player={p} mine={p.id === view.host_id} />
                    <strong>
                      {p.name}
                      {p.id === view.my_id ? " · You" : ""}
                    </strong>
                    <span className="radio-mark">
                      {vote === p.id && (
                        <SelectionCheck>
                          <CheckStroke size={18} />
                        </SelectionCheck>
                      )}
                    </span>
                  </motion.button>
                ))}
              </div>
              {runoff && (
                <p className="muted runoff-note">
                  Your original guess still decides your +1.
                </p>
              )}
              {footer(
                <>
                  <Button
                    disabled={busy || !vote}
                    onClick={() => send("vote", vote)}
                  >
                    Confirm vote
                  </Button>
                  {runoff && (
                    <p className="muted center compact">
                      Another tie? The imposter escapes.
                    </p>
                  )}
                </>,
              )}
            </>
          )}
        </>
      );
    }
    if (view.phase === "results" && view.result) {
      const r = view.result;
      const win = r.earned > 0;
      return (
        <>
          <Header back={askLeave} title={`Round ${view.round_id}`} />
          <motion.div
            className="result-content"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={`result-disc ${win ? "win" : ""}`}>
              <Icon name={win ? "check" : "x"} size={42} />
            </span>
            <h1>
              {r.was_imposter
                ? r.escaped
                  ? "You fooled them."
                  : "You were caught."
                : win
                  ? "You guessed right!"
                  : "You guessed wrong"}
            </h1>
            <div className={`round-points ${win ? "lime" : "terra"}`}>
              +{r.earned} points
            </div>
            <p>
              {r.was_imposter ? (
                r.escaped ? (
                  "You escaped the group vote."
                ) : (
                  "The room found its imposter."
                )
              ) : (
                <>
                  You voted for{" "}
                  <b className={win ? "lime" : "terra"}>
                    {playerName(r.my_vote)}
                  </b>
                  .
                </>
              )}
            </p>
            <div className="result-pair">
              <div>
                <small>Imposter:</small>
                <strong>
                  <Avatar player={person(r.imposter_id)} />
                  {playerName(r.imposter_id)}
                </strong>
              </div>
              <div>
                <small>Secret word:</small>
                <strong>{r.word}</strong>
              </div>
            </div>
            <div className="result-summary">
              {!r.accused_id && (
                <p className="resolution-detail">
                  The runoff tied. No one was accused.
                </p>
              )}
              <p>
                {playerName(r.imposter_id)}{" "}
                {r.escaped
                  ? "escaped the group vote."
                  : "was caught by the group."}
              </p>
              {r.escaped && <strong className="terra">+2 points</strong>}
            </div>
          </motion.div>
          {footer(
            view.is_host ? (
              <Button disabled={busy} onClick={() => send("punish")}>
                Drink or Dare
              </Button>
            ) : (
              <p className="muted center">
                Waiting for {playerName(view.host_id)} to start Drink or Dare.
              </p>
            ),
          )}
        </>
      );
    }
    if (view.phase === "punishment" && view.punishment) {
      const p = view.punishment;
      const mine = p.player_id === view.my_id;
      const recipient = person(p.player_id);
      return (
        <>
          <Header back={askLeave} title="Drink or Dare" />
          <p className="muted center punishment-counter">
            Turn {p.turn} of {p.total}
          </p>
          {!p.choice ? (
            <>
              <h1 className="center">
                {mine
                  ? `${me?.name}, your turn.`
                  : `${recipient?.name}’s turn.`}
              </h1>
              <div className="turn-avatar">
                <Rays />
                <Avatar player={recipient} large mine={mine} />
              </div>
              <p className="muted center">
                {mine
                  ? p.turn === 1
                    ? "The app picked you first."
                    : "The app picked you next."
                  : "Let them choose their fate."}
              </p>
              {footer(
                mine ? (
                  <>
                    <Button
                      className="punishment-option"
                      disabled={busy}
                      onClick={() => send("choice", "drink")}
                    >
                      <Icon name="glass" size={34} />
                      Drink
                    </Button>
                    <Button
                      kind="outline"
                      className="punishment-option"
                      disabled={busy}
                      onClick={() => send("choice", "dare")}
                    >
                      <Icon name="cards" size={34} />
                      Dare
                    </Button>
                    <Button
                      kind="text"
                      disabled={busy}
                      onClick={() => send("skip")}
                    >
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to choose.
                    </p>
                    {view.is_host && !recipient?.connected && (
                      <Button kind="text" onClick={() => send("skip")}>
                        Skip disconnected player
                      </Button>
                    )}
                  </>
                ),
              )}
            </>
          ) : p.choice === "dare" ? (
            <>
              <h1 className="center dare-title">
                <span>
                  {playerName(p.giver_id)} gives {recipient?.name}
                </span>
                <span> a dare.</span>
              </h1>
              <div className="dare-pair">
                <div>
                  <Avatar player={person(p.giver_id)} large />
                  <span>Dare giver</span>
                </div>
                <DareArrow />
                <div>
                  <Avatar player={recipient} large mine={mine} />
                  <span>{mine ? "Your turn" : "Their turn"}</span>
                </div>
              </div>
              <p className="center">
                {playerName(p.giver_id)} makes it up.
                <br />
                The room takes it from here.
              </p>
              {footer(
                mine ? (
                  <>
                    <Button disabled={busy} onClick={() => send("done")}>
                      Done
                    </Button>
                    <Button
                      kind="text"
                      disabled={busy}
                      onClick={() => send("skip")}
                    >
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to finish.
                    </p>
                    {view.is_host &&
                      (!recipient?.connected ||
                        !person(p.giver_id)?.connected) && (
                        <>
                          <Button
                            kind="outline"
                            onClick={() => send("reassign")}
                          >
                            Choose another dare giver
                          </Button>
                          <Button kind="text" onClick={() => send("skip")}>
                            Skip this turn
                          </Button>
                        </>
                      )}
                  </>
                ),
              )}
            </>
          ) : (
            <>
              <h1 className="center">{recipient?.name} chose Drink.</h1>
              <CoffeeCup />
              <h2 className="center">Your drink, your choice.</h2>
              <p className="muted center">Non-alcoholic is welcome.</p>
              {footer(
                mine ? (
                  <>
                    <Button disabled={busy} onClick={() => send("done")}>
                      Done
                    </Button>
                    <Button kind="text" onClick={() => send("skip")}>
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to finish.
                    </p>
                    {view.is_host && !recipient?.connected && (
                      <Button kind="text" onClick={() => send("skip")}>
                        Skip this turn
                      </Button>
                    )}
                  </>
                ),
              )}
            </>
          )}
        </>
      );
    }
    if (view.phase === "rankings" || view.phase === "ended") {
      const ended = view.phase === "ended";
      const sorted = [...view.players].sort(
        (a, b) => b.points - a.points || a.name.localeCompare(b.name),
      );
      const winner = sorted.filter((p) => p.points === sorted[0]?.points);
      return (
        <>
          {ended && <Confetti />}
          <div className="rankings-heading">
            <h1>{ended ? "That’s a wrap." : "The standings"}</h1>
            {!ended && <Icon name="trophy" size={52} className="lime" />}
          </div>
          <p className="muted">
            {ended
              ? `${view.name} · Final rankings`
              : `After round ${view.round_id}`}
          </p>
          <div className="standings">
            {sorted.map((p, i) => {
              const rank = sorted.findIndex((x) => x.points === p.points) + 1;
              return (
                <motion.div
                  layout={!reduced}
                  transition={{ type: "spring", stiffness: 240, damping: 28 }}
                  className="rank-row"
                  key={p.id}
                >
                  <span className={`rank ${i === 0 ? "lime" : ""}`}>
                    {ended && i === 0 ? <Icon name="crown" /> : rank}
                  </span>
                  <Avatar player={p} mine={p.id === view.host_id} />
                  <div className="player-details">
                    <strong>{p.name}</strong>
                    {!ended && (
                      <span>
                        {p.id === view.my_id
                          ? "You" + (view.is_host ? " · Host" : "")
                          : p.left
                            ? "Left party"
                            : !view.result
                              ? "Thanks for playing"
                              : p.id === view.result.imposter_id
                                ? view.result.escaped
                                  ? "Escaped as imposter"
                                  : "Caught as imposter"
                                : p.earned === 2
                                  ? "Escaped as imposter"
                                  : p.earned === 1
                                    ? "Guessed correctly"
                                    : "Guessed wrong"}
                      </span>
                    )}
                  </div>
                  <div className="score">
                    <ScoreValue
                      value={p.points}
                      from={ended ? p.points : Math.max(0, p.points - p.earned)}
                    />
                    {!ended && <small>+{p.earned} this round</small>}
                  </div>
                </motion.div>
              );
            })}
          </div>
          {ended && (
            <h2 className="center party-winner">
              {winner.length === 1
                ? `${winner[0].name} wins the party!`
                : "A shared victory!"}
            </h2>
          )}
          {footer(
            ended ? (
              <Button disabled={busy} onClick={() => execute(close)}>
                Back to home
              </Button>
            ) : view.is_host ? (
              <>
                <Button disabled={busy} onClick={() => send("next")}>
                  Next round
                </Button>
                <Button kind="outline" onClick={askLeave}>
                  End party
                </Button>
              </>
            ) : (
              <p className="muted center">
                Waiting for {playerName(view.host_id)} to choose the next round.
              </p>
            ),
          )}
        </>
      );
    }
    return null;
  }
  const screenKey = booting
    ? "boot"
    : page ||
      (!view
        ? "home"
        : disconnected
          ? "reconnect"
          : view.paused
            ? "paused"
            : `${view.phase}-${view.phase === "punishment" ? `${view.punishment?.turn}-${view.punishment?.choice}` : ""}-${view.phase === "voting" || view.phase === "runoff" ? !!view.my_vote : ""}`);
  const motionKind: ScreenMotion = page
    ? "page"
    : view?.phase === "punishment"
      ? "turn"
      : view?.phase === "runoff"
        ? "runoff"
        : "phase";
  return (
    <div className={`app-shell ${scanning ? "is-scanning" : ""}`}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <ScreenTransition
          key={screenKey}
          className={`screen screen-${disconnected && !page ? "reconnecting" : page || view?.phase || "home"}`}
          direction={direction}
          kind={motionKind}
        >
          {screen()}
        </ScreenTransition>
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.div
            className="error-banner"
            role="alert"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="info" />
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <Icon name="x" size={19} />
            </button>
          </motion.div>
        )}
        {notice && (
          <motion.div
            className="toast"
            role="status"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="check" size={20} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
      {showBusy && (
        <div className="busy-indicator" role="status" aria-label="Working">
          <span className="spinner" />
        </div>
      )}
      <AnimatePresence>
        {showQr && (
          <MotionSheet
            key="invitation"
            labelledBy="invitation-title"
            className="qr-sheet"
            busy={busy}
            onDismiss={() => setShowQr(false)}
          >
            <button
              className="sheet-close icon-button"
              onClick={() => setShowQr(false)}
              aria-label="Close invitation"
            >
              <Icon name="x" />
            </button>
            <h2 id="invitation-title">Bring everyone together</h2>
            <p className="muted">Connect to {view?.wifi}, then scan.</p>
            <img
              src={qr}
              alt="Scan this invitation in IMPOSTER to join the party"
            />
            <Button
              kind="outline"
              onClick={() =>
                execute(async () => {
                  await navigator.clipboard.writeText(credentials!.invitation);
                  setNotice("Invitation copied");
                })
              }
            >
              <Icon name="copy" size={20} />
              Copy invitation
            </Button>
          </MotionSheet>
        )}
        {confirm && (
          <MotionSheet
            key="confirmation"
            labelledBy="confirm-title"
            busy={busy}
            onDismiss={() => setConfirm(null)}
          >
            <h2 id="confirm-title">{confirm.title}</h2>
            <p className="muted">{confirm.body}</p>
            <Button kind="danger" disabled={busy} onClick={confirm.action}>
              {confirm.label}
            </Button>
            <Button
              kind="text"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Keep playing
            </Button>
          </MotionSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
