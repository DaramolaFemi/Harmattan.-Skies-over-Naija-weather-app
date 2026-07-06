(() => {
  "use strict";

  /* ----------------------------------------------------------------------
   * Shared data — Nigerian city list + weather-code interpretation,
   * defined once in weather-data.js and reused by the 9jaRun game page.
   * -------------------------------------------------------------------- */
  const CITIES = window.HarmattanData.CITIES;
  const interpret = window.HarmattanData.interpret;

  /* ----------------------------------------------------------------------
   * Icons — minimal line-style SVGs, matched to the brand mark language
   * -------------------------------------------------------------------- */
  const ICONS = {
    sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.6"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" stroke-linecap="round"/></svg>`,
    cloudSun: `<svg viewBox="0 0 24 24"><path d="M6.8 8.6a4 4 0 0 1 7.6-1.3" stroke-linecap="round"/><circle cx="9.2" cy="6" r="2.4"/><path d="M8 19h9.5a3.8 3.8 0 0 0 .5-7.57A5 5 0 0 0 8.6 9.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M6.5 18h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.2 8.2 4.2 4.2 0 0 0 6.5 18Z" stroke-linejoin="round"/></svg>`,
    rain: `<svg viewBox="0 0 24 24"><path d="M6.5 13.5h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.2 3.7 4.2 4.2 0 0 0 6.5 13.5Z" stroke-linejoin="round"/><path d="M8 17.5v3M12 17.5v3M16 17.5v3" stroke-linecap="round"/></svg>`,
    storm: `<svg viewBox="0 0 24 24"><path d="M6.5 12.5h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.2 2.7 4.2 4.2 0 0 0 6.5 12.5Z" stroke-linejoin="round"/><path d="m13 12-3 5h3l-2 5 6-7h-3l2-3z" stroke-linejoin="round" fill="currentColor"/></svg>`,
    haze: `<svg viewBox="0 0 24 24"><path d="M3 8h13M3 12h18M3 16h13" stroke-linecap="round"/></svg>`,
    wind: `<svg viewBox="0 0 24 24"><path d="M3 8h11.5a2.5 2.5 0 1 0-2.4-3.2M3 12h15a2.8 2.8 0 1 1-2.7 3.6M3 16h9a2 2 0 1 1-1.9 2.6" stroke-linecap="round"/></svg>`,
    humidity: `<svg viewBox="0 0 24 24"><path d="M12 2.8s6.2 7 6.2 11.3a6.2 6.2 0 1 1-12.4 0C5.8 9.8 12 2.8 12 2.8Z" stroke-linejoin="round"/></svg>`,
    pressure: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 12 15.2 8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    uv: `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="4.4"/><path d="M12 3.5v2.4M4.6 8.4l1.8 1.5M19.4 8.4l-1.8 1.5M3.2 15h2.6M18.2 15h2.6" stroke-linecap="round"/></svg>`,
    sunrise: `<svg viewBox="0 0 24 24"><path d="M12 4v4" stroke-linecap="round"/><path d="m7.5 10.5 1.6 1.6M16.5 10.5l-1.6 1.6" stroke-linecap="round"/><path d="M5 15a7 7 0 0 1 14 0" stroke-linecap="round"/><path d="M2.5 15h19M4.5 18.5h15" stroke-linecap="round"/></svg>`,
    sunset: `<svg viewBox="0 0 24 24"><path d="M12 4v4" stroke-linecap="round" opacity=".4"/><path d="m7.5 10.5 1.6 1.6M16.5 10.5l-1.6 1.6" stroke-linecap="round"/><path d="M5 15a7 7 0 0 1 14 0" stroke-linecap="round"/><path d="M2.5 18.5h19M4.5 15h15" stroke-linecap="round"/></svg>`,
    drop: `<svg viewBox="0 0 24 24"><path d="M12 2.8s6.2 7 6.2 11.3a6.2 6.2 0 1 1-12.4 0C5.8 9.8 12 2.8 12 2.8Z" stroke-linejoin="round"/></svg>`,
  };

  /* ----------------------------------------------------------------------
   * Mood lines — a bank of contextual one-liners, not a live AI call.
   * Picked randomly per condition plus whatever extra mood the numbers
   * (heat, humidity, wind, time of day) happen to justify.
   * -------------------------------------------------------------------- */
  const MOODS = {
    clear: [
      "Perfect weather for a walk — leave the umbrella, keep the sunscreen.",
      "Skies this clear don't happen every day. Go outside and use them.",
      "Not a cloud in sight. Lagos traffic, on the other hand…",
      "Shades on, playlist loud, vibes accordingly.",
      "The kind of afternoon that makes agbada weather official.",
      "Clear skies ahead — good day for suya and slow evenings.",
      "Sun's out, so is everyone's ankara.",
      "A rare day where ‘let's meet outside’ actually makes sense.",
      "Blue skies, zero drama. Enjoy it while it lasts.",
      "This is the weather influencers fake with filters. Yours is real.",
      "Good day to finally wash that car.",
      "Bright, warm, and doing absolutely nothing wrong.",
    ],
    clouds: [
      "Overcast and undecided — much like your weekend plans.",
      "The sky's wearing a grey cardigan today.",
      "Not quite sunny, not quite gloomy. A weather Switzerland.",
      "Perfect lighting for photos, zero commitment to rain.",
      "Clouds gathering like they're planning something. Probably nothing.",
      "A calm, moody sky — good for long thoughts and longer playlists.",
      "Neither jacket nor sunglasses required. Just vibes.",
      "The clouds are auditioning for a rainstorm but haven't got the part yet.",
      "Soft light, soft mood. Take it easy today.",
      "Grey skies, but make it aesthetic.",
    ],
    rain: [
      "Today feels like staying indoors with a cup of coffee.",
      "The streets are getting a free wash. Your shoes will not thank you.",
      "Umbrella: mandatory. Okada ride: adventurous.",
      "Good day to watch the rain from a window you're not paying rent to leave.",
      "Rain's falling, excuses for staying in bed are rising.",
      "Traffic's about to triple. Leave earlier or just accept your fate.",
      "Nothing hits like garri and rain sounds right now.",
      "The gutters are about to become rivers. Tread carefully.",
      "A proper downpour — dramatic, sudden, and slightly personal.",
      "Perfect soundtrack for indoor productivity. Or an indoor nap.",
    ],
    storm: [
      "Thunder's doing the most today. Maybe unplug the router, just in case.",
      "The sky is arguing with itself. Best to stay out of it.",
      "Lightning show, no ticket required. Watch from indoors though.",
      "This is not umbrella weather. This is stay-inside-and-pray weather.",
      "Generator weather has officially arrived.",
      "The heavens are clearing their throat rather aggressively.",
      "Storm's here — candles ready, light supply odds not looking great.",
      "Big weather energy. Respect it and reschedule the outdoor plans.",
      "Somewhere, a goat is questioning its life choices right now.",
      "Dramatic skies for a dramatic day. Stay safe out there.",
    ],
    fog: [
      "Harmattan's here — moisturizer is no longer optional, it's policy.",
      "Visibility's dropping. So is the humidity. Chapped lips incoming.",
      "The whole city's wearing a soft-focus filter today.",
      "Dust in the air, cardigan on the shoulders, lotion in the bag.",
      "Harmattan haze — mysterious mornings, dry skin evenings.",
      "Everything looks like a memory today. Also, please moisturize.",
      "The sky's gone hazy and so has everyone's skincare routine.",
      "Cool mornings, dusty afternoons — classic harmattan mood swing.",
      "Great weather for pepper soup, terrible weather for contact lenses.",
      "The horizon's playing hide and seek behind all this dust.",
    ],
  };

  const MOOD_BONUS = {
    hot: [
      "It's the kind of hot where fans just move the heat around.",
      "Zobo weather. Ice water weather. Stay-in-the-shade weather.",
      "The sun is not playing today. Hydrate like it's a full-time job.",
      "Heat like this makes 'just a quick errand' a personal challenge.",
      "Even the AC is sweating today.",
      "Sunscreen isn't a suggestion right now, it's survival gear.",
    ],
    muggy: [
      "The air's thick enough to slice. Deodorant, don't fail us now.",
      "Humidity's doing the most — hair, plans, and patience all affected.",
      "Sticky air, slower pace. Take today at half speed.",
      "It's a two-shower kind of day.",
    ],
    windy: [
      "Wind's picking up — hold your umbrella and your gele.",
      "Breezy enough to rearrange your hair and your plans.",
      "Good kite weather, bad hat weather.",
    ],
    night: [
      "Night's settling in soft. Good time to wind down.",
      "The city's quieter now. Perfect for a slow walk or a slower playlist.",
      "Stars or no stars, the night's calling for something warm to drink.",
      "Everything sounds better after dark. Even the neighbour's generator, somehow.",
    ],
  };

  let lastMood = "";

  function pickMood({ category, isDay, temp, humidity, wind }) {
    let pool = [...(MOODS[category] || MOODS.clouds)];
    if (temp >= 32) pool.push(...MOOD_BONUS.hot);
    if (humidity >= 80) pool.push(...MOOD_BONUS.muggy);
    if (wind >= 22) pool.push(...MOOD_BONUS.windy);
    if (!isDay) pool.push(...MOOD_BONUS.night);

    let choice = lastMood;
    let guard = 0;
    while (choice === lastMood && guard < 8) {
      choice = pool[Math.floor(Math.random() * pool.length)];
      guard++;
    }
    lastMood = choice;
    return choice;
  }

  /* ----------------------------------------------------------------------
   * State
   * -------------------------------------------------------------------- */
  const state = {
    unit: localStorage.getItem("harmattan-unit") || "C",
    theme: localStorage.getItem("harmattan-theme") || "dark",
    city: CITIES.find(c => c.name === localStorage.getItem("harmattan-city")) || CITIES[0],
    fetchToken: 0,
  };

  /* ----------------------------------------------------------------------
   * DOM refs
   * -------------------------------------------------------------------- */
  const el = {
    hero: document.getElementById("hero"),
    heroLoading: document.getElementById("heroLoading"),
    greeting: document.getElementById("greeting"),
    cityName: document.getElementById("cityName"),
    stateTag: document.getElementById("stateTag"),
    dateTime: document.getElementById("dateTime"),
    tempIcon: document.getElementById("tempIcon"),
    tempValue: document.getElementById("tempValue"),
    conditionLabel: document.getElementById("conditionLabel"),
    feelsLike: document.getElementById("feelsLike"),
    moodLine: document.getElementById("moodLine"),
    moodShuffle: document.getElementById("moodShuffle"),
    fxRain: document.getElementById("fxRain"),
    statsGrid: document.getElementById("statsGrid"),
    forecastTrack: document.getElementById("forecastTrack"),
    tzLabel: document.getElementById("tzLabel"),
    cityChips: document.getElementById("cityChips"),
    citySearch: document.getElementById("citySearch"),
    cityList: document.getElementById("cityList"),
    themeToggle: document.getElementById("themeToggle"),
    unitToggle: document.getElementById("unitToggle"),
    soundToggle: document.getElementById("soundToggle"),
    toast: document.getElementById("toast"),
    year: document.getElementById("year"),
  };

  let clockTimer = null;
  let lastPayload = null;
  let moodContext = null;

  /* ----------------------------------------------------------------------
   * Helpers
   * -------------------------------------------------------------------- */
  function cToF(c) { return c * 9 / 5 + 32; }

  function fmtTemp(celsius) {
    const v = state.unit === "F" ? cToF(celsius) : celsius;
    return Math.round(v);
  }

  function localNow(utcOffsetSeconds) {
    const utcMs = Date.now();
    return new Date(utcMs + utcOffsetSeconds * 1000 + new Date().getTimezoneOffset() * 60000);
  }

  function greetingFor(hour) {
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 20) return "Good evening";
    return "Good night";
  }

  function fmtClock(date) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function fmtDate(date) {
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove("is-visible"), 3800);
  }

  /* ----------------------------------------------------------------------
   * Rendering
   * -------------------------------------------------------------------- */
  function renderChips() {
    el.cityChips.innerHTML = "";
    CITIES.filter(c => c.featured).forEach(c => {
      const btn = document.createElement("button");
      btn.className = "chip" + (c.name === state.city.name ? " is-active" : "");
      btn.type = "button";
      btn.textContent = c.name;
      btn.addEventListener("click", () => selectCity(c));
      el.cityChips.appendChild(btn);
    });
  }

  function renderCityList() {
    el.cityList.innerHTML = CITIES.map(c => `<option value="${c.name}">`).join("");
  }

  function initHeroParallax() {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const scene = document.getElementById("scene");
    const content = document.querySelector(".hero-content");
    let raf = null;

    el.hero.addEventListener("mousemove", (e) => {
      const rect = el.hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        scene.style.transform = `translate(${x * 16}px, ${y * 12}px) scale(1.03)`;
        content.style.transform = `translate(${x * -8}px, ${y * -5}px)`;
        raf = null;
      });
    });

    el.hero.addEventListener("mouseleave", () => {
      scene.style.transform = "";
      content.style.transform = "";
    });
  }

  function restartHeroAnimations() {
    const content = document.querySelector(".hero-content");
    content.querySelectorAll("*").forEach(node => {
      node.style.animation = "none";
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight;
      node.style.animation = "";
    });
  }

  function renderClock(utcOffsetSeconds) {
    clearInterval(clockTimer);
    const tick = () => {
      const now = localNow(utcOffsetSeconds);
      el.greeting.textContent = greetingFor(now.getHours());
      el.dateTime.textContent = `${fmtDate(now)} · ${fmtClock(now)}`;
    };
    tick();
    clockTimer = setInterval(tick, 30000);
  }

  function renderHero(payload) {
    const { current, daily } = payload;
    const info = interpret(current.weather_code, current.is_day);
    const isDay = current.is_day === 1;
    const isHot = current.temperature_2m >= 32;

    el.hero.dataset.condition = info.category;
    el.hero.dataset.day = isDay ? "true" : "false";
    document.body.dataset.condition = info.category;
    document.body.dataset.day = isDay ? "true" : "false";
    document.body.dataset.hot = isHot ? "true" : "false";

    el.cityName.textContent = state.city.name;
    el.stateTag.textContent = state.city.zone;

    el.tempIcon.innerHTML = ICONS[info.icon];
    el.tempValue.textContent = fmtTemp(current.temperature_2m);
    el.conditionLabel.textContent = info.label;
    el.feelsLike.textContent = `Feels like ${fmtTemp(current.apparent_temperature)}°${state.unit} · High ${fmtTemp(daily.temperature_2m_max[0])}° / Low ${fmtTemp(daily.temperature_2m_min[0])}°`;

    renderClock(payload.utc_offset_seconds);
    el.tzLabel.textContent = payload.timezone.split("/").pop().replace("_", " ");

    moodContext = {
      category: info.category,
      isDay,
      temp: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      wind: current.wind_speed_10m,
    };
    el.moodLine.textContent = pickMood(moodContext);

    restartHeroAnimations();

    if (window.HarmattanAudio) {
      const localHour = localNow(payload.utc_offset_seconds).getHours();
      window.HarmattanAudio.setCondition(info.category, isDay, localHour);
    }
  }

  function renderStats(payload) {
    const { current, daily } = payload;
    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);
    const rain = daily.precipitation_sum[0];

    const cards = [
      { icon: "humidity", label: "Humidity", value: `${Math.round(current.relative_humidity_2m)}%`, sub: "Relative" },
      { icon: "wind", label: "Wind", value: `${Math.round(current.wind_speed_10m)} km/h`, sub: bearingToCompass(current.wind_direction_10m) },
      { icon: "pressure", label: "Pressure", value: `${Math.round(current.surface_pressure)}`, sub: "hPa" },
      { icon: "uv", label: "UV Index", value: `${Math.round(daily.uv_index_max[0])}`, sub: uvLabel(daily.uv_index_max[0]) },
      { icon: "drop", label: "Rainfall", value: `${rain.toFixed(1)} mm`, sub: "Today" },
      { icon: "sunrise", label: "Sunrise", value: fmtClock(sunrise), sub: "Local" },
      { icon: "sunset", label: "Sunset", value: fmtClock(sunset), sub: "Local" },
      { icon: "haze", label: "Cloud cover", value: `${Math.round(current.cloud_cover)}%`, sub: skyLabel(current.cloud_cover) },
    ];

    el.statsGrid.innerHTML = cards.map((c, i) => `
      <div class="stat-card" style="animation-delay:${i * 0.05 + 0.1}s">
        <div class="stat-icon">${ICONS[c.icon]}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-sub">${c.sub}</div>
      </div>
    `).join("");
  }

  function renderForecast(payload) {
    const { daily } = payload;
    const days = daily.time.slice(0, 5);
    el.forecastTrack.innerHTML = days.map((iso, i) => {
      const date = new Date(iso + "T12:00:00");
      const label = i === 0 ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short" });
      const info = interpret(daily.weather_code[i], 1);
      return `
        <div class="forecast-card" style="animation-delay:${i * 0.06 + 0.15}s">
          <div class="fc-day">${label}</div>
          <div class="fc-icon">${ICONS[info.icon]}</div>
          <div><span class="fc-hi">${fmtTemp(daily.temperature_2m_max[i])}°</span><span class="fc-lo">${fmtTemp(daily.temperature_2m_min[i])}°</span></div>
          <div class="fc-rain">${daily.precipitation_sum[i] > 0 ? daily.precipitation_sum[i].toFixed(1) + " mm" : "Dry"}</div>
        </div>
      `;
    }).join("");
  }

  function bearingToCompass(deg) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  }

  function uvLabel(uv) {
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
  }

  function skyLabel(pct) {
    if (pct < 15) return "Clear";
    if (pct < 50) return "Scattered";
    if (pct < 85) return "Broken";
    return "Overcast";
  }

  function renderAll(payload) {
    lastPayload = payload;
    renderHero(payload);
    renderStats(payload);
    renderForecast(payload);
  }

  function renderSkeletons() {
    el.statsGrid.innerHTML = Array.from({ length: 8 }).map((_, i) => `
      <div class="stat-card is-skeleton" style="animation-delay:${i * 0.04}s">
        <div class="stat-icon"></div>
        <div class="skel-bar" style="width:60%;height:.6rem;"></div>
        <div class="skel-bar" style="width:75%;height:1.1rem;"></div>
        <div class="skel-bar" style="width:45%;height:.6rem;"></div>
      </div>
    `).join("");
    el.forecastTrack.innerHTML = Array.from({ length: 5 }).map((_, i) => `
      <div class="forecast-card is-skeleton" style="animation-delay:${i * 0.05}s">
        <div class="skel-bar" style="width:50%;height:.7rem;margin:0 auto;"></div>
        <div class="fc-icon"></div>
        <div class="skel-bar" style="width:60%;height:.9rem;"></div>
        <div class="skel-bar" style="width:40%;height:.6rem;"></div>
      </div>
    `).join("");
  }

  /* ----------------------------------------------------------------------
   * Data fetching
   * -------------------------------------------------------------------- */
  async function fetchWeather(city) {
    const token = ++state.fetchToken;
    el.heroLoading.classList.remove("is-hidden");
    renderSkeletons();

    const params = new URLSearchParams({
      latitude: city.lat,
      longitude: city.lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum",
      timezone: "auto",
      forecast_days: "6",
    });

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if (!res.ok) throw new Error(`Weather service responded ${res.status}`);
      const data = await res.json();
      if (token !== state.fetchToken) return; // a newer request superseded this one
      renderAll(data);
      el.heroLoading.classList.add("is-hidden");
    } catch (err) {
      if (token !== state.fetchToken) return;
      el.heroLoading.classList.add("is-hidden");
      if (lastPayload) renderAll(lastPayload); // fall back to last known weather rather than stuck skeletons
      showToast("Couldn't reach the weather service — check your connection and try again.");
      console.error(err);
    }
  }

  function selectCity(city) {
    state.city = city;
    localStorage.setItem("harmattan-city", city.name);
    el.citySearch.value = "";
    renderChips();
    fetchWeather(city);
  }

  /* ----------------------------------------------------------------------
   * Theme + unit toggles
   * -------------------------------------------------------------------- */
  function applyTheme(theme) {
    state.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem("harmattan-theme", theme);
  }

  function applyUnit(unit) {
    state.unit = unit;
    localStorage.setItem("harmattan-unit", unit);
    el.unitToggle.querySelector(".unit-c").classList.toggle("is-active", unit === "C");
    el.unitToggle.querySelector(".unit-f").classList.toggle("is-active", unit === "F");
    if (lastPayload) renderAll(lastPayload);
  }

  /* ----------------------------------------------------------------------
   * Events
   * -------------------------------------------------------------------- */
  el.themeToggle.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  el.unitToggle.addEventListener("click", () => {
    applyUnit(state.unit === "C" ? "F" : "C");
  });

  el.moodShuffle.addEventListener("click", () => {
    if (!moodContext) return;
    el.moodLine.textContent = pickMood(moodContext);
    el.moodLine.classList.remove("is-swapping");
    // eslint-disable-next-line no-unused-expressions
    el.moodLine.offsetHeight;
    el.moodLine.classList.add("is-swapping");
    el.moodShuffle.classList.add("is-spinning");
    setTimeout(() => el.moodShuffle.classList.remove("is-spinning"), 400);
  });

  /* ---------------- page-wide rain layer ---------------- */
  function buildRainDrops() {
    const frag = document.createDocumentFragment();
    const count = 60;
    for (let i = 0; i < count; i++) {
      const drop = document.createElement("span");
      drop.className = "fx-drop";
      const duration = 0.6 + Math.random() * 0.6;
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.height = `${40 + Math.random() * 60}px`;
      drop.style.animationDuration = `${duration}s`;
      drop.style.animationDelay = `${Math.random() * -duration}s`;
      drop.style.opacity = 0.35 + Math.random() * 0.5;
      frag.appendChild(drop);
    }
    el.fxRain.appendChild(frag);
  }

  /* ---------------- ambient sound ---------------- */
  function setSoundUI(on) {
    el.soundToggle.classList.toggle("is-on", on);
    el.soundToggle.setAttribute("aria-pressed", String(on));
  }

  el.soundToggle.addEventListener("click", () => {
    if (!window.HarmattanAudio) return;
    const on = window.HarmattanAudio.toggle();
    localStorage.setItem("harmattan-sound", on ? "on" : "off");
    setSoundUI(on);
  });

  // Browsers block audio until a real user gesture. If sound was left on
  // last visit, the very next tap or key press anywhere resumes it —
  // no need to hunt for the toggle again.
  if (localStorage.getItem("harmattan-sound") === "on") {
    const resumeOnce = () => {
      if (window.HarmattanAudio) {
        window.HarmattanAudio.setEnabled(true);
        setSoundUI(true);
      }
      window.removeEventListener("pointerdown", resumeOnce);
      window.removeEventListener("keydown", resumeOnce);
    };
    window.addEventListener("pointerdown", resumeOnce, { once: true });
    window.addEventListener("keydown", resumeOnce, { once: true });
  }

  function trySearch(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    const match = CITIES.find(c => c.name.toLowerCase() === q) ||
      CITIES.find(c => c.name.toLowerCase().startsWith(q));
    if (match) {
      selectCity(match);
    } else {
      showToast(`"${raw.trim()}" isn't in our Nigerian city list yet.`);
    }
  }

  el.citySearch.addEventListener("change", () => trySearch(el.citySearch.value));
  el.citySearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySearch(el.citySearch.value);
  });

  /* ----------------------------------------------------------------------
   * Boot
   * -------------------------------------------------------------------- */
  applyTheme(state.theme);
  applyUnit(state.unit);
  el.year.textContent = new Date().getFullYear();
  renderCityList();
  renderChips();
  buildRainDrops();
  initHeroParallax();
  fetchWeather(state.city);
})();
