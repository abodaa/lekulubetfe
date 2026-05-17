import React, { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaUserCircle,
  FaWallet,
  FaGamepad,
  FaCoins,
  FaTrophy,
  FaUsers,
  FaGift,
  FaLink,
  FaVolumeUp,
  FaVolumeMute,
  FaCheckCircle,
} from "react-icons/fa";
import { GiMoneyStack, GiPlayButton } from "react-icons/gi";

export default function Profile({ onNavigate }) {
  const [sound, setSound] = useState(true);
  const [profileData, setProfileData] = useState({
    user: {
      firstName: "User",
      lastName: "",
      phone: null,
      isRegistered: false,
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      registrationDate: new Date(),
    },
    wallet: { balance: 0, main: 0, play: 0, coins: 0, gamesWon: 0 },
  });
  const [inviteStats, setInviteStats] = useState({
    totalInvites: 0,
    totalRewards: 0,
    totalDepositsFromInvited: 0,
    inviteCode: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, sessionId, isLoading: authLoading } = useAuth();

  const displayName =
    profileData.user?.firstName || user?.firstName || "Player";
  const initials = displayName.charAt(0).toUpperCase();

  const fetchProfileData = React.useCallback(async () => {
    if (authLoading || !sessionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [profileRes, walletRes, inviteRes] = await Promise.all([
        apiFetch("/user/profile", { sessionId }).catch((err) => {
          if (err?.message === "api_error_404") {
            console.warn("Profile 404 - using auth user info only");
            return null;
          }
          throw err;
        }),
        apiFetch("/wallet", { sessionId }).catch((err) => {
          console.warn("Wallet fetch failed:", err);
          return { balance: 0, main: 0, play: 0, coins: 0, gamesWon: 0 };
        }),
        apiFetch("/user/invite-stats", { sessionId }).catch(() => null),
      ]);

      const userInfo = profileRes?.user || {
        firstName: user?.firstName || "User",
        lastName: user?.lastName || "",
        phone: user?.phone || null,
        isRegistered: user?.isRegistered || false,
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        registrationDate: new Date(),
      };

      const mainValue =
        walletRes.main !== null && walletRes.main !== undefined
          ? walletRes.main
          : (walletRes.balance ?? 0);
      const playValue =
        walletRes.play !== null && walletRes.play !== undefined
          ? walletRes.play
          : 0;

      setProfileData({
        user: userInfo,
        wallet: {
          balance: walletRes.balance ?? 0,
          main: mainValue,
          play: playValue,
          coins: walletRes.coins || 0,
          gamesWon: walletRes.gamesWon ?? 0,
        },
      });

      if (inviteRes) setInviteStats(inviteRes);
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
      setError(`Failed to load profile. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, authLoading, user]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const StatCard = ({ icon, label, value, sublabel, color = "white" }) => (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div
        className={`text-white font-bold text-lg ${color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-white/50 text-xs uppercase tracking-wider">
        {label}
      </div>
      {sublabel && (
        <div className="text-white/50 text-[10px] mt-1">{sublabel}</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <FaUserCircle className="text-yellow-400" size={14} />
            </div>
            <span className="text-white/70 text-xs font-medium">
              MY PROFILE
            </span>
          </div>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <div className="relative inline-block mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/20 shadow-xl">
              <span className="text-white text-3xl font-bold">{initials}</span>
            </div>
            {profileData.user?.isRegistered && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-white/20">
                <FaCheckCircle size={12} className="text-white" />
              </div>
            )}
          </div>
          <h1 className="text-white text-xl font-bold">{displayName}</h1>
          {profileData.user?.isRegistered && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[9px] font-medium">
              Verified User
            </span>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <p className="text-white/50 text-xs mb-3">{error}</p>
            <button
              onClick={fetchProfileData}
              className="px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              <StatCard
                icon={<GiMoneyStack size={16} className="text-blue-400" />}
                label="Main Wallet"
                value={`${profileData.wallet.main?.toLocaleString() || 0} ETB`}
                sublabel="Withdrawable"
              />
              <StatCard
                icon={<GiPlayButton size={16} className="text-emerald-400" />}
                label="Play Wallet"
                value={`${profileData.wallet.play?.toLocaleString() || 0} ETB`}
                sublabel="Game funds"
                color="green"
              />
              <StatCard
                icon={<FaCoins size={16} className="text-yellow-400" />}
                label="Coins"
                value={profileData.wallet.coins?.toLocaleString() || 0}
                sublabel="Earned from bets"
                color="yellow"
              />
              <StatCard
                icon={<FaTrophy size={16} className="text-yellow-400" />}
                label="Games Won"
                value={profileData.wallet.gamesWon?.toLocaleString() || 0}
                color="yellow"
              />
            </motion.div>

            {/* Invite Stats Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4 mb-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <FaUsers size={12} className="text-purple-400" />
                </div>
                <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
                  Referral Program
                </h3>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-white/50 text-xs">Total Invites</p>
                  <p className="text-white text-xl font-bold">
                    {inviteStats.totalInvites || 0}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-xs">Rewards Earned</p>
                  <p className="text-green-400 text-xl font-bold">
                    {inviteStats.totalRewards?.toLocaleString() || 0} ETB
                  </p>
                </div>
              </div>
              {inviteStats.inviteCode && (
                <div className="bg-white/5 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FaLink size={12} className="text-white/30" />
                    <span className="text-white/60 text-[10px] font-mono">
                      {inviteStats.inviteCode}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteStats.inviteCode);
                    }}
                    className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] hover:bg-white/20 transition-all"
                  >
                    Copy
                  </button>
                </div>
              )}
            </motion.div>

            {/* Settings Section */}
            {/* <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-white/5">
                <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                  Settings
                </h3>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    {sound ? (
                      <FaVolumeUp size={14} className="text-white/60" />
                    ) : (
                      <FaVolumeMute size={14} className="text-white/60" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      Sound Effects
                    </p>
                    <p className="text-white/30 text-[9px]">
                      Enable/disable game sounds
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSound(!sound)}
                  className={`relative w-10 h-5 rounded-full transition-all ${
                    sound ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      sound ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </motion.div> */}
          </>
        )}
      </main>

      <BottomNav current="profile" onNavigate={onNavigate} />
    </div>
  );
}
