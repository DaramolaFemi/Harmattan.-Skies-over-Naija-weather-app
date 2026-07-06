/* ==========================================================================
 * Shared weather data — Nigerian city list + WMO weather-code interpretation.
 * Used by both the main weather page (main.js) and the 9jaRun game (game.js)
 * so the two stay in sync and neither duplicates the other's source of truth.
 * ========================================================================== */

window.HarmattanData = (() => {
  "use strict";

  /* ----------------------------------------------------------------------
   * Nigerian cities — curated set with coordinates and geopolitical zone
   * -------------------------------------------------------------------- */
  const CITIES = [
    { name: "Lagos",         zone: "South-West",    lat: 6.5244,  lon: 3.3792,  featured: true },
    { name: "Abuja",         zone: "FCT",           lat: 9.0765,  lon: 7.3986,  featured: true },
    { name: "Kano",          zone: "North-West",    lat: 12.0022, lon: 8.5920,  featured: true },
    { name: "Port Harcourt", zone: "South-South",   lat: 4.8156,  lon: 7.0498,  featured: true },
    { name: "Ibadan",        zone: "South-West",    lat: 7.3775,  lon: 3.9470,  featured: true },
    { name: "Enugu",         zone: "South-East",    lat: 6.4483,  lon: 7.5464,  featured: true },
    { name: "Kaduna",        zone: "North-West",    lat: 10.5105, lon: 7.4165,  featured: true },
    { name: "Calabar",       zone: "South-South",   lat: 4.9757,  lon: 8.3417,  featured: true },
    { name: "Benin City",    zone: "South-South",   lat: 6.3350,  lon: 5.6037  },
    { name: "Jos",           zone: "North-Central", lat: 9.8965,  lon: 8.8583  },
    { name: "Owerri",        zone: "South-East",    lat: 5.4840,  lon: 7.0351  },
    { name: "Uyo",           zone: "South-South",   lat: 5.0377,  lon: 7.9128  },
    { name: "Abeokuta",      zone: "South-West",    lat: 7.1475,  lon: 3.3619  },
    { name: "Warri",         zone: "South-South",   lat: 5.5160,  lon: 5.7500  },
    { name: "Sokoto",        zone: "North-West",    lat: 13.0059, lon: 5.2476  },
    { name: "Maiduguri",     zone: "North-East",    lat: 11.8333, lon: 13.1500 },
    { name: "Ilorin",        zone: "North-Central", lat: 8.4966,  lon: 4.5426  },
    { name: "Onitsha",       zone: "South-East",    lat: 6.1408,  lon: 6.7987  },
    { name: "Aba",           zone: "South-East",    lat: 5.1066,  lon: 7.3667  },
    { name: "Akure",         zone: "South-West",    lat: 7.2500,  lon: 5.1958  },
  ];

  /* ----------------------------------------------------------------------
   * Weather-code interpretation (WMO codes, per Open-Meteo)
   * -------------------------------------------------------------------- */
  function interpret(code, isDay) {
    const day = isDay !== 0;
    const table = {
      0:  { category: "clear",  label: "Clear sky" },
      1:  { category: "clear",  label: "Mostly clear" },
      2:  { category: "clouds", label: "Partly cloudy" },
      3:  { category: "clouds", label: "Overcast" },
      45: { category: "fog",    label: "Foggy" },
      48: { category: "fog",    label: "Harmattan haze" },
      51: { category: "rain",   label: "Light drizzle" },
      53: { category: "rain",   label: "Drizzle" },
      55: { category: "rain",   label: "Dense drizzle" },
      56: { category: "rain",   label: "Freezing drizzle" },
      57: { category: "rain",   label: "Freezing drizzle" },
      61: { category: "rain",   label: "Light rain" },
      63: { category: "rain",   label: "Steady rain" },
      65: { category: "rain",   label: "Heavy rain" },
      66: { category: "rain",   label: "Freezing rain" },
      67: { category: "rain",   label: "Freezing rain" },
      71: { category: "clouds", label: "Light snow" },
      73: { category: "clouds", label: "Snow" },
      75: { category: "clouds", label: "Heavy snow" },
      77: { category: "clouds", label: "Snow grains" },
      80: { category: "rain",   label: "Rain showers" },
      81: { category: "rain",   label: "Rain showers" },
      82: { category: "rain",   label: "Violent showers" },
      85: { category: "clouds", label: "Snow showers" },
      86: { category: "clouds", label: "Snow showers" },
      95: { category: "storm",  label: "Thunderstorm" },
      96: { category: "storm",  label: "Thunderstorm, hail" },
      99: { category: "storm",  label: "Severe thunderstorm" },
    };
    const entry = table[code] || { category: "clouds", label: "Cloudy" };
    let icon = "cloud";
    if (entry.category === "clear") icon = day ? "sun" : "sun";
    else if (entry.category === "clouds") icon = day ? "cloudSun" : "cloud";
    else if (entry.category === "rain") icon = "rain";
    else if (entry.category === "storm") icon = "storm";
    else if (entry.category === "fog") icon = "haze";
    return { ...entry, icon };
  }

  return { CITIES, interpret };
})();
