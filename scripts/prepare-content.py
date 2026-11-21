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
SPOKEN_REVIEW = ROOT / "crates/party-core/content/spoken-mode-review.json"
MODE_REPORT = ROOT / "TOPIC-MODES.md"
DIVERSITY = ROOT / "crates/party-core/content/diversity-review.json"
SELECTION_INDEX = ROOT / "crates/party-core/content/selection-index.json"
MIN_WORDS = 20
MIN_MODE_WORDS = 10
NONVERBAL = ("act_it", "sound_only")
SPOKEN = ("two_truths", "if_it_could_talk", "sell_it")
MODES = ("classic", *NONVERBAL, *SPOKEN)
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
            definition = pair.get("definition")
            if (
                not isinstance(definition, str)
                or definition != definition.strip()
                or not 16 <= len(definition) <= 160
                or not definition.isprintable()
                or not definition.endswith(".")
                or canonical(definition) in {normalized, canonical(hint)}
            ):
                raise ValueError(f"Use a short, plain-language definition for {word!r}.")
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


def validate_mode_review(packs, review, modes=NONVERBAL):
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
            if word not in pairs or word in decisions or set(decision) != {"word", *modes}:
                raise ValueError(f"Unknown, duplicate or incomplete mode decision: {topic_id} / {word}")
            decisions[word] = decision
            for mode in modes:
                entry = decision[mode]
                expected = "example" if mode in pairs[word]["modes"] else "excluded"
                if not isinstance(entry, dict) or set(entry) != {expected}:
                    raise ValueError(f"Decision disagrees with eligible modes: {topic_id} / {word} / {mode}")
                text = entry[expected]
                if not isinstance(text, str) or not text.strip() or text != text.strip() or any(ord(c) < 32 for c in text):
                    raise ValueError(f"Missing concrete example or exclusion reason: {topic_id} / {word} / {mode}")
        if set(decisions) != set(pairs):
            raise ValueError(f"Missing mode decisions: {topic_id} / {set(pairs) - set(decisions)}")
        if set(topic_review["associations"]) != set(modes):
            raise ValueError(f"Missing mode association groups: {topic_id}")
        for mode in modes:
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


def extend_with_spoken_review(packs, review, rows):
    topics = {topic["id"]: topic for topic in review["topics"]}
    groups = {id: {mode: {} for mode in SPOKEN} for id in topics}
    decisions = {(topic["id"], word["word"]): word for topic in topics.values() for word in topic["words"]}
    pairs = {(topic["id"], word["word"]): word for topic in packs for word in topic["words"]}
    approved = set()
    for row in rows:
        topic, mode, word, hint, example = (row[key] for key in ("topic", "mode", "word", "hint", "example"))
        key = (topic, mode, word)
        if mode not in SPOKEN or key in approved or pairs.get((topic, word), {}).get("mode_hints", {}).get(mode) != hint:
            raise ValueError(f"Unmatched or duplicate spoken review: {key}")
        approved.add(key)
        decisions[topic, word][mode] = {"example": example}
        groups[topic][mode].setdefault(hint, []).append(word)
    for decision in decisions.values():
        for mode in SPOKEN:
            decision.setdefault(mode, {"excluded": "Outside the reviewed starter pool for this rule."})
    for topic_id, topic in topics.items():
        for mode in SPOKEN:
            topic["associations"][mode] = [
                {"hint": hint, "plausible_words": words}
                for hint, words in groups[topic_id][mode].items()
            ]


def mode_report(packs, review):
    """Human-readable derived inventory; JSON remains the authoring source."""
    labels = {"classic": "Classic", "act_it": "Act It", "sound_only": "Sound Only", "two_truths": "Two Truths and a Lie", "if_it_could_talk": "If It Could Talk", "sell_it": "Sell It"}
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
        "Played words and equivalent concepts stay deducted across modes and parties on the same host device until the host starts a fresh word deck. Recent clue families can temporarily reduce these static pools. The host's enabled packs and the four opt-in settings still control topic availability.", "",
        "## Coverage", "",
    ]
    for mode in MODES:
        playable = [topic for topic in packs if sum(mode in pair['modes'] for pair in topic['words']) >= MIN_MODE_WORDS]
        count = sum(sum(mode in pair['modes'] for pair in topic['words']) for topic in playable)
        lines.append(f"- **{labels[mode]}:** {len(playable)} playable topics; {count} words across those playable pools.")
    lines += ["", f"**{sum(len(topic['words']) for topic in packs)} distinct catalog entries.** The 2026-11-17 review preserved the original 552 entries and Classic hints, and added 29 words: Everyday +7, Nature +6, Travel +6, Technology +5, Hobbies +5.", "",
              "The live ballot uses the remaining fresh candidates with viable hints. These counts describe the starting catalog.", ""]
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


def selection_index(packs, classic, nonverbal, diversity):
    words = {pair["word"]: pair for topic in packs for pair in topic["words"]}
    ids = [pair.get("word_id", "") for pair in words.values()]
    if len(set(ids)) != len(ids) or any(not re.fullmatch(r"[a-z0-9-]+/[a-z0-9-]+", id) for id in ids):
        raise ValueError("Every word needs a unique stable word_id.")
    if diversity["revision"] < 1 or not all(old not in ids and new in ids for old, new in diversity["aliases"].items()):
        raise ValueError("Invalid catalog revision or word ID alias.")
    metadata = {name: {"concept": pair["word_id"], "semantic": [], "performance": {}, "hints": {}} for name, pair in words.items()}
    equivalents = set()
    for category in ("concepts", "semantic", *MODES):
        for group, names in diversity.get(category, {}).items():
            if len(set(names)) != len(names) or len(names) < 2 or not set(names) <= words.keys():
                raise ValueError(f"Unknown or duplicate words in {category}/{group}: {names}")
            for name in names:
                if category == "concepts":
                    if name in equivalents:
                        raise ValueError(f"Conflicting equivalent concept: {name}")
                    equivalents.add(name)
                    metadata[name]["concept"] = "equivalent/" + group
                elif category == "semantic":
                    metadata[name]["semantic"].append(group)
                elif category in words[name]["modes"]:
                    metadata[name]["performance"].setdefault(category, []).append(group)
    for topic, classic_review, mode_review in zip(packs, classic["topics"], nonverbal["topics"], strict=True):
        if not topic["id"] == classic_review["id"] == mode_review["id"]:
            raise ValueError("Topic reviews must follow the canonical order.")
        for mode in MODES:
            source = classic_review["associations"] if mode == "classic" else mode_review["associations"][mode]
            associations = {row["hint"]: row["plausible_words"] for row in source}
            for pair in topic["words"]:
                name = pair["word"]
                if not associations or mode not in pair["modes"]:
                    continue
                primary = pair["hint"] if mode == "classic" else pair["mode_hints"][mode]
                options = [primary, *diversity["fallback_hints"].get(mode, {}).get(name, [])]
                hints = []
                for hint in dict.fromkeys(options):
                    if name not in associations.get(hint, []):
                        raise ValueError(f"Unreviewed {mode} hint for {name}: {hint}")
                    validate_hint(name, hint)
                    hints.append({"text": hint, "candidates": [words[target]["word_id"] for target in associations[hint]]})
                metadata[name]["hints"][mode] = hints
    for mode, options in diversity["fallback_hints"].items():
        if mode not in MODES or any(name not in metadata or mode not in metadata[name]["hints"] for name in options):
            raise ValueError(f"Unavailable fallback hint in {mode}.")
    return json.dumps({
        "revision": diversity["revision"],
        "aliases": diversity["aliases"],
        "words": {words[name]["word_id"]: details for name, details in metadata.items()},
    }, ensure_ascii=False, separators=(",", ":")) + "\n"


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
    extend_with_spoken_review(packs, mode_review, json.loads(SPOKEN_REVIEW.read_text(encoding="utf-8")))
    validate_mode_review(packs, mode_review, MODES[1:])
    index = selection_index(packs, review, mode_review, json.loads(DIVERSITY.read_text(encoding="utf-8")))
    if args.check:
        if not SELECTION_INDEX.exists() or SELECTION_INDEX.read_text(encoding="utf-8") != index:
            raise ValueError("selection-index.json is stale; run --write-mode-report.")
    else:
        SELECTION_INDEX.write_text(index, encoding="utf-8")
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
