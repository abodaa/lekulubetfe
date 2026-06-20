import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { useWebSocket } from "../contexts/WebSocketContext";
import lbLogo from "../assets/lb.png";
import { apiFetch, getApiBase } from "../lib/api/client";
import { prefetchCartellas } from "../lib/cartellaCache";
import { loadGroupCode } from "../lib/groupSession";
import { motion } from "framer-motion";
import { useT } from "../contexts/Languagecontext";
import { GrInfo } from "react-icons/gr";
import { CiPlay1 } from "react-icons/ci";
import { FaCoins, FaCrown, FaRocket, FaUsers } from "react-icons/fa";

export default function Game({ onNavigate, onStakeSelected, selectedStake }) {
  const [adminPost, setAdminPost] = useState(null);
  // A remembered group means the user can rejoin via Play in Group (set on
  // mount; the home screen is freshly mounted whenever we navigate here).
  const [activeGroupCode] = useState(() => loadGroupCode());
  const apiBase = getApiBase();
  const { sessionId } = useAuth();
  const t = useT();
  useWebSocket();

  // Warm the static cartella-layout cache while the player is picking a stake,
  // so the selection screen renders instantly when they tap one.
  useEffect(() => {
    if (sessionId) prefetchCartellas(sessionId);
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;
    const loadAdminPost = async () => {
      try {
        const data = await apiFetch("/admin/posts", {
          method: "GET",
          timeoutMs: 20000,
        });
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        const active = posts.find((p) => p?.active === true) || null;
        if (active) {
          const url = active.url?.startsWith("http")
            ? active.url
            : `${apiBase}${active.url}`;
          if (isMounted) setAdminPost({ ...active, url });
        } else {
          if (isMounted) setAdminPost(null);
        }
      } catch (e) {
        console.error("Failed to load admin post:", e);
        if (isMounted) setAdminPost(null);
      }
    };
    loadAdminPost();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const joinStake = (s) => {
    localStorage.removeItem("selectedStake");
    onStakeSelected?.(s);
  };

  // Show initial screen when no stake is selected
  if (!selectedStake) {
    return (
      <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]">
        {/* Fixed Header*/}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#0e1830]/95 to-transparent backdrop-blur-md py-2 px-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <img
              src={lbLogo}
              alt="Lekulu Bingo Logo"
              className="w-10 h-10 object-contain rounded-full flex items-center justify-center border border-white/20"
            />
          </div>
        </div>

        <main className="px-4 pb-24 pt-16">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 mt-4"
          >
            <h1 className="text-2xl font-bold text-white mb-2">
              {t("game.lets_play")}
            </h1>
            <p className="text-white/40 text-sm">{t("game.select_stake")}</p>
          </motion.div>

          {/* Stake Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-sm mx-auto space-y-3"
          >
            {/* 10 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(10)}
              className="group relative rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3 cursor-pointer transition-all"
            >
              <div className="absolute -top-1 -right-1 z-50">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[8px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
                  {t("game.popular")}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <FaCoins className="text-emerald-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        10 ETB
                      </span>
                      <span className="text-[10px] text-white/30">
                        {" "}
                        {t("game.good_choice")}{" "}
                      </span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      {t("game.most_players")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span>{t("game.play")}</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>

            {/* 20 ETB Card - Featured */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(20)}
              className="group relative rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur border-2 border-blue-400/40 p-3 cursor-pointer transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FaRocket className="text-blue-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        20 ETB
                      </span>
                      <span className="text-[10px] text-yellow-400/70">
                        {t("game.best_value")}
                      </span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      {t("game.good_regular")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  <span>{t("game.play")}</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>

            {/* 50 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(50)}
              className="group relative rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3 cursor-pointer transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <FaCrown className="text-amber-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        50 ETB
                      </span>
                      <span className="text-[10px] text-white/30">
                        {t("game.high_stake")}
                      </span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      {t("game.high_rollers")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  <span>{t("game.play")}</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>

            {/* In a group — rejoin hint */}
            {activeGroupCode && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate?.("group-hub")}
                className="flex items-center gap-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-3 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/25 flex items-center justify-center flex-shrink-0">
                  <FaUsers className="text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-emerald-100 font-bold text-sm">
                    {t("game.in_group", { code: activeGroupCode })}
                  </div>
                  <p className="text-emerald-200/70 text-[11px] leading-tight">
                    {t("game.tap_rejoin")}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Play in a Group */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate?.("group-hub")}
              className="group relative rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-400/5 backdrop-blur border-2 border-amber-400/40 p-3 cursor-pointer transition-all overflow-hidden"
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <FaUsers className="text-amber-300 text-lg" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">
                      {t("game.play_in_group")}
                    </div>
                    <p className="text-white/40 text-[10px]">
                      {t("game.create_join")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-medium">
                  <span>{t("game.open")}</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Admin Announcement */}
          {adminPost && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-sm mx-auto mt-6"
            >
              <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="flex items-center justify-between gap-5">
                    <p className="text-white text-sm uppercase">
                      {t("game.announcement")}
                    </p>
                    <p className="text-white/50 text-xs">
                      {new Date(adminPost.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {adminPost.kind === "image" ? (
                  <img
                    src={adminPost.url}
                    alt={adminPost.caption || "Announcement"}
                    className="w-full h-36 object-cover"
                    onError={(e) => {
                      e.target.src = lbLogo;
                      e.target.alt = "Lekulu Bingo Logo";
                    }}
                  />
                ) : (
                  <video
                    src={adminPost.url}
                    className="w-full h-36 object-cover"
                    controls
                    muted
                    playsInline
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallbackImg = document.createElement("img");
                      fallbackImg.src = lbLogo;
                      fallbackImg.alt = "Lekulu Bingo Logo";
                      fallbackImg.className = "w-full h-36 object-cover";
                      e.target.parentNode.insertBefore(fallbackImg, e.target);
                    }}
                  />
                )}

                {adminPost.caption && (
                  <div className="p-2">
                    <p className="text-white/60 text-xs leading-relaxed">
                      {adminPost.caption}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </main>

        <BottomNav current="game" onNavigate={onNavigate} />
      </div>
    );
  }

  // If stake is selected, this component shouldn't be rendered
  return (
    <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-white text-lg font-bold mb-1">
          {t("game.nav_error")}
        </h2>
        <p className="text-white/40 text-xs mb-4">{t("game.nav_error_desc")}</p>
        <button
          onClick={() => onNavigate?.("cartela-selection")}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium shadow-lg shadow-amber-500/30 hover:scale-105 transition-all active:scale-95"
        >
          {t("game.go_cartela")}
        </button>
      </motion.div>
    </div>
  );
}
