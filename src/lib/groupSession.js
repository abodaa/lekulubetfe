// Persists the current private-group code across reloads / app close so a
// player (owner or joinee) can be re-admitted to the same group on return.
//
// Uses localStorage so a rejoin survives fully closing and reopening the mini
// app (important: players have staked real money on an in-progress round), but
// bounds the value with a TTL so a stale code can never make the app hang on
// "Rejoining…" long after the group is gone. A stale code also self-clears the
// moment the server declines re-admission.
const KEY = "lekulu_group";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export function saveGroupCode(code) {
  try {
    if (!code) return;
    localStorage.setItem(KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function loadGroupCode() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, ts } = JSON.parse(raw);
    if (!code || !ts || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearGroupCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
