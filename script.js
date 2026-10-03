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

function weatherInfo(code, isDay = 1) {
  const entry = WEATHER_CODES[code] || { label: "Unknown", icon: "🌡️", night: "🌡️" };
  return {
    label: entry.label,
    icon: !isDay && entry.night ? entry.night : entry.icon,
  };
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
  els.curIcon.textContent = info.icon;
  els.curTemp.textContent = Math.round(current.temperature_2m);
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
    card.innerHTML =
      `<h3 class="forecast-card__day">${escapeHtml(dayName)}</h3>` +
      `<p class="forecast-card__date">${formatShortDate(dateStr)}</p>` +
      `<div class="forecast-card__icon" aria-hidden="true">${info.icon}</div>` +
      `<p class="forecast-card__desc">${escapeHtml(info.label)}</p>` +
      `<div class="forecast-card__temps">` +
      `<span class="temp-max">${Math.round(max)}°</span>` +
      `<span class="temp-min">${Math.round(min)}°</span>` +
      `</div>` +
      `<div class="forecast-card__bar"><span style="width:${pct.toFixed(1)}%"></span></div>` +
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
   Event wiring
   ------------------------------------------------------------------------- */
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  closeSuggestions();
  const value = els.input.value.trim();
  if (state.activeSuggestion >= 0 && state.suggestions[state.activeSuggestion]) {
    chooseSuggestion(state.activeSuggestion);
    return;
  }
  loadByQuery(value);
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
  const last = readLastLocation();
  if (last) loadWeather(last);
})();
