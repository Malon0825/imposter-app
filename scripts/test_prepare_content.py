"""Negative content checks: malformed or stale metadata must fail validation."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("prepare_content", Path(__file__).with_name("prepare-content.py"))
content = importlib.util.module_from_spec(spec)
spec.loader.exec_module(content)


class ContentValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packs = json.loads(content.CATALOG.read_text(encoding="utf-8"))
        cls.review = json.loads(content.MODE_REVIEW.read_text(encoding="utf-8"))

    def test_unknown_duplicate_and_missing_classic_modes_are_rejected(self):
        for modes in (["classic", "sound_typo"], ["classic", "classic"], ["act_it"]):
            with self.subTest(modes=modes):
                packs = copy.deepcopy(self.packs)
                packs[0]["words"][0]["modes"] = modes
                with self.assertRaises(ValueError):
                    content.validate(packs)

    def test_missing_and_answer_repeating_mode_hints_are_rejected(self):
        for hint in (None, "Wallet"):
            with self.subTest(hint=hint):
                packs = copy.deepcopy(self.packs)
                pair = packs[0]["words"][0]
                if hint is None:
                    pair["mode_hints"].clear()
                else:
                    pair["mode_hints"]["act_it"] = hint
                with self.assertRaises(ValueError):
                    content.validate(packs)

    def test_every_word_needs_an_explicit_nonverbal_decision(self):
        review = copy.deepcopy(self.review)
        review["topics"][0]["words"].pop()
        with self.assertRaisesRegex(ValueError, "Missing mode decisions"):
            content.validate_mode_review(self.packs, review)

    def test_examples_cannot_enable_a_word_excluded_from_the_catalog(self):
        review = copy.deepcopy(self.review)
        review["topics"][0]["words"][0]["sound_only"] = {"example": "Tap anything."}
        with self.assertRaisesRegex(ValueError, "Decision disagrees"):
            content.validate_mode_review(self.packs, review)

    def test_sound_hints_cannot_use_classic_only_alternatives(self):
        review = copy.deepcopy(self.review)
        association = review["topics"][0]["associations"]["sound_only"][0]
        association["plausible_words"][0] = "Wallet"
        with self.assertRaisesRegex(ValueError, "eligible candidates"):
            content.validate_mode_review(self.packs, review)

    def test_a_mode_hint_needs_at_least_three_distinct_candidates(self):
        for candidates in (["Key", "Pen"], ["Key", "Key", "Pen"]):
            with self.subTest(candidates=candidates):
                review = copy.deepcopy(self.review)
                review["topics"][0]["associations"]["sound_only"][0]["plausible_words"] = candidates
                with self.assertRaisesRegex(ValueError, "eligible candidates"):
                    content.validate_mode_review(self.packs, review)

    def test_undersized_pools_cannot_advertise_playable_hint_groups(self):
        review = copy.deepcopy(self.review)
        food = next(topic for topic in review["topics"] if topic["id"] == "food")
        food["associations"]["sound_only"] = [{
            "hint": "Straw", "plausible_words": ["Bubble tea", "Smoothie", "Soup"]
        }]
        with self.assertRaisesRegex(ValueError, "undersized mode"):
            content.validate_mode_review(self.packs, review)

    def test_stale_word_decisions_and_changed_minimum_are_rejected(self):
        review = copy.deepcopy(self.review)
        review["topics"][0]["words"][0]["word"] = "Removed target"
        with self.assertRaisesRegex(ValueError, "Unknown, duplicate"):
            content.validate_mode_review(self.packs, review)
        review = copy.deepcopy(self.review)
        review["minimum_playable_words"] = 1
        with self.assertRaisesRegex(ValueError, "minimum pool size"):
            content.validate_mode_review(self.packs, review)


if __name__ == "__main__":
    unittest.main()
