const BASE_URL = "https://funcional-s4vd.onrender.com";
const BACKEND_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-pronosticos-diarios-cache-v12";

const app = document.getElementById("app");

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function confidenceText(confidence) {
  const n = Number(confidence || 0);
  if (n >= 75) return "ALTA";
  if (n >= 65) return "MEDIA";
  return "NORMAL";
}

function confidenceBadge(confidence) {
  const n = Number(confidence || 0);

  if (n >= 75) {
    return `<span class="badge badge-green">ALTA</span>`;
  }
  if (n >= 65) {
    return `<span class="badge badge-yellow">MEDIA</span>`;
  }
  return `<span class="badge badge-red">NORMAL</span>`;
}

function pickTypeBadge(type) {
  const t = String(type || "").toLowerCase();

  if (t === "winner") {
    return `<span class="type-pill type-medio">Ganador</span>`;
  }
  if (t === "double_chance") {
    return `<span class="type-pill type-solido">Doble oportunidad</span>`;
  }
  if (t === "draw_no_bet") {
    return `<span class="type-pill type-agresivo">Empate no apuesta</span>`;
  }
  return `<span class="type-pill">Pick</span>`;
}

function sourceBadge() {
  return `<span class="source-pill source-real">Odds reales</span>`;
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

function getBestOdds(picks) {
  if (!Array.isArray(picks) || picks.length === 0) return "-";
  const max = Math.max(...picks.map(p => Number(p.odds || 0)));
  return max > 0 ? max.toFixed(2) : "-";
}

function getHighConfidenceCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.filter(p => Number(p.confidence || 0) >= 75).length;
}

function getRealOddsCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.length;
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? String(value) : "0";
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
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
        <p>Buscando partidos válidos y actualizando datos guardados.</p>
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
          <div class="competition">${escapeHtml(pick.league || "")}</div>
          <h2 class="match">${escapeHtml(pick.match || "")}</h2>
        </div>
        <div class="kickoff">
          <span>🕒</span>
          <strong>${escapeHtml(pick.time_local || "--:--")}</strong>
        </div>
      </div>

      <div class="pick-tags">
        ${pickTypeBadge(pick.pick_type)}
        ${confidenceBadge(pick.confidence)}
        ${sourceBadge()}
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
          <span class="value">${escapeHtml(confidenceText(pick.confidence))}</span>
        </div>

        <div class="stat-box">
          <span class="label">Favorito</span>
          <span class="value">${escapeHtml(pick.favorite_team || "-")}</span>
        </div>

        <div class="stat-box">
          <span class="label">Bookmaker</span>
          <span class="value">${escapeHtml(pick.bookmaker || "-")}</span>
        </div>
      </div>

      <div class="tipster-box">
        <h3>Lectura tipster</h3>
        <p>
          ${escapeHtml(pick.favorite_team || "-")} parte como favorito para este partido.
          Probabilidades estimadas: local ${escapeHtml(pick.prob_home ?? "-")}%,
          empate ${escapeHtml(pick.prob_draw ?? "-")}%,
          visitante ${escapeHtml(pick.prob_away ?? "-")}%.
        </p>
      </div>

      <div class="pick-footer">
        <span><strong>Fuente:</strong> ${escapeHtml(pick.bookmaker || "Bookmaker")}</span>
        <span><strong>Tipo:</strong> ${escapeHtml(pick.pick_type || "-")}</span>
      </div>
    </article>
  `;
}

function normalizeHistory(rawHistory) {
  if (!rawHistory || !rawHistory.days || typeof rawHistory.days !== "object") {
    return {
      summary: { total_picks: 0, won: 0, lost: 0, pending: 0, hit_rate: 0 },
      days: []
    };
  }

  const entries = Object.entries(rawHistory.days)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([date, day]) => {
      const picks = Array.isArray(day?.picks) ? day.picks : [];

      const normalizedPicks = picks.map(p => ({
        match: p.match || `${p.home_team || ""} vs ${p.away_team || ""}`.trim(),
        pick: p.pick || "-",
        odds: p.odds ?? "-",
        status: "pending",
        result_label: "Pendiente"
      }));

      return {
        date,
        generated_at: day?.saved_at ? formatDateTime(day.saved_at) : "-",
        picks: normalizedPicks,
        stats: {
          won: 0,
          lost: 0,
          pending: normalizedPicks.length
        }
      };
    });

  const totalPicks = entries.reduce((acc, day) => acc + (day.picks?.length || 0), 0);
  const pending = totalPicks;

  return {
    summary: {
      total_picks: totalPicks,
      won: 0,
      lost: 0,
      pending,
      hit_rate: 0
    },
    days: entries
  };
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
          <p>Seguimiento guardado por días.</p>
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
        <p><strong>Fecha:</strong> ${escapeHtml(todayData.cache_day || "-")}</p>
        <p><strong>Generado:</strong> ${escapeHtml(formatDateTime(todayData.generated_at) || "-")}</p>
        <p><strong>Hasta:</strong> ${escapeHtml(formatDateTime(todayData.cached_until) || "-")}</p>
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
        <p>Mercados mixtos, picks fijados durante todo el día y seguimiento del historial guardado.</p>
      </div>
      <button class="refresh-btn" onclick="loadAll(true)">Actualizar</button>
    </section>

    <section class="meta-strip">
      <div><strong>Fecha:</strong> ${escapeHtml(todayData.cache_day || "-")}</div>
      <div><strong>Generado:</strong> ${escapeHtml(formatDateTime(todayData.generated_at) || "-")}</div>
      <div><strong>Se mantiene hasta:</strong> ${escapeHtml(formatDateTime(todayData.cached_until) || "-")}</div>
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
      Picks diarios cargados correctamente. El sistema mantiene los picks del día y guarda histórico por fecha.
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
      ? `${BACKEND_URL}?force_refresh=true&ts=${Date.now()}`
      : `${BACKEND_URL}?ts=${Date.now()}`;

    const [todayDataRaw, historyRaw] = await Promise.all([
      fetchJson(todayUrl),
      fetchJson(`${HISTORY_URL}?ts=${Date.now()}`)
    ]);

    const historyData = normalizeHistory(historyRaw);
    const todayData = todayDataRaw || {};

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

document.addEventListener("DOMContentLoaded", () => {
  loadAll(true);
});

window.loadAll = loadAll;