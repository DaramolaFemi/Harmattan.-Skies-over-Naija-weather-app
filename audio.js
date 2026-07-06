/* ==========================================================================
 * Harmattan ambient audio engine
 *
 * There are no sample files here — every layer (piano, pad, rain, rumble,
 * haze wind, night shimmer) is synthesised live with the Web Audio API and
 * cross-faded according to the current weather condition and time of day.
 * Nothing to license, nothing to download, and it never plays quite the
 * same phrase twice.
 * ========================================================================== */

window.HarmattanAudio = (() => {
  "use strict";

  const RAMP = 2.6; // seconds — how gently layers cross-fade between weather moods
  const CHORDS = {
    a: [130.81, 196.00, 246.94, 293.66], // C3 G3 B3 D4 — open, warm
    b: [110.00, 164.81, 220.00, 261.63], // A2 E3 A3 C4 — slightly darker
  };

  /* ---------------- note / scale helpers ---------------- */
  const NOTE_SEMITONE = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
  function semi(note, octave) { return NOTE_SEMITONE[note] + (octave - 4) * 12; }
  function freqOf(semitoneFromA4) { return 440 * Math.pow(2, semitoneFromA4 / 12); }
  function degreeToFreq(rootSemitone, scale, index) {
    const len = scale.length;
    const octave = Math.floor(index / len);
    const deg = ((index % len) + len) % len;
    return freqOf(rootSemitone + scale[deg] + octave * 12);
  }

  const SCALES = {
    majorPenta: [0, 2, 4, 7, 9],
    minorPenta: [0, 3, 5, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dusty: [0, 2, 4, 6, 8, 10], // whole-tone-ish — ambiguous, hazy
  };

  /* piano character + register per weather condition */
  const CATEGORY_VOICE = {
    clear:  { scale: SCALES.majorPenta, root: semi("C", 5), phrase: [3, 6], rest: 1.0,  gap: [3, 7]  },
    clouds: { scale: SCALES.dorian,     root: semi("D", 4), phrase: [3, 5], rest: 1.15, gap: [4, 9]  },
    rain:   { scale: SCALES.minorPenta, root: semi("A", 3), phrase: [3, 5], rest: 1.25, gap: [3, 7]  },
    storm:  { scale: SCALES.aeolian,    root: semi("A", 3), phrase: [2, 4], rest: 1.5,  gap: [6, 12] },
    fog:    { scale: SCALES.dusty,      root: semi("D", 4), phrase: [2, 4], rest: 1.6,  gap: [6, 13] },
  };

  /* how the same weather feels at a different hour of the day */
  const TIME_MOD = {
    morning:   { shift: 5,   tempo: 0.9,  velocity: 0.6,  restMul: 0.85, wet: 0.22 },
    afternoon: { shift: 0,   tempo: 1.0,  velocity: 0.62, restMul: 1.0,  wet: 0.26 },
    evening:   { shift: -5,  tempo: 1.15, velocity: 0.5,  restMul: 1.25, wet: 0.34 },
    night:     { shift: -12, tempo: 1.35, velocity: 0.38, restMul: 1.55, wet: 0.44 },
  };

  function timeOfDayFor(hour) {
    if (hour < 5) return "night";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 20) return "evening";
    return "night";
  }

  let ctx = null;
  let ready = false;
  let enabled = false;

  let master, dry, wet, reverb;
  let padFilter, padGain, padOsc = [];
  let rainGain, rainFilter;
  let rumbleGain, rumbleFilter, rumbleSwellGain;
  let hazeGain, hazeFilter;
  let twinkleGain;
  let pianoGain, pianoWetSend;

  let chordFlip = "a";
  let currentCategory = "clear";
  let currentTimeBucket = "afternoon";
  let level = { pad: 0.4, cutoff: 1800, rain: 0, rumble: 0, haze: 0, twinkle: 0.1, piano: 0.4 };
  let timers = [];

  function noiseBuffer(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function impulseBuffer(seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function makeLoopingNoise(seconds) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds);
    src.loop = true;
    src.start();
    return src;
  }

  function addLFO(param, rate, depth) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g).connect(param);
    osc.start();
    return osc;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    dry = ctx.createGain();
    dry.gain.value = 0.75;
    wet = ctx.createGain();
    wet.gain.value = 0.32;
    reverb = ctx.createConvolver();
    reverb.buffer = impulseBuffer(3.6, 2.2);
    dry.connect(master);
    wet.connect(reverb).connect(master);

    /* ---------------- piano: the soft, poetic voice ---------------- */
    pianoGain = ctx.createGain();
    pianoGain.gain.value = 0;
    pianoGain.connect(dry);
    pianoGain.connect(wet);
    pianoWetSend = ctx.createGain();
    pianoWetSend.gain.value = 0.26;
    pianoGain.connect(pianoWetSend).connect(reverb);
    schedulePianoPhrase();

    /* ---------------- pad: slow evolving chord carpet ---------------- */
    padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = level.cutoff;
    padFilter.Q.value = 0.5;
    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain);
    padGain.connect(dry);
    padGain.connect(wet);

    const pans = [-0.35, 0.35, -0.15, 0.15];
    CHORDS.a.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? -1 : 1) * 4;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pans[i];
      osc.connect(panner).connect(padFilter);
      osc.start();
      padOsc.push(osc);
    });
    addLFO(padGain.gain, 0.06, 0.05); // slow breathing swell
    scheduleChordDrift();

    /* ---------------- rain: filtered noise hiss ---------------- */
    const rain = makeLoopingNoise(4);
    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 2600;
    rainFilter.Q.value = 0.7;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rain.connect(rainFilter).connect(rainGain);
    rainGain.connect(dry);
    rainGain.connect(wet);
    addLFO(rainFilter.frequency, 0.045, 400);

    /* ---------------- rumble: distant storm weight ------------- */
    const rumble = makeLoopingNoise(5);
    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 110;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumbleSwellGain = ctx.createGain();
    rumbleSwellGain.gain.value = 0;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleFilter.connect(rumbleSwellGain);
    rumbleGain.connect(dry);
    rumbleSwellGain.connect(dry);
    rumbleSwellGain.connect(wet);
    scheduleThunder();

    /* ---------------- haze: dry harmattan air ------------------ */
    const haze = makeLoopingNoise(4);
    hazeFilter = ctx.createBiquadFilter();
    hazeFilter.type = "bandpass";
    hazeFilter.frequency.value = 1800;
    hazeFilter.Q.value = 1.1;
    hazeGain = ctx.createGain();
    hazeGain.gain.value = 0;
    haze.connect(hazeFilter).connect(hazeGain);
    hazeGain.connect(dry);
    hazeGain.connect(wet);
    addLFO(hazeFilter.frequency, 0.03, 500);

    /* ---------------- twinkle: sparse night shimmer ------------- */
    twinkleGain = ctx.createGain();
    twinkleGain.gain.value = 0;
    twinkleGain.connect(dry);
    twinkleGain.connect(wet);
    scheduleTwinkle();

    ready = true;
    pushLevelsToNodes(); // the graph just came alive — apply whatever mood was already computed
  }

  /* ---------------- the piano voice itself ---------------- */
  function playPianoNote(freqHz, time, duration, velocity) {
    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.value = freqHz;

    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.value = freqHz * 2.01; // faint inharmonicity, like real strings

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.16;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200 + velocity * 1600;
    filter.Q.value = 0.3;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(velocity, time + 0.015);
    env.gain.exponentialRampToValueAtTime(Math.max(velocity * 0.32, 0.001), time + duration * 0.45);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 1.1);

    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 0.7;

    body.connect(filter);
    overtone.connect(overtoneGain).connect(filter);
    filter.connect(env).connect(panner).connect(pianoGain);

    body.start(time); body.stop(time + duration + 1.3);
    overtone.start(time); overtone.stop(time + duration + 1.3);
  }

  function schedulePianoPhrase() {
    const voice = CATEGORY_VOICE[currentCategory] || CATEGORY_VOICE.clouds;
    const mod = TIME_MOD[currentTimeBucket] || TIME_MOD.afternoon;
    const root = voice.root + mod.shift;

    const [minLen, maxLen] = voice.phrase;
    const phraseLen = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));

    let degree = 0;
    let t = ctx.currentTime + 0.3;
    for (let i = 0; i < phraseLen; i++) {
      const isLast = i === phraseLen - 1;
      degree = isLast ? 0 : degree + (Math.random() < 0.15 ? (Math.random() < 0.5 ? -3 : 3) : Math.round(Math.random() * 4) - 2);
      degree = Math.max(-2, Math.min(9, degree));

      const freqHz = degreeToFreq(root, voice.scale, degree);
      const dur = (0.9 + Math.random() * 1.3) * mod.tempo;
      const velocity = mod.velocity * (0.75 + Math.random() * 0.4) * level.piano * 2.1;
      const jitter = (Math.random() - 0.5) * 0.05;

      playPianoNote(freqHz, t + jitter, dur, Math.min(velocity, 0.9));

      t += dur * 0.62 + (0.15 + Math.random() * 0.45) * voice.rest * mod.restMul;
    }

    const [gapMin, gapMax] = voice.gap;
    const nextIn = (gapMin + Math.random() * (gapMax - gapMin)) * mod.restMul * 1000;
    timers.push(setTimeout(schedulePianoPhrase, (t - ctx.currentTime) * 1000 + nextIn));
  }

  function scheduleChordDrift() {
    const t = ctx.currentTime;
    const chord = CHORDS[chordFlip];
    padOsc.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(chord[i], t, 9);
    });
    chordFlip = chordFlip === "a" ? "b" : "a";
    timers.push(setTimeout(scheduleChordDrift, 22000 + Math.random() * 6000));
  }

  function scheduleTwinkle() {
    const delay = 3500 + Math.random() * 5500;
    timers.push(setTimeout(() => {
      if (level.twinkle > 0.02 && ctx) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
        osc.frequency.value = notes[Math.floor(Math.random() * notes.length)] * 2;
        const g = ctx.createGain();
        const peak = level.twinkle * (0.4 + Math.random() * 0.5);
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        osc.connect(g).connect(twinkleGain);
        osc.start(t);
        osc.stop(t + 2.3);
      }
      scheduleTwinkle();
    }, delay));
  }

  function scheduleThunder() {
    const delay = 9000 + Math.random() * 14000;
    timers.push(setTimeout(() => {
      if (level.rumble > 0.05 && ctx) {
        const t = ctx.currentTime;
        const peak = level.rumble * (0.5 + Math.random() * 0.6);
        rumbleSwellGain.gain.cancelScheduledValues(t);
        rumbleSwellGain.gain.setValueAtTime(rumbleSwellGain.gain.value, t);
        rumbleSwellGain.gain.linearRampToValueAtTime(peak, t + 1.4);
        rumbleSwellGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      }
      scheduleThunder();
    }, delay));
  }

  const PROFILES = {
    clear:  { pad: 0.34, cutoff: 2200, rain: 0,    rumble: 0,    haze: 0,    twinkle: 0.16, piano: 0.5  },
    clouds: { pad: 0.30, cutoff: 950,  rain: 0,    rumble: 0,    haze: 0.07, twinkle: 0.05, piano: 0.42 },
    rain:   { pad: 0.24, cutoff: 700,  rain: 0.5,  rumble: 0,    haze: 0,    twinkle: 0,    piano: 0.4  },
    storm:  { pad: 0.20, cutoff: 500,  rain: 0.42, rumble: 0.34, haze: 0,    twinkle: 0,    piano: 0.3  },
    fog:    { pad: 0.26, cutoff: 1000, rain: 0,    rumble: 0,    haze: 0.4,  twinkle: 0.04, piano: 0.38 },
  };

  function pushLevelsToNodes() {
    if (!ready) return;
    const t = ctx.currentTime;
    const mod = TIME_MOD[currentTimeBucket];
    padGain.gain.setTargetAtTime(level.pad, t, RAMP);
    padFilter.frequency.setTargetAtTime(level.cutoff, t, RAMP);
    rainGain.gain.setTargetAtTime(level.rain, t, RAMP);
    rumbleGain.gain.setTargetAtTime(level.rumble * 0.6, t, RAMP);
    hazeGain.gain.setTargetAtTime(level.haze, t, RAMP);
    pianoGain.gain.setTargetAtTime(0.45, t, RAMP); // per-note velocity carries the real dynamics
    pianoWetSend.gain.setTargetAtTime(mod.wet, t, RAMP);
  }

  function applyProfile(category, isDay, hour) {
    currentCategory = PROFILES[category] ? category : "clouds";
    currentTimeBucket = typeof hour === "number" ? timeOfDayFor(hour) : (isDay ? "afternoon" : "night");

    const base = PROFILES[currentCategory];
    const nightFactor = isDay ? 1 : 0.82;
    level = {
      pad: base.pad * nightFactor,
      cutoff: base.cutoff * (isDay ? 1 : 0.85),
      rain: base.rain,
      rumble: base.rumble,
      haze: base.haze,
      twinkle: isDay ? base.twinkle : base.twinkle + 0.12,
      piano: base.piano,
    };
    pushLevelsToNodes();
  }

  function init() {
    if (!ready) build();
  }

  function setCondition(category, isDay, hour) {
    applyProfile(category, isDay, hour);
  }

  function setEnabled(next) {
    enabled = next;
    if (!ready) build();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(enabled ? 0.55 : 0, t, 1.4);
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  return { init, setCondition, setEnabled, toggle, isEnabled };
})();
