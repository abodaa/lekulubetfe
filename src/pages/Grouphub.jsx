import React, { useEffect, useState } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../lib/auth/AuthProvider";
import CartelaSelection from "./CartelaSelection.jsx";
import GameLayout from "./GameLayout.jsx";
import Winner from "./Winner.jsx";
import { prefetchCartellas } from "../lib/cartellaCache";
import { loadGroupCode, clearGroupCode } from "../lib/groupSession";
import { useT } from "../contexts/Languagecontext";

const STAKES = [10, 20, 50];
const GAME_PHASES = ["registration", "starting", "running", "announce"];

const PAGE_BG =
  "min-h-[var(--app-height)] text-white bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]";

const CARD =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]";

function StakePills({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STAKES.map((s) => {
        const active = Number(value) === s;
        return (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={`py-3 rounded-xl border font-bold transition-all ${
              active
                ? "bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 border-amber-300/50 shadow-[0_4px_14px_rgba(245,158,11,0.35)]"
                : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {s} ETB
          </button>
        );
      })}
    </div>
  );
}

export default function GroupHub({ onNavigate }) {
  const {
    group,
    groupStatus,
    openGroups,
    gameState,
    createGroup,
    requestJoinGroup,
    rejoinGroup,
    exitGroup,
    approveJoin,
    rejectJoin,
    setGroupStake,
    setGroupOpen,
    startGroup,
    leaveGroup,
    listOpenGroups,
  } = useWebSocket();
  const { showError, showSuccess, showInfo } = useToast();
  const { sessionId } = useAuth();
  const t = useT();

  const [tab, setTab] = useState("create");
  const [createStake, setCreateStake] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [rejoining, setRejoining] = useState(() => !!loadGroupCode());

  // Surface server-side group events as toasts.
  useEffect(() => {
    const onErr = (e) =>
      showError(e.detail?.message || t("gh.something_wrong"));
    const onClosed = (e) => {
      const r = e.detail?.reason;
      if (r === "group_dissolved") showInfo(t("gh.closed_by_owner"));
      else if (r === "group_join_rejected") showError(t("gh.join_declined"));
      else if (r === "group_left") showInfo(t("gh.you_left"));
    };
    const onReq = (e) =>
      showInfo(
        t("gh.asked_to_join", { name: e.detail?.name || t("gh.someone") }),
      );
    window.addEventListener("groupError", onErr);
    window.addEventListener("groupClosed", onClosed);
    window.addEventListener("groupJoinRequested", onReq);
    return () => {
      window.removeEventListener("groupError", onErr);
      window.removeEventListener("groupClosed", onClosed);
      window.removeEventListener("groupJoinRequested", onReq);
    };
  }, [showError, showInfo]);

  // Keep the open-group list fresh while browsing.
  useEffect(() => {
    if (!group && tab === "join") {
      listOpenGroups();
      const id = setInterval(listOpenGroups, 5000);
      return () => clearInterval(id);
    }
  }, [group, tab, listOpenGroups]);

  // Warm the static cartella-layout cache while sitting in the lobby so the
  // board renders instantly when the round starts — for the owner too, who
  // otherwise jumps straight from "Start" into a cold fetch.
  useEffect(() => {
    if (group && groupStatus === "lobby") {
      try {
        if (sessionId) prefetchCartellas(sessionId);
      } catch {
        /* ignore */
      }
    }
  }, [group, groupStatus]);

  // On opening "Play in Group", if we have a remembered group and aren't
  // already in one, ask the server to re-admit us (re-enters group mode). This
  // is the ONLY path that auto-redirects into a group — public stake selection
  // never does.
  useEffect(() => {
    if (group) return;
    if (loadGroupCode()) {
      setRejoining(true);
      rejoinGroup();
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload-resume: while waiting for the server to re-admit us into our group,
  // show a "rejoining" state. Clear it once the group is restored, or give up
  // after a few seconds (the group no longer exists) and fall back to the menu.
  useEffect(() => {
    if (!rejoining) return;
    if (group) {
      setRejoining(false);
      return;
    }
    const t = setTimeout(() => {
      clearGroupCode();
      setRejoining(false);
    }, 10000);
    return () => clearTimeout(t);
  }, [rejoining, group]);

  const copyCode = (code) => {
    try {
      navigator.clipboard?.writeText(code);
      showSuccess(t("gh.code_copied"));
    } catch {
      /* ignore */
    }
  };

  // ---------- IN-GAME: reuse the proven screens ----------
  // Back from a group game returns to the stake-selection home and leaves group
  // MODE (membership is kept, so the home screen offers "rejoin via Play in
  // Group"), mirroring the public game's back behavior.
  const goHomeFromGroup = () => {
    exitGroup?.();
    onNavigate?.("game", true);
  };

  // Drive this off the authoritative group status (set by the server's
  // group_state), NOT a possibly-stale gameState.phase from earlier public play
  // — otherwise the owner/joiner can be thrown into cartella selection before a
  // round has actually started.
  const inGame =
    group && groupStatus === "in_game" && GAME_PHASES.includes(gameState.phase);
  if (inGame) {
    const stake = group.stake;
    // Mirror the public determineGamePage mapping: "starting" belongs with the
    // running game (numbers are being called), NOT the selection screen.
    if (gameState.phase === "running" || gameState.phase === "starting") {
      return (
        <GameLayout
          stake={stake}
          onNavigate={(p) => p === "game" && goHomeFromGroup()}
        />
      );
    }
    if (gameState.phase === "announce") {
      // After ~5s the server returns the group to its lobby and GroupHub flips
      // back automatically.
      return (
        <Winner
          onNavigate={(p) => p === "game" && leaveGroup()}
          onResetToGame={() => {}}
        />
      );
    }
    return (
      <CartelaSelection
        stake={stake}
        onNavigate={(p) => p === "game" && leaveGroup()}
        onResetToGame={() => leaveGroup()}
        onCartelaSelected={() => {}}
        onGameIdUpdate={() => {}}
      />
    );
  }

  // ---------- PENDING APPROVAL ----------
  if (groupStatus === "pending") {
    return (
      <div
        className={`${PAGE_BG} flex flex-col items-center justify-center p-6`}
      >
        <div className={`${CARD} p-8 w-full max-w-sm text-center`}>
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <h2 className="text-lg font-bold mb-1">{t("gh.request_sent")}</h2>
          <p className="text-white/60 text-sm mb-6">
            {t("gh.waiting_approve")}
            {group?.code ? t("gh.group_suffix", { code: group.code }) : ""}.
          </p>
          <button
            onClick={leaveGroup}
            className="w-full py-3 rounded-xl bg-white/10 border border-white/20 font-semibold hover:bg-white/15"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  // ---------- LOBBY ----------
  if (group && groupStatus === "lobby") {
    const isOwner = !!group.isOwner;
    const onlineCount = (group.members || []).filter((m) => m.online).length;
    const canStart = isOwner && onlineCount >= 2;
    return (
      <div className={`${PAGE_BG} p-4 pb-28`}>
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/40 text-[11px] uppercase tracking-wider">
                {t("gh.group_code")}
              </div>
              <button
                onClick={() => copyCode(group.code)}
                className="text-2xl font-extrabold tracking-[0.2em] text-amber-300"
                title="Tap to copy"
              >
                {group.code}
              </button>
            </div>
            <button
              onClick={leaveGroup}
              className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-sm font-semibold hover:bg-rose-500/25"
            >
              {isOwner ? t("gh.close_group") : t("gh.leave")}
            </button>
          </div>

          {/* Stake */}
          <div className={`${CARD} p-4 mb-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white/80">
                {t("gh.stake")}
              </span>
              {!isOwner && (
                <span className="text-amber-300 font-bold">
                  {group.stake} ETB
                </span>
              )}
            </div>
            {isOwner ? (
              <StakePills value={group.stake} onChange={setGroupStake} />
            ) : (
              <p className="text-white/40 text-xs">{t("gh.set_by_owner")}</p>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setGroupOpen(!group.isOpen)}
                className="flex items-center justify-between w-full mt-3 gap-3 text-left"
              >
                <span className="text-xs text-white/60">
                  {t("gh.list_public")}
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                    group.isOpen ? "bg-emerald-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      group.isOpen ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            )}
          </div>

          {/* Members */}
          <div className={`${CARD} p-4 mb-3`}>
            <div className="text-sm font-semibold text-white/80 mb-2">
              {t("gh.players", { n: group.memberCount })}
            </div>
            <div className="space-y-2">
              {(group.members || []).map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        m.online ? "bg-emerald-400" : "bg-white/25"
                      }`}
                    />
                    <span className="text-sm">{m.name}</span>
                    {m.isOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {t("gh.owner")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending requests (owner) */}
          {isOwner && (group.pending || []).length > 0 && (
            <div className={`${CARD} p-4 mb-3`}>
              <div className="text-sm font-semibold text-white/80 mb-2">
                {t("gh.join_requests")}
              </div>
              <div className="space-y-2">
                {group.pending.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm truncate">{p.name}</span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approveJoin(p.userId)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30"
                      >
                        {t("gh.approve")}
                      </button>
                      <button
                        onClick={() => rejectJoin(p.userId)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/70 text-xs font-semibold hover:bg-white/15"
                      >
                        {t("gh.reject")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isOwner && (
            <div className="text-center text-white/50 text-sm py-4">
              {t("gh.waiting_owner_start")}
            </div>
          )}
        </div>

        {/* Start bar (owner) */}
        {isOwner && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#06080f] to-transparent">
            <div className="max-w-md mx-auto">
              <button
                onClick={() =>
                  canStart ? startGroup() : showError(t("gh.need_2"))
                }
                disabled={!canStart}
                className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-all ${
                  canStart
                    ? "bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.4)]"
                    : "bg-white/10 text-white/40 border border-white/15"
                }`}
              >
                {canStart
                  ? t("gh.start_game", { stake: group.stake })
                  : t("gh.waiting_players", { n: onlineCount })}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- REJOINING AFTER RELOAD ----------
  if (rejoining && !group) {
    return (
      <div
        className={`${PAGE_BG} flex flex-col items-center justify-center p-6`}
      >
        <div className={`${CARD} p-8 w-full max-w-sm text-center`}>
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <h2 className="text-lg font-bold mb-1">{t("gh.rejoining")}</h2>
          <p className="text-white/60 text-sm">{t("gh.reconnecting")}</p>
        </div>
      </div>
    );
  }

  // ---------- NO GROUP: CREATE / JOIN ----------
  return (
    <div className={`${PAGE_BG} p-4`}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button
            onClick={() => onNavigate?.("game", true)}
            className="w-9 h-9 grid place-items-center rounded-xl bg-white/10 border border-white/20 text-white/80"
            aria-label="Back"
          >
            ‹
          </button>
          <h1 className="text-xl font-extrabold">{t("game.play_in_group")}</h1>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {["create", "join"].map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`py-2.5 rounded-xl font-semibold capitalize transition-all ${
                tab === tabKey
                  ? "bg-white/15 border border-white/25"
                  : "bg-white/5 border border-white/10 text-white/60"
              }`}
            >
              {tabKey === "create" ? t("gh.create") : t("gh.join")}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <div className={`${CARD} p-5`}>
            <h2 className="font-bold mb-1">{t("gh.create_group_h")}</h2>
            <p className="text-white/55 text-sm mb-4">{t("gh.create_desc")}</p>
            <div className="text-white/70 text-sm font-semibold mb-2">
              {t("gh.stake_per_player")}
            </div>
            <StakePills value={createStake} onChange={setCreateStake} />
            <button
              onClick={() => createGroup(createStake)}
              className="w-full mt-5 py-4 rounded-2xl font-extrabold text-lg bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.4)]"
            >
              {t("gh.create_group_btn")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`${CARD} p-5`}>
              <h2 className="font-bold mb-3">{t("gh.join_with_code")}</h2>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="ABCDE"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-center tracking-[0.3em] font-bold uppercase placeholder:text-white/25 focus:outline-none focus:border-amber-400/50"
              />
              <button
                onClick={() =>
                  joinCode.length >= 4
                    ? requestJoinGroup(joinCode)
                    : showError(t("gh.enter_valid_code"))
                }
                className="w-full mt-3 py-3 rounded-xl font-bold bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950"
              >
                {t("gh.request_to_join")}
              </button>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold">{t("gh.open_groups")}</h2>
                <button
                  onClick={listOpenGroups}
                  className="text-xs text-amber-300/80 hover:text-amber-300"
                >
                  {t("gh.refresh")}
                </button>
              </div>
              {(openGroups || []).length === 0 ? (
                <p className="text-white/40 text-sm">{t("gh.no_open")}</p>
              ) : (
                <div className="space-y-2">
                  {openGroups.map((g) => (
                    <div
                      key={g.code}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="min-w-0">
                        <div className="font-bold tracking-widest text-amber-300">
                          {g.code}
                        </div>
                        <div className="text-xs text-white/50 truncate">
                          {g.ownerName} · {g.stake} ETB · {g.memberCount}{" "}
                          {g.memberCount === 1
                            ? t("gh.player_one")
                            : t("gh.player_many")}
                        </div>
                      </div>
                      <button
                        onClick={() => requestJoinGroup(g.code)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/15 shrink-0"
                      >
                        {t("gh.request_btn")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
