// Imposter sound set v1: every effect synthesised with the Web Audio API.
// No audio files: each sound is a function (ctx, out, t) that schedules nodes from time t into `out`.
// It works the same with a live AudioContext and an OfflineAudioContext (used to measure and export).
// Ports to the app as-is (src/sound.ts): shared sounds get a host-scheduled start time, personal ones play now.

const SFX = (() => {
  // ---------- building blocks
  const noiseCache = new WeakMap();
  function noiseBuf(ctx) {
    if (noiseCache.has(ctx)) return noiseCache.get(ctx);
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
    return b;
  }
  // gain envelope: attack a, hold h, exponential decay d, to peak level v
  function env(ctx, t, v, a, d, h = 0) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a);
    if (h) g.gain.setValueAtTime(Math.max(v, 0.0002), t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
    return g;
  }
  function tone(ctx, out, t, { type = "sine", f = 440, f2 = 0, v = 0.3, a = 0.005, d = 0.3, h = 0, sweep = 0, detune = 0 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (sweep || a + h + d));
    o.detune.value = detune;
    const g = env(ctx, t, v, a, d, h);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + a + h + d + 0.05);
    return o;
  }
  function noise(ctx, out, t, { v = 0.3, a = 0.002, d = 0.1, h = 0, type = "bandpass", f = 2000, f2 = 0, q = 1, sweep = 0 } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf(ctx);
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + (sweep || a + h + d));
    fl.Q.value = q;
    const g = env(ctx, t, v, a, d, h);
    s.connect(fl).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + a + h + d + 0.05);
  }
  // short feedback echo, used as a cheap "room"
  function room(ctx, out, time = 0.09, fb = 0.28, wet = 0.35) {
    const inp = ctx.createGain();
    const dl = ctx.createDelay(1);
    dl.delayTime.value = time;
    const f = ctx.createGain(); f.gain.value = fb;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    const w = ctx.createGain(); w.gain.value = wet;
    inp.connect(out);
    inp.connect(dl); dl.connect(lp).connect(f).connect(dl); lp.connect(w).connect(out);
    return inp;
  }
  const thud = (ctx, out, t, v = 0.7, f = 120) => {
    tone(ctx, out, t, { f, f2: 42, v, a: 0.004, d: 0.22, sweep: 0.18 });
    noise(ctx, out, t, { type: "lowpass", f: 500, v: v * 0.5, d: 0.08 });
  };
  const click = (ctx, out, t, v = 0.25, f = 3200) => noise(ctx, out, t, { f, q: 2.5, v, d: 0.025 });

  // ---------- the sounds. Each entry: who hears it, length, what it's for, play(ctx, out, t)
  const S = {
    // ===== personal: your phone only
    tap: { who: "you", group: "Personal", name: "Button tap", use: "Any button. Barely there.", play(c, o, t) {
      tone(c, o, t, { type: "triangle", f: 1900, v: 0.2, d: 0.035 });
      click(c, o, t, 0.13, 5000);
    } },
    draw: { who: "you", group: "Personal", name: "Draw a card", use: "Card slides out of the deck and lands. Identical for every tier, so it never gives a Golden away.", play(c, o, t) {
      noise(c, o, t, { f: 500, f2: 3200, q: 0.9, v: 0.32, a: 0.18, d: 0.14, sweep: 0.3 });
      noise(c, o, t + 0.05, { type: "highpass", f: 4000, v: 0.06, a: 0.1, d: 0.15 });
      thud(c, o, t + 0.36, 0.55, 140);
      click(c, o, t + 0.36, 0.18, 2200);
    } },
    reveal: { who: "you", group: "Personal", name: "Reveal the card", use: "Second tap: a flip swoosh and a soft sparkle. Same for every tier.", play(c, o, t) {
      noise(c, o, t, { type: "bandpass", f: 1200, f2: 6000, q: 0.8, v: 0.28, a: 0.06, d: 0.12, sweep: 0.16 });
      [2093, 2637, 3136, 4186].forEach((f, i) => tone(c, o, t + 0.16 + i * 0.045, { f, v: 0.07, d: 0.35 }));
    } },
    chip: { who: "you", group: "Personal", name: "Bet chip", use: "Each step of the bet control: a clay-chip clack.", play(c, o, t) {
      click(c, o, t, 0.45, 3800);
      tone(c, o, t, { type: "triangle", f: 2600, v: 0.14, d: 0.05 });
      click(c, o, t + 0.045, 0.25, 3000);
    } },
    seal: { who: "you", group: "Personal", name: "Lock your vote", use: "Pressing the wax seal: a soft squash and a low press.", play(c, o, t) {
      noise(c, o, t, { type: "lowpass", f: 900, f2: 300, v: 0.4, a: 0.02, d: 0.22 });
      tone(c, o, t + 0.02, { f: 95, f2: 60, v: 0.5, a: 0.01, d: 0.2 });
      click(c, o, t + 0.2, 0.08, 1800);
    } },
    file: { who: "you", group: "Personal", name: "Into the case file", use: "Adding a card to your hand: a paper rustle.", play(c, o, t) {
      for (let i = 0; i < 7; i++) noise(c, o, t + i * 0.045 + Math.random() * 0.02, { f: 2500 + Math.random() * 2500, q: 0.7, v: 0.15 + Math.random() * 0.08, d: 0.05 });
    } },
    win: { who: "you", group: "Personal", name: "Your result: win", use: "Your own result beat when you got it right or escaped: two bright notes.", play(c, o, t) {
      const r = room(c, o);
      [[784, 0], [1175, 0.11]].forEach(([f, dt]) => {
        tone(c, r, t + dt, { type: "triangle", f, v: 0.28, d: 0.5 });
        tone(c, r, t + dt, { f: f * 2, v: 0.06, d: 0.3 });
      });
    } },
    lose: { who: "you", group: "Personal", name: "Your result: loss", use: "Your own result beat when you were wrong or caught: a low thud.", play(c, o, t) {
      thud(c, o, t, 0.6, 110);
      tone(c, o, t + 0.05, { type: "triangle", f: 196, f2: 165, v: 0.14, d: 0.45 });
    } },

    // ===== shared: every phone at once, host-scheduled
    riffle: { who: "all", group: "Shared", name: "Rule shuffle", use: "The round's rule is shuffled: a card riffle, then the rule lands.", play(c, o, t) {
      for (let i = 0; i < 22; i++) { const dt = 0.9 * Math.pow(i / 22, 0.8); click(c, o, t + dt, 0.12 + (i / 22) * 0.1, 2600 + Math.random() * 1600); }
      thud(c, o, t + 1.05, 0.5, 130);
      noise(c, o, t + 1.05, { type: "highpass", f: 3000, v: 0.05, d: 0.2 });
    } },
    playCommon: { who: "all", group: "Shared", name: "Card played: Common", use: "\"Maya played a Common card\": a paper slap on the table.", play(c, o, t) {
      noise(c, o, t, { type: "highpass", f: 900, v: 0.38, d: 0.09 });
      thud(c, o, t, 0.32, 160);
    } },
    playRare: { who: "all", group: "Shared", name: "Card played: Rare", use: "\"Maya played a Rare card\": a short glassy chime.", play(c, o, t) {
      const r = room(c, o, 0.11, 0.3, 0.4);
      noise(c, o, t, { type: "highpass", f: 900, v: 0.22, d: 0.07 });
      [[1318, 0], [1975, 0.06], [2637, 0.12]].forEach(([f, dt]) => { tone(c, r, t + dt, { f, v: 0.14, d: 0.9 }); tone(c, r, t + dt, { f: f * 1.005, v: 0.05, d: 0.9 }); });
    } },
    playGolden: { who: "all", group: "Shared", name: "Card played: GOLDEN", use: "The signature sound. The card slams down (deep impact), then a gong blooms with a shimmer. The tier is already public at this moment.", play(c, o, t) {
      const r = room(c, o, 0.13, 0.35, 0.45);
      // impact
      tone(c, o, t, { f: 90, f2: 32, v: 0.85, a: 0.005, d: 0.6, sweep: 0.5 });
      noise(c, o, t, { type: "lowpass", f: 700, f2: 120, v: 0.6, d: 0.35 });
      click(c, o, t, 0.3, 1500);
      // gong: inharmonic partials with slow beating
      [[1, 0.26], [1.48, 0.14], [2.0, 0.1], [2.76, 0.07], [3.6, 0.05], [5.2, 0.03]].forEach(([m, v], i) => {
        tone(c, r, t + 0.04, { f: 98 * m, v, a: 0.02 + i * 0.01, d: 2.1 - i * 0.2 });
        tone(c, r, t + 0.04, { f: 98 * m * 1.004, v: v * 0.6, a: 0.03, d: 2.0 - i * 0.2 });
      });
      // shimmer
      noise(c, r, t + 0.08, { type: "highpass", f: 6000, v: 0.05, a: 0.25, d: 1.2 });
      for (let i = 0; i < 9; i++) tone(c, r, t + 0.15 + i * 0.07, { f: 2400 + Math.random() * 2600, v: 0.035, d: 0.4 });
    } },
    heartbeat: { who: "all", group: "Shared", name: "Last votes (heartbeat)", use: "While the last ballots come in: a slow heartbeat that speeds up (70 → 110 bpm over 7 beats). Stops the moment the last vote locks.", play(c, o, t) {
      let at = t;
      for (let i = 0; i < 7; i++) {
        const bpm = 70 + (i / 6) * 40, v = 0.55 + i * 0.04;
        tone(c, o, at, { f: 62, f2: 45, v, a: 0.008, d: 0.13 });
        noise(c, o, at, { type: "lowpass", f: 180, v: v * 0.35, d: 0.08 });
        tone(c, o, at + 0.19, { f: 55, f2: 42, v: v * 0.65, a: 0.008, d: 0.12 });
        at += 60 / bpm;
      }
    } },
    suspense: { who: "all", group: "Shared", name: "Result suspense", use: "While the envelope breathes before results: three slow heartbeats, then a beat of silence before the reveal.", play(c, o, t) {
      for (let i = 0; i < 3; i++) {
        const at = t + i * 0.9;
        tone(c, o, at, { f: 60, f2: 44, v: 0.6, a: 0.008, d: 0.14 });
        tone(c, o, at + 0.2, { f: 54, f2: 42, v: 0.4, a: 0.008, d: 0.13 });
      }
      noise(c, o, t, { type: "lowpass", f: 300, v: 0.03, a: 1.2, d: 1.2, h: 0.3 });
    } },
    gavel: { who: "all", group: "Shared", name: "Verdict: caught", use: "The Imposter is caught: a gavel bang in a wood-panelled room.", play(c, o, t) {
      const r = room(c, o, 0.07, 0.35, 0.5);
      noise(c, r, t, { f: 900, q: 1.4, v: 0.7, d: 0.09 });
      tone(c, r, t, { type: "triangle", f: 220, f2: 140, v: 0.5, d: 0.16 });
      thud(c, r, t, 0.5, 110);
    } },
    escape: { who: "all", group: "Shared", name: "Verdict: escaped", use: "The Imposter escapes: a door creaks open, then slams.", play(c, o, t) {
      const cr = c.createOscillator(); cr.type = "sawtooth"; cr.frequency.setValueAtTime(140, t); cr.frequency.linearRampToValueAtTime(260, t + 0.7);
      const lfo = c.createOscillator(); lfo.frequency.value = 23; const lg = c.createGain(); lg.gain.value = 40; lfo.connect(lg).connect(cr.frequency);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 3;
      const g = env(c, t, 0.12, 0.15, 0.4, 0.2);
      cr.connect(bp).connect(g).connect(o); cr.start(t); lfo.start(t); cr.stop(t + 0.8); lfo.stop(t + 0.8);
      const r = room(c, o, 0.08, 0.3, 0.45);
      thud(c, r, t + 0.8, 0.75, 100);
      noise(c, r, t + 0.8, { f: 700, q: 1, v: 0.4, d: 0.12 });
    } },
    stamp: { who: "all", group: "Shared", name: "Evidence stamp", use: "Each card in the results replay gets stamped: a rubber stamp hitting paper.", play(c, o, t) {
      noise(c, o, t, { type: "highpass", f: 2500, v: 0.05, a: 0.02, d: 0.02 });
      thud(c, o, t + 0.03, 0.55, 105);
      noise(c, o, t + 0.03, { f: 1400, q: 0.8, v: 0.22, d: 0.06 });
    } },
    womp: { who: "all", group: "Shared", name: "Bluff exposed", use: "A Bluff Card turns face up: a comic sad-trombone womp.", play(c, o, t) {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100; lp.Q.value = 2; lp.connect(o);
      [[392, 0, 0.22], [370, 0.24, 0.22], [349, 0.48, 0.22], [330, 0.72, 0.7]].forEach(([f, dt, d], i) => {
        const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.setValueAtTime(f, t + dt);
        if (i === 3) { const v = c.createOscillator(); v.frequency.value = 6; const vg = c.createGain(); vg.gain.value = 9; v.connect(vg).connect(osc.frequency); v.start(t + dt); v.stop(t + dt + d); osc.frequency.linearRampToValueAtTime(f * 0.9, t + dt + d); }
        const g = env(c, t + dt, 0.26, 0.03, d * 0.7, d * 0.2);
        osc.connect(g).connect(lp); osc.start(t + dt); osc.stop(t + dt + d + 0.1);
      });
    } },
    coins: { who: "all", group: "Shared", name: "Bounty paid", use: "PAID lands on the Bounty note: a short cascade of coins.", play(c, o, t) {
      const r = room(c, o, 0.05, 0.2, 0.3);
      for (let i = 0; i < 12; i++) {
        const dt = i * 0.05 + Math.random() * 0.03, f = 2800 + Math.random() * 1800;
        tone(c, r, t + dt, { f, v: 0.14, d: 0.18 }); tone(c, r, t + dt, { f: f * 1.47, v: 0.06, d: 0.12 });
        click(c, o, t + dt, 0.07, 6000);
      }
    } },
    drumroll: { who: "all", group: "Shared", name: "Drink or Dare", use: "Each player's turn begins: a short snare roll that ends in a hit.", play(c, o, t) {
      const n = 30;
      for (let i = 0; i < n; i++) noise(c, o, t + i * 0.035, { f: 1900, q: 0.9, v: 0.06 + (i / n) * 0.14, d: 0.03 });
      thud(c, o, t + n * 0.035, 0.6, 130);
      noise(c, o, t + n * 0.035, { type: "highpass", f: 5000, v: 0.16, d: 0.6 });
    } },
    celebrate: { who: "all", group: "Shared", name: "Session complete", use: "The winner is announced: a three-note brass flourish and a few confetti pops. The only musical moment.", play(c, o, t) {
      const r = room(c, o, 0.12, 0.3, 0.4);
      const brass = (f, at, d, v) => {
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 1.5;
        lp.frequency.setValueAtTime(600, at); lp.frequency.exponentialRampToValueAtTime(3200, at + 0.06); lp.frequency.exponentialRampToValueAtTime(1400, at + d);
        lp.connect(r);
        [0, 7].forEach((dt) => tone(c, lp, at, { type: "sawtooth", f, v, a: 0.03, d, h: 0.05, detune: dt }));
      };
      brass(523, t, 0.16, 0.09); brass(659, t + 0.16, 0.16, 0.09); brass(784, t + 0.32, 0.16, 0.09);
      [523, 659, 784, 1046].forEach((f) => brass(f, t + 0.52, 0.9, 0.065));
      for (let i = 0; i < 6; i++) noise(c, o, t + 0.55 + Math.random() * 0.6, { type: "highpass", f: 2500, v: 0.12, d: 0.04 });
    } },
  };

  // ---------- playback
  let ctx = null, master = null;
  function live() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function play(id, delay = 0) { const c = live(); S[id].play(c, master, c.currentTime + 0.02 + delay); }
  function volume(v) { live(); master.gain.value = v; }
  // render offline for measurement (length, peak, rms)
  async function measure(id, secs = 4) {
    const sr = 44100, oc = new OfflineAudioContext(1, sr * secs, sr);
    const g = oc.createGain(); g.gain.value = 0.8; g.connect(oc.destination);
    S[id].play(oc, g, 0.02);
    const buf = await oc.startRendering(), d = buf.getChannelData(0);
    let peak = 0, sum = 0, last = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; if (a > 0.003) last = i; }
    return { id, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), length: +(last / sr).toFixed(2) };
  }
  return { S, play, volume, measure };
})();
