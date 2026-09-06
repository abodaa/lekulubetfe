import React, { useEffect, useMemo, useState } from "react";
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

const fmtGap = (minutes) => {
  if (minutes == null) return "unknown";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / (60 * 24))} days`;
};

/**
 * Lists every user whose invitedBy looks like it came from the bot.start
 * bug (see telegram/bot.js) rather than a genuine invite: a real invite is
 * tracked in the SAME /start call that creates the account, so a big gap
 * between registrationDate and when the invite was actually recorded means
 * it was attached to an already-existing account later. Backed by
 * GET /admin/invites/audit (read-only) and POST /admin/invites/bulk-clear.
 */
export default function AdminInviteAudit({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [showAll, setShowAll] = useState(false); // include clearly-legit rows too
  const [selected, setSelected] = useState(() => new Set());
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    // This scans every user with invitedBy set — give it more room than the
    // default timeout, especially useful while the new invitedBy index (see
    // models/User.js) is still building on a large collection.
    apiFetch("/admin/invites/audit", { timeoutMs: 30000 })
      .then((d) => {
        setItems(d.items || []);
        setFlaggedCount(d.flaggedCount || 0);
        setUnknownCount(d.unknownCount || 0);
        setSelected(new Set());
      })
      .catch((e) => {
        console.error("invite audit load failed", e);
        // e.message is api_error_<status> (see lib/api/client.js) — surface
        // the status so a 401/403 (auth) vs 404 (route not deployed) vs 500
        // (server error — check server logs) are distinguishable at a glance
        // instead of a single generic message.
        setError(`Failed to load (${e?.message || "unknown error"}).`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const visibleItems = useMemo(
    () => (showAll ? items : items.filter((i) => i.likelyBug !== false)),
    [items, showAll],
  );

  const toggle = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllFlagged = () => {
    setSelected(
      new Set(items.filter((i) => i.likelyBug === true).map((i) => i.userId)),
    );
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkClear = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Clear the inviter for ${selected.size} user(s)? This also rolls back each inviter's count. This can't be undone.`,
      )
    )
      return;
    setClearing(true);
    setFeedback(null);

    // The backend caps each /invites/bulk-clear call at 500 ids (see
    // admin.js). A big incident (e.g. one popular invite link tapped
    // repeatedly over time by already-registered users) can easily produce
    // more than 500 flagged accounts, so chunk into multiple calls instead
    // of failing outright — this is exactly the "clear everyone at once"
    // convenience that was asked for, regardless of how many there are.
    const CHUNK_SIZE = 400;
    const ids = Array.from(selected);
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    let totalCleared = 0;
    const skipReasonCounts = {}; // e.g. { NOT_INVITED: 7, USER_NOT_FOUND: 1 }
    let failedChunk = null;
    for (const chunk of chunks) {
      try {
        const res = await apiFetch("/admin/invites/bulk-clear", {
          method: "POST",
          timeoutMs: 30000,
          body: { userIds: chunk },
        });
        totalCleared += res.clearedCount || 0;
        (res.skipped || []).forEach((s) => {
          const reason = s.reason || "UNKNOWN";
          skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
        });
      } catch (e) {
        console.error("bulk clear chunk failed", e);
        failedChunk = e;
        break; // stop on first failure — report what succeeded so far below
      }
    }

    const totalSkipped = Object.values(skipReasonCounts).reduce(
      (a, b) => a + b,
      0,
    );
    // NOT_INVITED skips almost always mean this account was already cleared
    // by an earlier attempt (e.g. one that reported failure client-side —
    // slow DB response, timeout — but actually completed server-side) rather
    // than a real problem, so call that out explicitly instead of leaving it
    // looking like an error.
    const reasonLabels = {
      NOT_INVITED: "already cleared (no inviter set)",
      USER_NOT_FOUND: "user not found",
      ERROR: "failed unexpectedly",
      UNKNOWN: "unknown reason",
    };
    const skipBreakdown = Object.entries(skipReasonCounts)
      .map(([reason, count]) => `${count} ${reasonLabels[reason] || reason}`)
      .join(", ");

    if (failedChunk) {
      setFeedback({
        type: "error",
        message: `Failed partway through (${failedChunk?.message || "unknown error"}). Cleared ${totalCleared} before it stopped — you can select the rest and try again.`,
      });
    } else {
      setFeedback({
        type: totalCleared > 0 || totalSkipped === 0 ? "success" : "info",
        message: `Cleared ${totalCleared} of ${selected.size}.${
          totalSkipped ? ` Skipped: ${skipBreakdown}.` : ""
        }`,
      });
    }
    load();
    setClearing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0a0b10] text-white overflow-y-auto"
      role="dialog"
    >
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">Invite Audit</h1>
            <p className="text-white/40 text-xs mt-0.5">
              Users whose "invited by" looks like the /start bug, not a real
              invite.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-white/40 text-sm py-10 text-center">
            Loading…
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm py-10 text-center">{error}</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400">
                {flaggedCount} likely bug{flaggedCount === 1 ? "" : "s"}
              </div>
              {unknownCount > 0 && (
                <div className="text-xs px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-400">
                  {unknownCount} uncertain (no matching invite record)
                </div>
              )}
              <div className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-white/40">
                {items.length} total invited users
              </div>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="accent-amber-500"
                />
                Show legitimate invites too
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={selectAllFlagged}
                disabled={flaggedCount === 0}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                Select all likely bugs ({flaggedCount})
              </button>
              <button
                onClick={clearSelection}
                disabled={selected.size === 0}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                Clear selection
              </button>
              <button
                onClick={handleBulkClear}
                disabled={selected.size === 0 || clearing}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 ml-auto"
              >
                {clearing ? "Clearing…" : `Clear selected (${selected.size})`}
              </button>
            </div>

            {feedback && (
              <div
                className={`text-xs px-3 py-2 rounded-lg mb-3 ${
                  feedback.type === "error"
                    ? "bg-red-500/10 text-red-400"
                    : feedback.type === "info"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {visibleItems.length === 0 ? (
              <div className="text-white/40 text-sm py-10 text-center">
                {showAll
                  ? "No invited users at all."
                  : "No suspicious invites found."}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleItems.map((i) => (
                  <div
                    key={i.userId}
                    className={`rounded-xl border p-3 text-sm ${
                      i.likelyBug === true
                        ? "bg-red-500/5 border-red-500/20"
                        : i.likelyBug === null
                          ? "bg-yellow-500/5 border-yellow-500/20"
                          : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i.userId)}
                        onChange={() => toggle(i.userId)}
                        className="mt-1 accent-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-white truncate">
                            {i.userName || "—"}{" "}
                            <span className="text-white/40 text-xs">
                              (ID {i.userTelegramId})
                            </span>
                          </div>
                          {i.likelyBug === true && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">
                              LIKELY BUG
                            </span>
                          )}
                          {i.likelyBug === null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">
                              UNCERTAIN
                            </span>
                          )}
                        </div>
                        <div className="text-white/50 text-xs mt-1">
                          Invited by {i.inviterName}{" "}
                          {i.inviterTelegramId && (
                            <span className="text-white/30">
                              (ID {i.inviterTelegramId})
                            </span>
                          )}
                        </div>
                        <div className="text-white/40 text-xs mt-1 flex flex-wrap gap-x-3">
                          <span>Registered: {fmtDate(i.registrationDate)}</span>
                          <span>Invite recorded: {fmtDate(i.invitedAt)}</span>
                          <span
                            className={
                              i.likelyBug === true
                                ? "text-red-400"
                                : "text-white/40"
                            }
                          >
                            Gap: {fmtGap(i.gapMinutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
