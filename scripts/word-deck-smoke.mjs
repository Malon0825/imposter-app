import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const folder = await mkdtemp(join(tmpdir(), "imposter-word-deck-"));
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolveClose) => listener.close(resolveClose));
const base = `http://127.0.0.1:${port}/api/`;
const binary = resolve(
  "target/debug",
  process.platform === "win32" ? "party-dev.exe" : "party-dev",
);
let bridge;

async function launch() {
  bridge = spawn(binary, {
    env: {
      ...process.env,
      IMPOSTER_DEV_PORT: String(port),
      IMPOSTER_DEV_HISTORY: join(folder, "deck.sqlite3"),
    },
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true,
  });
  await Promise.race([
    once(bridge.stdout, "data"),
    once(bridge, "exit").then(([code]) => {
      throw Error(`Development host exited with ${code}`);
    }),
    setTimeout(10000).then(() => {
      throw Error("Development host did not start");
    }),
  ]);
}

async function stop() {
  if (!bridge || bridge.exitCode !== null || bridge.signalCode !== null) return;
  const done = once(bridge, "exit");
  bridge.kill("SIGKILL");
  await done;
}

async function call(method, data) {
  const response = await fetch(base + method, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Imposter-Dev": "1" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

const create = () =>
  call("create", {
    name: "History smoke",
    player: "Host",
    wifi: "Test network",
  });
const view = (s) => call("state", { session_id: s.session_id });
const close = (s) => call("close", { session_id: s.session_id });
const act = (s, round, kind, value = null, id = crypto.randomUUID()) =>
  call("action", {
    session_id: s.session_id,
    action: { id, round_id: round, kind, value },
  });

async function deal(host) {
  const guests = await Promise.all(
    ["Sam", "Mia"].map((player) =>
      call("join", { invitation: host.credentials.native_invitation, player }),
    ),
  );
  await Promise.all(guests.map((g) => act(g, 0, "ready", true)));
  let state = await act(host, 0, "start");
  assert.equal(state.phase, "topic_voting");
  const round = state.round_id;
  assert(state.topic_vote.available_topics.includes("animals"));
  await Promise.all(
    [host, ...guests].map((s) => act(s, round, "topic_vote", ["animals"])),
  );
  for (let retries = 0; retries < 70; retries++) {
    state = await view(host);
    if (state.private_role) break;
    if (state.deal_error) throw Error(state.deal_error);
    await setTimeout(100);
  }
  assert.equal(state.phase, "roles", "The host should deal once after the final topic vote");
  const cards = await Promise.all([host, ...guests].map(view));
  const word = cards.find((card) => !card.private_role.imposter).private_role
    .clue;
  assert.equal(cards.filter((card) => card.private_role.imposter).length, 1);
  assert(guests.every((_, index) => cards[index + 1].deck_status === null));
  return { word, round, guests };
}

try {
  await launch();
  const first = await create();
  await assert.rejects(create(), /already hosting/);
  assert.equal((await view(first)).deck_status.played, 0);
  const original = await deal(first);
  assert.equal(
    (await act(first, original.round, "abandon")).deck_status.played,
    1,
  );
  await act(first, original.round, "end");
  await close(first);
  for (const guest of original.guests) await close(guest);

  const second = await create();
  assert.equal((await view(second)).deck_status.played, 1);
  const next = await deal(second);
  assert.notEqual(next.word, original.word);
  await stop();

  await launch();
  const third = await create();
  assert.equal((await view(third)).deck_status.played, 2);
  const afterRestart = await deal(third);
  assert(![original.word, next.word].includes(afterRestart.word));
  await act(third, afterRestart.round, "abandon");
  const reset = await act(third, afterRestart.round, "fresh_word_deck");
  assert.equal(reset.deck_status.played, 0);
  assert.equal(reset.players.length, 3);
  assert.equal(reset.score_session.number, 1);
  console.log(
    "Word deck survived party recreation and abrupt host restart. Duplicate deals and explicit renewal passed.",
  );
} finally {
  await stop();
}
