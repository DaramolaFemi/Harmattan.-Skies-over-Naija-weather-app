/* ==========================================================================
 * 9jaRun — an endless dodge/runner whose entire rule set (speed, hazard mix,
 * visibility, gusts, glare, heat) is derived from the *live* weather at
 * whichever Nigerian city is currently selected on the main Harmattan page.
 * No server, no seed table — the sky itself is the level generator.
 * ========================================================================== */

(() => {
  "use strict";

  document.body.dataset.theme = localStorage.getItem("harmattan-theme") || "dark";

  const CITIES = window.HarmattanData.CITIES;
  const interpret = window.HarmattanData.interpret;

  const FALLBACK_CITY = CITIES[0];
  const FALLBACK_CURRENT = {
    temperature_2m: 27, relative_humidity_2m: 55, apparent_temperature: 29,
    is_day: 1, weather_code: 1, cloud_cover: 20,
    wind_speed_10m: 10, wind_direction_10m: 200, uv_index: 5,
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  /* ----------------------------------------------------------------------
   * DOM refs
   * -------------------------------------------------------------------- */
  const el = {
    stage: document.getElementById("stage"),
    obstacleLayer: document.getElementById("obstacleLayer"),
    player: document.getElementById("player"),
    playerShadow: document.getElementById("playerShadow"),
    stageFog: document.getElementById("stageFog"),
    stageGlare: document.getElementById("stageGlare"),
    stageFlash: document.getElementById("stageFlash"),
    staminaWrap: document.getElementById("staminaWrap"),
    staminaBar: document.getElementById("staminaBar"),
    gustWarning: document.getElementById("gustWarning"),
    startOverlay: document.getElementById("startOverlay"),
    startSub: document.getElementById("startSub"),
    gameoverOverlay: document.getElementById("gameoverOverlay"),
    finalScore: document.getElementById("finalScore"),
    finalBest: document.getElementById("finalBest"),
    retryBtn: document.getElementById("retryBtn"),
    scoreValue: document.getElementById("scoreValue"),
    bestValue: document.getElementById("bestValue"),
    gameCityTag: document.getElementById("gameCityTag"),
    gameCityName: document.getElementById("gameCityName"),
    weatherChips: document.getElementById("weatherChips"),
    rulesList: document.getElementById("rulesList"),
    soundToggle: document.getElementById("gameSoundToggle"),
    jumpBtn: document.getElementById("jumpBtn"),
    duckBtn: document.getElementById("duckBtn"),
    gameYear: document.getElementById("gameYear"),
  };

  el.gameYear.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------------------
   * Physics / layout constants — mirror the geometry baked into game.css
   * -------------------------------------------------------------------- */
  const PLAYER_X = 26;
  const PLAYER_W = 34;
  const PLAYER_H_STAND = 46;
  const PLAYER_H_DUCK = 22;
  const DUCK_DURATION = 0.55;
  const BASE_GRAVITY = 2000;
  const BASE_JUMP_SPEED = 640;
  const LIGHTNING_WARN_TIME = 0.35;
  const GUST_WARN_TIME = 0.4;
  const GUST_DURATION = 0.9;
  const GUST_MULT = 1.55;

  const OBSTACLE_DEFS = {
    puddle:    { width: 44, height: 16, groundY: 0 },
    lightning: { width: 18, height: 30, groundY: 0 },
    debris:    { width: 30, height: 18, groundY: 34 },
    token:     { width: 30, height: 28, groundY: 18 },
  };

  const LIGHTNING_SVG = `<svg viewBox="0 0 24 24"><path d="m13 12-3 5h3l-2 5 6-7h-3l2-3z"/></svg>`;
  const DEBRIS_SVG = `<svg viewBox="0 0 24 24"><path d="M3 8h11.5a2.5 2.5 0 1 0-2.4-3.2M3 12h15a2.8 2.8 0 1 1-2.7 3.6M3 16h9a2 2 0 1 1-1.9 2.6"/></svg>`;
  // line-icon collectibles (umbrella, suya skewer, harmattan haze, fuel) — drawn as SVG
  // rather than emoji so they render consistently across browsers/OSes.
  const TOKEN_ICONS = [
    `<svg viewBox="0 0 24 24"><path d="M3 11a9 9 0 0 1 18 0Z"/><path d="M12 11v8a2 2 0 0 1-2.4 2" stroke-linecap="round"/><path d="M12 2.5v2.4" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M2.5 12h19" stroke-linecap="round"/><rect x="6" y="9" width="4" height="6" rx="1.2"/><rect x="13" y="9" width="4" height="6" rx="1.2"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M3 8h13M3 12h18M3 16h13" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 24 24"><rect x="2.5" y="8" width="16" height="8" rx="1.5"/><path d="M18.5 10.5h2.2v3h-2.2" stroke-linecap="round"/><path d="M8 8V6M12 8V6" stroke-linecap="round"/></svg>`,
  ];

  /* ----------------------------------------------------------------------
   * Weather → mechanics
   * -------------------------------------------------------------------- */
  function computeMechanics(current) {
    const info = interpret(current.weather_code, current.is_day);
    const wind = current.wind_speed_10m || 0;
    const humidity = current.relative_humidity_2m ?? 50;
    const temp = current.apparent_temperature ?? current.temperature_2m ?? 26;
    const uv = current.uv_index ?? 0;
    const cloud = current.cloud_cover ?? 0;
    const isDay = current.is_day === 1;

    const category = info.category;
    const isStormy = category === "storm";
    const isRainy = isStormy || category === "rain";
    const isFoggy = category === "fog";
    const isHot = temp >= 32;
    const highHumidity = humidity >= 70;
    const highUv = uv >= 6;
    const gusty = wind >= 8;
    const debrisOn = wind >= 12;

    const fogFactor = isFoggy ? 0.85 : Math.min(cloud / 100, 1) * 0.4;
    const baseSpeed = clamp(200 + wind * 3.2, 190, 430);
    const gravity = BASE_GRAVITY * (1 - clamp(humidity - 40, 0, 60) / 60 * 0.18);

    return {
      info, category, wind, humidity, temp, uv, cloud, isDay,
      isStormy, isRainy, isFoggy, isHot, highHumidity, highUv, gusty, debrisOn,
      fogFactor, baseSpeed, gravity,
      windDir: current.wind_direction_10m || 0,
    };
  }

  function buildChips(mech) {
    const chips = [
      { label: mech.info.label, hazard: mech.isStormy || mech.isRainy },
      { label: `Wind ${Math.round(mech.wind)} km/h`, hazard: mech.gusty },
      { label: `Feels ${Math.round(mech.temp)}°`, hazard: mech.isHot },
      { label: `Humidity ${Math.round(mech.humidity)}%`, hazard: mech.highHumidity },
      { label: `UV ${mech.uv.toFixed(1)}`, hazard: mech.highUv },
    ];
    el.weatherChips.innerHTML = chips.map(c =>
      `<span class="chip${c.hazard ? " is-hazard" : ""}">${c.label}</span>`
    ).join("");
  }

  function buildRules(mech) {
    const rules = [];
    rules.push(`Wind at ${Math.round(mech.wind)} km/h sets the pace${mech.gusty ? " and fires gust shoves that speed the run up for a moment" : ""}.`);
    if (mech.isRainy) rules.push(`${mech.isStormy ? "Storm" : "Rain"} conditions are filling the ground with puddles — jump to clear them.`);
    if (mech.isStormy) rules.push("Thunderstorm activity triggers telegraphed lightning strikes — they dim before they strike, so watch for the flash.");
    if (mech.debrisOn) rules.push("Wind this strong is throwing debris at head height — duck under it.");
    if (mech.isFoggy || mech.fogFactor > 0.15) rules.push(`${mech.isFoggy ? "Harmattan haze" : "Cloud cover"} is shortening how far ahead you can see — hazards reveal late.`);
    if (mech.highUv) rules.push("High UV is causing bright glare flashes across the stage.");
    if (mech.isHot) rules.push("It's 32°C+ out — your stamina drains, and low stamina shortens your jump. Grab tokens to recover.");
    if (mech.highHumidity) rules.push("Humid air makes your jumps a little floatier — gravity is softer than usual.");
    el.rulesList.innerHTML = rules.map(r => `<li>${r}</li>`).join("");
  }

  /* ----------------------------------------------------------------------
   * Small synthesised SFX — independent of the ambient HarmattanAudio engine
   * -------------------------------------------------------------------- */
  let sfxCtx = null;
  function ensureSfxCtx() {
    if (!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (sfxCtx.state === "suspended") sfxCtx.resume();
    return sfxCtx;
  }
  function blip(freq, dur, type, peak) {
    const ctx = ensureSfxCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function sfx(name) {
    if (!soundOn) return;
    if (name === "jump") blip(520, 0.18, "triangle", 0.22);
    else if (name === "duck") blip(220, 0.12, "square", 0.14);
    else if (name === "collect") { blip(880, 0.15, "sine", 0.22); setTimeout(() => blip(1180, 0.15, "sine", 0.18), 70); }
    else if (name === "hit") blip(140, 0.35, "sawtooth", 0.28);
    else if (name === "gust") blip(90, 0.4, "sine", 0.2);
    else if (name === "thunder") blip(70, 0.5, "sawtooth", 0.3);
  }

  /* ----------------------------------------------------------------------
   * Sound toggle (mirrors the main weather page's HarmattanAudio wiring)
   * -------------------------------------------------------------------- */
  let soundOn = localStorage.getItem("harmattan-sound") === "on";
  function setSoundUI(on) {
    el.soundToggle.classList.toggle("is-on", on);
    el.soundToggle.setAttribute("aria-pressed", String(on));
  }
  setSoundUI(soundOn);
  el.soundToggle.addEventListener("click", () => {
    if (!window.HarmattanAudio) return;
    soundOn = window.HarmattanAudio.toggle();
    localStorage.setItem("harmattan-sound", soundOn ? "on" : "off");
    setSoundUI(soundOn);
  });
  if (soundOn) {
    const resumeOnce = () => {
      if (window.HarmattanAudio) window.HarmattanAudio.setEnabled(true);
      window.removeEventListener("pointerdown", resumeOnce);
      window.removeEventListener("keydown", resumeOnce);
    };
    window.addEventListener("pointerdown", resumeOnce, { once: true });
    window.addEventListener("keydown", resumeOnce, { once: true });
  }

  /* ----------------------------------------------------------------------
   * Weather loading
   * -------------------------------------------------------------------- */
  function resolveCity() {
    const stored = localStorage.getItem("harmattan-city");
    return CITIES.find(c => c.name === stored) || FALLBACK_CITY;
  }

  async function fetchCurrentWeather(city) {
    const params = new URLSearchParams({
      latitude: city.lat,
      longitude: city.lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index",
      timezone: "auto",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) throw new Error(`Weather service responded ${res.status}`);
    const data = await res.json();
    return data.current;
  }

  let city = resolveCity();
  let mech = computeMechanics(FALLBACK_CURRENT);

  async function loadWeather() {
    city = resolveCity();
    el.gameCityTag.textContent = `Reading the sky over ${city.name}…`;
    try {
      const current = await fetchCurrentWeather(city);
      mech = computeMechanics(current);
    } catch (err) {
      mech = computeMechanics(FALLBACK_CURRENT);
      console.error(err);
    }
    applyMechanicsToUI();
  }

  function applyMechanicsToUI() {
    el.stage.dataset.condition = mech.category;
    el.stage.dataset.day = mech.isDay ? "true" : "false";
    el.gameCityTag.innerHTML = `${city.name} · <span class="tag-condition">${mech.info.label}</span>`;
    el.gameCityName.textContent = city.name + "'s";
    el.startSub.textContent = `Today's ${city.name} sky: ${mech.info.label.toLowerCase()}, wind ${Math.round(mech.wind)} km/h.`;
    el.stageFog.style.width = `${Math.round(mech.fogFactor * 55)}%`;
    el.staminaWrap.hidden = !mech.isHot;
    buildChips(mech);
    buildRules(mech);
    if (window.HarmattanAudio) {
      window.HarmattanAudio.setCondition(mech.category, mech.isDay, new Date().getHours());
    }
    el.bestValue.textContent = bestScore();
  }

  function bestKey() { return `harmattan-game-best-${city.name}`; }
  function bestScore() { return Number(localStorage.getItem(bestKey())) || 0; }

  /* ----------------------------------------------------------------------
   * Game state
   * -------------------------------------------------------------------- */
  let state = "idle"; // idle | running | gameover
  let stageWidth = el.stage.clientWidth;
  window.addEventListener("resize", () => { stageWidth = el.stage.clientWidth; });

  let jumpOffset = 0, vy = 0, isDucking = false, duckTimer = null;
  let obstacles = [];
  let elapsed = 0, distance = 0, tokensCollected = 0, score = 0;
  let stamina = 100, staminaDepleted = false;
  let gustPhase = "idle", gustPhaseTime = 0; // idle -> warn -> active
  let glareTimer = 0;
  let spawnTimers = { puddle: 0, lightning: 0, debris: 0, token: 0 };
  let rafId = null, lastTime = 0;

  // returns spawn intervals in seconds, to match the second-denominated `dt` timers are decremented by
  function spawnIntervals() {
    const rampMul = 1 + Math.min(elapsed / 50, 0.5);
    const ms = {
      puddle: (mech.isStormy ? 900 : mech.isRainy ? 1100 : 1600) / rampMul,
      lightning: clamp(5000 - mech.wind * 20, 2200, 5000) / rampMul,
      debris: clamp(4000 - mech.wind * 60, 1400, 4000) / rampMul,
      token: 3200 / (mech.isHot ? 0.8 : 1),
    };
    return { puddle: ms.puddle / 1000, lightning: ms.lightning / 1000, debris: ms.debris / 1000, token: ms.token / 1000 };
  }

  function resetRun() {
    obstacles.forEach(o => o.el.remove());
    obstacles = [];
    jumpOffset = 0; vy = 0; isDucking = false;
    clearTimeout(duckTimer);
    el.player.classList.remove("is-ducking", "is-hit");
    elapsed = 0; distance = 0; tokensCollected = 0; score = 0;
    stamina = 100; staminaDepleted = false;
    gustPhase = "idle"; gustPhaseTime = rand(2, 4);
    glareTimer = rand(3, 6);
    const intervals = spawnIntervals();
    spawnTimers = {
      puddle: rand(intervals.puddle * 0.6, intervals.puddle),
      lightning: rand(intervals.lightning * 0.6, intervals.lightning),
      debris: rand(intervals.debris * 0.6, intervals.debris),
      token: rand(intervals.token * 0.6, intervals.token),
    };
    el.scoreValue.textContent = "0";
    el.staminaBar.style.width = "100%";
    el.gustWarning.classList.remove("is-visible");
  }

  function startGame() {
    resetRun();
    state = "running";
    el.startOverlay.hidden = true;
    el.gameoverOverlay.hidden = true;
    el.player.classList.add("is-running");
    if (window.HarmattanAudio) {
      window.HarmattanAudio.init();
      window.HarmattanAudio.setEnabled(soundOn);
      window.HarmattanAudio.setCondition(mech.category, mech.isDay, new Date().getHours());
    }
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    state = "gameover";
    cancelAnimationFrame(rafId);
    el.player.classList.remove("is-running");
    el.player.classList.add("is-hit");
    sfx("hit");
    const best = Math.max(bestScore(), score);
    localStorage.setItem(bestKey(), String(best));
    el.finalScore.textContent = score;
    el.finalBest.textContent = best;
    el.bestValue.textContent = best;
    el.gameoverOverlay.hidden = false;
  }

  /* ----------------------------------------------------------------------
   * Player actions
   * -------------------------------------------------------------------- */
  function jump() {
    if (state !== "running" || jumpOffset > 0 || isDucking) return;
    const staminaFactor = staminaDepleted ? 0.75 : 1;
    vy = BASE_JUMP_SPEED * staminaFactor;
    sfx("jump");
  }
  function duck() {
    if (state !== "running" || jumpOffset > 0) return;
    isDucking = true;
    el.player.classList.add("is-ducking");
    sfx("duck");
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      isDucking = false;
      el.player.classList.remove("is-ducking");
    }, DUCK_DURATION * 1000);
  }

  /* ----------------------------------------------------------------------
   * Collision
   * -------------------------------------------------------------------- */
  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
      a.groundY < b.groundY + b.height && a.groundY + a.height > b.groundY;
  }

  function playerBox() {
    return {
      x: PLAYER_X, width: PLAYER_W,
      groundY: jumpOffset,
      height: isDucking ? PLAYER_H_DUCK : PLAYER_H_STAND,
    };
  }

  /* ----------------------------------------------------------------------
   * Spawning
   * -------------------------------------------------------------------- */
  function spawn(type) {
    const def = OBSTACLE_DEFS[type];
    const wrap = document.createElement("div");
    wrap.className = `obstacle ${type}`;
    if (type === "lightning") { wrap.innerHTML = LIGHTNING_SVG; wrap.classList.add("is-warning"); }
    else if (type === "debris") wrap.innerHTML = DEBRIS_SVG;
    else if (type === "token") wrap.innerHTML = TOKEN_ICONS[Math.floor(Math.random() * TOKEN_ICONS.length)];
    el.obstacleLayer.appendChild(wrap);
    obstacles.push({
      type, el: wrap,
      x: stageWidth + 40, width: def.width, height: def.height, groundY: def.groundY,
      warnRemaining: type === "lightning" ? LIGHTNING_WARN_TIME : 0,
      collected: false,
    });
  }

  function updateSpawns(dt) {
    const intervals = spawnIntervals();
    spawnTimers.puddle -= dt;
    if (spawnTimers.puddle <= 0) { spawn("puddle"); spawnTimers.puddle = rand(intervals.puddle * 0.8, intervals.puddle * 1.2); }

    if (mech.isStormy) {
      spawnTimers.lightning -= dt;
      if (spawnTimers.lightning <= 0) { spawn("lightning"); spawnTimers.lightning = rand(intervals.lightning * 0.8, intervals.lightning * 1.2); }
    }
    if (mech.debrisOn) {
      spawnTimers.debris -= dt;
      if (spawnTimers.debris <= 0) { spawn("debris"); spawnTimers.debris = rand(intervals.debris * 0.8, intervals.debris * 1.2); }
    }
    spawnTimers.token -= dt;
    if (spawnTimers.token <= 0) { spawn("token"); spawnTimers.token = rand(intervals.token * 0.8, intervals.token * 1.2); }
  }

  /* ----------------------------------------------------------------------
   * Gust + glare event timelines
   * -------------------------------------------------------------------- */
  function updateGust(dt) {
    if (!mech.gusty) return 1;
    gustPhaseTime -= dt;
    if (gustPhase === "idle" && gustPhaseTime <= 0) {
      gustPhase = "warn"; gustPhaseTime = GUST_WARN_TIME;
      el.gustWarning.classList.add("is-visible");
    } else if (gustPhase === "warn" && gustPhaseTime <= 0) {
      gustPhase = "active"; gustPhaseTime = GUST_DURATION;
      el.gustWarning.classList.remove("is-visible");
      sfx("gust");
    } else if (gustPhase === "active" && gustPhaseTime <= 0) {
      gustPhase = "idle";
      gustPhaseTime = clamp(7000 - mech.wind * 70, 2600, 7000) / 1000;
    }
    return gustPhase === "active" ? GUST_MULT : 1;
  }

  function updateGlare(dt) {
    if (!mech.highUv) return;
    glareTimer -= dt;
    if (glareTimer <= 0) {
      el.stageGlare.classList.remove("is-flashing");
      void el.stageGlare.offsetWidth;
      el.stageGlare.classList.add("is-flashing");
      glareTimer = clamp(9000 - mech.uv * 500, 3000, 9000) / 1000;
    }
  }

  /* ----------------------------------------------------------------------
   * Main loop
   * -------------------------------------------------------------------- */
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    elapsed += dt;

    const rampMul = 1 + Math.min(elapsed / 50, 0.5);
    const gustMul = updateGust(dt);
    const speed = mech.baseSpeed * rampMul * gustMul;
    distance += speed * dt;

    updateGlare(dt);
    updateSpawns(dt);

    // physics
    vy -= mech.gravity * dt;
    jumpOffset = Math.max(0, jumpOffset + vy * dt);
    if (jumpOffset === 0) vy = 0;
    el.player.classList.toggle("is-airborne", jumpOffset > 0);
    el.player.style.transform = `translateY(${-jumpOffset}px)`;
    el.playerShadow.style.opacity = clamp(1 - jumpOffset / 110, 0.15, 1);
    el.playerShadow.style.transform = `scale(${clamp(1 - jumpOffset / 140, 0.35, 1)})`;

    // stamina
    if (mech.isHot) {
      stamina = clamp(stamina - dt * 6, 0, 100);
      staminaDepleted = stamina <= 0;
      el.staminaBar.style.width = `${stamina}%`;
    }

    // obstacles
    const pBox = playerBox();
    let gameOver = false;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      o.el.style.transform = `translateX(${o.x}px)`;

      if (mech.fogFactor > 0.05) {
        const revealX = stageWidth - stageWidth * mech.fogFactor * 0.55;
        o.el.style.opacity = o.x > revealX ? "0.12" : "1";
      }

      if (o.type === "lightning" && o.warnRemaining > 0) {
        o.warnRemaining -= dt;
        if (o.warnRemaining <= 0) { o.el.classList.remove("is-warning"); sfx("thunder"); flashStorm(); }
      }

      if (o.type === "token") {
        if (!o.collected && overlaps(pBox, o)) {
          o.collected = true;
          o.el.remove();
          obstacles.splice(i, 1);
          tokensCollected++;
          if (mech.isHot) { stamina = clamp(stamina + 30, 0, 100); staminaDepleted = stamina <= 0; }
          sfx("collect");
          continue;
        }
      } else if (!(o.type === "lightning" && o.warnRemaining > 0)) {
        if (overlaps(pBox, o)) gameOver = true;
      }

      if (o.x < -o.width - 20) { o.el.remove(); obstacles.splice(i, 1); }
    }

    score = Math.floor(distance / 9) + tokensCollected * 20;
    el.scoreValue.textContent = score;

    if (gameOver) { endGame(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function flashStorm() {
    el.stageFlash.classList.remove("is-flashing");
    void el.stageFlash.offsetWidth;
    el.stageFlash.classList.add("is-flashing");
  }

  /* ----------------------------------------------------------------------
   * Input
   * -------------------------------------------------------------------- */
  el.stage.addEventListener("pointerdown", () => {
    if (state === "idle") startGame();
    else if (state === "running") jump();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && state === "idle") { e.preventDefault(); startGame(); return; }
    if (state !== "running") return;
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    else if (e.code === "ArrowDown") { e.preventDefault(); duck(); }
  });

  el.jumpBtn.addEventListener("click", () => { if (state === "idle") startGame(); else jump(); });
  el.duckBtn.addEventListener("click", () => duck());

  el.retryBtn.addEventListener("click", async () => {
    el.gameoverOverlay.hidden = true;
    el.startOverlay.hidden = false;
    el.startSub.textContent = `Re-checking the sky over ${city.name}…`;
    state = "idle";
    await loadWeather();
    startGame();
  });

  /* ----------------------------------------------------------------------
   * Init
   * -------------------------------------------------------------------- */
  (async function init() {
    stageWidth = el.stage.clientWidth;
    await loadWeather();
  })();
})();
