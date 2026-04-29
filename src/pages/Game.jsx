import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { useWebSocket } from "../contexts/WebSocketContext";
import lbLogo from "../assets/lb.png";
import { apiFetch, getApiBase } from "../lib/api/client";

export default function Game({ onNavigate, onStakeSelected, selectedStake }) {
  const [adminPost, setAdminPost] = useState(null);
  const apiBase = getApiBase();
  const { sessionId } = useAuth();
  useWebSocket();

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
    onStakeSelected?.(s);
  };

  // Show initial screen when no stake is selected
  if (!selectedStake) {
    return (
      <div
        className="min-h-screen"
        style={{ position: "relative", backgroundColor: "#e6e6fa" }}
      >
        <header className="p-4">
          <div className="app-header">
            <div className="app-logo">
              <div className="logo-circle">
                <img
                  src={lbLogo}
                  alt="Lekulu Bingo Logo"
                  className="logo-image"
                />
              </div>
              <span className="app-title" style={{ color: "#facc15" }}>
                Lekulu Bingo
              </span>
            </div>
            <button
              className="rules-button"
              onClick={() => onNavigate?.("rules")}
            >
              <span className="rules-icon">❓</span>
              <span>Rules</span>
            </button>
          </div>
          <h1 className="text-center text-3xl md:text-4xl font-extrabold leading-tight mt-6 text-white">
            Welcome to Lekulu Bingo
          </h1>
          <div className="text-center text-white mt-4">
            <p>Choose your stake amount to start playing</p>
          </div>
        </header>

        <main className="p-4 mb-8">
          <div className="stake-card rounded-2xl p-4 mx-auto max-w-md fade-in-up">
            <div className="stake-card__header">
              <div className="play-icon">▶</div>
              <div className="stake-card__title">Choose Your Stake</div>
            </div>
            <div className="grid grid-cols-1 gap-6 mt-8 max-w-sm mx-auto">
              <button
                onClick={() => joinStake(10)}
                className="stake-btn stake-green"
              >
                <div className="play-icon-small">▶</div>
                <span>Play 10 ETB</span>
              </button>
              <button
                onClick={() => joinStake(20)}
                className="stake-btn stake-blue"
              >
                <div className="play-icon-small">▶</div>
                <span>Play 20 ETB</span>
              </button>
              <button
                onClick={() => joinStake(50)}
                className="stake-btn stake-gold"
              >
                <div className="play-icon-small">▶</div>
                <span>Play 50 ETB</span>
              </button>
            </div>
          </div>

          {/* Admin Announcement - TV Screen Style */}
          {adminPost && (
            <div className="mx-auto max-w-md w-full px-2 mt-2">
              <div className="relative">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-3 shadow-2xl">
                  <div className="relative bg-black rounded-xl overflow-hidden border-4 border-gray-700 shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
                    <div className="relative">
                      <div className="absolute top-3 left-3 z-20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-black/80 text-white border border-gray-600 backdrop-blur-sm">
                            {adminPost.kind === "image"
                              ? "📺 LIVE"
                              : "📺 VIDEO"}
                          </span>
                        </div>
                      </div>
                      {adminPost.kind === "image" ? (
                        <img
                          src={adminPost.url}
                          alt={adminPost.caption || "Announcement"}
                          className="w-full h-48 sm:h-56 md:h-64 object-cover"
                          onError={(e) => {
                            e.target.src = lbLogo;
                            e.target.alt = "Lekulu Bingo Logo";
                          }}
                        />
                      ) : (
                        <video
                          src={adminPost.url}
                          className="w-full h-48 sm:h-56 md:h-64 object-cover"
                          controls
                          muted
                          playsInline
                          onError={(e) => {
                            e.target.style.display = "none";
                            const fallbackImg = document.createElement("img");
                            fallbackImg.src = lbLogo;
                            fallbackImg.alt = "Lekulu Bingo Logo";
                            fallbackImg.className =
                              "w-full h-48 sm:h-56 md:h-64 object-cover";
                            e.target.parentNode.insertBefore(
                              fallbackImg,
                              e.target,
                            );
                          }}
                        />
                      )}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="h-full bg-gradient-to-b from-transparent via-white/2 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                    {adminPost.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4">
                        <div className="text-white text-sm leading-relaxed font-medium">
                          {adminPost.caption}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center mt-2">
                    <div className="w-16 h-2 bg-gradient-to-r from-gray-600 to-gray-700 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <BottomNav current="game" onNavigate={onNavigate} />
      </div>
    );
  }

  // If stake is selected, this component shouldn't be rendered
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#e6e6fa" }}
    >
      <div className="text-center text-white">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-4">Navigation Error</h1>
        <p className="text-white/80 mb-6">
          You have a stake selected but are on the wrong page.
        </p>
        <button
          onClick={() => onNavigate?.("cartela-selection")}
          className="px-6 py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors"
        >
          Go to Cartella Selection
        </button>
      </div>
    </div>
  );
}
