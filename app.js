const BACKEND_URL = "https://funcional-s4vd.onrender.com/top-picks-today";
const HISTORY_URL = "https://funcional-s4vd.onrender.com/history-picks";
const CACHE_KEY = "top-pronosticos-diarios-cache-v11";

const app = document.getElementById("app");

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function confidenceBadge(confidence) {
  const c = String(confidence || "").toLowerCase();

  if (c === "verde") {
    return `<span class="badge badge-green">VERDE</span>`;
  }
  if (c === "amarillo") {
    return `<span class="badge badge-yellow">AMARILLO</span>`;
  }
  return `<span class="badge badge-red">ROJO</span>`;
}

function pickTypeBadge(type) {
  const t = String(type || "").toLowerCase();

  if (t === "solido") {
    return `<span class="type-pill type-solido">Sólido</span>`;
  }
  if (t === "medio") {
    return `<span class="type-pill type-medio">Medio</span>`;
  }
  if (t === "agresivo") {
    return `<span class="type-pill type-agresivo">Agresivo</span>`;
  }
  return `<span class="type-pill">Pick</span>`;
}

function marketBadge(marketGroup, pickText) {
  const market = String(marketGroup || "").toLowerCase();
  const pick = String(pickText || "").toLowerCase();

  if (market === "winner") {
    return `<span class="type-pill type-medio">Ganador</span>`;
  }
  if (market === "over_2_5") {
    return `<span class="type-pill type-agresivo">Más de 2.5</span>`;
  }
  if (market === "btts_yes") {
    return `<span class="type-pill type-solido">Ambos marcan</span>`;
  }

  if (pick.includes("ambos marcan")) {
    return `<span class="type-pill type-solido">Ambos marcan</span>`;
  }
  if (pick.includes("2.5")) {
    return `<span class="type-pill type-agresivo">Más de 2.5</span>`;
  }
  return `<span class="type-pill type-medio">Mercado</span>`;
}

function sourceBadge(sourceType) {
  const source = String(sourceType || "").toLowerCase();

  if (source === "real_odds") {
    return `<span class="source-pill source-real">Odds reales</span>`;
  }
  if (source === "model_odds") {
    return `<span class="source-pill source-model">Modelo mixto</span>`;
  }
  return `<span class="source-pill source-model">Modelo</span>`;
}

function resultBadge(status, label) {
  const s = String(status || "").toLowerCase();

  if (s === "won") {
    return `<span class="result-pill result-won">${escapeHtml(label || "Acertada")}</span>`;
  }
  if (s === "lost") {
    return `<span class="result-pill result-lost">${escapeHtml(label || "Perdida")}</span>`;
  }
  return `<span class="result-pill result-pending">${escapeHtml(label || "Pendiente")}</span>`;
}

function sourceText(sourceType, bookmaker) {
  const source = String(sourceType || "").toLowerCase();

  if (source === "real_odds") {
    return bookmaker || "Bookmaker";
  }
  if (source === "model_odds") {
    return "Modelo mixto";
  }
  return bookmaker || "Modelo";
}

function getBestOdds(picks) {
  if (!Array.isArray(picks) || picks.length === 0) return "-";
  const max = Math.max(...picks.map(p => Number(p.odds || 0)));
  return max > 0 ? max.toFixed(2) : "-";
}

function getHighConfidenceCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.filter(p => String(p.confidence || "").toLowerCase() === "verde").length;
}

function getRealOddsCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.filter(p => String(p.source_type || "").toLowerCase() === "real_odds").length;
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? String(value) : "0";
}

function loadingView() {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos cercanos, picks fijados durante el día, mercados mixtos y seguimiento completo del historial.</p>
      </div>
      <button class="refresh-btn" disabled>Cargando...</button>
    </section>

    <section class="status-card">
      <div class="spinner"></div>
      <div>
        <h3>Cargando picks e historial</h3>
        <p>Buscando partidos válidos y actualizando resultados anteriores.</p>
      </div>
    </section>
  `;
}

function errorView(message) {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos cercanos, picks fijados durante el día, mercados mixtos y seguimiento completo del historial.</p>
      </div>
      <button class="refresh-btn" onclick="loadAll(true)">Actualizar</button>
    </section>

    <section class="status-card error">
      <div>
        <h3>Error cargando datos</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderPickCard(pick) {
  return `
    <article class="pick-card">
      <div class="pick-top">
        <div>
          <div class="competition">${escapeHtml(pick.competition || "")}</div>
          <h2 class="match">${escapeHtml(pick.match || "")}</h2>
        </div>
        <div class="kickoff">
          <span>🕒</span>
          <strong>${escapeHtml(pick.starts_at || "--:--")}</strong>
        </div>
      </div>

      <div class="pick-tags">
        ${pickTypeBadge(pick.type)}
        ${marketBadge(pick.market_group, pick.pick)}
        ${confidenceBadge(pick.confidence)}
        ${sourceBadge(pick.source_type)}
      </div>

      <div class="pick-main-line">
        <span class="label">Pronóstico</span>
        <span class="value strong">${escapeHtml(pick.pick || "-")}</span>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <span class="label">Cuota</span>
          <span class="value">${escapeHtml(pick.odds ?? "-")}</span>
        </div>

        <div class="stat-box">
          <span class="label">Confianza</span>
          <span class="value">${escapeHtml(String(pick.confidence || "").toUpperCase() || "-")}</span>
        </div>

        <div class="stat-box">
          <span class="label">Tipo</span>
          <span class="value">${escapeHtml(pick.type || "-")}</span>
        </div>

        <div class="stat-box">
          <span class="label">Value</span>
          <span class="value">${Number(pick.value_edge) >= 0 ? "+" : ""}${escapeHtml(pick.value_edge ?? "-")}%</span>
        </div>
      </div>

      <div class="tipster-box">
        <h3>Lectura tipster</h3>
        <p>${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}</p>
      </div>

      <div class="pick-footer">
        <span><strong>Fuente:</strong> ${escapeHtml(sourceText(pick.source_type, pick.bookmaker))}</span>
        <span><strong>Mercado:</strong> ${escapeHtml(pick.market_name || "-")}</span>
      </div>
    </article>
  `;
}

function renderHistory(history) {
  if (!history || !Array.isArray(history.days) || history.days.length === 0) return "";

  const summary = history.summary || {
    total_picks: 0,
    won: 0,
    lost: 0,
    pending: 0,
    hit_rate: 0
  };

  return `
    <section class="history-section">
      <div class="history-header">
        <div>
          <div class="eyebrow">HISTORIAL</div>
          <h2>Historial de picks</h2>
          <p>Seguimiento de acertadas, perdidas y pendientes.</p>
        </div>
      </div>

      <section class="summary-grid history-summary-grid">
        <div class="summary-card">
          <span class="summary-label">Total picks</span>
          <strong class="summary-value">${escapeHtml(summary.total_picks)}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">Acertadas</span>
          <strong class="summary-value">${escapeHtml(summary.won)}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">Perdidas</span>
          <strong class="summary-value">${escapeHtml(summary.lost)}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">Hit rate</span>
          <strong class="summary-value">${escapeHtml(summary.hit_rate)}%</strong>
        </div>
      </section>

      <div class="history-days">
        ${history.days.map(day => `
          <article class="history-day-card">
            <div class="history-day-top">
              <div>
                <h3>${escapeHtml(day.date || "-")}</h3>
                <p>${escapeHtml(day.generated_at || "-")}</p>
              </div>
              <div class="history-day-stats">
                ${resultBadge("won", `Aciertos: ${day.stats?.won ?? 0}`)}
                ${resultBadge("lost", `Fallos: ${day.stats?.lost ?? 0}`)}
                ${resultBadge("pending", `Pendientes: ${day.stats?.pending ?? 0}`)}
              </div>
            </div>

            <div class="history-picks-list">
              ${(day.picks || []).map(pick => `
                <div class="history-pick-row">
                  <div class="history-pick-main">
                    <strong>${escapeHtml(pick.match || "-")}</strong>
                    <span>${escapeHtml(pick.pick || "-")} · cuota ${escapeHtml(pick.odds ?? "-")}</span>
                  </div>
                  <div class="history-pick-result">
                    ${resultBadge(pick.status, pick.result_label)}
                  </div>
                </div>
              `).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderEmpty(todayData, historyData) {
  const summary = historyData?.summary || {
    total_picks: 0,
    won: 0,
    lost: 0,
    pending: 0,
    hit_rate: 0
  };

  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos cercanos, picks fijados durante el día, mercados mixtos y seguimiento completo del historial.</p>
      </div>
      <button class="refresh-btn" onclick="loadAll(true)">Actualizar</button>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks de hoy</span>
        <strong class="summary-value">0</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Acertadas</span>
        <strong class="summary-value">${escapeHtml(summary.won)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Perdidas</span>
        <strong class="summary-value">${escapeHtml(summary.lost)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Hit rate</span>
        <strong class="summary-value">${escapeHtml(summary.hit_rate)}%</strong>
      </div>
    </section>

    <section class="status-card">
      <div>
        <h3>No hay picks válidos ahora mismo</h3>
        <p><strong>Fecha:</strong> ${escapeHtml(todayData.date || "-")}</p>
        <p><strong>Generado:</strong> ${escapeHtml(todayData.generated_at || "-")}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(todayData.source || "-")}</p>
      </div>
    </section>

    ${renderHistory(historyData)}
  `;
}

function renderData(todayData, historyData) {
  const picks = Array.isArray(todayData.picks) ? todayData.picks : [];

  if (picks.length === 0) {
    renderEmpty(todayData, historyData);
    return;
  }

  const highConfidence = getHighConfidenceCount(picks);
  const bestOdds = getBestOdds(picks);
  const realOddsCount = getRealOddsCount(picks);

  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Mercados mixtos, picks fijados durante todo el día y seguimiento real del historial para acertadas y perdidas.</p>
      </div>
      <button class="refresh-btn" onclick="loadAll(true)">Actualizar</button>
    </section>

    <section class="meta-strip">
      <div><strong>Fecha:</strong> ${escapeHtml(todayData.date || "-")}</div>
      <div><strong>Generado:</strong> ${escapeHtml(todayData.generated_at || "-")}</div>
      <div><strong>Se mantiene hasta:</strong> ${escapeHtml(todayData.cached_until || "-")}</div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks de hoy</span>
        <strong class="summary-value">${formatCount(todayData.count ?? picks.length)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Mejor cuota</span>
        <strong class="summary-value">${escapeHtml(bestOdds)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Confianza alta</span>
        <strong class="summary-value">${escapeHtml(highConfidence)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Odds reales</span>
        <strong class="summary-value">${escapeHtml(realOddsCount)}</strong>
      </div>
    </section>

    <section class="status-ok">
      Picks diarios cargados correctamente. El sistema mantiene los picks del día y actualiza el historial aparte.
    </section>

    <section class="cards-grid">
      ${picks.map(renderPickCard).join("")}
    </section>

    ${renderHistory(historyData)}
  `;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function loadAll(forceRefresh = false) {
  loadingView();

  try {
    const todayUrl = forceRefresh
      ? `${BACKEND_URL}?refresh=1&ts=${Date.now()}`
      : BACKEND_URL;

    const [todayData, historyData] = await Promise.all([
      fetchJson(todayUrl),
      fetchJson(`${HISTORY_URL}?ts=${Date.now()}`)
    ]);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ todayData, historyData }));
    } catch (_) {}

    renderData(todayData, historyData);
  } catch (error) {
    console.error("Error cargando datos:", error);

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        renderData(parsed.todayData, parsed.historyData);
        return;
      }
    } catch (_) {}

    errorView(error.message || "Error desconocido");
  }
}

// primera carga forzada para evitar cache viejo
document.addEventListener("DOMContentLoaded", () => {
  loadAll(true);
});

window.loadAll = loadAll;