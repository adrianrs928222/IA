const BACKEND_URL = "https://funcional-s4vd.onrender.com/top-picks-today";
const CACHE_KEY = "top-picks-cache-v1";

const els = {
  todayDate: document.getElementById("todayDate"),
  sourceStatus: document.getElementById("sourceStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
  retryBtn: document.getElementById("retryBtn"),
  installBtn: document.getElementById("installBtn"),
  statusBanner: document.getElementById("statusBanner"),
  cardsWrap: document.getElementById("cardsWrap"),
  cards: document.getElementById("cards"),
  emptyState: document.getElementById("emptyState"),
  summaryCount: document.getElementById("summaryCount"),
  summaryBestOdds: document.getElementById("summaryBestOdds"),
  summaryHighConfidence: document.getElementById("summaryHighConfidence"),
  template: document.getElementById("pickCardTemplate")
};

let deferredPrompt = null;

function formatDate(dateString) {
  if (!dateString) return "Fecha no disponible";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function showBanner(message, type = "info") {
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner status-banner--${type}`;
}

function hideBanner() {
  els.statusBanner.className = "status-banner hidden";
}

function setLoadingState(isLoading) {
  els.refreshBtn.disabled = isLoading;
  els.refreshBtn.textContent = isLoading ? "Actualizando…" : "Actualizar picks";
  els.sourceStatus.textContent = isLoading ? "Consultando backend…" : els.sourceStatus.textContent;
}

function normalizePick(raw) {
  const competition = raw.competition || raw.league || raw.tournament || "Competición";
  const match = raw.match || raw.fixture || `${raw.home_team || raw.home || "Local"} vs ${raw.away_team || raw.away || "Visitante"}`;
  const startsAt = raw.starts_at || raw.match_time || raw.time || "Hora pendiente";
  const pick = raw.pick || raw.market || raw.prediction || raw.tip || "Sin pick";
  const confidence = (raw.confidence || raw.color || "gris").toString().toLowerCase();
  const explanation = raw.tipster_explanation || raw.explanation || raw.reason || "Sin explicación disponible.";

  const oddsNumber = Number(raw.odds ?? raw.cuota ?? raw.odd);
  const modelProbRaw = raw.model_probability ?? raw.probability ?? raw.prob_model;
  const impliedProbRaw = raw.implied_probability ?? raw.probability_implied ?? raw.prob_impl;
  const valueRaw = raw.value_edge ?? raw.value ?? raw.edge;

  const modelProbability = Number(modelProbRaw);
  const impliedProbability = Number(impliedProbRaw);
  const valueEdge = Number(valueRaw);

  return {
    competition,
    match,
    startsAt,
    pick,
    confidence,
    explanation,
    odds: Number.isFinite(oddsNumber) ? oddsNumber : null,
    modelProbability: Number.isFinite(modelProbability)
      ? (modelProbability <= 1 ? modelProbability * 100 : modelProbability)
      : null,
    impliedProbability: Number.isFinite(impliedProbability)
      ? (impliedProbability <= 1 ? impliedProbability * 100 : impliedProbability)
      : null,
    valueEdge: Number.isFinite(valueEdge)
      ? (Math.abs(valueEdge) <= 1 ? valueEdge * 100 : valueEdge)
      : null
  };
}

function formatPercent(value) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatOdds(value) {
  if (value == null) return "—";
  return value.toFixed(2);
}

function formatValue(value) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function renderSummary(picks) {
  const bestOdds = picks.reduce((max, pick) => pick.odds && pick.odds > max ? pick.odds : max, 0);
  const highConfidence = picks.filter(p => p.confidence === "verde").length;
  els.summaryCount.textContent = String(picks.length);
  els.summaryBestOdds.textContent = bestOdds ? formatOdds(bestOdds) : "—";
  els.summaryHighConfidence.textContent = String(highConfidence);
}

function renderPicks(data) {
  const picks = (data.picks || []).map(normalizePick);
  els.cards.innerHTML = "";

  if (!picks.length) {
    els.cardsWrap.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    renderSummary([]);
    return;
  }

  picks.forEach((pick) => {
    const node = els.template.content.cloneNode(true);

    node.querySelector(".pick-card__competition").textContent = pick.competition;
    node.querySelector(".pick-card__match").textContent = pick.match;
    node.querySelector(".badge--time").textContent = pick.startsAt;

    const confidenceBadge = node.querySelector(".badge--confidence");
    confidenceBadge.textContent = (pick.confidence || "gris").toUpperCase();
    confidenceBadge.classList.add(pick.confidence || "gris");

    node.querySelector(".pick-card__pick").textContent = pick.pick;
    node.querySelector(".pick-card__odds").textContent = formatOdds(pick.odds);
    node.querySelector(".pick-card__modelProb").textContent = formatPercent(pick.modelProbability);
    node.querySelector(".pick-card__value").textContent = formatValue(pick.valueEdge);
    node.querySelector(".pick-card__explanation").textContent = pick.explanation;

    els.cards.appendChild(node);
  });

  renderSummary(picks);
  els.cardsWrap.classList.remove("hidden");
  els.emptyState.classList.add("hidden");
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchPicks(force = false) {
  setLoadingState(true);
  hideBanner();

  const cache = loadCache();
  if (!force && cache?.date) {
    els.todayDate.textContent = formatDate(cache.date);
    renderPicks(cache);
    els.sourceStatus.textContent = "Mostrando caché local";
  }

  try {
    const response = await fetch(BACKEND_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();

    els.todayDate.textContent = formatDate(data.date);
    els.sourceStatus.textContent = "Conectado a Render";
    renderPicks(data);
    saveCache(data);
    showBanner("Picks actualizados correctamente.", "success");
  } catch (error) {
    const fallback = loadCache();
    if (fallback?.picks?.length) {
      els.todayDate.textContent = formatDate(fallback.date);
      els.sourceStatus.textContent = "Usando último cache disponible";
      renderPicks(fallback);
      showBanner("No se pudo actualizar ahora mismo. Se muestra la última versión guardada.", "info");
    } else {
      els.cardsWrap.classList.add("hidden");
      els.emptyState.classList.remove("hidden");
      els.sourceStatus.textContent = "Backend no disponible";
      showBanner("No se pudo cargar el backend. Puede que Render esté despertando o que no haya picks aún.", "error");
    }
  } finally {
    setLoadingState(false);
  }
}

els.refreshBtn.addEventListener("click", () => fetchPicks(true));
els.retryBtn.addEventListener("click", () => fetchPicks(true));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  els.installBtn.hidden = false;
});

els.installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

fetchPicks(false);
