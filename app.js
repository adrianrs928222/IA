const API_BASE = "https://funcional-s4vd.onrender.com";

const state = {
  data: null,
  history: null,
  loading: true,
  error: "",
  leagueFilter: "all",
  marketFilter: "all",
  historyPage: 1,
  historyPageSize: 12,
};

const root = document.getElementById("app");

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function badge(text, cls = "") {
  return el("span", cls, text);
}

function formatMeta(data) {
  const generated = data?.generated_at || "-";
  const day = data?.cache_day || "-";
  const lookahead = data?.lookahead_hours ?? "-";
  const count = data?.count ?? 0;

  const meta = el("div", "meta");
  meta.textContent = `Picks: ${count} · Actualizado: ${generated} · Día: ${day} · Ventana: ${lookahead}h`;
  return meta;
}

function createFilters() {
  const wrap = el("div", "filters");

  const leagueSelect = document.createElement("select");
  leagueSelect.innerHTML = `
    <option value="all">Todas las ligas</option>
    <option value="LaLiga">LaLiga</option>
    <option value="Segunda División">Segunda División</option>
    <option value="Champions League">Champions League</option>
  `;
  leagueSelect.value = state.leagueFilter;
  leagueSelect.onchange = (e) => {
    state.leagueFilter = e.target.value;
    render();
  };

  const marketSelect = document.createElement("select");
  marketSelect.innerHTML = `
    <option value="all">Todos los mercados</option>
    <option value="winner">Ganador</option>
    <option value="btts_yes">Ambos marcan</option>
    <option value="over_2_5">Más de 2.5 goles</option>
  `;
  marketSelect.value = state.marketFilter;
  marketSelect.onchange = (e) => {
    state.marketFilter = e.target.value;
    render();
  };

  const refreshBtn = document.createElement("button");
  refreshBtn.textContent = "Refresh";
  refreshBtn.onclick = () => loadAll(true);

  wrap.appendChild(leagueSelect);
  wrap.appendChild(marketSelect);
  wrap.appendChild(refreshBtn);

  return wrap;
}

function createLoading() {
  const box = el("div", "loading");
  box.innerHTML = `
    <div class="loading-spinner"></div>
    <p>Cargando picks premium...</p>
  `;
  return box;
}

function createError(message) {
  return el("div", "error-box", message || "Error cargando picks");
}

function createEmpty() {
  return el("div", "empty-state", "No hay picks disponibles ahora mismo.");
}

function filterPicks(picks) {
  return (picks || []).filter((p) => {
    const leagueOk = state.leagueFilter === "all" || p.league === state.leagueFilter;
    const marketOk = state.marketFilter === "all" || p.pick_type === state.marketFilter;
    return leagueOk && marketOk;
  });
}

function pickTypeLabel(type) {
  if (type === "winner") return "Ganador";
  if (type === "btts_yes") return "Ambos marcan";
  if (type === "over_2_5") return "Más de 2.5 goles";
  return "Pick";
}

function confidenceBandLabel(confidence) {
  if (confidence >= 80) return "Confianza alta";
  if (confidence >= 72) return "Confianza media";
  return "Confianza intermedia";
}

function confidenceBandClass(confidence) {
  if (confidence >= 80) return "b alta green";
  if (confidence >= 72) return "b media yellow";
  return "b intermedia red";
}

function statusClass(status) {
  if (status === "won") return "r win";
  if (status === "lost") return "r lost";
  return "r pend";
}

function statusLabel(status) {
  if (status === "won") return "Acertado";
  if (status === "lost") return "Perdido";
  return "Pendiente";
}

function confidenceClass(conf) {
  if (conf >= 80) return "conf-high";
  if (conf >= 72) return "conf-medium";
  return "conf-low";
}

function formatOdds(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(2);
}

function createCombo(combo) {
  if (!combo || !combo.picks || !combo.picks.length) return null;

  const wrap = el("section", "combo");
  const title = el("h2", "", "Combi del día");
  wrap.appendChild(title);

  const meta = el("div", "combo-meta");
  meta.appendChild(badge(`Picks: ${combo.size || combo.picks.length}`));
  meta.appendChild(badge(`Cuota: ${formatOdds(combo.estimated_total_odds)}`));
  meta.appendChild(badge(`Confianza media: ${combo.confidence ?? "-"}%`));
  wrap.appendChild(meta);

  const list = el("div", "combo-card-list");

  combo.picks.forEach((p) => {
    const row = el("div", "combo-row");

    const strong = el("strong", "", p.match || "-");
    row.appendChild(strong);

    const sub = el(
      "small",
      "",
      `${p.pick || "-"} · ${p.league || "-"} · ${p.confidence ?? "-"}% · Cuota ${formatOdds(p.odds_estimate)}`
    );
    row.appendChild(sub);

    list.appendChild(row);
  });

  wrap.appendChild(list);
  return wrap;
}

function createConfidenceBadge(confidence) {
  const span = badge(`${confidence}%`, "confidence-badge");
  span.classList.add(confidenceClass(confidence));
  return span;
}

function createCard(pick, isTop = false) {
  const card = el("article", "card");

  const top = el("div", "top");
  const left = document.createElement("div");

  const league = el("div", "league", pick.league || "Liga");
  left.appendChild(league);

  const title = el("h2", "", pick.match || "-");
  left.appendChild(title);

  top.appendChild(left);

  const timeBadge = el("div", "time-badge", pick.time_local || "-");
  top.appendChild(timeBadge);
  card.appendChild(top);

  const tags = el("div", "tags");
  tags.appendChild(badge(pickTypeLabel(pick.pick_type), "t pick-type"));

  if (isTop) {
    tags.appendChild(badge("TOP PICK", "t top"));
  }

  tags.appendChild(
    badge(confidenceBandLabel(pick.confidence), confidenceBandClass(pick.confidence))
  );
  tags.appendChild(createConfidenceBadge(pick.confidence || 0));
  tags.appendChild(badge(statusLabel(pick.status), statusClass(pick.status)));
  card.appendChild(tags);

  const pickBox = el("div", "pick", pick.pick || "-");
  card.appendChild(pickBox);

  const stats = el("div", "stats");
  stats.appendChild(badge(`Ganador: ${pick.pick_winner || "-"}`));
  stats.appendChild(badge(`BTTS: ${pick.btts || "-"}`));
  stats.appendChild(badge(`Over 2.5: ${pick.over_2_5 || "-"}`));
  card.appendChild(stats);

  const oddsRow = el("div", "stats");
  oddsRow.appendChild(badge(`Cuota: ${formatOdds(pick.odds_estimate)}`));
  if (pick.bookmaker) {
    oddsRow.appendChild(badge(`${pick.bookmaker}`));
  }
  if (pick.bookmaker_market) {
    oddsRow.appendChild(badge(`${pick.bookmaker_market}`));
  }
  card.appendChild(oddsRow);

  const cardsRow = el("div", "cards-row");
  const cards = pick.cards || {};
  const entries = Object.entries(cards);

  if (entries.length) {
    entries.forEach(([team, value]) => {
      cardsRow.appendChild(badge(`${team}: ${value}`, "card-stat"));
    });
    card.appendChild(cardsRow);
  }

  if (pick.score_line) {
    const score = el("div", "score", `Marcador: ${pick.score_line}`);
    card.appendChild(score);
  }

  if (pick.tipster_explanation) {
    const tip = el("p", "tip", pick.tipster_explanation);
    card.appendChild(tip);
  }

  return card;
}

function createGroupSection(titleText, picks, topFirst = false) {
  const section = document.createElement("section");

  const title = el("h2", "", titleText);
  section.appendChild(title);

  if (!picks.length) {
    section.appendChild(el("div", "empty-state", "No hay picks en esta categoría."));
    return section;
  }

  const grid = el("div", "grid");
  picks.forEach((pick, idx) => {
    grid.appendChild(createCard(pick, topFirst && idx === 0));
  });
  section.appendChild(grid);

  return section;
}

function createHistoryPagination(historyData) {
  const totalPages = historyData?.total_pages || 1;
  const currentPage = historyData?.page || 1;

  if (totalPages <= 1) return null;

  const wrap = el("div", "pagination");

  const prev = document.createElement("button");
  prev.textContent = "←";
  prev.disabled = currentPage <= 1;
  prev.onclick = () => {
    if (state.historyPage > 1) {
      state.historyPage -= 1;
      loadHistoryOnly();
    }
  };
  wrap.appendChild(prev);

  const maxButtons = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxButtons - 1);

  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }

  for (let i = start; i <= end; i++) {
    const btn = document.createElement("button");
    btn.textContent = String(i);
    if (i === currentPage) btn.className = "active";
    btn.onclick = () => {
      state.historyPage = i;
      loadHistoryOnly();
    };
    wrap.appendChild(btn);
  }

  const next = document.createElement("button");
  next.textContent = "→";
  next.disabled = currentPage >= totalPages;
  next.onclick = () => {
    if (state.historyPage < totalPages) {
      state.historyPage += 1;
      loadHistoryOnly();
    }
  };
  wrap.appendChild(next);

  return wrap;
}

function createHistory(historyData) {
  const wrap = el("section", "history");
  const title = el("h2", "", "Historial");
  wrap.appendChild(title);

  const summary = el(
    "div",
    "meta",
    `Página ${historyData?.page || 1} de ${historyData?.total_pages || 1} · Total picks: ${historyData?.total_items || 0}`
  );
  wrap.appendChild(summary);

  const items = historyData?.items || [];

  if (!items.length) {
    wrap.appendChild(el("div", "empty-state", "Todavía no hay historial disponible."));
    return wrap;
  }

  const list = el("div", "history-list");

  items.forEach((p) => {
    const row = el("div", "history-row");

    const left = el("div", "history-row-left");
    const strong = el("strong", "", p.match || "-");
    const span = el(
      "span",
      "",
      `${p.pick || "-"} · ${p.league || "-"} · ${p.time_local || "-"} · ${p.confidence ?? 0}%`
    );

    let extraText = `Cuota ${formatOdds(p.odds_estimate)} · ${p.source || "-"}`;
    if (p.bookmaker) {
      extraText += ` · ${p.bookmaker}`;
    }
    if (p.score_line) {
      extraText += ` · Marcador ${p.score_line}`;
    }
    if (p.history_date) {
      extraText += ` · ${p.history_date}`;
    }

    const small = el("small", "", extraText);

    left.appendChild(strong);
    left.appendChild(span);
    left.appendChild(small);

    const right = el("div", "history-row-right");
    right.appendChild(badge(statusLabel(p.status), statusClass(p.status)));

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  wrap.appendChild(list);

  const pagination = createHistoryPagination(historyData);
  if (pagination) wrap.appendChild(pagination);

  return wrap;
}

function render() {
  root.innerHTML = "";

  root.appendChild(createFilters());

  if (state.loading) {
    root.appendChild(createLoading());
    return;
  }

  if (state.error) {
    root.appendChild(createError(state.error));
    return;
  }

  const data = state.data || {};
  const history = state.history || {};

  root.appendChild(formatMeta(data));

  const combo = createCombo(data.combo_of_day);
  if (combo) root.appendChild(combo);

  const alta = filterPicks(data.groups?.alta || []);
  const media = filterPicks(data.groups?.media || []);
  const intermedia = filterPicks(data.groups?.intermedia || []);
  const allPicks = [...alta, ...media, ...intermedia];

  if (!allPicks.length) {
    root.appendChild(createEmpty());
  } else {
    root.appendChild(createGroupSection("Confianza alta", alta, true));
    root.appendChild(createGroupSection("Confianza media", media));
    root.appendChild(createGroupSection("Confianza intermedia", intermedia));
  }

  root.appendChild(createHistory(history));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function loadHistoryOnly() {
  try {
    const historyUrl = `${API_BASE}/api/history?page=${state.historyPage}&page_size=${state.historyPageSize}`;
    state.history = await fetchJson(historyUrl);
    render();
  } catch (err) {
    console.error(err);
  }
}

async function loadAll(forceRefresh = false) {
  state.loading = true;
  state.error = "";
  render();

  try {
    const picksUrl = forceRefresh
      ? `${API_BASE}/api/picks?force_refresh=true`
      : `${API_BASE}/api/picks`;

    const historyUrl = `${API_BASE}/api/history?page=${state.historyPage}&page_size=${state.historyPageSize}`;

    const [picksData, historyData] = await Promise.all([
      fetchJson(picksUrl),
      fetchJson(historyUrl),
    ]);

    state.data = picksData;
    state.history = historyData;
  } catch (err) {
    state.error = "No se pudo cargar la información.";
    console.error(err);
  } finally {
    state.loading = false;
    render();
  }
}

loadAll();