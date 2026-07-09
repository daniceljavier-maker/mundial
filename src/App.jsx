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

// ... [MISMOS COMPONENTES VISUALES: Shell, Header, Tabs, Pick, Apostar, MatchCard, TeamCol, Ranking, Criterio, Admin, AddMatch, ResultForm, Styles]
// No modifiqué el código de la UI, puedes pegar el resto de tus componentes justo aquí debajo.