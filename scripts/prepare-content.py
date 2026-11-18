"""Validate and format the canonical offline catalog without regenerating words.

Edit crates/party-core/content/topics.json directly. TOPICS.md documents the
editorial policy; its examples are not an input to this script.
Use --check for read-only validation.
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "crates/party-core/content/topics.json"
REVIEW = ROOT / "crates/party-core/content/hint-review.json"
MODE_REVIEW = ROOT / "crates/party-core/content/mode-review.json"
MODE_REPORT = ROOT / "TOPIC-MODES.md"
MIN_WORDS = 20
MIN_MODE_WORDS = 10
MODES = ("classic", "act_it", "sound_only")
OPT_IN_TOPICS = {"dating", "puberty", "health", "consent"}
GENERIC_HINTS = {
    "thing", "stuff", "object", "animal", "nature", "food", "place", "job",
    "music", "sport", "game", "technology", "emotion", "feeling", "concept",
    "body", "anatomy",
}


def canonical(text):
    return re.sub(r"[\W_]+", "", text.casefold())


def validate_hint(word, hint):
    if not isinstance(hint, str) or not re.fullmatch(r"[^\W\d_]+(?:-[^\W\d_]+)*", hint):
        raise ValueError(f"Use a single alphabetic hint for {word!r}.")
    if canonical(hint) in GENERIC_HINTS:
        raise ValueError(f"Hint is a generic category label: {word!r} / {hint!r}")
    normalized_word, normalized_hint = canonical(word), canonical(hint)
    word_tokens = re.findall(r"[^\W_]+", word.casefold())
    if (
        normalized_hint == normalized_word
        or hint.casefold() in word_tokens
        or (len(normalized_hint) >= 4 and normalized_hint in normalized_word)
        or (len(normalized_word) >= 4 and normalized_word in normalized_hint)
    ):
        raise ValueError(f"Hint repeats the answer or part of it: {word!r} / {hint!r}")


def validate(packs):
    if not isinstance(packs, list) or not packs:
        raise ValueError("The catalog must contain a nonempty list of topics.")
    topic_ids, topic_names, words = set(), set(), set()
    for topic in packs:
        for field in ("id", "name", "icon", "description"):
            value = topic[field]
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise ValueError(f"Invalid topic {field}: {value!r}")
        topic_id = topic["id"]
        if topic_id in topic_ids or canonical(topic["name"]) in topic_names:
            raise ValueError(f"Duplicate topic: {topic_id}")
        topic_ids.add(topic_id)
        topic_names.add(canonical(topic["name"]))
        if not isinstance(topic["opt_in"], bool) or topic["opt_in"] != (
            topic_id in OPT_IN_TOPICS
        ):
            raise ValueError(f"Unexpected opt-in setting: {topic_id}")
        if not isinstance(topic["words"], list) or len(topic["words"]) < MIN_WORDS:
            raise ValueError(f"{topic_id} needs at least {MIN_WORDS} word/hint pairs.")
        for pair in topic["words"]:
            word, hint = pair["word"], pair["hint"]
            for text in (word, hint):
                if (
                    not isinstance(text, str)
                    or not text.strip()
                    or text != text.strip()
                    or any(ord(c) < 32 for c in text)
                ):
                    raise ValueError(f"Invalid word or hint in {topic_id}: {pair!r}")
            normalized = canonical(word)
            if not normalized or normalized in words:
                raise ValueError(f"Empty or duplicate word: {word!r}")
            words.add(normalized)
            validate_hint(word, hint)
            modes = pair.get("modes")
            if (
                not isinstance(modes, list)
                or not all(isinstance(mode, str) for mode in modes)
                or any(mode not in MODES for mode in modes)
                or modes != [mode for mode in MODES if mode in modes]
                or "classic" not in modes
            ):
                raise ValueError(f"Use distinct known modes in canonical order: {word!r}")
            mode_hints = pair.get("mode_hints")
            if not isinstance(mode_hints, dict) or set(mode_hints) != set(modes) - {"classic"}:
                raise ValueError(f"Mode hints must match eligible nonverbal modes: {word!r}")
            for mode_hint in mode_hints.values():
                validate_hint(word, mode_hint)
    if not OPT_IN_TOPICS <= topic_ids:
        raise ValueError("An existing opt-in topic is missing.")


def validate_review(packs, review):
    """Check the authored review record, not the truth of semantic judgments."""
    if review["version"] != 1:
        raise ValueError("Unsupported hint-review version.")
    topics = {topic["id"]: topic for topic in packs}
    seen = set()
    for topic_review in review["topics"]:
        topic_id = topic_review["id"]
        if topic_id not in topics or topic_id in seen:
            raise ValueError(f"Unknown or duplicate review topic: {topic_id}")
        seen.add(topic_id)
        topic = topics[topic_id]
        words = {pair["word"] for pair in topic["words"]}
        groups = {}
        for association in topic_review["associations"]:
            hint = association["hint"]
            candidates = association["plausible_words"]
            if hint in groups:
                raise ValueError(f"Duplicate review hint: {topic_id} / {hint}")
            if (
                not isinstance(candidates, list)
                or not 3 <= len(candidates) <= 6
                or len(set(candidates)) != len(candidates)
                or not set(candidates) <= words
            ):
                raise ValueError(
                    f"Review needs 3–6 distinct words from its topic: {topic_id} / {hint}"
                )
            groups[hint] = set(candidates)
        for pair in topic["words"]:
            if pair["word"] not in groups.get(pair["hint"], set()):
                raise ValueError(
                    f"Missing or stale hint review: {topic_id} / {pair['word']}"
                )
        if set(groups) != {pair["hint"] for pair in topic["words"]}:
            raise ValueError(f"Unused hints in review: {topic_id}")
    if seen != set(topics):
        raise ValueError(f"Missing topic reviews: {set(topics) - seen}")


def validate_mode_review(packs, review):
    """Require word-by-word decisions and hint alternatives within each pool."""
    if review.get("version") != 1 or review.get("minimum_playable_words") != MIN_MODE_WORDS:
        raise ValueError("Unsupported mode-review version or minimum pool size.")
    topics = {topic["id"]: topic for topic in packs}
    seen = set()
    for topic_review in review["topics"]:
        topic_id = topic_review["id"]
        if topic_id not in topics or topic_id in seen:
            raise ValueError(f"Unknown or duplicate mode-review topic: {topic_id}")
        seen.add(topic_id)
        pairs = {pair["word"]: pair for pair in topics[topic_id]["words"]}
        decisions = {}
        for decision in topic_review["words"]:
            word = decision["word"]
            if word not in pairs or word in decisions or set(decision) != {"word", *MODES[1:]}:
                raise ValueError(f"Unknown, duplicate or incomplete mode decision: {topic_id} / {word}")
            decisions[word] = decision
            for mode in MODES[1:]:
                entry = decision[mode]
                expected = "example" if mode in pairs[word]["modes"] else "excluded"
                if not isinstance(entry, dict) or set(entry) != {expected}:
                    raise ValueError(f"Decision disagrees with eligible modes: {topic_id} / {word} / {mode}")
                text = entry[expected]
                if not isinstance(text, str) or not text.strip() or text != text.strip() or any(ord(c) < 32 for c in text):
                    raise ValueError(f"Missing concrete example or exclusion reason: {topic_id} / {word} / {mode}")
        if set(decisions) != set(pairs):
            raise ValueError(f"Missing mode decisions: {topic_id} / {set(pairs) - set(decisions)}")
        if set(topic_review["associations"]) != set(MODES[1:]):
            raise ValueError(f"Missing mode association groups: {topic_id}")
        for mode in MODES[1:]:
            eligible = {word for word, pair in pairs.items() if mode in pair["modes"]}
            associations = topic_review["associations"][mode]
            if len(eligible) < MIN_MODE_WORDS:
                if associations:
                    raise ValueError(f"An undersized mode must not advertise reviewed playable hints: {topic_id} / {mode}")
                continue
            groups = {}
            for association in associations:
                hint, candidates = association["hint"], association["plausible_words"]
                if (
                    hint in groups
                    or not isinstance(candidates, list)
                    or not 3 <= len(candidates) <= 6
                    or len(set(candidates)) != len(candidates)
                    or not set(candidates) <= eligible
                ):
                    raise ValueError(f"Mode hint needs 3–6 distinct eligible candidates: {topic_id} / {mode} / {hint}")
                groups[hint] = set(candidates)
            used_hints = set()
            for word in eligible:
                hint = pairs[word]["mode_hints"][mode]
                used_hints.add(hint)
                if word not in groups.get(hint, set()):
                    raise ValueError(f"Missing filtered hint alternatives: {topic_id} / {mode} / {word}")
            if used_hints != set(groups):
                raise ValueError(f"Unused mode hint groups: {topic_id} / {mode}")
    if seen != set(topics):
        raise ValueError(f"Missing mode-review topics: {set(topics) - seen}")


def mode_report(packs, review):
    """Human-readable derived inventory; JSON remains the authoring source."""
    labels = {"classic": "Classic", "act_it": "Act It", "sound_only": "Sound Only"}
    lines = [
        "# Topic and word classifications by game mode", "",
        f"Editorial review: {review['reviewed_on']}. Generated from the canonical catalog and mode-review record. This is a content review, not human playtest certification.", "",
        "Regenerate with `python scripts/prepare-content.py --write-mode-report`. Do not edit these word lists directly.", "",
        "## Pool rules", "",
        f"A topic needs at least **{MIN_MODE_WORDS}** accepted words before it can enter a mode. Counts below ten are retained candidates; the entire topic is unavailable for that mode. Do not draw individual candidates from these undersized pools.", "",
        "Every accepted nonverbal word has a concrete solo clue example in [mode-review.json](crates/party-core/content/mode-review.json). Every excluded word has a recorded reason there. Every hint in a playable nonverbal pool has 3–6 plausible alternatives from that same filtered pool.", "",
        "Small unavailable pools retain their Classic hints for editorial reference; those hints are not approved for dealing in that mode. Selection must use the gated topic selector. Clue examples and candidate alternatives never go to players.", "",
        "There are no required props, other participants, contact, recordings, words, lyrics, spelling, or mouthed answers in nonverbal clue examples. Physical performances can be small seated gestures. Sound examples describe mouth-made imitations, not playing actual instruments or devices. Speech remains available during discussion.", "",
        "Sound Only accepts familiar fictional sounds in Movies. Space & science does not invent sounds for silent vacuum phenomena. Abstract, clinical and relationship topics are withheld where ten useful clues cannot be supported without changing the topic or repeating the same generic noises.", "",
        "Repeat history is shared across modes. A compatible word is not reused until that topic/mode subset is exhausted; only that subset resets. Topic filtering still respects the host's enabled packs and the four opt-in topics.", "",
        "## Coverage", "",
    ]
    for mode in MODES:
        playable = [topic for topic in packs if sum(mode in pair['modes'] for pair in topic['words']) >= MIN_MODE_WORDS]
        count = sum(sum(mode in pair['modes'] for pair in topic['words']) for topic in playable)
        lines.append(f"- **{labels[mode]}:** {len(playable)} playable topics; {count} words across those playable pools.")
    lines += ["", f"**{sum(len(topic['words']) for topic in packs)} distinct catalog entries.** The 2026-11-17 review preserved the original 552 entries and Classic hints, and added 29 words: Everyday +7, Nature +6, Travel +6, Technology +5, Hobbies +5.", "",
              "**Current app status:** the active game still uses Classic. Mode filtering, mode hints and safe selection helpers are prepared for the reviewed random-rule feature; the new screens and session toggle are not activated by this content change.", ""]
    for topic in packs:
        lines += [f"## {topic['name']}", ""]
        if topic['opt_in']:
            lines += ["Opt-in pack; classification does not enable it automatically.", ""]
        lines += [f"**Classic — playable ({len(topic['words'])}).** All words in this topic are Classic-compatible.", "",
                  "**All catalog words:** " + ", ".join(pair['word'] for pair in topic['words']) + ".", ""]
        for mode in MODES[1:]:
            accepted = [pair['word'] for pair in topic['words'] if mode in pair['modes']]
            excluded = [pair['word'] for pair in topic['words'] if mode not in pair['modes']]
            status = "playable" if len(accepted) >= MIN_MODE_WORDS else "unavailable"
            lines += [f"**{labels[mode]} — {status} ({len(accepted)} accepted; minimum {MIN_MODE_WORDS}).**", ""]
            if accepted:
                prefix = "Eligible words: " if status == "playable" else "Held-back candidates: "
                lines += [prefix + ", ".join(accepted) + ".", ""]
            if excluded:
                lines += ["Excluded words: " + ", ".join(excluded) + ".", ""]
            if status == "unavailable":
                source = next(item for item in review['topics'] if item['id'] == topic['id'])
                reasons = dict.fromkeys(item[mode]['excluded'] for item in source['words'] if 'excluded' in item[mode])
                lines += [" ".join(reasons), ""]
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument(
        "--check", action="store_true", help="Validate without writing files."
    )
    actions.add_argument("--write-mode-report", action="store_true", help="Validate and regenerate TOPIC-MODES.md.")
    args = parser.parse_args()
    packs = json.loads(CATALOG.read_text(encoding="utf-8"))
    validate(packs)
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    validate_review(packs, review)
    mode_review = json.loads(MODE_REVIEW.read_text(encoding="utf-8"))
    validate_mode_review(packs, mode_review)
    report = mode_report(packs, mode_review)
    if args.check and (not MODE_REPORT.exists() or MODE_REPORT.read_text(encoding="utf-8") != report):
        raise ValueError("TOPIC-MODES.md is stale; run --write-mode-report.")
    if args.write_mode_report:
        MODE_REPORT.write_text(report, encoding="utf-8")
    if not args.check:
        CATALOG.write_text(
            json.dumps(packs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    count = sum(len(topic["words"]) for topic in packs)
    smallest = min(len(topic["words"]) for topic in packs)
    print(
        f"Validated {len(packs)} topics; {count} word/hint pairs; "
        f"minimum {smallest} per topic; every pair has reviewed alternatives."
    )
    for mode in MODES:
        counts = [sum(mode in pair["modes"] for pair in topic["words"]) for topic in packs]
        print(f"{mode}: {sum(count >= MIN_MODE_WORDS for count in counts)} playable topics; minimum {MIN_MODE_WORDS} per playable topic.")


if __name__ == "__main__":
    main()
