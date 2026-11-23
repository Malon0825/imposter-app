# Optional clue board — review mockups

Status: proposed design for review, not implementation approval.

Generated with the built-in image generation tool using the existing app's discussion and voting screenshots as references. Exact prompts are in [prompts.json](prompts.json).

1. [Discussion](01-discussion.png): optional clues sit beneath player names in the existing roster. A blank clue is simply absent. The host can open voting without waiting for entries.
2. [Edit clue](02-edit-clue.png): one text field and Save clue above the keyboard. Remove clue appears when editing an existing clue; first-time entry would omit that action. Close dismisses the sheet.
3. [Voting](03-voting.png): clues remain visible beneath ballot names and become read-only. The selected suspect and disabled self-vote use the existing app styling.

Rules: one optional clue per player per round; editable/removable before voting; retained through same-round reconnects; read-only in voting/runoff; cleared before the next round. Clues are deliberate public submissions, separate from private role cards and secret ballots.

Visual system: charcoal #141916, warm ivory #F4F1E8, sage #B4C8AD, lime #D6F56B; existing rounded typography, initials avatars, card artwork, flat roster dividers, and large buttons. Phone framing is presentation only.
