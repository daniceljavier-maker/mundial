import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ============================================================
   PORRA MUNDIAL 2026  (v2)
   Conectado a Google Drive (Google Sheets via Apps Script)
   ============================================================ */

const PARTICIPANTS = [
  "Lore", "Iñakitxu", "Derek", "Iñaki", "Idoia",
  "Dan", "Teresa", "Iñigo / Carla", "Manuel", "Dominique",
];

const SEED_MATCHES = [
  { id: "qf1", round: "Cuartos de final", stage: "knockout", kickoff: "2026-07-09T20:00:00Z",
    home: { name: "Francia", flag: "🇫🇷" }, away: { name: "Marruecos", flag: "🇲🇦" }, result: null },
  { id: "qf2", round: "Cuartos de final", stage: "knockout", kickoff: "2026-07-10T19:00:00Z",
    home: { name: "España", flag: "🇪🇸" }, away: { name: "Bélgica", flag: "🇧🇪" }, result: null },
  { id: "qf3", round: "Cuartos de final", stage: "knockout", kickoff: "2026-07-11T21:00:00Z",
    home: { name: "Noruega", flag: "🇳🇴" }, away: { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" }, result: null },
  { id: "qf4", round: "Cuartos de final", stage: "knockout", kickoff: "2026-07-12T01:00:00Z",
    home: { name: "Argentina", flag: "🇦🇷" }, away: { name: "Suiza", flag: "🇨🇭" }, result: null },
];

const MISS_MIN = 120;

// Reemplaza esto con tu Web App URL de Google Apps Script
const SCRIPT_URL = "TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI"; 

/* ---------- Almacenamiento en Drive ---------- */
async function loadDriveData() {
  if (!SCRIPT_URL || SCRIPT_URL === "TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI") return null;
  try {
    const res = await fetch(SCRIPT_URL);
    return await res.json();
  } catch (e) {
    console.error("Error cargando Drive:", e);
    return null;
  }
}

async function saveToDrive(action, payload) {
  if (!SCRIPT_URL || SCRIPT_URL === "TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI") return;
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload })
    });
  } catch (e) {
    console.error("Error guardando en Drive:", e);
  }
}

/* LocalStorage para datos de dispositivo (clientId y nombre) */
const getLocal = (key) => localStorage.getItem(key);
const setLocal = (key, val) => localStorage.setItem(key, val);

/* ---------- Etiquetas de método ---------- */
const metLabel = (m) => (m === "pen" ? "pen." : m === "et" ? "TE" : "");
const metLong = (m) => (m === "pen" ? "penales" : m === "et" ? "tiempo extra" : "90'");
const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

function scoreBet(bet, m) {
  if (!m.result) return { points: 0, label: "—", pending: true };
  if (!bet) return { points: 0, label: "Sin pronóstico" };
  const ph = bet.h, pa = bet.a, ah = m.result.homeGoals, aa = m.result.awayGoals;
  const po = sgn(ph - pa), ro = sgn(ah - aa);
  const exact = ph === ah && pa === aa;

  if (m.stage === "group") {
    const winnerOk = po === ro;
    if (exact) return { points: 10, label: "Marcador exacto" };
    if (winnerOk && ph - pa === ah - aa) return { points: 8, label: "Ganador + diferencia" };
    if (winnerOk && (ph === ah || pa === aa)) return { points: 6, label: "Ganador + goles de un equipo" };
    if (winnerOk) return { points: 4, label: "Solo el ganador" };
    return { points: 0, label: "Sin acierto" };
  }
  const wentExtra = m.result.metodo && m.result.metodo !== "90";
  const actualAdv = ro !== 0 ? (ah > aa ? "home" : "away") : m.result.advancer;
  const predAdv = po !== 0 ? (ph > pa ? "home" : "away") : bet.advancer;
  const advOk = predAdv && actualAdv && predAdv === actualAdv;
  const predictedExtra = po === 0;

  if (exact && (!wentExtra || advOk)) return { points: 10, label: "Marcador exacto" };
  if (advOk && ph - pa === ah - aa) return { points: 8, label: "Avanza + diferencia" };
  if (advOk && (ph === ah || pa === aa)) return { points: 6, label: "Avanza + goles de un equipo" };
  if (advOk) return { points: 4, label: "Solo quién avanza" };
  if (predictedExtra && wentExtra) return { points: 2, label: "Acertó TE/penales" };
  return { points: 0, label: "Sin acierto" };
}

function buildStandings(matches, bets) {
  const rows = PARTICIPANTS.map((pid) => {
    let pts = 0, exact = 0, eights = 0, goalErr = 0, metodoHits = 0, minErr = 0;
    const detail = {};
    for (const m of matches) {
      const bet = bets?.[m.id]?.[pid] || null;
      if (m.result) {
        const s = scoreBet(bet, m);
        pts += s.points;
        if (s.points === 10) exact++;
        if (s.points === 8) eights++;
        if (bet) goalErr += Math.abs(bet.h - m.result.homeGoals) + Math.abs(bet.a - m.result.awayGoals);
        if (bet && bet.metodo && bet.metodo === m.result.metodo) metodoHits++;
        if (m.result.firstGoalMinute != null) {
          if (bet && bet.minuto != null) minErr += Math.abs(bet.minuto - m.result.firstGoalMinute);
          else minErr += MISS_MIN;
        }
        detail[m.id] = s;
      } else {
        detail[m.id] = bet ? { points: null, label: "Apostado", pending: true } : { points: null, label: "—", pending: true };
      }
    }
    return { pid, pts, exact, eights, goalErr, metodoHits, minErr, detail };
  });
  rows.sort((x, y) =>
    y.pts - x.pts || y.exact - x.exact || y.metodoHits - x.metodoHits ||
    y.eights - x.eights || x.goalErr - y.goalErr || x.minErr - y.minErr
  );
  let last = null, shown = 0;
  rows.forEach((r, i) => {
    const key = [r.pts, r.exact, r.metodoHits, r.eights, r.goalErr, r.minErr].join("|");
    if (key !== last) { shown = i + 1; last = key; }
    r.position = shown;
  });
  return rows;
}

function fmtKick(iso) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City", weekday: "short", day: "numeric",
      month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
function timeLeft(iso, now) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3.6e6), mnt = Math.floor((diff % 3.6e6) / 6e4), d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${mnt}m`;
  return `${mnt}m`;
}

export default function App() {
  const [clientId, setClientId] = useState(null);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bets, setBets] = useState({});
  const [claims, setClaims] = useState({});
  const [config, setConfig] = useState({ pin: null });
  const [tab, setTab] = useState("apostar");
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminOk, setAdminOk] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const refresh = useCallback(async () => {
    const data = await loadDriveData();
    if (data) {
      setMatches(data.matches && data.matches.length > 0 ? data.matches : SEED_MATCHES);
      setBets(data.bets || {});
      setClaims(data.claims || {});
      setConfig(data.config || { pin: null });
    } else {
      setMatches(SEED_MATCHES);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let cid = getLocal("clientId");
      if (!cid) { cid = "c" + Math.random().toString(36).slice(2); setLocal("clientId", cid); }
      setClientId(cid);
      const meRaw = getLocal("me");
      if (meRaw) setMe(meRaw);
      await refresh();
      setLoaded(true);
    })();
  }, [refresh]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  const claimName = async (name) => {
    if (claims[name] && claims[name] !== clientId) { flash("Ese nombre ya está tomado"); return; }
    const latest = { ...claims };
    for (const k of Object.keys(latest)) if (latest[k] === clientId) delete latest[k];
    latest[name] = clientId;
    setClaims(latest); setMe(name); setLocal("me", name);
    saveToDrive("updateClaims", latest);
  };

  const releaseName = async () => {
    const latest = { ...claims };
    for (const k of Object.keys(latest)) if (latest[k] === clientId) delete latest[k];
    setClaims(latest); setMe(null); setLocal("me", "");
    saveToDrive("updateClaims", latest);
  };

  const submitBet = async (matchId, bet) => {
    const latest = { ...bets };
    if (!latest[matchId]) latest[matchId] = {};
    latest[matchId][me] = { ...bet, at: Date.now() };
    setBets(latest);
    saveToDrive("updateBets", latest);
    flash("Pronóstico guardado ⚽");
  };

  const saveMatches = (next) => { setMatches(next); saveToDrive("updateMatches", next); };
  const saveConfig = (next) => { setConfig(next); saveToDrive("updateConfig", next); };
  const resetClaims = () => { setClaims({}); saveToDrive("updateClaims", {}); flash("Nombres liberados"); };

  const standings = useMemo(() => buildStandings(matches, bets), [matches, bets]);
  const myRow = standings.find((r) => r.pid === me);
  const openMatches = matches.filter((m) => !m.result && new Date(m.kickoff).getTime() > now);
  const nextMatch = [...openMatches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];

  if (!loaded) return <Shell><div className="center muted">Cargando…</div></Shell>;

  return (
    <Shell>
      <Header me={me} onChangeMe={releaseName} onAdmin={() => setAdminOpen(true)} />
      {!me ? (
        <Pick onPick={claimName} bets={bets} claims={claims} clientId={clientId} />
      ) : (
        <>
          <Tabs tab={tab} setTab={setTab} myPts={myRow?.pts ?? 0} />
          <div className="content">
            {tab === "apostar" && <Apostar me={me} matches={matches} bets={bets} now={now} onSubmit={submitBet} nextId={nextMatch?.id} />}
            {tab === "ranking" && <Ranking standings={standings} matches={matches} me={me} />}
            {tab === "criterio" && <Criterio />}
          </div>
        </>
      )}
      {adminOpen && (
        <Admin
          ok={adminOk} pin={config.pin} matches={matches} claims={claims}
          onAuth={setAdminOk} onSetPin={(p) => saveConfig({ ...config, pin: p })}
          onSaveMatches={saveMatches} onResetClaims={resetClaims}
          onClose={() => setAdminOpen(false)} flash={flash}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      <Styles />
    </Shell>
  );
}

/* ============================================================
   COMPONENTES VISUALES
   ============================================================ */

function Shell({ children }) {
  return (
    <div className="shell">
      <div className="container">{children}</div>
    </div>
  );
}

function Header({ me, onChangeMe, onAdmin }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="ball">⚽</span>
        <div>
          <h1>Porra Mundial 2026</h1>
          <p className="muted small">Cuartos de final · en vivo</p>
        </div>
      </div>
      <div className="header-actions">
        {me && (
          <button className="chip" onClick={onChangeMe} title="Cambiar de nombre">
            👤 {me} ✕
          </button>
        )}
        <button className="chip ghost" onClick={onAdmin} title="Panel de administración">⚙️</button>
      </div>
    </header>
  );
}

function Tabs({ tab, setTab, myPts }) {
  const tabs = [
    { id: "apostar", label: "Apostar", icon: "🎯" },
    { id: "ranking", label: "Ranking", icon: "🏆" },
    { id: "criterio", label: "Criterio", icon: "📖" },
  ];
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
          <span>{t.icon}</span> {t.label}
          {t.id === "ranking" && <span className="pts-badge">{myPts} pts</span>}
        </button>
      ))}
    </nav>
  );
}

function Pick({ onPick, claims, clientId }) {
  return (
    <div className="pick">
      <h2>¿Quién eres?</h2>
      <p className="muted">Elige tu nombre para empezar a apostar. Cada nombre solo puede usarse en un dispositivo.</p>
      <div className="pick-grid">
        {PARTICIPANTS.map((p) => {
          const taken = claims[p] && claims[p] !== clientId;
          return (
            <button key={p} className={`pick-btn ${taken ? "taken" : ""}`} disabled={taken} onClick={() => onPick(p)}>
              {p} {taken && <span className="small muted">(ocupado)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Apostar({ me, matches, bets, now, onSubmit, nextId }) {
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  return (
    <div className="stack">
      {sorted.length === 0 && <div className="card center muted">No hay partidos todavía.</div>}
      {sorted.map((m) => (
        <MatchCard key={m.id} m={m} me={me} bet={bets?.[m.id]?.[me] || null} now={now} onSubmit={onSubmit} highlight={m.id === nextId} />
      ))}
    </div>
  );
}

function MatchCard({ m, me, bet, now, onSubmit, highlight }) {
  const locked = !!m.result || new Date(m.kickoff).getTime() <= now;
  const left = timeLeft(m.kickoff, now);
  const [h, setH] = useState(bet?.h ?? "");
  const [a, setA] = useState(bet?.a ?? "");
  const [advancer, setAdvancer] = useState(bet?.advancer ?? "");
  const [metodo, setMetodo] = useState(bet?.metodo ?? "90");
  const [minuto, setMinuto] = useState(bet?.minuto ?? "");
  const [open, setOpen] = useState(false);
  const isKO = m.stage !== "group";
  const tie = h !== "" && a !== "" && Number(h) === Number(a);
  const score = bet && m.result ? scoreBet(bet, m) : null;

  const canSave = h !== "" && a !== "" && (!isKO || !tie || advancer);

  const save = () => {
    const b = { h: Number(h), a: Number(a), metodo: tie && isKO ? metodo : "90" };
    if (isKO && tie) b.advancer = advancer;
    if (minuto !== "") b.minuto = Number(minuto);
    onSubmit(m.id, b);
    setOpen(false);
  };

  return (
    <div className={`card match ${highlight ? "highlight" : ""}`}>
      <div className="match-top">
        <span className="round">{m.round}</span>
        <span className="muted small">{fmtKick(m.kickoff)}{left ? ` · ⏳ ${left}` : ""}</span>
      </div>
      <div className="match-teams">
        <TeamCol team={m.home} goals={m.result?.homeGoals} />
        <div className="vs">
          {m.result ? (
            <div className="final">
              <strong>{m.result.homeGoals} - {m.result.awayGoals}</strong>
              {m.result.metodo && m.result.metodo !== "90" && <span className="small muted"> ({metLabel(m.result.metodo)})</span>}
            </div>
          ) : (
            <span className="muted">vs</span>
          )}
        </div>
        <TeamCol team={m.away} goals={m.result?.awayGoals} />
      </div>

      {bet && (
        <div className="mybet">
          Tu pronóstico: <strong>{bet.h} - {bet.a}</strong>
          {bet.metodo && bet.metodo !== "90" && <span> ({metLong(bet.metodo)})</span>}
          {bet.advancer && <span> · avanza {bet.advancer === "home" ? m.home.name : m.away.name}</span>}
          {bet.minuto != null && <span> · 1er gol min {bet.minuto}</span>}
          {score && <span className={`score-badge s${score.points}`}>{score.points} pts · {score.label}</span>}
        </div>
      )}

      {!locked && (
        <>
          {!open ? (
            <button className="btn" onClick={() => setOpen(true)}>{bet ? "Editar pronóstico" : "Apostar"}</button>
          ) : (
            <div className="bet-form">
              <div className="row">
                <label>{m.home.flag} {m.home.name}
                  <input type="number" min="0" max="20" value={h} onChange={(e) => setH(e.target.value)} />
                </label>
                <label>{m.away.flag} {m.away.name}
                  <input type="number" min="0" max="20" value={a} onChange={(e) => setA(e.target.value)} />
                </label>
              </div>
              {isKO && tie && (
                <div className="row">
                  <label>¿Quién avanza?
                    <select value={advancer} onChange={(e) => setAdvancer(e.target.value)}>
                      <option value="">Elige…</option>
                      <option value="home">{m.home.name}</option>
                      <option value="away">{m.away.name}</option>
                    </select>
                  </label>
                  <label>Método
                    <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                      <option value="et">Tiempo extra</option>
                      <option value="pen">Penales</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="row">
                <label>Minuto del 1er gol (opcional)
                  <input type="number" min="0" max="120" value={minuto} onChange={(e) => setMinuto(e.target.value)} placeholder="ej. 23" />
                </label>
              </div>
              <div className="row">
                <button className="btn primary" disabled={!canSave} onClick={save}>Guardar</button>
                <button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </>
      )}
      {locked && !m.result && <div className="muted small center">🔒 Apuestas cerradas — partido en curso</div>}
    </div>
  );
}

function TeamCol({ team, goals }) {
  return (
    <div className="team">
      <span className="flag">{team.flag}</span>
      <span className="tname">{team.name}</span>
      {goals != null && <span className="tgoals">{goals}</span>}
    </div>
  );
}

function Ranking({ standings, matches, me }) {
  const played = matches.filter((m) => m.result);
  return (
    <div className="stack">
      <div className="card">
        <h3>🏆 Clasificación</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Participante</th><th>Pts</th><th>10s</th><th>8s</th><th>Err. goles</th><th>Método</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.pid} className={r.pid === me ? "me" : ""}>
                  <td>{r.position === 1 ? "🥇" : r.position === 2 ? "🥈" : r.position === 3 ? "🥉" : r.position}</td>
                  <td>{r.pid}{r.pid === me ? " (tú)" : ""}</td>
                  <td><strong>{r.pts}</strong></td>
                  <td>{r.exact}</td>
                  <td>{r.eights}</td>
                  <td>{r.goalErr}</td>
                  <td>{r.metodoHits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {played.length > 0 && (
        <div className="card">
          <h3>📋 Detalle por partido</h3>
          {played.map((m) => (
            <div key={m.id} className="detail-block">
              <p className="small"><strong>{m.home.flag} {m.home.name} {m.result.homeGoals} - {m.result.awayGoals} {m.away.name} {m.away.flag}</strong>{m.result.metodo && m.result.metodo !== "90" ? ` (${metLong(m.result.metodo)})` : ""}</p>
              <div className="detail-grid">
                {standings.map((r) => (
                  <span key={r.pid} className={`mini ${r.pid === me ? "me" : ""}`}>
                    {r.pid}: <strong>{r.detail[m.id]?.points ?? "—"}</strong>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Criterio() {
  return (
    <div className="card">
      <h3>📖 Criterio de puntuación</h3>
      <table>
        <tbody>
          <tr><td><strong>10 pts</strong></td><td>Marcador exacto</td></tr>
          <tr><td><strong>8 pts</strong></td><td>Ganador/avanza + diferencia de goles</td></tr>
          <tr><td><strong>6 pts</strong></td><td>Ganador/avanza + goles de un equipo</td></tr>
          <tr><td><strong>4 pts</strong></td><td>Solo el ganador / quién avanza</td></tr>
          <tr><td><strong>2 pts</strong></td><td>Acertar que hubo tiempo extra / penales</td></tr>
        </tbody>
      </table>
      <h4>Desempates (en orden)</h4>
      <ol className="small">
        <li>Más marcadores exactos (10s)</li>
        <li>Más aciertos de método (90' / TE / penales)</li>
        <li>Más aciertos de 8 puntos</li>
        <li>Menor error acumulado de goles</li>
        <li>Menor error en el minuto del primer gol (sin apuesta = {MISS_MIN} min de castigo)</li>
      </ol>
      <p className="muted small">Las apuestas se cierran automáticamente al inicio de cada partido.</p>
    </div>
  );
}

function Admin({ ok, pin, matches, onAuth, onSetPin, onSaveMatches, onResetClaims, onClose, flash }) {
  const [input, setInput] = useState("");
  const [newPin, setNewPin] = useState("");

  const tryAuth = () => {
    if (input === pin) onAuth(true);
    else flash("PIN incorrecto");
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>⚙️ Administración</h3>
          <button className="chip ghost" onClick={onClose}>✕</button>
        </div>

        {!ok ? (
          <div className="stack">
            {pin ? (
              <>
                <label>PIN de administrador
                  <input type="password" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryAuth()} />
                </label>
                <button className="btn primary" onClick={tryAuth}>Entrar</button>
              </>
            ) : (
              <>
                <p className="muted small">No hay PIN configurado. Crea uno (mínimo 4 caracteres) para proteger el panel.</p>
                <label>Nuevo PIN
                  <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
                </label>
                <button className="btn primary" disabled={newPin.length < 4} onClick={() => { onSetPin(newPin); onAuth(true); flash("PIN creado"); }}>
                  Crear PIN y entrar
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="stack">
            <h4>Capturar resultados</h4>
            {matches.map((m) => (
              <ResultForm key={m.id} m={m} onSave={(result) => {
                onSaveMatches(matches.map((x) => (x.id === m.id ? { ...x, result } : x)));
                flash("Resultado guardado");
              }} onClear={() => {
                onSaveMatches(matches.map((x) => (x.id === m.id ? { ...x, result: null } : x)));
                flash("Resultado borrado");
              }} />
            ))}
            <h4>Agregar partido</h4>
            <AddMatch onAdd={(nm) => { onSaveMatches([...matches, nm]); flash("Partido agregado"); }} />
            <h4>Otros</h4>
            <button className="btn danger" onClick={onResetClaims}>Liberar todos los nombres</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultForm({ m, onSave, onClear }) {
  const [h, setH] = useState(m.result?.homeGoals ?? "");
  const [a, setA] = useState(m.result?.awayGoals ?? "");
  const [metodo, setMetodo] = useState(m.result?.metodo ?? "90");
  const [advancer, setAdvancer] = useState(m.result?.advancer ?? "");
  const [minuto, setMinuto] = useState(m.result?.firstGoalMinute ?? "");
  const tie = h !== "" && a !== "" && Number(h) === Number(a);
  const isKO = m.stage !== "group";

  const save = () => {
    const r = { homeGoals: Number(h), awayGoals: Number(a), metodo };
    if (isKO && tie) r.advancer = advancer;
    if (minuto !== "") r.firstGoalMinute = Number(minuto);
    onSave(r);
  };

  return (
    <div className="result-form">
      <p className="small"><strong>{m.home.flag} {m.home.name} vs {m.away.name} {m.away.flag}</strong> <span className="muted">· {m.round}</span></p>
      <div className="row">
        <input type="number" min="0" placeholder={m.home.name} value={h} onChange={(e) => setH(e.target.value)} />
        <input type="number" min="0" placeholder={m.away.name} value={a} onChange={(e) => setA(e.target.value)} />
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          <option value="90">90'</option>
          <option value="et">Tiempo extra</option>
          <option value="pen">Penales</option>
        </select>
      </div>
      <div className="row">
        {isKO && tie && (
          <select value={advancer} onChange={(e) => setAdvancer(e.target.value)}>
            <option value="">¿Quién avanza?</option>
            <option value="home">{m.home.name}</option>
            <option value="away">{m.away.name}</option>
          </select>
        )}
        <input type="number" min="0" max="120" placeholder="Min 1er gol" value={minuto} onChange={(e) => setMinuto(e.target.value)} />
        <button className="btn small-btn primary" disabled={h === "" || a === "" || (isKO && tie && !advancer)} onClick={save}>Guardar</button>
        {m.result && <button className="btn small-btn ghost" onClick={onClear}>Borrar</button>}
      </div>
    </div>
  );
}

function AddMatch({ onAdd }) {
  const [round, setRound] = useState("Semifinal");
  const [stage, setStage] = useState("knockout");
  const [homeName, setHomeName] = useState("");
  const [homeFlag, setHomeFlag] = useState("");
  const [awayName, setAwayName] = useState("");
  const [awayFlag, setAwayFlag] = useState("");
  const [kickoff, setKickoff] = useState("");

  const add = () => {
    onAdd({
      id: "m" + Math.random().toString(36).slice(2, 8),
      round, stage,
      kickoff: new Date(kickoff).toISOString(),
      home: { name: homeName, flag: homeFlag || "🏳️" },
      away: { name: awayName, flag: awayFlag || "🏳️" },
      result: null,
    });
    setHomeName(""); setHomeFlag(""); setAwayName(""); setAwayFlag(""); setKickoff("");
  };

  return (
    <div className="result-form">
      <div className="row">
        <input placeholder="Ronda (ej. Semifinal)" value={round} onChange={(e) => setRound(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="knockout">Eliminatoria</option>
          <option value="group">Grupos</option>
        </select>
      </div>
      <div className="row">
        <input placeholder="Local" value={homeName} onChange={(e) => setHomeName(e.target.value)} />
        <input placeholder="🇫🇷" className="flag-in" value={homeFlag} onChange={(e) => setHomeFlag(e.target.value)} />
        <input placeholder="Visitante" value={awayName} onChange={(e) => setAwayName(e.target.value)} />
        <input placeholder="🇲🇦" className="flag-in" value={awayFlag} onChange={(e) => setAwayFlag(e.target.value)} />
      </div>
      <div className="row">
        <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        <button className="btn small-btn primary" disabled={!homeName || !awayName || !kickoff} onClick={add}>Agregar</button>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #0b1120; }
      .shell { min-height: 100vh; background: linear-gradient(180deg, #0b1120 0%, #101a33 100%); color: #e8edf7;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px 12px 64px; }
      .container { max-width: 640px; margin: 0 auto; }
      .muted { color: #8b97ad; } .small { font-size: 12px; } .center { text-align: center; padding: 24px 0; }
      .stack { display: flex; flex-direction: column; gap: 14px; }

      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .ball { font-size: 30px; }
      .brand h1 { font-size: 19px; }
      .header-actions { display: flex; gap: 8px; }
      .chip { background: #1c2942; color: #e8edf7; border: 1px solid #2c3d61; border-radius: 999px;
        padding: 6px 12px; font-size: 13px; cursor: pointer; }
      .chip.ghost { background: transparent; }
      .chip:hover { border-color: #4a6396; }

      .tabs { display: flex; gap: 6px; margin-bottom: 16px; background: #131e38; border-radius: 12px; padding: 4px; }
      .tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 6px;
        background: transparent; color: #8b97ad; border: none; border-radius: 9px; font-size: 13px; cursor: pointer; }
      .tab.active { background: #22335a; color: #fff; font-weight: 600; }
      .pts-badge { background: #2ecc71; color: #05230f; border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 700; }

      .card { background: #131e38; border: 1px solid #223154; border-radius: 14px; padding: 16px; }
      .card h3 { margin-bottom: 10px; } .card h4 { margin: 12px 0 8px; }
      .match.highlight { border-color: #2ecc71; box-shadow: 0 0 0 1px #2ecc71; }
      .match-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
      .round { background: #22335a; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
      .match-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
      .team { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .flag { font-size: 34px; } .tname { font-weight: 600; font-size: 14px; text-align: center; }
      .tgoals { font-size: 22px; font-weight: 800; color: #2ecc71; }
      .vs { text-align: center; } .final strong { font-size: 22px; }

      .mybet { background: #0e1730; border: 1px dashed #2c3d61; border-radius: 9px; padding: 8px 10px;
        font-size: 13px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
      .score-badge { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; margin-left: auto; }
      .score-badge.s10 { background: #f1c40f; color: #3d3200; }
      .score-badge.s8 { background: #2ecc71; color: #05230f; }
      .score-badge.s6 { background: #3498db; color: #06263c; }
      .score-badge.s4 { background: #9b59b6; color: #2b0e38; }
      .score-badge.s2 { background: #e67e22; color: #3b1e04; }
      .score-badge.s0 { background: #2c3d61; color: #aab6cc; }

      .btn { width: 100%; background: #22335a; color: #fff; border: 1px solid #2c3d61; border-radius: 10px;
        padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
      .btn.primary { background: #2ecc71; border-color: #2ecc71; color: #05230f; }
      .btn.ghost { background: transparent; }
      .btn.danger { background: #b03030; border-color: #b03030; }
      .btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn.small-btn { width: auto; padding: 8px 14px; font-size: 13px; }

      .bet-form { display: flex; flex-direction: column; gap: 10px; background: #0e1730; border-radius: 10px; padding: 12px; }
      .row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
      .row > label { flex: 1; min-width: 120px; }
      label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #8b97ad; }
      input, select { background: #1c2942; color: #e8edf7; border: 1px solid #2c3d61; border-radius: 8px;
        padding: 9px 10px; font-size: 15px; width: 100%; }
      .row input, .row select { width: auto; flex: 1; min-width: 90px; }
      input:focus, select:focus { outline: none; border-color: #2ecc71; }
      .flag-in { max-width: 64px; }

      .pick h2 { margin-bottom: 6px; }
      .pick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
      .pick-btn { background: #131e38; color: #e8edf7; border: 1px solid #223154; border-radius: 12px;
        padding: 16px 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
      .pick-btn:hover:not(:disabled) { border-color: #2ecc71; }
      .pick-btn.taken { opacity: 0.4; cursor: not-allowed; }

      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #1c2942; }
      th { color: #8b97ad; font-weight: 600; font-size: 11px; text-transform: uppercase; }
      tr.me td { background: #16294a; }

      .detail-block { border-top: 1px solid #1c2942; padding: 10px 0; }
      .detail-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .mini { background: #0e1730; border-radius: 6px; padding: 3px 8px; font-size: 12px; }
      .mini.me { border: 1px solid #2ecc71; }

      ol { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; margin: 6px 0; }

      .modal-bg { position: fixed; inset: 0; background: rgba(4, 8, 18, 0.75); display: flex;
        align-items: flex-start; justify-content: center; padding: 24px 12px; z-index: 50; overflow-y: auto; }
      .modal { background: #131e38; border: 1px solid #223154; border-radius: 16px; padding: 18px;
        width: 100%; max-width: 520px; }
      .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .result-form { background: #0e1730; border-radius: 10px; padding: 10px; display: flex;
        flex-direction: column; gap: 8px; margin-bottom: 8px; }

      .toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); background: #2ecc71;
        color: #05230f; font-weight: 700; padding: 10px 18px; border-radius: 999px; font-size: 14px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.4); z-index: 100; }
    `}</style>
  );
}