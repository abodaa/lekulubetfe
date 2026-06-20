import React from "react";
import { CgProfile } from "react-icons/cg";
import { GiPlayButton, GiTrophy, GiWallet, GiPlayer } from "react-icons/gi";
import { useT } from "../contexts/LanguageContext";

const tabs = [
  { key: "game", labelKey: "nav.play", icon: <GiPlayButton size={18} /> },
  { key: "scores", labelKey: "nav.leaderboard", icon: <GiTrophy size={18} /> },
  { key: "wallet", labelKey: "nav.wallet", icon: <GiWallet size={18} /> },
  { key: "profile", labelKey: "nav.profile", icon: <CgProfile size={18} /> },
];

export default function BottomNav({ current, onNavigate }) {
  const t = useT();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-black/40 to-transparent">
      <nav className="mx-auto max-w-md w-full">
        <ul className="flex justify-around items-center gap-1 list-none bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl px-2 py-2 shadow-lg">
          {tabs.map((tab) => (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                aria-current={current === tab.key ? "page" : undefined}
                onClick={() => onNavigate?.(tab.key)}
                className={`group w-full flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 ${
                  current === tab.key
                    ? "bg-white/15 text-white shadow-md"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <span
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    current === tab.key ? "text-yellow-400" : ""
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-medium transition-all ${
                    current === tab.key
                      ? "text-white font-semibold"
                      : "text-white/40"
                  }`}
                >
                  {t(tab.labelKey)}
                </span>
                {current === tab.key && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
