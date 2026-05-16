import React from "react";
import { GiPlayButton, GiTrophy, GiWallet, GiPlayer } from "react-icons/gi";
import { FaHome, FaChartLine, FaUser } from "react-icons/fa";

const tabs = [
  { key: "game", label: "Play", icon: <GiPlayButton size={18} /> },
  { key: "scores", label: "Leaderboard", icon: <GiTrophy size={18} /> },
  { key: "wallet", label: "Wallet", icon: <GiWallet size={18} /> },
  { key: "profile", label: "Profile", icon: <GiPlayer size={18} /> },
];

export default function BottomNav({ current, onNavigate }) {
  return (
    <div className="nav-wrap">
      <nav className="mx-auto max-w-md w-full">
        <ul className="bottom-nav flex justify-around items-center gap-1 list-none px-3 py-2 rounded-2xl">
          {tabs.map((t) => (
            <li key={t.key} className="flex-1">
              <button
                type="button"
                aria-current={current === t.key ? "page" : undefined}
                onClick={() => onNavigate?.(t.key)}
                className={`group w-full flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 ${
                  current === t.key
                    ? "bg-white/15 text-white shadow-lg"
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
                    current === t.key ? "text-white" : "text-white/40"
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
