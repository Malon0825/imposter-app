// Types for the synthesised sound set (src/sound-set.js).
export type SoundId =
  | "tap" | "draw" | "reveal" | "chip" | "seal" | "file" | "win" | "lose"
  | "riffle" | "playCommon" | "playRare" | "playGolden" | "heartbeat" | "suspense"
  | "gavel" | "escape" | "stamp" | "womp" | "coins" | "drumroll" | "celebrate";
export declare const SFX: {
  S: Record<SoundId, { who: "you" | "all"; play(ctx: BaseAudioContext, out: AudioNode, t: number): void }>;
  play(id: SoundId, delay?: number): void;
  volume(v: number): void;
};
