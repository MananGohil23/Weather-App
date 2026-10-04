"use strict";

/* =========================================================================
   SkyCast — Weather & Forecast Dashboard
   APIs: Open-Meteo (forecast + geocoding). No external libraries.
   ========================================================================= */

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const STORAGE_KEY = "skycast:last-location";

/* -------------------------------------------------------------------------
   WMO weather code → description + icon
   ------------------------------------------------------------------------- */
const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "☀️", night: "🌙" },
  1: { label: "Mainly clear", icon: "🌤️", night: "🌙" },
  2: { label: "Partly cloudy", icon: "⛅", night: "☁️" },
  3: { label: "Overcast", icon: "☁️", night: "☁️" },
  45: { label: "Fog", icon: "🌫️", night: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️", night: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️", night: "🌧️" },
  53: { label: "Drizzle", icon: "🌦️", night: "🌧️" },
  55: { label: "Dense drizzle", icon: "🌧️", night: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️", night: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️", night: "🌧️" },
  61: { label: "Light rain", icon: "🌦️", night: "🌧️" },
  63: { label: "Rain", icon: "🌧️", night: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️", night: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️", night: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️", night: "🌧️" },
  71: { label: "Light snow", icon: "🌨️", night: "🌨️" },
  73: { label: "Snow", icon: "❄️", night: "❄️" },
  75: { label: "Heavy snow", icon: "❄️", night: "❄️" },
  77: { label: "Snow grains", icon: "🌨️", night: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️", night: "🌧️" },
  81: { label: "Rain showers", icon: "🌧️", night: "🌧️" },
  82: { label: "Violent showers", icon: "⛈️", night: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️", night: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️", night: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️", night: "⛈️" },
  96: { label: "Thunderstorm, hail", icon: "⛈️", night: "⛈️" },
  99: { label: "Thunderstorm, hail", icon: "⛈️", night: "⛈️" },
};

function weatherKind(code) {
  if (code === 0) return "clear";
  if (code === 1) return "mainly-clear";
  if (code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloudy";
}

function weatherInfo(code, isDay = 1) {
  const entry = WEATHER_CODES[code] || { label: "Unknown", icon: "🌡️", night: "🌡️" };
  return {
    label: entry.label,
    kind: weatherKind(code),
    icon: !isDay && entry.night ? entry.night : entry.icon,
  };
}

function weatherTheme(code, isDay = 1) {
  const kind = weatherKind(code);
  if (kind === "clear" || kind === "mainly-clear") return isDay ? "clear-day" : "clear-night";
  if (kind === "snow") return "snow";
  if (kind === "thunder") return "thunder";
  if (kind === "rain" || kind === "drizzle") return "rain";
  if (kind === "fog") return "fog";
  return isDay ? "cloudy-day" : "cloudy-night";
}

let wiUid = 0;

function weatherIconSVG(kind, isDay = 1) {
  const uid = "wi" + ++wiUid;
  const gSun = `url(#${uid}-sun)`;
  const gMoon = `url(#${uid}-moon)`;
  const gCloud = `url(#${uid}-cloud)`;
  const gCloudDark = `url(#${uid}-cloud-dark)`;

  const defs =
    `<defs>` +
    `<radialGradient id="${uid}-sun" cx="24" cy="22" r="22" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff4c8"/><stop offset="1" stop-color="#ffb703"/></radialGradient>` +
    `<linearGradient id="${uid}-moon" x1="20" y1="12" x2="52" y2="54" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c7ff"/></linearGradient>` +
    `<linearGradient id="${uid}-cloud" x1="16" y1="20" x2="50" y2="52" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#eef3ff"/><stop offset="1" stop-color="#a9bbdd"/></linearGradient>` +
    `<linearGradient id="${uid}-cloud-dark" x1="16" y1="20" x2="50" y2="52" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#c3cfea"/><stop offset="1" stop-color="#7c8fb9"/></linearGradient>` +
    `</defs>`;

  const rays = (cx, cy, r1, r2, w) => {
    let s = "";
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const x1 = cx + Math.cos(a) * r1;
      const y1 = cy + Math.sin(a) * r1;
      const x2 = cx + Math.cos(a) * r2;
      const y2 = cy + Math.sin(a) * r2;
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    return `<g class="wi__rays" stroke="#ffb703" stroke-width="${w}" stroke-linecap="round">${s}</g>`;
  };

  const cloud = (cls, fill, tx, ty) =>
    `<g class="wi__cloud ${cls}" fill="${fill}" transform="translate(${tx} ${ty})">` +
    `<circle cx="26" cy="34" r="10"/><circle cx="38" cy="29" r="13"/>` +
    `<circle cx="48" cy="38" r="8"/><rect x="18" y="35" width="32" height="13" rx="6.5"/></g>`;

  let inner;
  if (kind === "clear") {
    inner = isDay
      ? rays(32, 32, 17, 27, 3.4) +
        `<circle class="wi__core" cx="32" cy="32" r="12" fill="${gSun}"/>`
      : `<g class="wi__star s1" fill="#dfe7ff"><circle cx="14" cy="18" r="1.7"/></g>` +
        `<g class="wi__star s2" fill="#dfe7ff"><circle cx="50" cy="16" r="1.4"/></g>` +
        `<g class="wi__star s3" fill="#dfe7ff"><circle cx="47" cy="45" r="1.6"/></g>` +
        `<path class="wi__moon" d="M42 12a20 20 0 1 0 0 40 25 25 0 0 1 0-40Z" fill="${gMoon}"/>`;
  } else if (kind === "mainly-clear" || kind === "partly") {
    const big = kind === "mainly-clear";
    const c = big ? 26 : 24;
    inner =
      rays(c, c, big ? 13 : 12, big ? 21 : 19, big ? 3 : 2.8) +
      `<circle class="wi__core" cx="${c}" cy="${c}" r="${big ? 9 : 8}" fill="${gSun}"/>` +
      cloud("", gCloud, 6, 7);
  } else if (kind === "overcast" || kind === "cloudy") {
    inner = cloud("wi__cloud--back", gCloudDark, -2, -4) + cloud("", gCloud, 4, 6);
  } else if (kind === "fog") {
    inner =
      cloud("", gCloudDark, 4, -2) +
      `<g class="wi__fogline" stroke="#c3ccda" stroke-width="3" stroke-linecap="round"><line x1="18" y1="46" x2="46" y2="46"/></g>` +
      `<g class="wi__fogline l2" stroke="#c3ccda" stroke-width="3" stroke-linecap="round"><line x1="15" y1="53" x2="49" y2="53"/></g>` +
      `<g class="wi__fogline l3" stroke="#c3ccda" stroke-width="3" stroke-linecap="round"><line x1="21" y1="60" x2="43" y2="60"/></g>`;
  } else if (kind === "drizzle" || kind === "rain") {
    inner =
      cloud("", gCloudDark, 4, -6) +
      `<g stroke="#6fd0ff" stroke-width="3.2" stroke-linecap="round">` +
      `<line class="wi__drop d1" x1="26" y1="48" x2="23" y2="56"/>` +
      `<line class="wi__drop d2" x1="36" y1="48" x2="33" y2="58"/>` +
      `<line class="wi__drop d3" x1="46" y1="48" x2="43" y2="56"/></g>`;
  } else if (kind === "snow") {
    inner =
      cloud("", gCloudDark, 4, -6) +
      `<g fill="#eaf4ff">` +
      `<circle class="wi__flake f1" cx="26" cy="52" r="2.4"/>` +
      `<circle class="wi__flake f2" cx="36" cy="55" r="2.4"/>` +
      `<circle class="wi__flake f3" cx="46" cy="52" r="2.4"/></g>`;
  } else if (kind === "thunder") {
    inner =
      cloud("", gCloudDark, 4, -6) +
      `<path class="wi__bolt" d="M35 40l-10 15h7l-3 12 13-18h-7l6-9z" fill="#ffd166"/>`;
  } else {
    inner = cloud("", gCloud, 4, 4);
  }

  return (
    `<svg class="wi" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    defs +
    inner +
    `</svg>`
  );
}

/* -------------------------------------------------------------------------
   DOM references
   ------------------------------------------------------------------------- */
const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  clearBtn: document.getElementById("clear-btn"),
  suggestions: document.getElementById("suggestions"),
  geoBtn: document.getElementById("geo-btn"),
  retryBtn: document.getElementById("retry-btn"),

  stateWelcome: document.getElementById("state-welcome"),
  stateLoading: document.getElementById("state-loading"),
  stateError: document.getElementById("state-error"),
  errorText: document.getElementById("error-text"),
  dashboard: document.getElementById("dashboard"),

  curCity: document.getElementById("cur-city"),
  curMeta: document.getElementById("cur-meta"),
  curUpdated: document.getElementById("cur-updated"),
  curIcon: document.getElementById("cur-icon"),
  curTemp: document.getElementById("cur-temp"),
  curDesc: document.getElementById("cur-desc"),
  curFeels: document.getElementById("cur-feels"),
  curHumidity: document.getElementById("cur-humidity"),
  curWind: document.getElementById("cur-wind"),
  curPressure: document.getElementById("cur-pressure"),
  curPrecip: document.getElementById("cur-precip"),
  curSun: document.getElementById("cur-sun"),

  forecastGrid: document.getElementById("forecast-grid"),
  forecastRange: document.getElementById("forecast-range"),
};

/* -------------------------------------------------------------------------
   App state
   ------------------------------------------------------------------------- */
const state = {
  view: "welcome", // welcome | loading | error | dashboard
  place: null, // { name, admin1, country, latitude, longitude, label }
  data: null, // last successful forecast payload
  activeSuggestion: -1,
  suggestions: [],
};

function setView(view) {
  state.view = view;
  els.stateWelcome.hidden = view !== "welcome";
  els.stateLoading.hidden = view !== "loading";
  els.stateError.hidden = view !== "error";
  els.dashboard.hidden = view !== "dashboard";
}

function showError(message) {
  els.errorText.textContent = message;
  setView("error");
}

/* -------------------------------------------------------------------------
   Formatting helpers
   ------------------------------------------------------------------------- */
function formatClock(iso) {
  if (!iso || typeof iso !== "string") return "--";
  const time = iso.includes("T") ? iso.split("T")[1] : iso;
  return time.slice(0, 5);
}

function parseDateParts(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatWeekday(dateStr, { long = false } = {}) {
  const date = parseDateParts(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: long ? "long" : "short",
    timeZone: "UTC",
  });
}

function formatShortDate(dateStr) {
  const date = parseDateParts(dateStr);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function placeLabel(place) {
  if (!place) return "—";
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(", ");
}

/* -------------------------------------------------------------------------
   Networking
   ------------------------------------------------------------------------- */
let searchController = null;

async function fetchJSON(url, { signal } = {}) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new Error("Network error. Check your internet connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`Weather service responded with ${response.status}. Please try again.`);
  }
  return response.json();
}

async function geocode(query, { signal, count = 6 } = {}) {
  const url =
    `${GEO_URL}?name=${encodeURIComponent(query)}` +
    `&count=${count}&language=en&format=json`;
  const json = await fetchJSON(url, { signal });
  return Array.isArray(json.results) ? json.results : [];
}

async function fetchForecast(latitude, longitude, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day," +
      "precipitation,weather_code,pressure_msl,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone: "auto",
    forecast_days: "5",
  });
  return fetchJSON(`${FORECAST_URL}?${params.toString()}`, { signal });
}

/* -------------------------------------------------------------------------
   Main load flow
   ------------------------------------------------------------------------- */
let loadController = null;

async function loadWeather(place) {
  if (!place) return;

  if (loadController) loadController.abort();
  loadController = new AbortController();
  const { signal } = loadController;

  state.place = place;
  setView("loading");

  try {
    const data = await fetchForecast(place.latitude, place.longitude, { signal });
    state.data = data;
    renderCurrent(place, data);
    renderForecast(data);
    setView("dashboard");
    saveLastLocation(place);
    els.input.value = "";
    toggleClearButton();
  } catch (err) {
    if (err && err.name === "AbortError") return;
    showError(err.message || "Unable to load weather data.");
  }
}

async function loadByQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    showError("Type a city name to search.");
    return;
  }

  setView("loading");
  try {
    const results = await geocode(trimmed, { count: 1 });
    if (!results.length) {
      showError(`No matches found for “${trimmed}”. Try another city.`);
      return;
    }
    await loadWeather(normalizePlace(results[0]));
  } catch (err) {
    if (err && err.name === "AbortError") return;
    showError(err.message || "Search failed. Please try again.");
  }
}

function normalizePlace(raw) {
  return {
    name: raw.name,
    admin1: raw.admin1 || "",
    country: raw.country || raw.country_code || "",
    latitude: raw.latitude,
    longitude: raw.longitude,
  };
}

function loadByCoords(latitude, longitude) {
  loadWeather({
    name: "Current location",
    admin1: "",
    country: "",
    latitude,
    longitude,
    coordsOnly: true,
  });
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */
function renderCurrent(place, data) {
  const current = data.current || {};
  const daily = data.daily || {};
  const info = weatherInfo(current.weather_code, current.is_day);

  applyTheme(weatherTheme(current.weather_code, current.is_day));

  els.curCity.textContent = place.coordsOnly
    ? "Current location"
    : place.name || "—";

  const metaParts = [];
  if (!place.coordsOnly) {
    if (place.admin1) metaParts.push(place.admin1);
    if (place.country) metaParts.push(place.country);
  }
  metaParts.push(
    `${Number(place.latitude).toFixed(2)}°, ${Number(place.longitude).toFixed(2)}°`
  );
  if (data.timezone) metaParts.push(data.timezone);
  els.curMeta.textContent = metaParts.join(" · ");

  els.curUpdated.textContent = `Updated ${formatClock(current.time)} local`;
  els.curIcon.innerHTML = weatherIconSVG(info.kind, current.is_day);
  animateNumber(els.curTemp, Math.round(current.temperature_2m));
  els.curDesc.textContent = info.label;

  els.curFeels.textContent = `${Math.round(current.apparent_temperature)}°`;
  els.curHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  els.curWind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  els.curPressure.textContent = `${Math.round(current.pressure_msl)} hPa`;
  els.curPrecip.textContent = `${round1(current.precipitation)} mm`;

  const sunrise = (daily.sunrise && daily.sunrise[0]) || "";
  const sunset = (daily.sunset && daily.sunset[0]) || "";
  els.curSun.textContent = `${formatClock(sunrise)} / ${formatClock(sunset)}`;
}

function renderForecast(data) {
  const daily = data.daily;
  if (!daily || !Array.isArray(daily.time)) {
    els.forecastGrid.innerHTML = "";
    els.forecastRange.textContent = "";
    return;
  }

  const count = daily.time.length;
  const highs = daily.temperature_2m_max;
  const lows = daily.temperature_2m_min;
  const boundsMax = Math.max.apply(null, highs);
  const boundsMin = Math.min.apply(null, lows);
  const span = Math.max(boundsMax - boundsMin, 1);

  els.forecastGrid.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const dateStr = daily.time[i];
    const code = daily.weather_code[i];
    const info = weatherInfo(code, 1);
    const max = highs[i];
    const min = lows[i];

    const isToday = i === 0;
    const dayName = isToday ? "Today" : formatWeekday(dateStr);

    const pct = Math.min(100, Math.max(8, ((max - boundsMin) / span) * 100));

    const card = document.createElement("article");
    card.className = "forecast-card" + (isToday ? " forecast-card--today" : "");
    card.style.setProperty("--i", String(i));
    card.innerHTML =
      `<h3 class="forecast-card__day">${escapeHtml(dayName)}</h3>` +
      `<p class="forecast-card__date">${formatShortDate(dateStr)}</p>` +
      `<div class="forecast-card__icon" aria-hidden="true">${weatherIconSVG(info.kind, 1)}</div>` +
      `<p class="forecast-card__desc">${escapeHtml(info.label)}</p>` +
      `<div class="forecast-card__temps">` +
      `<span class="temp-max">${Math.round(max)}°</span>` +
      `<span class="temp-min">${Math.round(min)}°</span>` +
      `</div>` +
      `<div class="forecast-card__bar"><span style="--w:${pct.toFixed(1)}%"></span></div>` +
      `<div class="forecast-card__temps" style="font-size:0.72rem;color:var(--text-muted)">` +
      `<span>${formatClock(daily.sunrise[i])}</span>` +
      `<span>${formatClock(daily.sunset[i])}</span>` +
      `</div>`;

    els.forecastGrid.appendChild(card);
  }

  els.forecastRange.textContent =
    `${formatShortDate(daily.time[0])} – ${formatShortDate(daily.time[count - 1])}`;
}

/* -------------------------------------------------------------------------
   Search suggestions (debounced)
   ------------------------------------------------------------------------- */
let debounceTimer = null;

function closeSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  state.suggestions = [];
  state.activeSuggestion = -1;
}

function renderSuggestions(results) {
  state.suggestions = results.map(normalizePlace);
  state.activeSuggestion = -1;

  if (!state.suggestions.length) {
    closeSuggestions();
    return;
  }

  els.suggestions.innerHTML = "";
  state.suggestions.forEach((place, i) => {
    const li = document.createElement("li");
    li.className = "suggestion";
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    li.dataset.index = String(i);

    const name = document.createElement("span");
    name.className = "suggestion__name";
    name.textContent = place.name;

    const meta = document.createElement("span");
    meta.className = "suggestion__meta";
    meta.textContent = [place.admin1, place.country].filter(Boolean).join(", ");

    li.append(name, meta);
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      chooseSuggestion(i);
    });

    els.suggestions.appendChild(li);
  });

  els.suggestions.hidden = false;
}

function highlightSuggestion(index) {
  state.activeSuggestion = index;
  const items = els.suggestions.querySelectorAll(".suggestion");
  items.forEach((item, i) => {
    item.setAttribute("aria-selected", i === index ? "true" : "false");
  });
}

function chooseSuggestion(index) {
  const place = state.suggestions[index];
  if (!place) return;
  closeSuggestions();
  loadWeather(place);
}

function onInput() {
  const value = els.input.value.trim();
  toggleClearButton();

  if (debounceTimer) clearTimeout(debounceTimer);
  if (value.length < 2) {
    closeSuggestions();
    return;
  }

  debounceTimer = setTimeout(async () => {
    if (searchController) searchController.abort();
    searchController = new AbortController();
    try {
      const results = await geocode(value, {
        signal: searchController.signal,
        count: 6,
      });
      if (els.input.value.trim() === value) renderSuggestions(results);
    } catch (err) {
      if (!err || err.name !== "AbortError") closeSuggestions();
    }
  }, 300);
}

function toggleClearButton() {
  els.clearBtn.hidden = els.input.value.length === 0;
}

/* -------------------------------------------------------------------------
   Geolocation
   ------------------------------------------------------------------------- */
function useMyLocation() {
  if (!("geolocation" in navigator)) {
    showError("Geolocation is not supported by this browser.");
    return;
  }
  setView("loading");
  els.stateLoading.querySelector(".state__text").textContent =
    "Requesting your location…";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      els.stateLoading.querySelector(".state__text").textContent =
        "Fetching the latest weather…";
      loadByCoords(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      els.stateLoading.querySelector(".state__text").textContent =
        "Fetching the latest weather…";
      let message = "Unable to access your location.";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Location permission denied. Search for a city instead.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Location information is unavailable right now.";
      } else if (error.code === error.TIMEOUT) {
        message = "Location request timed out. Please try again.";
      }
      showError(message);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

/* -------------------------------------------------------------------------
   Persistence
   ------------------------------------------------------------------------- */
function saveLastLocation(place) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch (_) {
    /* storage unavailable — ignore */
  }
}

function readLastLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw);
    if (place && typeof place.latitude === "number" && typeof place.longitude === "number") {
      return place;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

/* -------------------------------------------------------------------------
   Small utilities
   ------------------------------------------------------------------------- */
function round1(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.round(value * 10) / 10;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------------------------------------------------------------
   Motion preferences & animated number counter
   ------------------------------------------------------------------------- */
const reduceMotion =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const finePointer =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: fine)").matches;

function formatNumber(value, decimals = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toFixed(decimals);
}

function animateNumber(el, to, { decimals = 0, duration = 850 } = {}) {
  if (!el) return;
  const previous = Number(el.dataset.value);
  const from = Number.isFinite(previous) ? previous : 0;
  el.dataset.value = String(to);
  if (reduceMotion || !Number.isFinite(to) || from === to) {
    el.textContent = formatNumber(to, decimals);
    return;
  }
  const start = performance.now();
  function frame() {
    const elapsed = performance.now() - start;
    const p = Math.min(1, Math.max(0, elapsed / duration));
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatNumber(from + (to - from) * eased, decimals);
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = formatNumber(to, decimals);
  }
  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------------------
   Dynamic themes
   ------------------------------------------------------------------------- */
const THEME_CLASSES = [
  "theme-clear-day",
  "theme-clear-night",
  "theme-cloudy-day",
  "theme-cloudy-night",
  "theme-rain",
  "theme-thunder",
  "theme-snow",
  "theme-fog",
];
let currentTheme = "clear-day";

function applyTheme(theme) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  document.body.classList.remove.apply(document.body.classList, THEME_CLASSES);
  document.body.classList.add("theme-" + theme);
  fx.setTheme(theme);
}

/* -------------------------------------------------------------------------
   Particle / weather FX canvas
   ------------------------------------------------------------------------- */
const fx = (() => {
  const canvas = document.getElementById("weather-fx");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let theme = "clear-day";
  let rafId = null;
  let lastTime = 0;
  let flash = 0;
  let running = false;

  const rand = (min, max) => min + Math.random() * (max - min);

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    particles = [];
    if (!ctx) return;
    const area = width * height;
    if (theme === "rain" || theme === "thunder") {
      const n = Math.min(260, Math.round(area / 8500));
      for (let i = 0; i < n; i++)
        particles.push({
          x: rand(0, width),
          y: rand(-height, height),
          len: rand(11, 24),
          sp: rand(7, 13),
          o: rand(0.12, 0.45),
        });
    } else if (theme === "snow") {
      const n = Math.min(170, Math.round(area / 14000));
      for (let i = 0; i < n; i++)
        particles.push({
          x: rand(0, width),
          y: rand(-height, height),
          r: rand(1, 2.8),
          sp: rand(0.5, 1.5),
          dx: rand(-0.4, 0.4),
          ph: rand(0, 6.28),
          o: rand(0.3, 0.9),
        });
    } else if (theme === "clear-night" || theme === "cloudy-night") {
      const n = Math.min(150, Math.round(area / 15000));
      for (let i = 0; i < n; i++)
        particles.push({
          x: rand(0, width),
          y: rand(0, height * 0.85),
          r: rand(0.6, 1.8),
          ph: rand(0, 6.28),
          sp: rand(0.4, 1.3),
          o: rand(0.15, 0.85),
        });
    } else {
      const n = Math.min(70, Math.round(area / 32000));
      for (let i = 0; i < n; i++)
        particles.push({
          x: rand(0, width),
          y: rand(0, height),
          r: rand(1, 3.2),
          sp: rand(0.15, 0.5),
          dx: rand(-0.2, 0.2),
          ph: rand(0, 6.28),
          o: rand(0.05, 0.16),
        });
    }
  }

  function draw(now) {
    const dt = Math.min(40, now - lastTime) / 16.67 || 1;
    lastTime = now;
    ctx.clearRect(0, 0, width, height);

    if (theme === "rain" || theme === "thunder") {
      ctx.lineCap = "round";
      ctx.lineWidth = 1.5;
      for (const p of particles) {
        p.y += p.sp * dt;
        p.x -= p.sp * 0.35 * dt;
        if (p.y > height + 30) {
          p.y = -30;
          p.x = rand(0, width);
        }
        ctx.strokeStyle = `rgba(150, 214, 255, ${p.o})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.35, p.y + p.len);
        ctx.stroke();
      }
      if (theme === "thunder") {
        if (flash <= 0 && Math.random() < 0.004) flash = 1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(200, 190, 255, ${flash * 0.16})`;
          ctx.fillRect(0, 0, width, height);
          flash -= 0.06 * dt;
        }
      }
    } else if (theme === "snow") {
      for (const p of particles) {
        p.y += p.sp * dt;
        p.x += Math.sin(now / 900 + p.ph) * 0.4 + p.dx * dt;
        if (p.y > height + 10) {
          p.y = -10;
          p.x = rand(0, width);
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(234, 244, 255, ${p.o})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === "clear-night" || theme === "cloudy-night") {
      for (const p of particles) {
        const tw = 0.5 + 0.5 * Math.sin((now / 700) * p.sp + p.ph);
        ctx.beginPath();
        ctx.fillStyle = `rgba(226, 233, 255, ${p.o * tw})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const p of particles) {
        p.y -= p.sp * dt;
        p.x += Math.sin(now / 1400 + p.ph) * 0.25 + p.dx * dt;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = rand(0, width);
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${p.o})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (!ctx || reduceMotion || running) return;
    running = true;
    resize();
    lastTime = performance.now();
    rafId = requestAnimationFrame(draw);
  }

  function setTheme(next) {
    theme = next;
    if (!ctx) return;
    if (!running) start();
    else build();
  }

  window.addEventListener("resize", () => {
    if (running) resize();
  });

  return { setTheme, start };
})();

/* -------------------------------------------------------------------------
   Micro-interactions: cursor spotlight, 3D tilt, button ripples
   ------------------------------------------------------------------------- */
function setupCursorGlow() {
  const glow = document.getElementById("cursor-glow");
  if (!glow || reduceMotion || !finePointer) return;
  document.body.classList.add("pointer-fine");

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  window.addEventListener("pointermove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
  });

  (function loop() {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    glow.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
}

function setupTilt() {
  const card = document.querySelector(".current.card");
  if (!card || reduceMotion || !finePointer) return;

  let frame = null;
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      card.style.transform = `rotateY(${(px * 6).toFixed(2)}deg) rotateX(${(
        -py * 6
      ).toFixed(2)}deg) translateY(-2px)`;
    });
  });

  card.addEventListener("pointerleave", () => {
    if (frame) cancelAnimationFrame(frame);
    card.style.transform = "";
  });
}

function setupRipple() {
  if (reduceMotion) return;
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(".btn, .search__submit, .search__geo");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = size + "px";
    span.style.left = event.clientX - rect.left + "px";
    span.style.top = event.clientY - rect.top + "px";
    target.appendChild(span);
    setTimeout(() => span.remove(), 640);
  });
}

/* -------------------------------------------------------------------------
   Event wiring
   ------------------------------------------------------------------------- */
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const active = state.activeSuggestion;
  const chosen = active >= 0 ? state.suggestions[active] : null;
  closeSuggestions();
  if (chosen) {
    loadWeather(chosen);
    return;
  }
  loadByQuery(els.input.value.trim());
});

els.input.addEventListener("input", onInput);

els.input.addEventListener("keydown", (event) => {
  if (els.suggestions.hidden || !state.suggestions.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const next = (state.activeSuggestion + 1) % state.suggestions.length;
    highlightSuggestion(next);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const prev =
      (state.activeSuggestion - 1 + state.suggestions.length) %
      state.suggestions.length;
    highlightSuggestion(prev);
  } else if (event.key === "Enter") {
    if (state.activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(state.activeSuggestion);
    }
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

els.clearBtn.addEventListener("click", () => {
  els.input.value = "";
  toggleClearButton();
  closeSuggestions();
  els.input.focus();
});

els.geoBtn.addEventListener("click", useMyLocation);

els.retryBtn.addEventListener("click", () => {
  if (state.place) {
    loadWeather(state.place);
  } else if (els.input.value.trim()) {
    loadByQuery(els.input.value);
  } else {
    setView("welcome");
  }
});

document.addEventListener("click", (event) => {
  if (!els.form.contains(event.target)) closeSuggestions();
});

/* -------------------------------------------------------------------------
   Init
   ------------------------------------------------------------------------- */
(function init() {
  setView("welcome");
  setupCursorGlow();
  setupTilt();
  setupRipple();
  fx.start();

  const last = readLastLocation();
  if (last) loadWeather(last);
})();
