import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  webGuest,
  entryInvitation,
  persistentResume,
  ApiError,
} from "./api";
import { parseInvitation, androidAppLink } from "./invitation";
import { preferences, requestId } from "./storage";
import type {
  Credentials,
  DeviceStatus,
  Player,
  RecoveryData,
  CastRole,
  RoundOutcome,
  RoundVerdict,
  SessionData,
  Topic,
  View,
} from "./types";
import { Icon } from "./icons";
import { ROUND_RULES, RandomRulesSwitch, RuleArt, RuleIndicator, RuleReveal } from "./round-rules";
import { RoleClue, RoleMeaning } from "./role-meaning";
import { baitDecoy, CAST, CAST_ORDER, CastLineup, castCopy, judgeDoubles, PickChips, RoleBadge, RoleIntel, RoleStage, specials } from "./full-cast";
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
import { play as playSound, playShared, setSound, soundOn, onSoundChange } from "./sound";
import { HandButton, HandSheet, PlayableNudge } from "./cards/Hand";
import { Announcements } from "./cards/Announce";
import { DrawScreen } from "./cards/Draw";
import { centre as fxCentre, flash as fxFlash, ring as fxRing, shake as fxShake, sparks as fxSparks } from "./cards/fx";
import { BountyNote, CardsReplay, cardLineLabel, StandingTags, StoryOfTheNight, WantedPoster } from "./cards/Results";
import {
  BallotCardSlot,
  ballotCardReady,
  CardTextSwitch,
  ColdFeet,
  LastWordScreen,
  PlaysStrip,
  PowerCardsSwitch,
  PublicNotes,
  type BallotCard,
  type Who,
} from "./cards/Round";
import { Art, BookingPhoto, CardBacks, Mugshot, Stamp, TopicEmblem, Type, cardArt } from "./theme";
import {
  Confetti,
  DareArrow,
  Rays,
} from "./illustrations";

type Page =
  | "web_join"
  | "recover"
  | "secret"
  | "home"
  | "create"
  | "host_setup"
  | "scan"
  | "invitation"
  | "wifi"
  | "identity"
  | "topics"
  | "session_setup"
  | "help"
  | "story"
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
const OUTCOME_HEADLINE: Record<RoundOutcome, string> = {
  correct: "You got it",
  wrong: "You guessed wrong",
  escaped: "You escaped",
  caught: "You were caught",
  spotted: "You were spotted",
};
const OUTCOME_CHIP: Record<RoundOutcome, string> = {
  correct: "Got it",
  wrong: "Wrong",
  escaped: "Escaped",
  caught: "Caught",
  spotted: "Spotted",
};
const outcomeHeadline = (o: RoundOutcome, role?: CastRole | null, bait?: boolean) =>
  role === "accomplice" && o === "caught"
    ? "Your imposter was caught"
    : role === "accomplice" && o === "spotted"
      ? "The Detective spotted you"
      : role === "decoy" && o === "spotted"
        ? bait
          ? "The room convicted you"
          : "The imposter spotted you"
        : OUTCOME_HEADLINE[o];
const OUTCOME_STAMP: Record<RoundOutcome, string> = {
  correct: "Correct",
  wrong: "Wrong",
  escaped: "Escaped",
  caught: "Caught",
  spotted: "Spotted",
};
const goodOutcome = (o: RoundOutcome | null | undefined) =>
  o === "correct" || o === "escaped";
const recapItem = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.32, ease: MOTION.easeOut } },
};
const signed = (value: number) =>
  value < 0 ? `−${Math.abs(value)}` : `+${value}`;
function SessionProgress({ score, target }: { score: number; target: number }) {
  return (
    <div className="session-progress">
      <p className="muted compact">
        {score} / {target} · Session target
      </p>
      <progress
        aria-label="Progress toward session target"
        value={Math.min(score, target)}
        max={target}
      />
    </div>
  );
}
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
  return <CardBacks className={`cards-art ${className}`} />;
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
      onClick={
        onClick &&
        (() => {
          onClick();
          // After the tap's own work, so creating audio never delays a transition.
          window.setTimeout(() => playSound("tap"), 0);
        })
      }
    >
      {children}
    </motion.button>
  );
}
function Header({
  title,
  back,
  right,
  notice,
}: {
  title?: string;
  back?: () => void;
  right?: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <>
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
      {notice}
    </>
  );
}
function TopicVoting({
  view,
  busy,
  send,
  leave,
  remove,
  notice,
  settings,
  invitation,
}: {
  view: View;
  busy: boolean;
  send: (kind: string, value?: unknown) => void;
  leave: () => void;
  remove: (player: Player) => void;
  notice: ReactNode;
  settings: ReactNode;
  invitation?: ReactNode;
}) {
  const vote = view.topic_vote!;
  const rule = view.round_rule;
  const nonverbal = rule === "act_it" || rule === "sound_only";
  const reduced = useReducedMotion();
  const draftKey = `imposter.topic-draft.${view.id}.${view.my_id}.${view.round_id}`;
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(preferences.getItem(draftKey) || "[]");
      return Array.isArray(saved)
        ? saved.filter(
            (id): id is string =>
              typeof id === "string" && vote.available_topics.includes(id),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const submitted = vote.my_topics !== null;
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [showResults, submitted]);
  useEffect(() => {
    if (submitted) preferences.removeItem(draftKey);
  }, [submitted, draftKey]);
  const toggle = (id: string) => {
    if (busy || submitted) return;
    setSelected((old) => {
      const next = old.includes(id)
        ? old.filter((t) => t !== id)
        : [...old, id];
      preferences.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  };
  const names = (ids: string[]) =>
    ids
      .map((id) => view.catalog.find((t) => t.id === id)?.name || id)
      .join(" + ");
  const pending = view.players.filter(
    (p) => vote.player_ids.includes(p.id) && !vote.submitted_ids.includes(p.id),
  );
  const controls = pending.filter((p) => p.id !== view.my_id);
  const waiting = (text: string) => <p className="muted center">{text}</p>;
  const pendingList = () => (
    <details className="topic-pending">
      <summary>
        Waiting for {pending.map((p) => p.name).join(", ") || "everyone"}
      </summary>
      {controls.map((p) => (
        <div className="topic-pending-row" key={p.id}>
          <span>
            {p.name}
            {!p.connected ? " · Reconnecting" : " · Not voted"}
          </span>
          {view.is_host && (
            <button
              className="inline-link"
              disabled={busy}
              onClick={() => remove(p)}
            >
              Remove {p.name}
            </button>
          )}
        </div>
      ))}
    </details>
  );
  if (view.phase === "topic_voting") {
    const featured =
      rule === "sound_only"
        ? ["animals", "music", "nature", "travel", "sports", "everyday"]
        : ["everyday", "food", "animals", "nature", "movies", "music"];
    const topics = view.catalog
      .filter((t) => vote.available_topics.includes(t.id))
      .sort((a, b) => {
        const order = (id: string) =>
          featured.includes(id) ? featured.indexOf(id) : 6;
        return order(a.id) - order(b.id);
      })
      .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <Header
          title={`Round ${view.round_id} · Topic vote`}
          back={leave}
          notice={notice}
          right={
            <div className="party-header-actions">
              {!submitted && (
                <button
                  className="icon-button"
                  aria-label={
                    searching ? "Close topic search" : "Search topics"
                  }
                  onClick={() => {
                    setSearching(!searching);
                    setSearch("");
                  }}
                >
                  <Icon name={searching ? "x" : "search"} size={21} />
                </button>
              )}
              {settings}
              {invitation}
            </div>
          }
        />
        {submitted ? (
          <>
            <div className="center-stage topic-locked">
              <LockedVoteArt />
              <h1>Your topics are locked</h1>
              {rule && rule !== "classic" && <RuleIndicator rule={rule} />}
              <p className="muted">You chose {names(vote.my_topics!)}.</p>
              <p>Results appear when everyone votes.</p>
            </div>
            <div className="topic-vote-progress" role="status">
              <ProgressDots
                linked
                count={vote.player_ids.length}
                filled={vote.submitted_ids.length}
              />
              <p className="muted">
                {vote.submitted_ids.length} of {vote.player_ids.length} players
                voted
              </p>
            </div>
            {pendingList()}
            <div className="actions">
              <Button disabled>Waiting for everyone</Button>
            </div>
          </>
        ) : (
          <>
            <h1>What should we play?</h1>
            {rule && rule !== "classic" && <RuleIndicator rule={rule} />}
            <p className="muted topic-ballot-copy">
              {rule === "sound_only"
                ? "Only topics with sound-ready words."
                : rule === "act_it"
                  ? "Only topics with words you can act out."
                  : "Choose one or more topics."}
            </p>
            <ExpandSection open={searching}>
              <input
                className="search-input"
                aria-label="Search topics"
                placeholder="Find a topic…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </ExpandSection>
            <div className="topic-scroll">
              <div className="topic-grid">
                {topics.map((t) => (
                  <motion.button
                    key={t.id}
                    disabled={busy}
                    whileTap={reduced ? undefined : { scale: 0.975 }}
                    transition={MOTION.press}
                    className={`topic-tile ${selected.includes(t.id) ? "selected" : ""}`}
                    aria-pressed={selected.includes(t.id)}
                    onClick={() => toggle(t.id)}
                  >
                    {t.opt_in && <small className="opt-in">Opt-in</small>}
                    {selected.includes(t.id) && (
                      <span className="topic-check">
                        <SelectionCheck>
                          <CheckStroke size={16} />
                        </SelectionCheck>
                      </span>
                    )}
                    <TopicEmblem id={t.id} />
                    <strong>{t.name}</strong>
                  </motion.button>
                ))}
              </div>
              {!topics.length && (
                <p className="muted center">No topics match your search.</p>
              )}
            </div>
            <div className="topic-vote-progress" role="status">
              <ProgressDots
                linked
                count={vote.player_ids.length}
                filled={vote.submitted_ids.length}
              />
              <p className="muted">
                {vote.submitted_ids.length} of {vote.player_ids.length} players
                voted
              </p>
            </div>
            <div className="sticky-actions">
              <p className="muted center">
                {selected.length} topic{selected.length === 1 ? "" : "s"}{" "}
                selected
              </p>
              <Button
                disabled={busy || !selected.length}
                onClick={() => send("topic_vote", selected)}
              >
                Lock my vote
              </Button>
              <p className="muted center topic-footer-note">
                Results appear when everyone votes.
              </p>
            </div>
          </>
        )}
      </>
    );
  }
  const counts = vote.counts || {};
  const leaders = [...vote.leaders].sort(
    (a, b) =>
      view.catalog.findIndex((t) => t.id === a) -
      view.catalog.findIndex((t) => t.id === b),
  );
  const leaderNames = leaders.map(
    (id) => view.catalog.find((t) => t.id === id)?.name || id,
  );
  const leaderText =
    leaderNames.length < 2
      ? leaderNames[0]
      : `${leaderNames.slice(0, -1).join(", ")} and ${leaderNames.at(-1)}`;
  const chosen = view.catalog.find((t) => t.id === vote.selected_topic);
  const tied = vote.leaders.length > 1;
  const chance = Number.isInteger(100 / vote.leaders.length)
    ? `${100 / vote.leaders.length}%`
    : `1 in ${vote.leaders.length}`;
  const countLabel = (id: string) =>
    `${counts[id] || 0} vote${counts[id] === 1 ? "" : "s"}`;
  const result = view.phase === "topic_results" || showResults;
  return (
    <>
      <Header
        title={`Round ${view.round_id} · ${result ? "Topic result" : "Topic chosen"}`}
        back={showResults ? () => setShowResults(false) : leave}
        notice={notice}
        right={
          invitation ? (
            <div className="party-header-actions">
              {settings}
              {invitation}
            </div>
          ) : (
            settings
          )
        }
      />
      {rule && rule !== "classic" && (
        <div className="topic-result-rule">
          <RuleIndicator rule={rule} />
        </div>
      )}
      {result ? (
        <>
          <h1>{tied ? "It’s a tie." : "The votes are in."}</h1>
          <p className="muted topic-result-copy">
            {tied
              ? `${leaderText} lead with ${counts[leaders[0]]} votes each.`
              : `${leaderText} received the most votes.`}
          </p>
          <div className="topic-result-list">
            <div className="topic-leaders">
              {leaders.map((id) => {
                const t = view.catalog.find((t) => t.id === id)!;
                return (
                  <div className="topic-leader" key={id}>
                    <TopicEmblem id={t.id} />
                    <div>
                      <strong>{t.name}</strong>
                      <span>{countLabel(id)}</span>
                    </div>
                    <div className="topic-chance">
                      <strong>{chance}</strong>
                      <span>chance</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.keys(counts).some((id) => !vote.leaders.includes(id)) && (
              <>
                <p className="muted topic-also-title">Also voted</p>
                <div className="topic-also">
                  {Object.keys(counts)
                    .filter((id) => !vote.leaders.includes(id))
                    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
                    .map((id) => (
                      <div key={id}>
                        <strong>{names([id])}</strong>
                        <span>{countLabel(id)}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          <p className="muted center">
            {vote.submitted_ids.length} of {vote.player_ids.length} players
            voted
          </p>
          <p className="muted center compact">
            {tied
              ? "Only tied leaders enter the draw."
              : "The highest-voted topic wins."}
          </p>
          <div className="actions">
            {showResults ? (
              <Button onClick={() => setShowResults(false)}>
                Back to topic
              </Button>
            ) : view.is_host ? (
              <Button disabled={busy} onClick={() => send("draw_topic")}>
                Draw topic
              </Button>
            ) : (
              waiting("Waiting for the host to draw the topic.")
            )}
            <p className="muted center compact">
              {tied
                ? "Equal chance. One draw."
                : "One vote per selected topic."}
            </p>
          </div>
        </>
      ) : chosen ? (
        <>
          <div className="topic-chosen-heading">
            <Type>Tonight’s case</Type>
            <h1>{chosen.name} it is.</h1>
            <p className="muted">The topic for this round.</p>
          </div>
          <motion.div
            className="chosen-topic-card"
            initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: reduced ? 0 : MOTION.roleReveal,
              ease: MOTION.easeOut,
            }}
          >
            <Stamp className="topic-chosen-stamp" slam delay={0.25}>Chosen</Stamp>
            <span className="topic-emblem-frame"><TopicEmblem id={chosen.id} /></span>
            <h2>{chosen.name}</h2>
            <p>
              {countLabel(chosen.id)} ·{" "}
              {tied
                ? vote.leaders.length === 2
                  ? "Won the 50/50 draw"
                  : `Chosen from ${vote.leaders.length} tied topics`
                : nonverbal
                  ? "Most selected"
                  : "Top vote"}
            </p>
          </motion.div>
          <div className="topic-next-copy">
            <h2>Everyone plays this topic.</h2>
            <p className="muted">Your private card comes next.</p>
          </div>
          <div className="actions">
            <Button kind="text" onClick={() => setShowResults(true)}>
              View votes
            </Button>
            {view.deal_error && view.is_host ? (
              <>
                <p role="alert" className="terra">{view.deal_error}</p>
                <Button disabled={busy} onClick={() => send("begin_round")}>Retry deal</Button>
              </>
            ) : waiting(view.players.some((p) => !p.left && !p.connected)
              ? "Waiting for everyone to reconnect."
              : "Dealing private cards…")}
            {nonverbal && (
              <p className="muted center compact">
                {ROUND_RULES[rule].name} stays for the whole round.
              </p>
            )}
            {view.is_host &&
              view.players
                .filter((p) => !p.left && !p.connected && p.id !== view.my_id)
                .map((p) => (
                  <button
                    key={p.id}
                    className="inline-link"
                    disabled={busy}
                    onClick={() => remove(p)}
                  >
                    Remove {p.name}
                  </button>
                ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default function App() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [page, setPage] = useState<Page>(webGuest ? "web_join" : "home");
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
  const [name, setName] = useState(preferences.getItem("imposter.name") || "");
  const [partyName, setPartyName] = useState("Friday night");
  const [wifi, setWifi] = useState("");
  const [invitation, setInvitation] = useState(webGuest ? entryInvitation : "");
  const [details, setDetails] = useState<{
    name: string;
    host_name: string;
    wifi: string;
    phase?: string;
  } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [showTopicSearch, setShowTopicSearch] = useState(false);
  const [editWifi, setEditWifi] = useState(false);
  const [vote, setVote] = useState("");
  const [bet, setBet] = useState(0);
  // Full Cast ballot extras: the imposter names both; the detective may name an accomplice.
  const [accomplicePick, setAccomplicePick] = useState<string | null>(null);
  const [decoyPick, setDecoyPick] = useState<string | null>(null);
  // The round whose party results this player has opened, after their own.
  const [roomSeen, setRoomSeen] = useState<number | null>(null);
  // The round whose Full Cast role screen this player has moved past.
  const [roleSeen, setRoleSeen] = useState<number | null>(null);
  const [targetScore, setTargetScore] = useState(15);
  const [clueEditor, setClueEditor] = useState<{
    round: number;
    turn: number;
    text: string;
    existing: boolean;
  } | null>(null);
  const [reportTargets, setReportTargets] = useState<string[]>([]);
  const [revealRequested, setRevealed] = useState(false);
  const revealRound = useRef<number | null>(null);
  const revealed = revealRequested && revealRound.current === view?.round_id;
  // Power cards: the hand sheet, the card sent with a vote, and the host's
  // OK to open the vote while a clue is still owed.
  const [handOpen, setHandOpen] = useState(false);
  // A new phase is a new screen: the hand closes rather than covering it.
  useEffect(() => setHandOpen(false), [view?.phase, view?.round_id]);
  const [ballotCard, setBallotCard] = useState<BallotCard | null>(null);
  const [confirmOpenVote, setConfirmOpenVote] = useState(false);
  // Block screenshots only while a private card is face up. Browsers cannot
  // block them at all, so this is the installed app only.
  useEffect(() => {
    if (native)
      device(revealed || handOpen ? "secureScreen" : "allowScreenshots").catch(() => {});
  }, [revealed, handOpen]);
  const reviewRound = useRef<number | null>(null);
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [showRoundSettings, setShowRoundSettings] = useState(false);
  const [skipRule, setSkipRule] = useState<boolean | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
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
  const actionAttempt = useRef<{ key: string; id: string } | null>(null);
  const externalHandled = useRef("");
  const [checkingHost, setCheckingHost] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState("");
  const [canResume] = useState(() => !webGuest || persistentResume());
  const [recovery, setRecovery] = useState<{
    name: string;
    code: string;
  } | null>(null);
  const reconnectRequest =
    view?.is_host &&
    view.phase !== "ended" &&
    !showQr &&
    !confirm &&
    !clueEditor
      ? view.reconnect_requests?.[0]
      : undefined;
  useEffect(() => {
    if (view?.is_host && view.reconnect_requests?.length) setShowQr(false);
  }, [view?.reconnect_requests?.[0]?.id]);

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
      setSessionBlocked("");
      setRecovery(null);
      setRevealed(false);
      setError("");
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
  const act = async (
    kind: string,
    value: unknown = null,
    expectedRound?: number,
  ) => {
    if (!current.current) return;
    const roundId = expectedRound ?? current.current.round_id;
    const key = JSON.stringify([roundId, kind, value]);
    if (actionAttempt.current?.key !== key)
      actionAttempt.current = { key, id: requestId() };
    const v = await api<View>("action", {
      session_id: sessionId,
      action: {
        id: actionAttempt.current.id,
        round_id: roundId,
        kind,
        value,
      },
    });
    actionAttempt.current = null;
    accept(v);
  };
  const send = (kind: string, value: unknown = null) =>
    execute(() => act(kind, value));
  useEffect(() => {
    if (
      clueEditor &&
      (view?.phase !== "discussion" ||
        view.round_id !== clueEditor.round ||
        disconnected)
    ) {
      setClueEditor(null);
      if (view?.phase === "voting")
        setNotice("Voting has started. Clues are now read-only.");
    }
  }, [view?.phase, view?.round_id, disconnected, clueEditor?.round]);
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
          if (
            saved.credentials.is_host ||
            (e instanceof ApiError &&
              ["no_player", "invitation_expired", "party_closed"].includes(
                e.code,
              ))
          )
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
    if (!webGuest || booting || page !== "web_join" || sessionId || !invitation)
      return;
    let active = true;
    setCheckingHost(true);
    api<NonNullable<typeof details>>("inspect", { invitation })
      .then((d) => {
        if (active) {
          setDetails(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setCheckingHost(false);
      });
    return () => {
      active = false;
    };
  }, [booting, page, sessionId, invitation]);

  useEffect(() => {
    if (!webGuest || page !== "recover" || !recovery) return;
    let active = true,
      inFlight = false;
    const check = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const result = await api<RecoveryData>("recover", {
          invitation,
          player: recovery.name,
        });
        if (active && result.session) adopt(result.session);
        else if (active && result.code && result.code !== recovery.code)
          setRecovery({ name: recovery.name, code: result.code });
      } catch (e) {
        if (active) {
          if (
            e instanceof ApiError &&
            e.code !== "unreachable" &&
            e.code !== "rate_limit"
          )
            setRecovery(null);
          setError(errorText(e));
        }
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(check, 2000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [page, recovery, invitation, adopt]);

  useEffect(() => {
    if (!native) return;
    const update = () => void refreshDevice();
    window.addEventListener("imposter-invitation", update);
    return () => window.removeEventListener("imposter-invitation", update);
  }, [refreshDevice]);

  useEffect(() => {
    const incoming = status?.invitation;
    if (!incoming) {
      externalHandled.current = "";
      return;
    }
    if (
      !native ||
      booting ||
      busy ||
      !incoming ||
      externalHandled.current === incoming
    )
      return;
    externalHandled.current = incoming;
    void device("consumeInvitation")
      .then(setStatus)
      .catch(() => {});
    try {
      const parsed = parseInvitation(incoming);
      if (current.current?.id === parsed.native.party_id) return;
      if (current.current) {
        setConfirm({
          title: "Join another party?",
          body: "Leave this party before opening the new invitation. Hosting players will end their current party.",
          label: "Leave and continue",
          action: () =>
            execute(async () => {
              if (current.current?.phase !== "ended")
                await act(current.current?.is_host ? "end" : "leave");
              await close();
              setConfirm(null);
              readInvitation(incoming);
            }),
        });
      } else readInvitation(incoming);
    } catch (e) {
      setError(errorText(e));
    }
  }, [status?.invitation, booting, busy]);

  useEffect(() => {
    if (!sessionId || view?.phase === "ended" || sessionBlocked) return;
    let active = true;
    // The host keeps a 9s presence grace before it calls anyone offline, so the
    // player's own screen must not give up first. A phone on a busy Wi-Fi drops
    // the odd request; only a sustained outage is worth interrupting them for.
    let lastOk = Date.now();
    const refresh = async () => {
      if (polling.current) return;
      if (webGuest && document.hidden) return;
      polling.current = true;
      try {
        const v = await api<View>("state", { session_id: sessionId });
        if (active) {
          accept(v);
          setDisconnected(false);
          lastOk = Date.now();
        }
      } catch (e) {
        if (
          active &&
          e instanceof ApiError &&
          ["controller_replaced", "no_player"].includes(e.code)
        ) {
          setSessionBlocked(e.message);
          setDisconnected(true);
          setRevealed(false);
          return;
        }
        if (active && Date.now() - lastOk >= 5000) {
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
    const visibility = () => {
      if (!document.hidden) focus();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sessionId, view?.phase, accept, refreshDevice, sessionBlocked]);

  useEffect(() => {
    setRevealed(false);
    setVote("");
    setBet(0);
    setBallotCard(null);
    setConfirmOpenVote(false);
    setAccomplicePick(null);
    setDecoyPick(null);
    setReportTargets([]);
    setReportOpen(false);
    setSkipRule(null);
    setError("");
  }, [view?.round_id, view?.phase]);
  useEffect(() => {
    if (view?.round_notice) setNotice(view.round_notice);
  }, [view?.round_id, view?.round_notice]);
  useEffect(() => {
    if (
      page === "secret" &&
      (!view?.private_role ||
        disconnected ||
        view.round_id !== reviewRound.current)
    ) {
      document.documentElement.setAttribute("data-private-concealed", "");
      setRevealed(false);
      setPage(null);
    }
  }, [page, view?.round_id, !!view?.private_role, disconnected]);
  useEffect(() => {
    const hide = () => {
      document.documentElement.toggleAttribute(
        "data-motion-paused",
        document.hidden,
      );
      if (document.hidden) {
        document.documentElement.setAttribute("data-private-concealed", "");
        setRevealed(false);
        // The hand is private like the role card: it reopens only on a tap.
        setHandOpen(false);
      } else {
        refreshDevice();
      }
    };
    document.addEventListener("visibilitychange", hide);
    const conceal = () => {
      document.documentElement.setAttribute("data-private-concealed", "");
      setRevealed(false);
      setHandOpen(false);
    };
    window.addEventListener("pagehide", conceal);
    hide();
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", conceal);
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
      if (skipRule !== null || reportOpen) {
        setSkipRule(null);
        setReportOpen(false);
        return;
      }
      if (showRoundSettings) {
        setShowRoundSettings(false);
        return;
      }
      if (clueEditor) {
        setClueEditor(null);
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
          session_setup: null,
          secret: null,
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
    if (
      !confirm &&
      !showQr &&
      !reconnectRequest &&
      !clueEditor &&
      !showRoundSettings && skipRule === null && !reportOpen
    )
      return;
    document.documentElement.setAttribute("data-private-concealed", "");
    setRevealed(false);
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            clueEditor
              ? ".clue-editor input"
              : showRoundSettings
                ? ".round-settings [role=switch]"
                : ".bottom-sheet button",
          )
          ?.focus(),
      60,
    );
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pending.current) return;
        setConfirm(null);
        setShowQr(false);
        setClueEditor(null);
        setSkipRule(null);
        setReportOpen(false);
        setShowRoundSettings(false);
        if (reconnectRequest) send("reject_reconnect", reconnectRequest.id);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          ".bottom-sheet button:not(:disabled), .bottom-sheet input:not(:disabled), .bottom-sheet a[href], .bottom-sheet summary",
        ),
      ].filter((node) => node.getClientRects().length > 0);
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
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [
    confirm,
    showQr,
    reconnectRequest?.id,
    skipRule !== null,
    reportOpen,
    clueEditor?.turn,
    showRoundSettings,
  ]);

  const nav = (p: Page, explicitDirection?: number) => {
    const depth: Record<string, number> = {
      home: 0,
      web_join: 0,
      recover: 1,
      secret: 1,
      create: 1,
      host_setup: 2,
      scan: 1,
      invitation: 2,
      wifi: 3,
      identity: 4,
      topics: 1,
      session_setup: 1,
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
    setPage(webGuest && p === "home" ? "web_join" : p);
    setShowQr(false);
    setShowRoundSettings(false);
  };
  const requestReconnect = async (player: string) => {
    const result = await api<RecoveryData>("recover", { invitation, player });
    if (result.session) adopt(result.session);
    else if (result.code) setRecovery({ name: player, code: result.code });
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
  const who: Who = {
    name: playerName,
    avatar: (id) => <Avatar player={person(id)} mine={id === view?.my_id} />,
  };
  const handButton = view?.cards?.on ? (
    <HandButton view={view} onOpen={() => setHandOpen(true)} />
  ) : null;
  const activePlayers = view?.players.filter((p) => !p.left) || [];
  // Shared sound beats: each plays once per round on every phone, from the
  // same moment the host already times for the screens.
  const sounded = useRef(new Set<string>());
  useEffect(() => {
    if (!view) return;
    const once = (key: string, fn: () => void) => {
      if (sounded.current.has(key)) return;
      sounded.current.add(key);
      fn();
    };
    const round = view.round_id;
    const beat = view.reveal;
    const elapsed = beat ? beat.total_ms - beat.remaining_ms : 0;
    const voters = view.players.filter((p) => !p.left).length;
    if (view.phase === "rule_reveal" && beat?.stage === "shuffle")
      once(`riffle-${round}`, () => playShared("riffle", elapsed));
    if (view.phase === "result_reveal" && beat?.stage === "suspense")
      once(`suspense-${round}`, () => playShared("suspense", elapsed));
    if (view.phase === "result_reveal" && beat?.stage === "verdict" && view.verdict) {
      const { escaped, my_outcome } = view.verdict;
      once(`verdict-${round}`, () => {
        if (elapsed > 300) return;
        playSound(escaped ? "escape" : "gavel");
        // Your own result lands a beat after the room's verdict sound.
        if (my_outcome)
          window.setTimeout(() => playSound(goodOutcome(my_outcome) ? "win" : "lose"), 700);
      });
    }
    if (view.phase === "voting" && view.my_vote && view.vote_count >= voters - 2 && view.vote_count < voters)
      once(`heartbeat-${round}`, () => playSound("heartbeat"));
    if (view.phase === "punishment" && view.punishment && !view.punishment.choice)
      once(`drumroll-${round}-${view.punishment.turn}`, () => playSound("drumroll"));
    if (view.phase === "session_complete")
      once(`celebrate-${view.score_session.number}`, () => playSound("celebrate"));
  }, [view]);
  // Game feel on the round's big beats: the role card flips with a flash and
  // a burst; your own result lands with sparks or a heavy thud.
  useEffect(() => {
    if (!revealed || view?.phase !== "roles") return;
    const t = window.setTimeout(() => {
      const card = document.querySelector(".role-flip");
      const [x, y] = fxCentre(card);
      const imposter = !!view?.private_role?.imposter;
      fxFlash("#fff", 0.35, 240);
      fxRing(x, y, imposter ? "#d98672" : "#f4f1e8", 420, 700);
      fxSparks(x, y, { n: 22, c1: "#f4f1e8", c2: imposter ? "#d98672" : "#d6f56b", spread: 220, dur: 1000 });
      fxShake(undefined, 4, 300);
    }, 230);
    return () => window.clearTimeout(t);
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps
  const resultBeat = view?.phase === "result_reveal" && view.verdict?.my_outcome ? `${view.round_id}-${view.verdict.my_outcome}` : null;
  useEffect(() => {
    if (!resultBeat || !view?.verdict?.my_outcome) return;
    const good = goodOutcome(view.verdict.my_outcome);
    const t = window.setTimeout(() => {
      const [x, y] = fxCentre(document.querySelector(".outcome-art"));
      if (good) {
        fxSparks(x, y, { n: 36, c1: "#f4f1e8", c2: "#d6f56b", spread: 260, dur: 1200 });
        fxRing(x, y, "#d6f56b", 420, 700);
        fxShake(undefined, 5, 320);
      } else {
        fxRing(x, y, "#d98672", 360, 650);
        fxShake(undefined, 8, 380);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [resultBeat]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sound, setSoundState] = useState(soundOn);
  useEffect(() => {
    const off = onSoundChange(setSoundState);
    return () => {
      off();
    };
  }, []);
  const disconnectedPlayers = activePlayers.filter((p) => !p.connected);
  const connectionPaused =
    !!view?.paused && !!view.pause_reason?.includes("disconnected");
  const showPauseScreen = !!view?.paused && !connectionPaused;
  const reviewingCard =
    page === "secret" &&
    !!view?.private_role &&
    view.round_id === reviewRound.current &&
    !disconnected;
  const close = async () => {
    if (sessionId) await api("close", { session_id: sessionId });
    clearSession();
    setSessionId("");
    setCredentials(null);
    current.current = null;
    setView(null);
    setDetails(null);
    setDisconnected(false);
    setSessionBlocked("");
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
  const askAbandon = () => {
    setRevealed(false);
    setShowRoundSettings(false);
    setSkipRule(!!view?.random_rules);
  };
  const confirmRemovePlayer = (player: Player) =>
    setConfirm({
      title: `Remove ${player.name}?`,
      body:
        view?.phase === "lobby"
          ? "They can scan the invitation to join again before a round starts."
          : "They will leave this round. With fewer than three players, everyone returns to the lobby.",
      label: "Remove player",
      action: () =>
        execute(async () => {
          await act("remove", player.id);
          setConfirm(null);
        }),
    });
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
      preferences.setItem("imposter.name", name.trim());
      adopt(s);
    } catch (e) {
      if (useBackground) await device("stopHosting").catch(() => {});
      throw e;
    }
  };
  const readInvitation = (text: string) => {
    const parsed = parseInvitation(text);
    if (scanning) void stopScan();
    setInvitation(parsed.text);
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

  const editClue = (turn: number) => {
    if (!view || view.phase !== "discussion") return;
    const entry = view.clues?.find(
      (c) => c.player_id === view.my_id && c.turn === turn,
    );
    setClueEditor({
      round: view.round_id,
      turn,
      text: entry?.text || "",
      existing: !!entry,
    });
  };
  const clueHistory = (playerId: string, editable = false) => (
    <span className="clue-history">
      {(view?.performed || [])
        .filter((entry) => entry.player_id === playerId)
        .sort((a, b) => a.turn - b.turn)
        .map(({ turn }) =>
          editable ? (
            <button
              key={turn}
              className="clue-entry clue-edit"
              aria-label={`Unmark performed clue for turn ${turn}`}
              disabled={busy || view?.paused}
              onClick={() => send("performed", { turn, performed: false })}
            >
              Turn {turn}: Performed
            </button>
          ) : (
            <span key={turn} className="clue-entry">
              Turn {turn}: Performed
            </span>
          ),
        )}
      {(view?.clues || [])
        .filter((c) => c.player_id === playerId)
        .sort((a, b) => a.turn - b.turn)
        .map((c) =>
          editable ? (
            <button
              key={c.turn}
              className="clue-entry clue-edit"
              aria-label={`Edit my clue for turn ${c.turn}`}
              disabled={busy || view?.paused}
              onClick={() => editClue(c.turn)}
            >
              Turn {c.turn}: {c.text}
              <Icon name="edit" size={15} />
            </button>
          ) : (
            <span key={c.turn} className="clue-entry">
              Turn {c.turn}: {c.text}
            </span>
          ),
        )}
    </span>
  );
  function playersList(showClues = false) {
    // Discussion lists players in the round's speaking order, first speaker on top.
    const order = showClues ? view?.speaking_order ?? null : null;
    const players = order
      ? [...activePlayers].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      : activePlayers;
    return (
      <div className={`players-list ${order ? "speaking" : ""}`}>
        {players.map((p, i) => (
          <motion.div
            className="player-row"
            key={p.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.035 }}
          >
            {order && <span className={`speak-order ${i === 0 ? "first" : ""}`}>{i + 1}</span>}
            <Avatar player={p} mine={p.id === view?.host_id} />
            <div className="player-details">
              <strong>
                {p.name}
                {showClues && p.id === view?.my_id ? " · You" : ""}
                {order && i === 0 && <span className="starts-tag">Starts</span>}
                {!p.connected && (
                  <span className="player-connection-label">Disconnected</span>
                )}
              </strong>
              {!showClues && (
                <span>
                  {p.id === view?.my_id &&
                  p.id !== view?.host_id &&
                  !p.ready ? (
                    "You"
                  ) : (
                    <>
                      {p.id === view?.my_id ? "You · " : ""}
                      {p.id === view?.host_id
                        ? "Host"
                        : !p.connected
                          ? "Waiting to reconnect"
                          : p.ready
                            ? "Ready"
                            : "Not ready yet"}
                    </>
                  )}
                </span>
              )}
              {showClues && clueHistory(p.id, p.id === view?.my_id)}
              {showClues &&
                view &&
                (view.round_rule === "act_it" ||
                  view.round_rule === "sound_only") &&
                p.id === view.my_id &&
                !view.performed?.some(
                  (c) => c.player_id === p.id && c.turn === view.clue_turn,
                ) && (
                  <button
                    className="inline-link add-clue"
                    disabled={busy || view.paused}
                    onClick={() =>
                      send("performed", {
                        turn: view.clue_turn,
                        performed: true,
                      })
                    }
                  >
                    Mark my turn performed
                  </button>
                )}
              {showClues &&
                (!view?.round_rule || view.round_rule === "classic") &&
                p.id === view?.my_id &&
                !view.clues?.some(
                  (c) => c.player_id === p.id && c.turn === view.clue_turn,
                ) && (
                  <button
                    className="inline-link add-clue"
                    disabled={busy || view.paused}
                    onClick={() => editClue(view.clue_turn || 1)}
                  >
                    Add clue for turn {view.clue_turn || 1}
                  </button>
                )}
            </div>
            {p.id === view?.host_id ? (
              <Icon name="crown" className="lime" />
            ) : !p.connected ? (
              <span className="connection-dot offline" />
            ) : view?.phase === "lobby" && p.ready ? (
              <span className="ready-mark" aria-label="Ready">
                <Stamp tone="lime" slam>Ready</Stamp>
              </span>
            ) : null}
            {view?.is_host && p.id !== view.my_id && view.phase === "lobby" && (
              <button
                className="player-manage"
                aria-label={`Manage ${p.name}`}
                onClick={() => confirmRemovePlayer(p)}
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
  const openRoundSettings = () => {
    setError("");
    setRevealed(false);
    setShowRoundSettings(true);
  };
  const kickoffToggle = <RandomRulesSwitch checked={!!view?.random_rules} disabled={busy} toggle={() => send("random_rules", !view?.random_rules)} />;
  const canSkipRound = !!view?.is_host && ["rule_reveal", "topic_voting", "topic_chosen", "roles", "discussion", "voting"].includes(view.phase);
  const settingsButton = view?.is_host ? (
    <button
      className="icon-button"
      aria-label="Session settings"
      onClick={openRoundSettings}
    >
      <Icon name="settings" />
    </button>
  ) : undefined;
  const nonverbal =
    view?.round_rule === "act_it" || view?.round_rule === "sound_only";
  const deckMessage =
    view?.deck_status?.reason === "recent"
      ? "The remaining words are too similar to recent clues."
      : view?.deck_status?.reason === "hints"
        ? "The remaining words need more possible answers for their imposter hints."
        : view?.deck_status?.reason === "incompatible"
          ? "Enable a topic with enough words for this rule."
          : "The enabled topics have used all their fresh words.";
  const invitationButton = view?.is_host ? (
    <button
      className="icon-button"
      aria-label="Show invitation QR code"
      onClick={() => setShowQr(true)}
    >
      <Icon name="qr" />
    </button>
  ) : undefined;
  const hostHeaderActions = view?.is_host ? (
    <div className="party-header-actions">
      {handButton}
      {settingsButton}
      {invitationButton}
    </div>
  ) : undefined;
  const roundHeaderActions = (
    <div className="party-header-actions">
      {handButton}
      {view?.private_role && (view.phase !== "roles" || view.role_ready) && (
        <button
          className="icon-button"
          aria-label="Check my card"
          title="Check my card"
          onClick={() => {
            reviewRound.current = view.round_id;
            setRevealed(false);
            nav("secret");
          }}
        >
          <Icon name="eye" />
        </button>
      )}
      {invitationButton || (
        <button className="icon-button" onClick={help} aria-label="How to play">
          <Icon name="info" size={21} />
        </button>
      )}
    </div>
  );
  const connectionStatus =
    !disconnected &&
    view?.phase !== "ended" &&
    disconnectedPlayers.length > 0 ? (
      <aside
        className="player-connection-notice"
        aria-label="Player connection status"
      >
        <ul role="status" aria-atomic="true">
          {disconnectedPlayers.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <span>Disconnected</span>
            </li>
          ))}
        </ul>
        {connectionPaused && (
          <div className="connection-wait">
            <span>Waiting to continue.</span>
            {view?.is_host && (
              <button
                className="inline-link"
                disabled={busy}
                onClick={askAbandon}
              >
                Skip round
              </button>
            )}
          </div>
        )}
      </aside>
    ) : null;
  // The room's verdict: a burst when the imposter is caught, a quieter slip
  // when they escape. Shared by the reveal fallback and the top of Results.
  const verdictCard = (verdict: RoundVerdict, enter: boolean) => (
    <motion.div
      className={`verdict-card ${verdict.escaped ? "escaped" : "caught"}`}
      initial={enter ? (verdict.escaped ? { rotateY: -70, opacity: 0, x: -18, rotate: -4 } : { rotateY: -70, opacity: 0, scale: 0.94 }) : false}
      animate={{ rotateY: 0, opacity: 1, x: 0, rotate: 0, scale: 1 }}
      transition={{ duration: enter ? MOTION.roleReveal : 0, ease: MOTION.easeOut }}
    >
      <Type className="verdict-label">The verdict</Type>
      <div className="verdict-body">
        <Avatar player={person(verdict.imposter_id)} large />
        <div>
          <h1>{verdict.tied && <>It’s a tie.<br /></>}{playerName(verdict.imposter_id)} {verdict.escaped ? "escaped." : "was caught"}</h1>
          <p className="verdict-role">Imposter</p>
          {verdict.tied && <p className="verdict-tie">No one was accused.</p>}
        </div>
      </div>
      <Stamp tone="red" slam={enter} delay={0.45} className="verdict-stamp">
        {verdict.escaped ? "Escaped" : "Guilty"}
      </Stamp>
    </motion.div>
  );
  const reconnect = () => (
    <>
      <div className="center-stage reconnecting-content">
        <Art name="a4-reconnecting" className="reconnect-art" />
        <h1>Hold that thought.</h1>
        <p>
          Reconnecting to{" "}
          {view?.is_host
            ? "your party"
            : `${playerName(view?.host_id)}’s party`}
          .
        </p>
        <p className="muted">
          {sessionBlocked ||
            "Your place and score stay with the host while this party is running."}
        </p>
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
            disabled={busy || !!sessionBlocked}
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
          {webGuest && sessionBlocked && credentials && (
            <Button
              disabled={busy}
              onClick={() =>
                execute(async () =>
                  adopt(await api<SessionData>("resume", { ...credentials })),
                )
              }
            >
              Reconnect this tab
            </Button>
          )}
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
    if (webGuest && page === "web_join") {
      let parsed: ReturnType<typeof parseInvitation> | null = null;
      try {
        parsed = parseInvitation(invitation);
      } catch {
        /* Explain missing/invalid links below. */
      }
      const saved = storedSession();
      const android = /Android/i.test(navigator.userAgent);
      const joinable =
        details &&
        details.phase !== "ended" &&
        (!details.phase || details.phase === "lobby");
      return (
        <>
          <Header
            title="IMPOSTER"
            right={
              <button
                className="icon-button"
                onClick={help}
                aria-label="How to play"
              >
                <Icon name="info" />
              </button>
            }
          />
          <div className="web-join-heading">
            <Cards />
            <h1>{details?.name || "One room. One secret."}</h1>
            <p className="muted">
              {details
                ? `Hosted by ${details.host_name}`
                : "Your host has the invitation."}
            </p>
          </div>
          <div className="setting-row">
            <Icon name="wifi" />
            <div>
              <strong>
                {details?.wifi ||
                  parsed?.native.wifi ||
                  "Join the host’s Wi-Fi"}
              </strong>
              <span>
                {checkingHost
                  ? "Finding the host…"
                  : details
                    ? "Connected locally · No internet needed"
                    : "Connect to the shared Wi-Fi, then scan the host’s QR."}
              </span>
            </div>
          </div>
          <p className="muted compact web-join-note">
            {details?.phase === "ended"
              ? "This party has ended. Ask the host for a new invitation."
              : details?.phase && details.phase !== "lobby"
                ? "A round is in progress. Returning players can reconnect below. New players join in the lobby."
                : "Closed your browser? Reconnect below to keep your place and score."}
          </p>
          {!canResume && (
            <p className="compact terra">
              Site storage is unavailable. If you close this tab, scan the QR
              again and ask the host to approve your reconnect.
            </p>
          )}
          <p className="muted compact web-privacy">
            Local browser play uses an unencrypted connection. Use Wi-Fi you
            trust.
          </p>
          {footer(
            <>
              {saved && (
                <Button
                  disabled={busy || checkingHost}
                  onClick={() =>
                    execute(async () =>
                      adopt(
                        await api<SessionData>("resume", {
                          ...saved.credentials,
                        }),
                      ),
                    )
                  }
                >
                  Reconnect my player
                </Button>
              )}
              {parsed && details?.phase !== "ended" && (
                <Button
                  kind="text"
                  disabled={busy || checkingHost}
                  onClick={() => nav("recover")}
                >
                  {saved ? "Recover with host approval" : "Reconnect my player"}
                </Button>
              )}
              {android && parsed?.browser && !saved && (
                <a className="button outline" href={androidAppLink(invitation)}>
                  Open in Imposter
                </a>
              )}
              {joinable && !saved ? (
                <Button
                  disabled={busy || checkingHost}
                  onClick={() => nav("identity")}
                >
                  Continue in browser
                </Button>
              ) : (
                parsed &&
                !saved && (
                  <Button
                    kind="outline"
                    disabled={busy || checkingHost}
                    onClick={() =>
                      execute(async () => {
                        setDetails(
                          await api<NonNullable<typeof details>>("inspect", {
                            invitation,
                          }),
                        );
                      })
                    }
                  >
                    {checkingHost ? "Finding the host…" : "Check connection"}
                  </Button>
                )
              )}
            </>,
          )}
        </>
      );
    }
    if (webGuest && page === "recover")
      return (
        <>
          <Header title="Reconnect" back={() => nav("web_join")} />
          <div className="center-stage">
            <Art name="a2-connected" className="reconnect-art" />
            <h1>
              {recovery ? "Check with your host." : "Your place is waiting."}
            </h1>
            {recovery ? (
              <div role="status">
                <p>Ask the host to approve {recovery.name} with this code:</p>
                <strong className="recovery-code">{recovery.code}</strong>
                <p className="muted">
                  Keep this page open. Your role, vote and score return after
                  approval.
                </p>
              </div>
            ) : (
              <>
                <p className="muted">
                  Use the name you joined with. The host will confirm it’s you
                  before restoring your player.
                </p>
                <label className="recovery-name">
                  Your name
                  <input
                    autoComplete="nickname"
                    maxLength={28}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          {footer(
            recovery ? (
              <p className="muted center">Waiting for host approval…</p>
            ) : (
              <Button
                disabled={busy || !name.trim()}
                onClick={() => execute(() => requestReconnect(name.trim()))}
              >
                Request reconnect
              </Button>
            ),
          )}
        </>
      );
    if (page === "story" && view?.cards?.story)
      return (
        <>
          <Header title="Story of the night" back={() => nav(null, -1)} />
          <StoryOfTheNight view={view} who={who} />
          {footer(<Button kind="outline" onClick={() => nav(null, -1)}>Back to the standings</Button>)}
        </>
      );
    if (page === "help")
      return (
        <>
          <Header title="Field guide" back={() => nav(returnPage, -1)} />
          <Art name="a12-field-guide" className="guide-art" />
          <h1>How to play</h1>
          <div className="field-guide">
            {(
              [
                [
                  "The game",
                  "One imposter has a hint, not the word. Clue, argue, vote.",
                  [
                    "Join the same Wi-Fi and be in the same room.",
                    "Check your private role. Civilians see the word. The imposter gets a hint.",
                    "Give clues. Classic uses spoken clues. Act It uses silent movements without spelling or mouthing words. Sound Only uses sounds you make yourself, with no words, lyrics, gestures, or recordings. Talk normally when you discuss suspicions.",
                    "Vote in secret. Everyone votes at the same time.",
                  ],
                ],
                [
                  "The cast",
                  "Everyone has a role, dealt by history. Each scores its own way.",
                  [
                    "Three players: Imposter, Decoy, Gambler. The Judge joins at four, the Accomplice and Detective at five, and every player after that is another Gambler.",
                    "Over a session everyone takes their turn at each role.",
                  ],
                ],
                [
                  "Scoring",
                  "Back your read with your own points. First to the target wins.",
                  [
                    "Civilians can optionally bet up to 3 of their own points. Correct: gain the bet plus +1. Wrong: lose the bet. Your balance stays at 0 or above.",
                    "The host chooses 10–30 points. Highest final score wins when someone reaches the target; tied leaders share the win. A new session resets everyone to 0.",
                    "After each round, report rule-breaking or skip. A majority deducts up to 1 point after the following round, with a minimum balance of 0. Reports clear when a session ends.",
                  ],
                ],
                [
                  "Power cards",
                  "Draw before roles. One card per round. Golden cards change everything.",
                  [
                    "With 6 or more players and power cards on, everyone gets 10 seconds to draw or skip before roles. A draw costs 3 points; Underdogs draw free. Up to 4 paid draws a session.",
                    "Everyone sees who drew. When you play a card, everyone sees your name and its tier, never which card.",
                    "Play one active card per round, in its window: when you see your role, during the discussion, or on your ballot. Passive cards go off on their own if you played no active.",
                    "When two cards clash, Golden beats Rare and Rare beats Common. Same tier: the first one played wins.",
                  ],
                ],
                [
                  "Underdogs & Bounty",
                  "Fall behind and draws are free. Take down the leader for the Bounty.",
                  [
                    "From round 3, anyone a third of the target or more behind the leader is an Underdog: free draws, bets up to 3 whatever your points, and +1 on a winning bet. Lose a bet you couldn’t cover and you drink.",
                    "When the leader loses a round, every Underdog gets the Bounty: +1, growing by 1 each round the leader survives, up to +3.",
                  ],
                ],
                [
                  "Drink or Dare",
                  "Lose the round, face the sentence.",
                  [
                    "Everyone who lost the round chooses Drink or Dare. Non-alcoholic is welcome.",
                    "Then check the standings and keep playing to find a new word.",
                  ],
                ],
              ] as [string, string, string[]][]
            ).map(([title, summary, detail], i) => (
              <details className="guide-entry" key={title}>
                <summary>
                  <Type className="guide-no">{String(i + 1).padStart(2, "0")}</Type>
                  <span>
                    <strong>{title}</strong>
                    <small>{summary}</small>
                  </span>
                  <Icon name="chevron" size={20} />
                </summary>
                <ul>
                  {detail.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <CardTextSwitch />
          <div className="round-settings-toggle guide-sound">
            <strong>Sound on this phone</strong>
            <button
              type="button"
              className="rule-switch"
              role="switch"
              aria-label="Sound"
              aria-checked={sound}
              onClick={() => setSound(!sound)}
            />
          </div>
          {footer(<Button kind="outline" onClick={() => nav(returnPage, -1)}>Close</Button>)}
        </>
      );
    if (page === "home" || (!view && !page))
      return (
        <>
          <div className="welcome">
            <Type className="case-no">Case No. 1.3</Type>
            <Art name="a1-welcome" className="welcome-cast" />
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
              <CardBacks />
            </motion.div>
            <h2>Someone is bluffing.</h2>
            <Type className="welcome-tag">One room. One secret. Trust no one.</Type>
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
          <p className="muted">You’ll host from this phone.</p>
          <form
            className="fill-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !partyName.trim()) return;
              nav("host_setup");
            }}
          >
            <div className="case-form">
            <Stamp>New case</Stamp>
            <Type>Case intake · Host</Type>
            <label>
              <Type>Your name</Type>
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
              <Type>Party name</Type>
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
                <Type>Network</Type>
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
            </div>
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
          <Art name="a2-connected" className="setup-art" />
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
                <Type>Point at the host’s invitation</Type>
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
                maxLength={10000}
                placeholder="Paste the host’s party link or invitation"
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
        label = parseInvitation(invitation).native.wifi;
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
          <Art name="a3-wifi" className="setup-art" />
          <div className="setting-row">
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
                    setNotice("Host reachable on this connection.");
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
          <Header back={() => nav(webGuest ? "web_join" : "wifi")} />
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
          <BookingPhoto
            initials={initials(name || "?")}
            label={`${(name.trim() || "?").toUpperCase()} · ${(details?.name || "").toUpperCase()}`}
          />
          <form
            className="fill-form"
            onSubmit={(e) => {
              e.preventDefault();
              execute(async () => {
                const player = name.trim();
                try {
                  const s = await api<SessionData>("join", { invitation, player });
                  preferences.setItem("imposter.name", player);
                  adopt(s);
                } catch (error) {
                  if (
                    !webGuest ||
                    !(error instanceof ApiError) ||
                    error.code !== "reconnect_required"
                  )
                    throw error;
                  nav("recover");
                  await requestReconnect(player);
                }
              });
            }}
          >
            <label className="booking-name">
              <Type>Your name</Type>
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
    if (page === "session_setup" && view?.is_host && view.phase === "lobby")
      return (
        <>
          <Header
            title="Session setup"
            back={() => nav(null, -1)}
            notice={connectionStatus}
          />
          <h1>Pick a finish line.</h1>
          <p className="muted">First to the target ends this session.</p>
          <div className="session-emblem" aria-hidden="true">
            <Icon name="crown" size={46} />
            <Icon name="eye" size={88} />
          </div>
          <h2>Target score</h2>
          <div
            className="target-options"
            role="group"
            aria-label="Session target score"
          >
            {[10, 15, 20, 25, 30].map((target) => (
              <motion.button
                key={target}
                className={targetScore === target ? "selected" : ""}
                aria-pressed={targetScore === target}
                aria-label={`${target} points`}
                whileTap={reduced ? undefined : { scale: 0.975 }}
                transition={MOTION.press}
                disabled={busy || view.score_session.started}
                onClick={() => setTargetScore(target)}
              >
                {target}
                {targetScore === target && (
                  <SelectionCheck>
                    <CheckStroke size={20} />
                  </SelectionCheck>
                )}
              </motion.button>
            ))}
          </div>
          <p className="muted center compact">points</p>
          <div className="session-rules">
            <p>
              <Icon name="trophy" /> Fresh scores every session.
            </p>
            <p>
              <Icon name="eye" /> Optional bets use your own points.
            </p>
          </div>
          <p className="center">
            {activePlayers.filter((p) => p.connected).length} player
            {activePlayers.filter((p) => p.connected).length === 1
              ? ""
              : "s"}{" "}
            connected
          </p>
          <div className="session-avatars" aria-hidden="true">
            {activePlayers.map((p) => (
              <Avatar key={p.id} player={p} mine={p.id === view.host_id} />
            ))}
          </div>
          {footer(
            <>
              <Button
                disabled={busy || view.score_session.started}
                onClick={() =>
                  execute(async () => {
                    await act("session_target", targetScore, view.round_id);
                    nav(null, -1);
                  })
                }
              >
                Save target
              </Button>
              <p className="muted center compact">
                Session {view.score_session.number} · Locks when the first round
                starts.
              </p>
            </>,
          )}
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
          <h1>Available topics</h1>
          <p className="muted">
            Choose which topics everyone can vote for. Opt-in packs are clearly
            marked.
          </p>
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
                    <TopicEmblem id={t.id} />
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
    if (showPauseScreen && !reviewingCard)
      return (
        <>
          <Header
            title={`Round ${view.round_id} · Paused`}
            right={
              view.is_host ? (
                <div className="party-header-actions">
                  {settingsButton}
                  {roundHeaderActions}
                </div>
              ) : (
                roundHeaderActions
              )
            }
          />
          <div className="center-stage">
            <Art
              name={view.pause_reason?.includes("disconnect") ? "a4-reconnecting" : "a2-connected"}
              className="reconnect-art"
            />
            <h1>A little pause.</h1>
            <p className="muted">{view.pause_reason}</p>
            <p>Your guesses and roles stay private.</p>
            {view.is_host && (
              <p className="muted compact">
                Returning players can scan the QR to reconnect with their
                original role and score.
              </p>
            )}
          </div>
          {footer(
            view.is_host ? (
              <>
                <Button
                  disabled={
                    busy ||
                    view.pause_reason?.startsWith("A player left.") ||
                    activePlayers.some((p) => !p.connected)
                  }
                  onClick={() => send("resume")}
                >
                  Resume round
                </Button>
                <Button kind="outline" onClick={askAbandon}>
                  Skip round
                </Button>
              </>
            ) : (
              <p className="muted center">Waiting for the host.</p>
            ),
          )}
        </>
      );
    if (view.phase === "rule_reveal" && view.round_rule) {
      return (
        <>
          <Header
            title={`Round ${view.round_id} · Round rule`}
            back={view.is_host ? askAbandon : askLeave}
            notice={connectionStatus}
            right={hostHeaderActions}
          />
          <RuleReveal rule={view.round_rule} reveal={view.reveal} />
        </>
      );
    }
    if (
      ["topic_voting", "topic_results", "topic_chosen"].includes(view.phase) &&
      view.topic_vote
    )
      return (
        <TopicVoting
          key={`${view.id}-${view.round_id}`}
          view={view}
          busy={busy}
          send={send}
          leave={view.is_host ? askAbandon : askLeave}
          notice={connectionStatus}
          settings={settingsButton}
          invitation={
            activePlayers.some((p) => !p.connected)
              ? invitationButton
              : undefined
          }
          remove={confirmRemovePlayer}
        />
      );
    if (view.phase === "lobby")
      return (
        <>
          <Header
            notice={connectionStatus}
            right={
              <div className="party-header-actions">
                {settingsButton}
                <button
                  className="icon-button"
                  onClick={askLeave}
                  aria-label={view.is_host ? "End party" : "Leave party"}
                >
                  <Icon name="logout" />
                </button>
              </div>
            }
          />
          <div className="lobby-heading">
            <div>
              <Type>
                Case ·{" "}
                {view.is_host
                  ? `Cast of ${activePlayers.length}`
                  : "The suspects"}
              </Type>
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
                  {activePlayers.length === 1 ? "" : "s"} ·{" "}
                  {/* Gamblers count as one role, when the size deals any. */}
                  {specials(activePlayers.length).length +
                    Number(activePlayers.length >= 3 && activePlayers.length > specials(activePlayers.length).length)}{" "}
                  roles
                </p>
              )}
            </div>
            {view.is_host && qr && (
              <button
                className="lobby-invitation inline-link"
                aria-label="Show invitation QR code"
                onClick={() => setShowQr(true)}
              >
                <Icon name="qr" size={21} />
                Show invitation
              </button>
            )}
          </div>
          <button
            className="session-target-summary"
            disabled={busy || !view.is_host || view.score_session.started}
            onClick={() => {
              setTargetScore(view.score_session.target);
              nav("session_setup");
            }}
          >
            <Icon name="trophy" size={22} />
            <span>
              Session {view.score_session.number} · First to{" "}
              {view.score_session.target}
            </span>
            {view.is_host && !view.score_session.started && (
              <Icon name="edit" size={20} />
            )}
          </button>

          {playersList()}
          {activePlayers.length >= 3 && <CastLineup players={activePlayers.length} />}
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
                <strong>Topic voting</strong>
                <small>
                  {view.topics.length} topics available · Everyone votes before
                  each round
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
                  {view.deck_status?.reason
                    ? "Enable more topics"
                    : "Topic settings"}
                </Button>
                {kickoffToggle}
                <PowerCardsSwitch view={view} send={send} busy={busy} />
                {view.deck_status?.reason ? (
                  <>
                    <p className="muted center" role="status">
                      {deckMessage}
                    </p>
                    <Button onClick={openRoundSettings}>
                      Word deck settings
                    </Button>
                  </>
                ) : (
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
                )}
                {view.random_rules && !view.deck_status?.reason && (
                  <p className="center muted compact">
                    The rule comes before topic voting.
                  </p>
                )}
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
    // A drawer still reading their card stays on it while the table moves on
    // to roles; they follow when they tap Continue.
    const drawPending =
      !!view.cards?.active &&
      view.phase === "roles" &&
      !!view.cards.draw &&
      view.cards.mine.hand.some((h) => h.new) &&
      !view.cards.draw.ready.includes(view.my_id);
    if ((view.phase === "draw" || drawPending) && view.cards)
      return (
        <>
          <Header
            notice={connectionStatus}
            back={askLeave}
            title={`Round ${view.round_id} · Draw`}
            right={view.is_host ? hostHeaderActions : roundHeaderActions}
          />
          <DrawScreen view={view} send={send} busy={busy} who={who} />
        </>
      );
    if (view.phase === "last_word")
      return (
        <>
          <Header notice={connectionStatus} back={askLeave} title={`Round ${view.round_id} · Results`} />
          <LastWordScreen view={view} send={send} busy={busy} who={who} />
        </>
      );
    if (view.phase === "roles" || reviewingCard)
      return (
        <>
          <Header
            notice={connectionStatus}
            back={reviewingCard ? () => nav(null, -1) : askLeave}
            title={`Round ${view.round_id}${revealed ? ` · ${me?.name}` : ""}`}
            right={
              reviewingCard
                ? invitationButton
                : view.is_host && !view.role_ready
                  ? hostHeaderActions
                  : roundHeaderActions
            }
          />
          {!reviewingCard && view.role_ready && <PlayableNudge view={view} onOpen={() => setHandOpen(true)} />}
          {nonverbal && view.round_rule && (
            <RuleIndicator rule={view.round_rule} />
          )}
          {!reviewingCard && !revealed && !view.role_ready && view.topic_vote?.selected_topic && (
            <div className="dealt-topic center">
              <strong>{view.round_rule && ROUND_RULES[view.round_rule].name} · {view.catalog.find((topic) => topic.id === view.topic_vote?.selected_topic)?.name}</strong>
              {view.topic_vote.leaders.length > 1 && <p className="muted compact">Picked from a tie</p>}
              {view.topic_vote.counts && <details>
                <summary>View topic votes</summary>
                <ul>{Object.entries(view.topic_vote.counts).sort((a, b) => b[1] - a[1]).map(([id, count]) => (
                  <li key={id}>{view.catalog.find((topic) => topic.id === id)?.name} · {count}</li>
                ))}</ul>
              </details>}
            </div>
          )}
          {view.role_ready && !reviewingCard ? (
            <>
              <div className="center-stage">
                <div className="sealed-back">
                  <CardBacks count={1} />
                  <Stamp tone="lime" slam delay={0.2}>Sealed</Stamp>
                </div>
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
          ) : revealed && view.private_role?.role && !reviewingCard && roleSeen !== view.round_id ? (
            // Full Cast: the role lands first, so players can plan their act
            // before the word or hint.
            <>
              <RoleStage role={view.private_role.role} players={activePlayers.length} />
              {footer(
                <Button onClick={() => setRoleSeen(view.round_id)}>
                  {view.private_role.imposter
                    ? "See my hint"
                    : view.private_role.role === "decoy" && !baitDecoy(activePlayers.length)
                      ? "See my decoy word"
                      : "See my word"}
                </Button>,
              )}
            </>
          ) : (
            <>
              <div className={`role-heading ${revealed ? "revealed" : ""}`}>
                {revealed && view.private_role?.role ? (
                  <RoleBadge role={view.private_role.role} />
                ) : revealed && view.private_role?.imposter && (
                  <span className="role-badge">IMPOSTER</span>
                )}
                <h1 className={`role-title ${revealed && view.private_role?.role ? "cast-title" : ""}`}>
                  {revealed
                    ? view.private_role?.role
                      ? CAST[view.private_role.role].title
                      : view.private_role?.imposter
                        ? "You are the imposter"
                        : "You are a civilian"
                    : "For your eyes only."}
                </h1>
              </div>
              <motion.div
                className={`role-flip ${view.private_role?.imposter ? "is-imposter" : ""}`}
                // After the role screen the card still flips in, rather than appearing turned.
                initial={view.private_role?.role ? { rotateY: 0 } : false}
                animate={{ rotateY: revealed ? 180 : 0 }}
                transition={{
                  duration: reduced ? 0 : MOTION.roleReveal,
                  ease: MOTION.easeOut,
                }}
              >
                <div className="role-front">
                  <CardBacks count={1} />
                  <Stamp className="role-front-stamp">Top secret</Stamp>
                </div>
                <div className="role-back" aria-hidden={!revealed}>
                  {revealed && view.private_role && (
                    <Stamp className="role-back-stamp">
                      {view.private_role.imposter ? "Forged" : "Eyes only"}
                    </Stamp>
                  )}
                  {revealed && view.private_role && (
                    !view.private_role.imposter && view.private_role.definition ? (
                      <RoleMeaning
                        key={view.round_id}
                        word={view.private_role.clue}
                        definition={view.private_role.definition}
                        label={view.private_role.role === "decoy" && !baitDecoy(activePlayers.length) ? "Your decoy word" : undefined}
                      />
                    ) : (
                      <RoleClue
                        clue={view.private_role.clue}
                        imposter={view.private_role.imposter}
                      />
                    )
                  )}
                </div>
              </motion.div>
              {revealed && view.private_role?.role && (
                <RoleIntel
                  role={view.private_role.role}
                  name={playerName}
                  players={activePlayers.length}
                  imposterId={view.private_role.imposter_id ?? undefined}
                  clearedId={view.private_role.cleared_id ?? undefined}
                />
              )}
              <p className="muted center role-reminder">
                {revealed && view.private_role?.role
                  ? castCopy(view.private_role.role, activePlayers.length).reminder
                  : revealed
                  ? view.private_role?.imposter
                    ? "Blend in. Keep them guessing."
                    : "Give a clue. Don’t say the word."
                  : "Keep your screen private."}
              </p>
              {footer(
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (!revealed) {
                      if (!document.hidden) {
                        document.documentElement.removeAttribute(
                          "data-private-concealed",
                        );
                        revealRound.current = view.round_id;
                        setRevealed(true);
                      }
                    } else if (reviewingCard) {
                      nav(null, -1);
                    } else {
                      void execute(async () => {
                        setRevealed(false);
                        if (!current.current?.paused) await act("role_ready");
                      });
                    }
                  }}
                >
                  {revealed
                    ? reviewingCard
                      ? "Hide & return"
                      : view.paused
                        ? "Hide my role"
                        : "Hide & ready"
                    : "Reveal my role"}
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
            notice={connectionStatus}
            back={askLeave}
            title={`Round ${view.round_id} · Turn ${view.clue_turn || 1}`}
            right={roundHeaderActions}
          />
          <PlayableNudge view={view} onOpen={() => setHandOpen(true)} />
          <PlaysStrip view={view} who={who} />
          <div className="clue-discussion-heading">
            <h1>
              Who sounds
              <br />
              suspicious?
            </h1>
            <Cards className="discussion-art" />
          </div>
          {nonverbal && view.round_rule ? (
            <div className="clue-rule">
              <h2 className="lime">{ROUND_RULES[view.round_rule].name}</h2>
              <p className="muted">
                {view.round_rule === "sound_only"
                  ? "Sounds for clues. Talking for discussion."
                  : "Silent actions for clues. Talking for discussion."}
              </p>
            </div>
          ) : (
            <p className="muted">Need more clues? Keep talking.</p>
          )}
          {view.round_rule && ["two_truths", "if_it_could_talk", "sell_it"].includes(view.round_rule) && (
            <div className="spoken-rule-reminder">
              <Icon name="chat" />
              <div>
                <strong>{ROUND_RULES[view.round_rule].name}</strong>
                <p>{ROUND_RULES[view.round_rule].instruction}</p>
                {view.round_rule === "sell_it" && <p className="muted">{ROUND_RULES.sell_it.detail}</p>}
              </div>
            </div>
          )}
          <div className="clue-board-heading">
            <h2>{view.speaking_order ? "Speaking order" : "Clues by turn"}</h2>
            <p className="muted compact">
              {nonverbal
                ? "Marking a turn is optional."
                : "Clues optional · clear next round."}
            </p>
          </div>
          <PublicNotes view={view} who={who} />
          {playersList(true)}
          {footer(
            view.is_host ? (
              <>
                <Button
                  kind="outline"
                  disabled={busy || view.paused}
                  onClick={() => send("next_clue_turn", view.clue_turn)}
                >
                  Another clue turn
                </Button>
                {confirmOpenVote && !!view.cards?.owed.length && (
                  <p className="muted center compact" role="status">
                    {view.cards.owed.map(playerName).join(", ")} still owes a clue.
                  </p>
                )}
                <Button
                  disabled={busy || view.paused}
                  onClick={() => {
                    // Put on the Spot: an owed clue asks the host once.
                    if (view.cards?.owed.length && !confirmOpenVote) {
                      setConfirmOpenVote(true);
                      return;
                    }
                    send("open_vote", view.cards?.owed.length ? { confirm: true } : null);
                  }}
                >
                  {confirmOpenVote && view.cards?.owed.length ? "Open voting anyway" : "Open voting"}
                </Button>
                <div className="round-secondary-actions">
                  <Button
                    kind="text"
                    disabled={busy || view.paused}
                    onClick={() => send("pause")}
                  >
                    Pause round
                  </Button>
                  <Button kind="text" onClick={openRoundSettings}>
                    Session settings
                  </Button>
                </div>
              </>
            ) : (
              <p className="muted center">
                {playerName(view.host_id)} will open voting when you’re ready.
              </p>
            ),
          )}
        </>
      );
    if (view.phase === "voting") {
      const choices = activePlayers.filter((p) => p.id !== view.my_id);
      const castRole = view.private_role?.role;
      // The imposter's dummy accusation is their accomplice pick, where the
      // size deals an accomplice at all.
      const crewBallot = castRole === "imposter" && !baitDecoy(activePlayers.length);
      const detective = castRole === "detective";
      const cleared = detective ? view.private_role?.cleared_id ?? null : null;
      const myPicks = view.betting.my_picks;
      const topPayout = view.betting.top_payout ?? 3;
      const stakeLabel = (stake: number) =>
        stake === 0 ? "No bet" : topPayout > 3 ? (stake === 3 ? `+${topPayout}/−3` : `±${stake}`) : String(stake);
      const betTitle = castRole ? CAST[castRole].bet : view.private_role?.imposter ? "Bet on your escape" : "Confidence bet";
      const win = (stake: number) => (stake === 3 ? topPayout : stake);
      const ready = crewBallot
        ? !!accomplicePick && !!decoyPick
        : detective
          ? !!vote && !!accomplicePick
          : !!vote;
      const heading = crewBallot ? "Find your crew" : castRole === "accomplice" ? "Who takes the fall?" : "Who is the imposter?";
      return (
        <>
          <Header
            back={askLeave}
            title={`Round ${view.round_id} · Vote`}
            right={
              view.is_host ? (
                <div className="party-header-actions">
                  {settingsButton}
                  {roundHeaderActions}
                </div>
              ) : (
                roundHeaderActions
              )
            }
            notice={connectionStatus}
          />
          <PlaysStrip view={view} who={who} />
          {view.my_vote ? (
            <>
              <div className="center-stage locked">
                <Type className="evidence-label">Evidence submitted</Type>
                <LockedVoteArt />
                <h1>Your vote is locked</h1>
                {crewBallot && myPicks ? (
                  <dl className="locked-picks">
                    <div><dt><Icon name="people" size={18} />Accomplice</dt><dd>{playerName(myPicks.accomplice)}</dd></div>
                    <div><dt><Icon name="shuffle" size={18} />Decoy</dt><dd>{playerName(myPicks.decoy)}</dd></div>
                  </dl>
                ) : detective && myPicks?.accomplice ? (
                  <dl className="locked-picks">
                    <div><dt><Icon name="eye" size={18} />Imposter</dt><dd>{playerName(view.my_vote)}</dd></div>
                    <div><dt><Icon name="people" size={18} />Accomplice</dt><dd>{playerName(myPicks.accomplice)}</dd></div>
                  </dl>
                ) : (
                  <p>
                    You voted for{" "}
                    <b className="terra">{playerName(view.my_vote)}</b>.
                  </p>
                )}
                <p className="muted vote-progress">
                  {view.vote_count} of {activePlayers.length} votes received.
                </p>
                {view.betting.my_stake !== null && (
                  <p className="muted compact">
                    {betTitle}:{" "}
                    {view.betting.my_stake ? stakeLabel(view.betting.my_stake) : "No bet"}
                  </p>
                )}
                <ProgressDots
                  count={activePlayers.length}
                  filled={view.vote_count}
                  linked
                />
                {/* Cold Feet sits in view, not below the fold under the envelope. */}
                <ColdFeet view={view} send={send} busy={busy} />
              </div>
              <PublicNotes view={view} who={who} />

              {!!view.clues?.length && (
                <div className="locked-clue-board">
                  <h2>Clues this round</h2>
                  {activePlayers
                    .filter((p) =>
                      view.clues?.some((c) => c.player_id === p.id),
                    )
                    .map((p) => (
                      <div key={p.id}>
                        <strong>{p.name}</strong>
                        {clueHistory(p.id)}
                      </div>
                    ))}
                </div>
              )}
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
              <h1>{heading}</h1>
              {castRole === "accomplice" && (
                <div className="vote-tip">
                  <b>Your vote counts like anyone’s.</b>
                  <p>If the imposter and someone else look neck and neck, your vote on the other player can tip it so the imposter escapes.</p>
                  <p>Careful: an odd vote can give you away.</p>
                </div>
              )}
              <p className="muted">
                {castRole
                  ? castCopy(castRole, activePlayers.length).vote
                  : view.private_role?.imposter
                    ? "Your vote is a dummy vote. It won’t count toward the tally."
                    : "Your vote stays private."}
              </p>
              {!!view.clues?.length && (
                <p className="muted compact clue-readonly">
                  Clues from all turns · read-only
                </p>
              )}
              {crewBallot ? (
                <div className="crew-ballot">
                  <PickChips
                    icon="people"
                    title="Your accomplice?"
                    players={choices}
                    value={accomplicePick}
                    exclude={[decoyPick]}
                    disabled={busy}
                    onPick={setAccomplicePick}
                  />
                  <PickChips
                    icon="shuffle"
                    title="The decoy?"
                    players={choices}
                    value={decoyPick}
                    exclude={[accomplicePick]}
                    disabled={busy}
                    onPick={setDecoyPick}
                  />
                </div>
              ) : (
              <div className="ballot-list lineup">
                {choices.map((p) => (
                  <motion.button
                    whileTap={
                      p.id === view.my_id || p.id === cleared || reduced
                        ? undefined
                        : { scale: 0.985 }
                    }
                    transition={MOTION.press}
                    className={`ballot-row ${vote === p.id ? "selected" : ""}`}
                    disabled={busy || p.id === view.my_id || p.id === cleared}
                    key={p.id}
                    onClick={() => {
                      setVote(p.id);
                      if (accomplicePick === p.id && detective) setAccomplicePick(null);
                    }}
                    aria-pressed={vote === p.id}
                  >
                    <Avatar player={p} mine={p.id === view.host_id} />
                    <span className="ballot-player">
                      <strong>
                        {p.name}
                        {p.id === view.my_id ? " · You" : ""}
                        {p.id === cleared && <span className="cleared-tag">Cleared</span>}
                        {!p.connected && (
                          <span className="player-connection-label">
                            Disconnected
                          </span>
                        )}
                      </strong>
                      {clueHistory(p.id)}
                    </span>
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
              )}
              {detective && (
                <PickChips
                  icon="people"
                  title="Who’s the accomplice?"
                  players={choices}
                  value={accomplicePick}
                  exclude={[vote, cleared]}
                  disabled={busy}
                  onPick={setAccomplicePick}
                />
              )}
              {view.betting.eligible && (
                <section
                  className="confidence-bet"
                  aria-labelledby="bet-heading"
                >
                  <div className="bet-heading">
                    <h2 id="bet-heading">{betTitle}</h2>
                    <span className="muted">Optional</span>
                  </div>
                  <p className="muted compact">
                    Your balance: {me?.points ?? 0} point{me?.points === 1 ? "" : "s"}
                  </p>
                  <div
                    className={`bet-options ${topPayout > 3 ? "gambler" : ""}`}
                    role="group"
                    aria-label={betTitle}
                  >
                    {[0, 1, 2, 3].map((stake) => (
                      <motion.button
                        key={stake}
                        className={bet === stake ? "selected" : ""}
                        aria-pressed={bet === stake}
                        aria-label={
                          stake === 0
                            ? "No bet"
                            : `Bet ${stake} point${stake === 1 ? "" : "s"} to win ${win(stake)}`
                        }
                        aria-describedby="bet-outcome"
                        disabled={
                          busy || view.paused || stake > view.betting.max_stake
                        }
                        onClick={() => {
                          playSound("chip");
                          setBet(stake);
                        }}
                        whileTap={reduced ? undefined : { scale: 0.975 }}
                        transition={MOTION.press}
                      >
                        {stakeLabel(stake)}
                        {stake > view.betting.max_stake && (
                          <Icon name="lock" size={14} />
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <p
                    id="bet-outcome"
                    className="muted compact"
                    aria-live="polite"
                  >
                    {castRole
                      ? bet > 0
                        ? `Win +${win(bet)} · Lose −${bet}`
                        : "No points at risk."
                      : view.private_role?.imposter
                        ? "Escape to win your bet. Get caught and lose it."
                        : bet > 0
                          ? `Correct: +${bet} · Wrong: −${bet}. A correct vote also earns +1.`
                          : "No points at risk. A correct vote earns +1."}
                  </p>
                  {view.betting.max_stake === 0 && (
                    <p className="muted compact">
                      Earn points before placing a bet.
                    </p>
                  )}
                </section>
              )}
              {footer(
                <>
                  <BallotCardSlot
                    view={view}
                    value={ballotCard}
                    onChange={setBallotCard}
                    accused={crewBallot ? accomplicePick : vote}
                    stake={view.betting.eligible ? bet : 0}
                    who={who}
                  />
                  <Button
                    disabled={busy || view.paused || !ready || !ballotCardReady(ballotCard)}
                    onClick={() =>
                      execute(async () => {
                        await act(
                          "vote",
                          {
                            player_id: crewBallot ? accomplicePick : vote,
                            stake: view.betting.eligible ? bet : 0,
                            ...(crewBallot && { accomplice_id: accomplicePick, decoy_id: decoyPick }),
                            ...(detective && { accomplice_id: accomplicePick }),
                            // A power card rides with the vote.
                            ...(ballotCard && { card: ballotCard }),
                          },
                          view.round_id,
                        );
                        playSound("seal");
                      })
                    }
                  >
                    {bet > 0 && view.betting.eligible
                      ? `Lock vote · Bet ${bet}`
                      : "Confirm vote"}
                  </Button>
                </>,
              )}
            </>
          )}
        </>
      );
    }
    if (view.phase === "result_reveal") {
      const verdict = view.verdict;
      const mine = verdict?.my_outcome;
      // Rejoining near the end of a beat shows it at rest rather than replaying.
      const enter = !reduced && visible && (view.reveal?.remaining_ms ?? 0) >= 450;
      return (
        <>
          <Header title={`Round ${view.round_id} · Results`} back={askLeave} />
          {verdict && mine ? (
            // Everyone looks at their own result first; the room's opens later.
            <div className="personal-stage center-stage" aria-live="polite">
              <motion.div
                className={`outcome-art ${goodOutcome(mine) ? "win" : ""}`}
                initial={enter ? { scale: 0.8, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={MOTION.select}
              >
                <Art name={`a8-${mine}`} />
                <Stamp tone={goodOutcome(mine) ? "lime" : "red"} slam={enter} delay={0.35}>
                  {OUTCOME_STAMP[mine]}
                </Stamp>
              </motion.div>
              <motion.h1
                initial={enter ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: MOTION.easeOut, delay: enter ? 0.12 : 0 }}
              >
                {outcomeHeadline(mine, verdict.my_role, baitDecoy(activePlayers.length))}
              </motion.h1>
              {verdict.my_delta != null && (
                <div className={`round-points ${verdict.my_delta > 0 ? "lime" : "terra"}`}>
                  <ScoreValue value={verdict.my_delta} from={enter ? 0 : verdict.my_delta} signed delay={enter ? 0.3 : 0} />{" "}
                  {Math.abs(verdict.my_delta) === 1 ? "point" : "points"}
                </div>
              )}
            </div>
          ) : verdict ? (
            <div className="verdict-stage center-stage" aria-live="polite">
              {verdictCard(verdict, enter)}
            </div>
          ) : (
            <div className="result-suspense center-stage is-waiting" aria-live="polite">
              <h1>The votes are in.</h1>
              <LockedVoteArt />
              <p className="muted">{view.vote_count} of {view.vote_count} votes locked</p>
              <ProgressDots count={view.vote_count} filled={view.vote_count} linked />
            </div>
          )}
        </>
      );
    }
    if (view.phase === "results" && view.result) {
      const r = view.result;
      const score = r.score;
      const win = score.base > 0;
      const cast = r.cast;
      const myRole = cast?.my_role ?? null;
      const mine = r.outcomes.find((o) => o.player_id === view.my_id)?.outcome ?? null;
      const roleName = (id: string) =>
        cast?.roles[id] ? CAST[cast.roles[id]].name : id === r.imposter_id ? "Imposter" : "Civilian";
      const rank = (id: string) =>
        cast?.roles[id] ? CAST_ORDER.indexOf(cast.roles[id]) : Number(id !== r.imposter_id);
      // Role extras that actually paid this round; a caught imposter gains nothing.
      const bonusRows: [string, boolean][] = !cast || score.voided
        ? []
        : myRole === "imposter"
          ? [["Found your accomplice", r.escaped && cast.pair_bonus], ["Spotted the decoy", r.escaped && cast.decoy_caught]]
          : myRole === "accomplice"
            ? [["Your imposter found you", cast.pair_bonus]]
            : myRole === "detective"
              ? [["Spotted the accomplice", cast.accomplice_caught]]
              : myRole === "decoy"
                ? cast.bait_decoy
                  ? [["They came for you", cast.decoy_voted]]
                  : [["Imposter caught", !r.escaped]]
                : [];
      const net = score.after - score.before;
      const betLabel = myRole ? CAST[myRole].bet : r.was_imposter ? "Escape bet" : "Confidence bet";
      const showRoom = roomSeen === view.round_id || !mine;
      if (!showRoom) {
        // Your own result first, with room to take it in; the party's follows on tap.
        return (
          <>
            <Header
              notice={connectionStatus}
              back={askLeave}
              title={`Round ${view.round_id} · You`}
              right={hostHeaderActions}
            />
            <motion.div
              className="personal-result"
              initial={reduced ? false : "hidden"}
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: 0.09 } } }}
            >
              <motion.div variants={recapItem} className="personal-result-head">
                <div className="result-stamp-row">
                  {mine && (
                    <Stamp tone={goodOutcome(mine) ? "lime" : "red"}>
                      {OUTCOME_STAMP[mine]}
                    </Stamp>
                  )}
                  {myRole && <RoleBadge role={myRole} />}
                </div>
                <h1>{outcomeHeadline(mine, myRole, cast?.bait_decoy)}</h1>
                <div className={`round-points ${net > 0 ? "lime" : net < 0 ? "terra" : "muted"}`}>
                  {net === 0 ? "0" : signed(net)} {Math.abs(net) === 1 ? "point" : "points"}
                </div>
              </motion.div>
              <motion.div variants={recapItem} className="recap-details">
                <dl className="score-breakdown">
                  {!score.voided && <div>
                    <dt>
                      {r.was_imposter
                        ? r.last_word ? "Last Word · named the word" : r.escaped ? "Escaped" : "Caught"
                        : myRole === "accomplice"
                          ? r.escaped ? "Imposter escaped" : "Imposter caught"
                          : <>Voted {playerName(r.my_vote)}{myRole === "judge" && judgeDoubles(activePlayers.length) ? " ×2" : ""}</>}
                    </dt>
                    <dd className={score.base ? "" : "muted"}>{signed(score.base)}</dd>
                  </div>}
                  {score.voided && (
                    <div>
                      <dt>Spotted · no gains</dt>
                      <dd className="terra">0</dd>
                    </div>
                  )}
                  {bonusRows.filter(([, paid]) => paid).map(([label]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>+1</dd>
                    </div>
                  ))}
                  {(score.cards ?? []).map((line, i) => (
                    <div key={`card-${i}`} className="card-line">
                      <dt>{cardLineLabel(line, view.my_id, who)}</dt>
                      <dd className={line.points < 0 ? "terra" : ""}>{signed(line.points)}</dd>
                    </div>
                  ))}
                  {!!score.bluff && (
                    <div>
                      <dt>Nobody voted for you</dt>
                      <dd>+{score.bluff}</dd>
                    </div>
                  )}
                  {(!r.was_imposter || view.betting.my_stake) ? (
                    <div>
                      <dt>{betLabel}</dt>
                      <dd className={score.bet < 0 ? "terra" : score.bet ? "" : "muted"}>
                        {score.bet ? signed(score.bet) : view.betting.my_stake ? "0" : "No bet"}
                      </dd>
                    </div>
                  ) : null}
                  {r.report_round !== null && (
                    <div>
                      <dt>Reports · Round {r.report_round}</dt>
                      <dd className="terra">
                        {score.penalty ? `−${score.penalty}` : "0 · at zero"}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="personal-score">
                  <span>Your score</span>
                  <strong>
                    <span className="muted">{score.before}</span> →{" "}
                    <span className={net < 0 ? "terra" : "lime"}>
                      {score.after}
                    </span>
                  </strong>
                </div>
                <SessionProgress
                  score={score.after}
                  target={view.score_session.target}
                />
              </motion.div>
            </motion.div>
            {footer(
              <Button onClick={() => setRoomSeen(view.round_id)}>See the room</Button>,
            )}
          </>
        );
      }
      return (
        <>
          <Header
            notice={connectionStatus}
            back={askLeave}
            title={`Round ${view.round_id} · Results`}
            right={hostHeaderActions}
          />
          <motion.div
            className="result-content"
            initial={reduced ? false : "hidden"}
            animate="shown"
            variants={{ shown: { transition: { staggerChildren: 0.09 } } }}
          >
            <motion.div variants={recapItem} className="recap-verdict-card">
              {verdictCard(
                { imposter_id: r.imposter_id, escaped: r.escaped, tied: !r.accused_id },
                !reduced && visible,
              )}
            </motion.div>
            <BountyNote view={view} />
            <CardsReplay view={view} who={who} />
            <motion.section
              variants={recapItem}
              className="everyone-results"
              aria-labelledby="everyone-results-title"
            >
              <h2 id="everyone-results-title">Everyone’s results</h2>
              {[...r.outcomes]
                // The imposter leads (then the cast in role order), then the room in its usual order.
                .sort((x, y) => rank(x.player_id) - rank(y.player_id))
                .map((o) => {
                  const good = goodOutcome(o.outcome);
                  const me = o.player_id === view.my_id;
                  return (
                    <div className={`rank-row outcome-row ${me ? "is-me" : ""}`} key={o.player_id}>
                      <Avatar player={person(o.player_id)} />
                      <div className="player-details">
                        <strong>{playerName(o.player_id)}</strong>
                        <span>
                          {roleName(o.player_id)}
                          {me ? " · You" : ""}
                        </span>
                      </div>
                      {o.outcome && (
                        <span className={`outcome-chip ${good ? "good" : "bad"}`}>
                          <Icon name={good ? "check" : "x"} size={14} />
                          {OUTCOME_CHIP[o.outcome]}
                        </span>
                      )}
                      {o.delta != null && (
                        <strong className={`outcome-delta ${o.delta > 0 ? "lime" : o.delta < 0 ? "terra" : "muted"}`}>
                          {o.delta === 0 ? "0" : signed(o.delta)}
                        </strong>
                      )}
                    </div>
                  );
                })}
            </motion.section>
            {cast && (
              <motion.ul variants={recapItem} className="cast-callouts" aria-label="Role moments">
                {cast.judge_tiebreak && <li><Icon name="shield" size={18} />The Judge broke the tie.</li>}
                {Object.values(cast.roles).includes("accomplice") && (
                  <li className={cast.accomplice_caught ? "good" : ""}>
                    <Icon name="search" size={18} />
                    {cast.accomplice_caught
                      ? `The Detective spotted ${playerName(Object.keys(cast.roles).find((id) => cast.roles[id] === "accomplice"))}.`
                      : "The accomplice stayed hidden."}
                  </li>
                )}
                {cast.bait_decoy ? (
                  <li className={cast.roles[r.accused_id ?? ""] === "decoy" ? "bad" : cast.decoy_voted ? "good" : ""}>
                    <Icon name="shuffle" size={18} />
                    {cast.roles[r.accused_id ?? ""] === "decoy"
                      ? "The room convicted the decoy."
                      : cast.decoy_voted ? "The decoy drew a vote." : "Nobody took the decoy’s bait."}
                  </li>
                ) : (
                  <li className={cast.decoy_caught ? "bad" : ""}>
                    <Icon name="shuffle" size={18} />
                    {cast.decoy_caught ? "The imposter spotted the decoy." : "The decoy blended in."}
                  </li>
                )}
                {cast.pair_bonus && <li className="bad"><Icon name="people" size={18} />The imposter found their accomplice.</li>}
              </motion.ul>
            )}
            <motion.div variants={recapItem} className="recap-details">
            <div className="result-pair round-flow-word">
              <div>
                <small>Secret word:</small>
                <strong>{r.word}</strong>
              </div>
              {cast?.decoy_word && (
                <div>
                  <small>Decoy word:</small>
                  <strong>{cast.decoy_word}</strong>
                </div>
              )}
            </div>
            {r.definition && (
              <details className="result-definition" key={view.round_id}>
                <summary>Word meaning</summary>
                <p>{r.definition}</p>
              </details>
            )}
            {view.score_session.complete && (
              <p className="muted compact center">
                Session target reached. Final standings follow reports and Drink
                or Dare.
              </p>
            )}
            </motion.div>
          </motion.div>
          {footer(
            <>
              {view.reporting && (view.reporting.my_reports === null ? (
                <Button kind="text" disabled={busy} onClick={() => { setReportTargets([]); setReportOpen(true); }}>
                  Report a rule violation
                </Button>
              ) : <p className="muted center compact" role="status">Report submitted.</p>)}
              {view.is_host ? (
                <Button disabled={busy} onClick={() => send("punish")}>Continue</Button>
              ) : <p className="muted center compact">Waiting for the host to continue</p>}
            </>,
          )}
        </>
      );
    }
    if (view.phase === "punishment" && view.punishment) {
      const p = view.punishment;
      const mine = p.player_id === view.my_id;
      const recipient = person(p.player_id);
      const skip = () => execute(() => act("skip", p.turn, view.round_id));
      const giverMissing = !person(p.giver_id)?.connected;
      const replaceGiver = view.is_host &&
        recipient?.connected &&
        giverMissing && (
          <Button
            kind="outline"
            disabled={busy}
            onClick={() =>
              execute(() => act("reassign", p.turn, view.round_id))
            }
          >
            Choose another dare giver
          </Button>
        );
      return (
        <>
          <Header
            back={askLeave}
            title="Drink or Dare"
            right={hostHeaderActions}
            notice={connectionStatus}
          />
          <Type className="center punishment-counter">
            Sentencing · Turn {p.turn} of {p.total}
          </Type>
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
                    <div className="punishment-tiles">
                      <Button
                        className="punishment-option"
                        disabled={busy}
                        onClick={() => send("choice", "drink")}
                      >
                        <Art name="a9-drink" />
                        Drink
                      </Button>
                      <Button
                        kind="outline"
                        className="punishment-option"
                        disabled={busy}
                        onClick={() => send("choice", "dare")}
                      >
                        <Art name="a10-dare" />
                        Dare
                      </Button>
                    </div>
                    <Button kind="text" disabled={busy} onClick={skip}>
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to choose.
                    </p>
                    {view.is_host && !recipient?.connected && (
                      <Button kind="text" disabled={busy} onClick={skip}>
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
                  {giverMissing
                    ? "Waiting for the dare giver"
                    : `${playerName(p.giver_id)} gives ${recipient?.name}`}
                </span>
                {!giverMissing && <span> a dare.</span>}
              </h1>
              <div className="dare-pair">
                <Mugshot caption="Dare giver">
                  <Avatar player={person(p.giver_id)} large />
                </Mugshot>
                <DareArrow />
                <Mugshot caption={mine ? "Your turn" : "Their turn"}>
                  <Avatar player={recipient} large mine={mine} />
                </Mugshot>
              </div>
              {!giverMissing && (
                <p className="center">
                  {playerName(p.giver_id)} makes it up.
                  <br />
                  The room takes it from here.
                </p>
              )}
              {footer(
                mine ? (
                  <>
                    {replaceGiver}
                    <Button disabled={busy} onClick={() => send("done")}>
                      Done
                    </Button>
                    <Button kind="text" disabled={busy} onClick={skip}>
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to finish.
                    </p>
                    {view.is_host &&
                      (!recipient?.connected || giverMissing) && (
                        <>
                          {replaceGiver}
                          <Button kind="text" disabled={busy} onClick={skip}>
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
              <Art name="a9-drink" className="drink-art" />
              <h2 className="center">Your drink, your choice.</h2>
              <p className="muted center">Non-alcoholic is welcome.</p>
              {footer(
                mine ? (
                  <>
                    <Button disabled={busy} onClick={() => send("done")}>
                      Done
                    </Button>
                    <Button kind="text" disabled={busy} onClick={skip}>
                      Skip
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted center">
                      Waiting for {recipient?.name} to finish.
                    </p>
                    {view.is_host && !recipient?.connected && (
                      <Button kind="text" disabled={busy} onClick={skip}>
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
    if (["rankings", "session_complete", "ended"].includes(view.phase)) {
      const ended = view.phase === "ended";
      const complete = view.phase === "session_complete";
      const final = ended || complete;
      const sorted = [...view.players].sort(
        (a, b) => b.points - a.points || a.name.localeCompare(b.name),
      );
      const winners = complete
        ? sorted.filter((p) => view.score_session.winner_ids.includes(p.id))
        : sorted.filter((p) => p.points === sorted[0]?.points);
      return (
        <>
          {final && <Confetti />}
          {!ended && (
            <Header
              title={
                complete
                  ? `Session ${view.score_session.number} complete`
                  : "Party"
              }
              right={hostHeaderActions}
              notice={connectionStatus}
            />
          )}
          {complete && (
            <div className="session-victory" aria-hidden="true">
              <Art name="a11-trophy" />
              <Stamp slam delay={0.5}>Case closed</Stamp>
            </div>
          )}
          {complete && (
            <Type className="center victory-line">
              First to {view.score_session.target} · Session {view.score_session.number}
            </Type>
          )}
          <div className="rankings-heading">
            <h1>
              {complete
                ? winners.length === 1
                  ? `${winners[0].name} wins!`
                  : "A shared victory!"
                : ended
                  ? "That’s a wrap."
                  : "The standings"}
            </h1>
            {!final && <Icon name="trophy" size={52} className="lime" />}
          </div>
          <p className="muted">
            {complete
              ? `Target reached · ${view.score_session.target} points`
              : ended
                ? `${view.name} · Final rankings`
                : `Session ${view.score_session.number} · First to ${view.score_session.target}`}
          </p>
          {!final && (
            <SessionProgress
              score={sorted[0]?.points ?? 0}
              target={view.score_session.target}
            />
          )}
          {!final && <WantedPoster view={view} who={who} />}
          <div className="standings">
            {sorted.map((p) => {
              const rank = sorted.findIndex((x) => x.points === p.points) + 1;
              const winning = final && winners.some((w) => w.id === p.id);
              return (
                <motion.div
                  layout={!reduced}
                  transition={{ type: "spring", stiffness: 240, damping: 28 }}
                  className="rank-row"
                  key={p.id}
                >
                  <span className={`rank ${rank === 1 ? "lime" : ""}`}>
                    {winning ? <Icon name="crown" /> : rank}
                  </span>
                  <Avatar player={p} mine={p.id === view.host_id} />
                  <div className="player-details">
                    <strong className={winning ? "lime" : ""}>
                      {p.name}
                      <StandingTags cards={view.cards} id={p.id} />
                    </strong>
                    <span>
                      {p.left
                        ? "Left party"
                        : !p.connected
                          ? "Disconnected"
                          : p.id === view.my_id
                            ? `You${view.is_host ? " · Host" : ""}`
                            : p.id === view.host_id
                              ? "Host"
                              : ""}
                    </span>
                  </div>
                  <div className="score">
                    <ScoreValue
                      value={p.points}
                      from={
                        final
                          ? p.points
                          : p.points - p.earned + p.report_penalty
                      }
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
          {ended && (
            <h2 className="center party-winner">
              {winners.length === 1
                ? `${winners[0].name} wins the party!`
                : "A shared victory!"}
            </h2>
          )}
          {complete && (
            <p className="muted center session-restart-note">
              Next session: everyone starts at 0.
              <br />
              Players stay connected.
            </p>
          )}
          {footer(
            ended ? (
              <>
                {!!view.cards?.story?.plays.length && (
                  <Button onClick={() => nav("story")}>Story of the night</Button>
                )}
                <Button kind={view.cards?.story?.plays.length ? "outline" : "primary"} disabled={busy} onClick={() => execute(close)}>
                  Back to home
                </Button>
              </>
            ) : view.is_host ? (
              <>
                {complete && !!view.cards?.story?.plays.length && (
                  <Button onClick={() => nav("story")}>Story of the night</Button>
                )}
                {!complete && kickoffToggle}
                <Button
                  disabled={busy}
                  onClick={() => send(complete ? "new_session" : "next")}
                >
                  {complete ? "Start next session" : "Next round"}
                </Button>
                <Button kind="outline" disabled={busy} onClick={askLeave}>
                  End party
                </Button>
              </>
            ) : (
              <>
                {complete && !!view.cards?.story?.plays.length && (
                  <Button onClick={() => nav("story")}>Story of the night</Button>
                )}
                <p className="muted center">
                  Waiting for {playerName(view.host_id)} to{" "}
                  {complete ? "start the next session" : "choose the next round"}.
                </p>
              </>
            ),
          )}
        </>
      );
    }
    return null;
  }
  // A drawer still on their card keeps the draw screen's identity when the
  // round moves on to roles, so their card doesn't replay its landing.
  const stillDrawing =
    view?.phase === "roles" &&
    !!view.cards?.active &&
    !!view.cards.draw &&
    view.cards.mine.hand.some((h) => h.new) &&
    !view.cards.draw.ready.includes(view.my_id);
  const screenKey = stillDrawing
    ? "draw--"
    : booting
    ? "boot"
    : page ||
      (!view
        ? "home"
        : disconnected
          ? "reconnect"
          : showPauseScreen
            ? "paused"
            : `${view.phase}-${view.phase === "punishment" ? `${view.punishment?.turn}-${view.punishment?.choice}` : ""}-${view.phase === "reporting" ? view.reporting?.my_reports !== null : view.phase === "voting" ? !!view.my_vote : ""}`);
  const motionKind: ScreenMotion = page
    ? "page"
    : view?.phase === "punishment"
      ? "turn"
          : "phase";
  return (
    <div className={`app-shell ${scanning ? "is-scanning" : ""}`}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <ScreenTransition
          key={screenKey}
          className={`screen screen-${reviewingCard ? "roles" : disconnected && !page ? "reconnecting" : page || view?.phase || "home"}`}
          direction={direction}
          kind={motionKind}
        >
          {screen()}
        </ScreenTransition>
      </AnimatePresence>
      {view?.cards?.active && !page && <Announcements view={view} who={who} />}
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
        {handOpen && view?.cards && (
          <HandSheet key="hand" view={view} send={send} busy={busy} who={who} onClose={() => setHandOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRoundSettings && view?.is_host && view.phase !== "ended" && (
          <MotionSheet
            key="round-settings"
            labelledBy="round-settings-title"
            className="round-settings"
            busy={busy}
            onDismiss={() => setShowRoundSettings(false)}
          >
            <button
              className="sheet-close icon-button"
              aria-label="Close session settings"
              disabled={busy}
              onClick={() => setShowRoundSettings(false)}
            >
              <Icon name="x" />
            </button>
            <h2 id="round-settings-title">{canSkipRound ? "Round settings" : "Session settings"}</h2>
            {canSkipRound && (
              <div className="round-menu-actions">
                {view.phase === "discussion" && !view.paused && (
                  <Button kind="text" disabled={busy} onClick={() => execute(async () => { await act("pause"); setShowRoundSettings(false); })}>Pause round</Button>
                )}
                <Button kind="outline" className="skip-round-menu" disabled={busy} onClick={askAbandon}>Skip round</Button>
                <p className="muted compact">Start a fresh round. Everyone keeps their points.</p>
              </div>
            )}
            <div className="round-settings-toggle">
              <strong>Random round rules</strong>
              <span className="muted" aria-hidden="true">
                {view.random_rules ? "On" : "Off"}
              </span>
              <button
                className="rule-switch"
                role="switch"
                aria-label="Random round rules"
                aria-checked={!!view.random_rules}
                disabled={busy}
                onClick={() => send("random_rules", !view.random_rules)}
              />
            </div>
            <p className="muted">
              {view.random_rules
                ? "A surprise rule before every topic vote."
                : "Upcoming rounds use Classic."}
            </p>
            <PowerCardsSwitch view={view} send={send} busy={busy} />
            {view.round_rule && view.rule_change_pending ? (
              <>
                <div className="round-settings-current">
                  <b>CURRENT ROUND</b>
                  <RuleArt rule={view.round_rule} />
                  <h3>{ROUND_RULES[view.round_rule].name}</h3>
                  <p>This round keeps its rule.</p>
                </div>
                <div className="round-settings-line">
                  <b>Round {view.round_id}</b>
                  <b>{ROUND_RULES[view.round_rule].name}</b>
                </div>
                <div className="round-settings-line">
                  <b>Next round</b>
                  <b className="lime">
                    {view.random_rules ? "Random rule" : "Classic"}
                  </b>
                </div>
                <p className="muted" role="status">
                  Random rules are {view.random_rules ? "on" : "off"} from next
                  round.
                </p>
                <p className="muted">Players, scores, and connections stay.</p>
              </>
            ) : (
              <>
                <h3 className="round-settings-draw-title">
                  {view.random_rules ? "In the draw" : "Available round rules"}
                </h3>
                <ul className="round-settings-rules">
                  {(Object.keys(ROUND_RULES) as Array<keyof typeof ROUND_RULES>).map(
                    (rule) => (
                      <li key={rule}>
                        <RuleArt rule={rule} />
                        <span>
                          <strong>{ROUND_RULES[rule].name}</strong>
                          <small>
                            {rule === "act_it"
                              ? "Silent actions. No sounds."
                              : rule === "sound_only"
                                ? "Make sounds. No words."
                                : ROUND_RULES[rule].short}
                          </small>
                        </span>
                      </li>
                    ),
                  )}
                </ul>
                <p className="muted">Topics match the drawn rule.</p>
                <p className="muted">Changes apply to the next rule draw.</p>
              </>
            )}
            {view.deck_status && (
              <details
                className="round-settings-deck"
                open={view.deck_status.reason ? true : undefined}
              >
                <summary>
                  <strong>Word deck</strong>
                  <span className="muted">
                    {view.deck_status.played} played
                  </span>
                </summary>
                {view.deck_status.reason && (
                  <p className="muted">{deckMessage}</p>
                )}
                <p className="muted">
                  Played words stay out across parties hosted on this device.
                </p>
                <Button
                  kind="outline"
                  disabled={busy || view.deck_status.played === 0}
                  onClick={() => {
                    setShowRoundSettings(false);
                    setConfirm({
                      title: "Start fresh word deck?",
                      body: "Older played words can return. Your players and scores carry over.",
                      label: "Start fresh word deck",
                      action: () =>
                        execute(async () => {
                          await act("fresh_word_deck");
                          setConfirm(null);
                        }),
                    });
                  }}
                >
                  Start fresh word deck
                </Button>
              </details>
            )}
            {error && (
              <p role="alert" className="terra">
                {error}
              </p>
            )}
            <Button disabled={busy} onClick={() => setShowRoundSettings(false)}>
              Done
            </Button>
            {view.random_rules && !view.rule_change_pending && (
              <p className="muted center compact">Your session keeps going.</p>
            )}
          </MotionSheet>
        )}
        {skipRule !== null && canSkipRound && view && (
          <MotionSheet key="skip-round" labelledBy="skip-round-title" busy={busy} onDismiss={() => setSkipRule(null)}>
            <button className="sheet-close icon-button" aria-label="Cancel skip" disabled={busy} onClick={() => setSkipRule(null)}><Icon name="x" /></button>
            <h2 id="skip-round-title">Skip this round?</h2>
            <p className="muted">Everyone keeps their points.</p>
            <RandomRulesSwitch checked={skipRule} disabled={busy} toggle={() => setSkipRule(!skipRule)} />
            {!skipRule && <p className="muted compact">The replacement reveals Classic.</p>}
            {error && <p className="terra" role="alert">{error}</p>}
            <Button disabled={busy} onClick={() => execute(async () => {
              await act("skip_round", skipRule, view.round_id);
              setSkipRule(null);
            })}>Skip and start</Button>
            <Button kind="text" disabled={busy} onClick={() => setSkipRule(null)}>Cancel</Button>
          </MotionSheet>
        )}
        {reportOpen && view?.phase === "results" && view.reporting && (
          <MotionSheet key="report-round" className="complaint-sheet" labelledBy="report-round-title" busy={busy} onDismiss={() => setReportOpen(false)}>
            <button className="sheet-close icon-button" aria-label="Close report" disabled={busy} onClick={() => setReportOpen(false)}><Icon name="x" /></button>
            <Type>Complaint · Round {view.round_id}</Type>
            <h2 id="report-round-title">Report a rule violation</h2>
            <p className="muted">Select one or more players.</p>
            <div className="report-sheet-list" role="group" aria-label="Players to report">
              {view.reporting.player_ids.filter((id) => id !== view.my_id).map((id) => {
                const checked = reportTargets.includes(id);
                return <button key={id} type="button" className="report-sheet-row" role="checkbox" aria-checked={checked} disabled={busy} onClick={() => setReportTargets((current) => checked ? current.filter((id2) => id2 !== id) : [...current, id])}>
                  <span className={`report-sheet-check ${checked ? "checked" : ""}`}>{checked && <Icon name="check" size={16} />}</span>
                  <Avatar player={person(id)} />
                  <strong>{playerName(id)}</strong>
                  {checked && <Stamp slam className="reported-stamp">Reported</Stamp>}
                </button>;
              })}
            </div>
            {error && <p className="terra" role="alert">{error}</p>}
            <Button disabled={busy || !reportTargets.length} onClick={() => execute(async () => {
              await act("report", reportTargets, view.round_id);
              setReportOpen(false);
            })}>Submit report</Button>
          </MotionSheet>
        )}
        {clueEditor && (
          <MotionSheet
            key="clue-editor"
            labelledBy="clue-editor-title"
            className="clue-editor"
            busy={busy}
            onDismiss={() => {
              if (!busy) setClueEditor(null);
            }}
          >
            <button
              className="sheet-close icon-button"
              aria-label="Close clue editor"
              disabled={busy}
              onClick={() => setClueEditor(null)}
            >
              <Icon name="x" />
            </button>
            <h2 id="clue-editor-title">Your clue · Turn {clueEditor.turn}</h2>
            <p className="muted">A word or short phrase you said aloud.</p>
            {(view?.clues || [])
              .filter(
                (c) => c.player_id === view?.my_id && c.turn < clueEditor.turn,
              )
              .map((c) => (
                <p key={c.turn} className="compact">
                  Turn {c.turn}: {c.text}
                </p>
              ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void execute(async () => {
                  await act(
                    "clue",
                    { turn: clueEditor.turn, text: clueEditor.text },
                    clueEditor.round,
                  );
                  setClueEditor(null);
                });
              }}
            >
              <label className="sr-only" htmlFor="clue-text">
                Your clue
              </label>
              <input
                id="clue-text"
                autoComplete="off"
                maxLength={120}
                value={clueEditor.text}
                onChange={(e) =>
                  setClueEditor({ ...clueEditor, text: e.target.value })
                }
                placeholder="A word or short phrase"
                disabled={busy}
              />
              <p className="muted compact">
                {[...clueEditor.text.trim()].length > 60
                  ? "Keep your clue to 60 characters."
                  : "Visible to everyone this round."}
              </p>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !!view?.paused ||
                  !clueEditor.text.trim() ||
                  [...clueEditor.text.trim()].length > 60
                }
              >
                Save clue
              </Button>
            </form>
            {clueEditor.existing && (
              <Button
                kind="text"
                disabled={busy || !!view?.paused}
                onClick={() =>
                  execute(async () => {
                    await act(
                      "clue",
                      { turn: clueEditor.turn, text: "" },
                      clueEditor.round,
                    );
                    setClueEditor(null);
                  })
                }
              >
                Remove this clue
              </Button>
            )}
          </MotionSheet>
        )}
        {reconnectRequest && (
          <MotionSheet
            key="recovery-approval"
            labelledBy="recovery-title"
            busy={busy}
            onDismiss={() => {
              if (!busy) send("reject_reconnect", reconnectRequest.id);
            }}
          >
            <h2 id="recovery-title">Reconnect {reconnectRequest.name}?</h2>
            <p className="muted">
              Confirm this player is with you and their screen shows this code
              before approving. Approving signs out their old browser tab.
            </p>
            <strong className="recovery-code">{reconnectRequest.code}</strong>
            <Button
              disabled={busy}
              onClick={() => send("approve_reconnect", reconnectRequest.id)}
            >
              Approve reconnect
            </Button>
            <Button
              kind="text"
              disabled={busy}
              onClick={() => send("reject_reconnect", reconnectRequest.id)}
            >
              Decline reconnect
            </Button>
          </MotionSheet>
        )}
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
            <p className="muted">Connect to {view?.wifi} first, then scan.</p>
            <img
              src={qr}
              alt="Scan with your phone’s Camera for browser play, or inside Imposter for app play"
            />
            <p className="compact muted qr-guidance">
              Use your phone’s Camera to play in your default browser. Have
              Imposter? Use Join party → Scan invitation in the app. Returning?
              Scan again to restore your player. If your saved place is missing,
              choose Reconnect my player.
            </p>
            <input
              className="invitation-link"
              aria-label="Party link"
              readOnly
              value={credentials?.invitation || ""}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              kind="outline"
              onClick={() =>
                execute(async () => {
                  let copied = false;
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(
                        credentials!.invitation,
                      );
                      copied = true;
                    }
                  } catch {
                    /* A selected text field remains available if clipboard access is denied. */
                  }
                  if (!copied) {
                    const field =
                      document.querySelector<HTMLInputElement>(
                        ".invitation-link",
                      );
                    field?.focus();
                    field?.select();
                    copied = document.execCommand("copy");
                  }
                  setNotice(
                    copied
                      ? "Invitation copied"
                      : "Press and hold the selected link to copy it.",
                  );
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
