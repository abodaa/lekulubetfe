import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../lib/api/client";

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-US", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(d);
  }
};

const money = (n) => Number(n || 0).toLocaleString();

// Colour + label per transaction type.
const TXN_META = {
  deposit: { label: "Deposit", cls: "text-emerald-400" },
  withdrawal: { label: "Withdrawal", cls: "text-red-400" },
  game_bet: { label: "Bet", cls: "text-amber-400" },
  game_win: { label: "Win", cls: "text-emerald-400" },
  bonus: { label: "Bonus", cls: "text-sky-400" },
  invite_reward: { label: "Referral", cls: "text-sky-400" },
  transfer_in: { label: "Transfer In", cls: "text-emerald-400" },
  transfer_out: { label: "Transfer Out", cls: "text-red-400" },
  coin_conversion: { label: "Coin Convert", cls: "text-purple-300" },
  admin_adjustment: { label: "Admin Adj.", cls: "text-white/80" },
};
const txnMeta = (t) => TXN_META[t] || { label: t, cls: "text-white/80" };

const Stat = ({ label, value, sub, accent }) => (
  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
    <div className="text-[11px] uppercase tracking-wide text-white/40">
      {label}
    </div>
    <div className={`text-lg font-semibold ${accent || "text-white"}`}>
      {value}
    </div>
    {sub != null && <div className="text-[11px] text-white/40">{sub}</div>}
  </div>
);

const TABS = ["Overview", "Transactions", "Games", "Referrals"];

export default function AdminUserDetail({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("Overview");

  // Paginated lists (seeded from the detail payload, extended via "load more").
  const [txns, setTxns] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnMore, setTxnMore] = useState(false);
  const [txnType, setTxnType] = useState("");
  const [txnLoading, setTxnLoading] = useState(false);

  const [games, setGames] = useState([]);
  const [gamePage, setGamePage] = useState(1);
  const [gameMore, setGameMore] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch(`/admin/users/${userId}/detail`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setTxns(d.transactions || []);
        setGames(d.games || []);
        setTxnPage(1);
        setGamePage(1);
        setTxnMore((d.transactions || []).length >= 50);
        setGameMore((d.games || []).length >= 30);
      })
      .catch((e) => {
        console.error("user detail load failed", e);
        if (alive) setError("Failed to load user details.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Re-fetch transactions when the type filter changes.
  const loadTxns = useCallback(
    async (page, type, replace) => {
      setTxnLoading(true);
      try {
        const q = new URLSearchParams({ page: String(page), limit: "30" });
        if (type) q.set("type", type);
        const d = await apiFetch(`/admin/users/${userId}/transactions?${q}`);
        setTxns((prev) =>
          replace ? d.transactions : [...prev, ...d.transactions],
        );
        setTxnPage(page);
        setTxnMore(!!d.hasMore);
      } catch (e) {
        console.error(e);
      } finally {
        setTxnLoading(false);
      }
    },
    [userId],
  );

  const onFilterType = (type) => {
    if (type === txnType) return;
    setTxnType(type);
    // Clear the list so the skeleton shows while the filtered set loads.
    setTxns([]);
    setTxnMore(false);
    loadTxns(1, type, true);
  };

  const loadGames = useCallback(
    async (page) => {
      setGameLoading(true);
      try {
        const d = await apiFetch(
          `/admin/users/${userId}/games?page=${page}&limit=20`,
        );
        setGames((prev) => (page === 1 ? d.games : [...prev, ...d.games]));
        setGamePage(page);
        setGameMore(!!d.hasMore);
      } catch (e) {
        console.error(e);
      } finally {
        setGameLoading(false);
      }
    },
    [userId],
  );

  const u = data?.user;
  const w = data?.wallet;
  const s = data?.summary;
  const r = data?.referrals;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg h-[90vh] sm:h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#0e1830] border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold truncate">
                {u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "User"}
              </h2>
              {u?.role && u.role !== "user" && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {u.role}
                </span>
              )}
              {u?.isBot && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  bot
                </span>
              )}
              {u?.isBlocked && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                  blocked
                </span>
              )}
            </div>
            {u && (
              <div className="text-xs text-white/50 mt-0.5 truncate">
                {u.username ? `@${u.username} · ` : ""}ID {u.telegramId}
                {u.phone ? ` · ${u.phone}` : ""}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-2 pt-2 gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "Games" && games.length === 0) loadGames(1);
              }}
              className={`flex-1 text-xs py-2 rounded-t-lg transition ${
                tab === t
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="text-white/50 text-sm">Loading…</div>}
          {error && <div className="text-red-400 text-sm">{error}</div>}

          {!loading && !error && data && (
            <>
              {tab === "Overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="Main"
                      value={money(w.main)}
                      accent="text-emerald-400"
                    />
                    <Stat
                      label="Bonus"
                      value={money(w.bonus)}
                      accent="text-sky-400"
                    />
                    <Stat
                      label="Coins"
                      value={money(w.coins)}
                      accent="text-amber-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="Deposited"
                      value={money(s.deposits)}
                      sub={`${s.depositsCount} txns`}
                      accent="text-emerald-400"
                    />
                    <Stat
                      label="Withdrawn"
                      value={money(s.withdrawals)}
                      sub={`${s.withdrawalsCount} txns`}
                      accent="text-red-400"
                    />
                    <Stat
                      label="Total Bets"
                      value={money(s.bets)}
                      sub={`${s.betsCount} bets`}
                    />
                    <Stat
                      label="Total Wins"
                      value={money(s.wins)}
                      sub={`${s.winsCount} wins`}
                      accent="text-emerald-400"
                    />
                    <Stat
                      label="Net Gaming"
                      value={money(s.netGaming)}
                      accent={
                        s.netGaming >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    />
                    <Stat
                      label="Referral Earnings"
                      value={money(s.inviteRewards)}
                    />
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs space-y-1.5 text-white/70">
                    <Row k="Registered" v={u.isRegistered ? "Yes" : "No"} />
                    <Row k="Language" v={(u.language || "en").toUpperCase()} />
                    <Row k="Max cartellas" v={u.maxCartellas ?? "default"} />
                    <Row k="Invited users" v={r.invitedCount} />
                    <Row
                      k="Invited by"
                      v={
                        r.inviter ? r.inviter.name || r.inviter.telegramId : "—"
                      }
                    />
                    <Row k="Joined" v={fmtDate(u.createdAt)} />
                    <Row k="Last active" v={fmtDate(u.lastActive)} />
                  </div>
                </div>
              )}

              {tab === "Transactions" && (
                <div className="space-y-2">
                  {/* Type filter — themed chips instead of a native <select>,
                      whose OS-rendered white dropdown was unreadable on the
                      dark theme. Horizontally scrollable on small screens. */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <FilterChip
                      active={txnType === ""}
                      onClick={() => onFilterType("")}
                    >
                      All
                    </FilterChip>
                    {Object.keys(TXN_META).map((t) => (
                      <FilterChip
                        key={t}
                        active={txnType === t}
                        onClick={() => onFilterType(t)}
                      >
                        {TXN_META[t].label}
                      </FilterChip>
                    ))}
                  </div>

                  {/* Filter fetch in-flight: skeleton rows when replacing the
                      list; existing rows dim while a fetch is running. */}
                  {txnLoading && txns.length === 0 && (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="h-[54px] rounded-lg bg-white/5 border border-white/10 animate-pulse"
                        />
                      ))}
                    </div>
                  )}
                  {txns.length === 0 && !txnLoading && (
                    <div className="text-white/40 text-sm py-6 text-center">
                      No transactions.
                    </div>
                  )}
                  <div
                    className={
                      txnLoading && txns.length > 0
                        ? "space-y-2 opacity-40 pointer-events-none transition-opacity"
                        : "space-y-2 transition-opacity"
                    }
                  >
                    {txns.map((t) => {
                      const m = txnMeta(t.type);
                      const neg = t.amount < 0;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className={`text-sm font-medium ${m.cls}`}>
                              {m.label}
                              {t.status && t.status !== "completed" && (
                                <span className="ml-1.5 text-[10px] uppercase text-amber-300">
                                  {t.status}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/40 truncate">
                              {t.description || t.gameId || ""}
                            </div>
                            <div className="text-[10px] text-white/30">
                              {fmtDate(t.createdAt)}
                            </div>
                          </div>
                          <div
                            className={`text-sm font-semibold shrink-0 ${
                              neg ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {neg ? "" : "+"}
                            {money(t.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {txnMore && (
                    <button
                      disabled={txnLoading}
                      onClick={() => loadTxns(txnPage + 1, txnType, false)}
                      className="w-full py-2 text-xs rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {txnLoading && (
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
                      )}
                      {txnLoading ? "Loading…" : "Load more"}
                    </button>
                  )}
                </div>
              )}

              {tab === "Games" && (
                <div className="space-y-2">
                  {games.length === 0 && !gameLoading && (
                    <div className="text-white/40 text-sm py-6 text-center">
                      No games played.
                    </div>
                  )}
                  {games.map((g) => (
                    <div
                      key={g.gameId}
                      className="rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80">
                          Stake {money(g.stake)} ·{" "}
                          <span className="text-white/50">
                            {g.cartellaCount} card
                            {g.cartellaCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        {g.won ? (
                          <span className="text-sm font-semibold text-emerald-400">
                            Won +{money(g.prize)}
                          </span>
                        ) : (
                          <span className="text-sm text-red-400">
                            −{money(g.staked)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {g.gameId} · {fmtDate(g.createdAt)}
                        {g.cartellas?.length
                          ? ` · #${g.cartellas.join(", #")}`
                          : ""}
                      </div>
                    </div>
                  ))}
                  {gameMore && (
                    <button
                      disabled={gameLoading}
                      onClick={() => loadGames(gamePage + 1)}
                      className="w-full py-2 text-xs rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
                    >
                      {gameLoading ? "Loading…" : "Load more"}
                    </button>
                  )}
                </div>
              )}

              {tab === "Referrals" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/70">
                    <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
                      Invited by
                    </div>
                    {r.inviter ? (
                      <div>
                        {r.inviter.name || "—"}{" "}
                        <span className="text-white/40 text-xs">
                          (ID {r.inviter.telegramId})
                        </span>
                      </div>
                    ) : (
                      <div className="text-white/40">Not referred</div>
                    )}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-white/40">
                    Invited {r.invitedCount} user
                    {r.invitedCount === 1 ? "" : "s"}
                  </div>
                  {r.invitedUsers.map((iu) => (
                    <div
                      key={iu.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                    >
                      <div className="text-sm text-white/80">
                        {iu.name || "—"}
                        <span className="text-white/40 text-xs ml-1">
                          ID {iu.telegramId}
                        </span>
                      </div>
                      <div className="text-[10px] text-white/30">
                        {fmtDate(iu.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between">
    <span className="text-white/40">{k}</span>
    <span className="text-white/80">{v}</span>
  </div>
);

const FilterChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border transition whitespace-nowrap ${
      active
        ? "bg-amber-500/25 text-amber-200 border-amber-500/40"
        : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80"
    }`}
  >
    {children}
  </button>
);
