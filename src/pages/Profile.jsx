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
  FaPercentage,
  FaMoneyBillWave,
} from "react-icons/fa";
import { GiMoneyStack, GiPlayButton } from "react-icons/gi";

export default function Profile({ onNavigate }) {
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
    wallet: { balance: 0, main: 0, play: 0, coins: 0, gamesWon: 0, bonus: 0 }, // ADDED bonus
  });
  const [inviteStats, setInviteStats] = useState({
    totalInvites: 0,
    totalRewards: 0,
    totalDepositsFromInvited: 0,
    estimatedDepositRewards: 0,
    rewardRate: "Loading...",
    rewardWallet: "Loading...",
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

      // Fetch profile, wallet, and invite stats
      const profilePromise = apiFetch("/user/profile", { sessionId }).catch(
        (err) => {
          console.warn("Profile fetch error:", err);
          return null;
        },
      );

      const walletPromise = apiFetch("/wallet", { sessionId }).catch((err) => {
        console.warn("Wallet fetch error:", err);
        return {
          balance: 0,
          main: 0,
          coins: 0,
          gamesWon: 0,
          bonus: 0,
        };
      });

      const invitePromise = apiFetch("/user/invite-stats", { sessionId }).catch(
        (err) => {
          console.warn("Invite stats fetch error:", err);
          return null;
        },
      );

      const [profileRes, walletRes, inviteRes] = await Promise.all([
        profilePromise,
        walletPromise,
        invitePromise,
      ]);

      console.log("Invite stats response:", inviteRes);
      console.log("Wallet response:", walletRes);

      const userInfo = profileRes?.user || {
        firstName: user?.firstName || "User",
        lastName: user?.lastName || "",
        phone: user?.phone || null,
        isRegistered: user?.isRegistered || false,
        totalGamesPlayed: user?.totalGamesPlayed || 0,
        totalGamesWon: user?.totalGamesWon || 0,
        registrationDate: new Date(),
      };

      // Safely get wallet values with fallbacks
      const mainValue = walletRes.main ?? walletRes.balance ?? 0;
      const coinsValue = walletRes.coins ?? 0;
      const gamesWonValue = profileRes?.user.totalGamesWon ?? 0;
      const bonusValue = walletRes.bonus ?? 0;

      setProfileData({
        user: userInfo,
        wallet: {
          balance: walletRes.balance ?? 0,
          main: mainValue,
          coins: coinsValue,
          gamesWon: gamesWonValue,
          bonus: bonusValue,
        },
      });

      if (inviteRes) {
        console.log("📊 Invite stats received:", inviteRes);
        console.log(
          "💰 totalDepositsFromInvited:",
          inviteRes.totalDepositsFromInvited,
        );
        setInviteStats({
          totalInvites: inviteRes.totalInvites || 0,
          totalRewards: inviteRes.totalRewards || 0,
          totalDepositsFromInvited: inviteRes.totalDepositsFromInvited || 0,
          estimatedDepositRewards: inviteRes.estimatedDepositRewards || 0,
          rewardRate: inviteRes.rewardRate || "1 ETB per registration",
          rewardWallet: inviteRes.rewardWallet || "Main Wallet (Withdrawable)",
          inviteCode: inviteRes.inviteCode || null,
        });
      } else {
        // Fallback: try to generate invite code by calling generate endpoint
        try {
          const generateRes = await apiFetch("/user/generate-invite-code", {
            sessionId,
            method: "POST",
          }).catch(() => null);
          if (generateRes && generateRes.inviteCode) {
            setInviteStats((prev) => ({
              ...prev,
              inviteCode: generateRes.inviteCode,
            }));
          }
        } catch (genError) {
          console.warn("Failed to generate invite code:", genError);
        }
      }
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
        className={`text-white font-bold text-lg ${color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : color === "purple" ? "text-purple-400" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-white/50 text-[10px] uppercase tracking-wider">
        {label}
      </div>
      {sublabel && (
        <div className="text-white/30 text-[9px] mt-1">{sublabel}</div>
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
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium">
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
            {/* Stats Grid - 3 columns for better layout */}
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
                icon={<FaGift size={16} className="text-purple-400" />}
                label="Bonus Wallet"
                value={`${profileData.wallet.bonus?.toLocaleString() || 0} ETB`}
                sublabel="Promotional funds"
                // color="purple"
              />
              <StatCard
                icon={<FaCoins size={16} className="text-yellow-400" />}
                label="Coins"
                value={profileData.wallet.coins?.toLocaleString() || 0}
                sublabel="Earned from bets"
                // color="yellow"
              />
              <StatCard
                icon={<FaGamepad size={16} className="text-emerald-400" />}
                label="Games Played"
                value={profileData.user.totalGamesPlayed.toLocaleString() || 0}
                sublabel="Games you've played"
                // color="green"
              />
              <StatCard
                icon={<FaTrophy size={16} className="text-yellow-400" />}
                label="Games Won"
                value={profileData.user.totalGamesWon.toLocaleString() || 0}
                sublabel="Games you've won"
                // color="yellow"
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

              {/* Stats Row */}
              <div className="flex justify-between items-center mb-3">
                <div className="text-center flex-1">
                  <p className="text-white/40 text-[9px] uppercase">Invites</p>
                  <p className="text-white text-lg font-bold">
                    {inviteStats.totalInvites || 0}
                  </p>
                </div>
                <div className="text-center flex-1 border-x border-white/10">
                  <p className="text-white/40 text-[9px] uppercase">Invitee Registration Rewards</p>
                  <p className="text-green-400 text-lg font-bold">
                    {inviteStats.totalRewards?.toLocaleString() || 0} ETB
                  </p>
                </div>
                {/* <div className="text-center flex-1">
                  <p className="text-white/40 text-[9px] uppercase">
                    Invite Deposits
                  </p>
                  <p className="text-amber-400 text-lg font-bold">
                    {inviteStats.totalDepositsFromInvited?.toLocaleString() ||
                      0}{" "}
                    ETB
                  </p>
                </div> */}
              </div>

              {/* Reward Rate Info */}
              <div className="bg-white/5 rounded-lg p-2 mb-3">
                <div className="flex items-center justify-between">
                  {/* <div className="flex items-center gap-2">
                    <FaPercentage size={10} className="text-yellow-400" />
                    <span className="text-white/50 text-[9px]">
                      Reward Rate
                    </span>
                  </div> */}
                  <span className="text-yellow-400 text-xs font-medium">
                    {inviteStats.rewardRate || "1 ETB per registration"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <FaMoneyBillWave size={10} className="text-emerald-400" />
                    <span className="text-white/50 text-xs">Credited to</span>
                  </div>
                  <span className="text-emerald-400 text-xs font-medium">
                    {inviteStats.rewardWallet || "Main Wallet (Withdrawable)"}
                  </span>
                </div>
              </div>

              {/* Estimated Rewards */}
              {/* {inviteStats.estimatedDepositRewards > 0 && (
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs">
                      Est. Deposit Rewards
                    </span>
                    <span className="text-green-400 text-xs font-bold">
                      +{inviteStats.estimatedDepositRewards.toFixed(2)} ETB
                    </span>
                  </div>
                </div>
              )} */}

              {/* Invite Code
              {inviteStats.inviteCode ? (
                <div className="bg-white/5 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FaLink size={12} className="text-white/30" />
                    <span className="text-white/60 text-xs font-mono">
                      {inviteStats.inviteCode}
                    </span>
                  </div>
                  <button
                    onClick={copyInviteLink}
                    className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs hover:bg-white/20 transition-all"
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <button
                    onClick={async () => {
                      try {
                        const res = await apiFetch(
                          "/user/generate-invite-code",
                          {
                            sessionId,
                            method: "POST",
                          },
                        );
                        if (res && res.inviteCode) {
                          setInviteStats((prev) => ({
                            ...prev,
                            inviteCode: res.inviteCode,
                          }));
                        }
                      } catch (err) {
                        console.error("Failed to generate invite code:", err);
                      }
                    }}
                    className="text-yellow-400 text-xs hover:text-yellow-300"
                  >
                    Generate Invite Code →
                  </button>
                </div>
              )} */}
            </motion.div>
          </>
        )}
      </main>

      <BottomNav current="profile" onNavigate={onNavigate} />
    </div>
  );
}
