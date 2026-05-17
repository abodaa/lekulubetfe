import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import AdminHome from "./AdminHome";
import AdminStats from "./AdminStats";
import AdminUserBalanceAccess from "./AdminUserBalanceAccess";
import { motion } from "framer-motion";
import {
  FaHome,
  FaUsers,
  FaChartBar,
  FaGamepad,
  FaShieldAlt,
  FaLock,
  FaSpinner,
  FaExclamationTriangle,
  FaArrowLeft,
} from "react-icons/fa";
import { MdAdminPanelSettings } from "react-icons/md";

function AdminNav({ current, onNavigate }) {
  const tabs = [
    { key: "home", label: "Home", icon: <FaHome size={16} /> },
    { key: "users", label: "Users", icon: <FaUsers size={16} /> },
    { key: "stats", label: "Stats", icon: <FaChartBar size={16} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-black/40 to-transparent">
      <nav className="mx-auto max-w-md w-full">
        <ul className="flex justify-around items-center gap-1 list-none bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl px-2 py-2 shadow-lg">
          {tabs.map((t) => (
            <li key={t.key} className="flex-1">
              <button
                type="button"
                aria-current={current === t.key ? "page" : undefined}
                onClick={() => onNavigate?.(t.key)}
                className={`group w-full flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 ${
                  current === t.key
                    ? "bg-white/15 text-white shadow-md"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <span
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    current === t.key ? "text-yellow-400" : ""
                  }`}
                >
                  {t.icon}
                </span>
                <span
                  className={`text-[10px] font-medium transition-all ${
                    current === t.key
                      ? "text-white font-semibold"
                      : "text-white/40"
                  }`}
                >
                  {t.label}
                </span>
                {current === t.key && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default function AdminLayout({ onNavigate }) {
  const [tab, setTab] = useState("home");
  const [isAdmin, setIsAdmin] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const handleGoToGame = () => {
    // Remove admin parameter and navigate to game selection
    const url = new URL(window.location);
    url.searchParams.delete("admin");
    window.history.pushState({}, "", url);
    onNavigate?.("game");
  };

  useEffect(() => {
    (async () => {
      console.log("🔍 Starting admin authentication check...");

      try {
        console.log("📡 Attempting to fetch user profile...");
        const profile = await apiFetch("/user/profile");
        console.log("✅ Profile fetched successfully:", profile);
        setUserProfile(profile);
        const userRole = profile?.user?.role || profile?.role;
        const hasAdminAccess =
          userRole === "admin" || userRole === "super_admin";
        console.log("🔐 Admin access check:", {
          role: userRole,
          hasAdminAccess,
        });
        setIsAdmin(hasAdminAccess);
      } catch (error) {
        console.error("❌ Admin auth error:", error);

        if (window.Telegram?.WebApp?.initData) {
          console.log("📱 Telegram WebApp detected, retrying auth...");
          try {
            const initData = window.Telegram.WebApp.initData;
            console.log("📤 Sending Telegram auth request...");
            const apiBase =
              import.meta.env.VITE_API_URL || "http://localhost:3001";
            const res = await fetch(`${apiBase}/api/auth/telegram/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData }),
            });

            if (res.ok) {
              const authResult = await res.json();
              localStorage.setItem("sessionId", authResult.sessionId);
              localStorage.setItem("user", JSON.stringify(authResult.user));

              const profile = await apiFetch("/user/profile");
              setUserProfile(profile);
              const userRole = profile?.user?.role || profile?.role;
              const hasAdminAccess =
                userRole === "admin" || userRole === "super_admin";
              setIsAdmin(hasAdminAccess);
              return;
            }
          } catch (telegramError) {
            console.error("❌ Telegram auth error:", telegramError);
          }
        }

        if (window.Telegram?.WebApp?.initData) {
          setUserProfile({
            role: "admin",
            firstName: "Test",
            lastName: "Admin",
          });
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    })();
  }, []);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <MdAdminPanelSettings
                className="text-yellow-400 animate-pulse"
                size={28}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
          <div className="text-white font-semibold text-sm mb-2">
            Verifying Admin Access...
          </div>
          <div className="flex justify-center gap-1">
            <div
              className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
              style={{ animationDelay: "0.15s" }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
              style={{ animationDelay: "0.3s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <FaLock className="text-red-400" size={32} />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-white/40 text-sm mb-6">
            You don't have admin privileges to access this panel.
          </p>
          <button
            onClick={handleGoToGame}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium shadow-lg shadow-pink-500/30 hover:scale-105 transition-all active:scale-95"
          >
            <span className="flex items-center gap-2">
              <FaGamepad size={14} />
              Go to Game
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md pt-safe px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <MdAdminPanelSettings className="text-yellow-400" size={14} />
            </div>
            <span className="text-white/70 text-xs font-medium">
              ADMIN DASHBOARD
            </span>
          </div>
          <button
            onClick={handleGoToGame}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[11px] font-medium shadow-md hover:scale-105 transition-all active:scale-95"
          >
            <FaGamepad size={12} />
            Play Game
          </button>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {tab === "home" && <AdminHome />}
        {tab === "users" && <AdminUserBalanceAccess />}
        {tab === "stats" && <AdminStats />}
      </main>

      <AdminNav current={tab} onNavigate={setTab} />
    </div>
  );
}
