import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider.jsx";
import { apiFetch } from "../lib/api/client.js";
import { motion } from "framer-motion";
import {
  FaWallet,
  FaCoins,
  FaHistory,
  FaUserCircle,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import { GiMoneyStack, GiPlayButton } from "react-icons/gi";
import { FiArrowDownLeft, FiArrowUpRight } from "react-icons/fi";

export default function Wallet({ onNavigate }) {
  const { sessionId, user, isLoading: authLoading } = useAuth();
  const [wallet, setWallet] = useState({
    main: 0,
    play: 0,
    coins: 0,
    playDeposited: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("balance");
  const [transactions, setTransactions] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [displayPhone, setDisplayPhone] = useState(null);
  const [displayRegistered, setDisplayRegistered] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Listen for wallet updates from WebSocket
  useEffect(() => {
    const handleWalletUpdate = (event) => {
      if (event.detail && event.detail.type === "wallet_update") {
        const { main, play, coins, source } = event.detail.payload;
        setWallet((prev) => ({
          ...prev,
          main: main ?? prev.main,
          play: play ?? prev.play,
          coins: coins ?? prev.coins,
        }));
        if (source === "win") {
          console.log("Success: Congratulations! You won the game!");
        }
      }
    };
    window.addEventListener("walletUpdate", handleWalletUpdate);
    return () => window.removeEventListener("walletUpdate", handleWalletUpdate);
  }, []);

  // Fetch wallet and profile data once
  useEffect(() => {
    if (authLoading || !sessionId) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        try {
          const walletData = await apiFetch("/wallet", { sessionId });
          const mainValue =
            walletData.main !== null && walletData.main !== undefined
              ? walletData.main
              : (walletData.balance ?? 0);
          const playValue =
            walletData.play !== null && walletData.play !== undefined
              ? walletData.play
              : 0;
          setWallet({
            main: mainValue,
            play: playValue,
            coins: walletData.coins || 0,
            playDeposited: walletData.playDeposited || 0,
          });
        } catch (walletError) {
          console.error("Wallet fetch error:", walletError);
          try {
            const profile = await apiFetch("/user/profile", { sessionId });
            setProfileData(profile);
            // Fix: Get phone from profile.user.phone
            const phoneNumber = profile?.user?.phone || null;
            setDisplayPhone(phoneNumber);
            // Fix: Check registration status correctly
            const isRegistered = profile?.user?.isRegistered === true;
            setDisplayRegistered(isRegistered);
            if (profile?.wallet) {
              const mainValue =
                profile.wallet.main !== null &&
                profile.wallet.main !== undefined
                  ? profile.wallet.main
                  : (profile.wallet.balance ?? 0);
              const playValue =
                profile.wallet.play !== null &&
                profile.wallet.play !== undefined
                  ? profile.wallet.play
                  : 0;
              setWallet({
                main: mainValue,
                play: playValue,
                coins: profile.wallet.coins || 0,
                playDeposited: profile.wallet.playDeposited || 0,
              });
            }
          } catch (e) {
            console.error("Profile fetch error:", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch wallet data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId, authLoading]);

  // Fetch transactions only when history tab is active
  useEffect(() => {
    if (!sessionId || activeTab !== "history") return;
    const fetchTransactions = async () => {
      try {
        setHistoryLoading(true);
        const transactionData = await apiFetch("/user/transactions", {
          sessionId,
        });
        setTransactions(transactionData.transactions?.transactions || []);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        setTransactions([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchTransactions();
  }, [sessionId, activeTab]);

  const getTransactionIcon = (type, amount) => {
    if (type === "deposit") return <FiArrowDownLeft size={14} />;
    if (type === "game_win") return <FiArrowDownLeft size={14} />;
    if (type === "game_bet") return <FiArrowUpRight size={14} />;
    return amount > 0 ? (
      <FiArrowDownLeft size={14} />
    ) : (
      <FiArrowUpRight size={14} />
    );
  };

  // Format phone number for display (mask middle digits)
  const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    const phoneStr = String(phone);
    if (phoneStr.length >= 10) {
      return phoneStr.slice(0, 4) + "****" + phoneStr.slice(-4);
    }
    return phoneStr;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <FaWallet className="text-yellow-400" size={14} />
            </div>
            <span className="text-white/70 text-xs font-medium">MY WALLET</span>
          </div>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <FaUserCircle className="text-white" size={16} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {profileData?.user?.firstName ||
                      user?.firstName ||
                      "Player"}
                  </p>
                  {displayPhone && (
                    <p className="text-white/40 text-[10px]">
                      {formatPhoneNumber(displayPhone)}
                    </p>
                  )}
                </div>
              </div>
              {displayRegistered ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20">
                  <FaCheckCircle className="text-green-400" size={12} />
                  <span className="text-green-400 text-xs">Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20">
                  <FaCheckCircle className="text-green-400" size={12} />
                  <span className="text-green-400 text-xs">Verified</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-4"
        >
          <div className="flex gap-1 bg-white/5 rounded-full p-0.5">
            <button
              onClick={() => setActiveTab("balance")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === "balance"
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <FaWallet size={12} />
              Balance
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === "history"
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <FaHistory size={12} />
              History
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : activeTab === "balance" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            {/* Main Wallet Card */}
            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <GiMoneyStack className="text-blue-400" size={16} />
                  </div>
                  <span className="text-white/60 text-xs uppercase tracking-wider">
                    Main Wallet
                  </span>
                </div>
                <span className="text-white/50 text-xs">Withdrawable</span>
              </div>
              <div className="text-white text-2xl font-bold">
                {wallet.main?.toLocaleString() || 0}{" "}
                <span className="text-white/40 text-sm">ETB</span>
              </div>
            </div>

            {/* Play Wallet Card */}
            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <GiPlayButton className="text-emerald-400" size={16} />
                  </div>
                  <span className="text-white/60 text-xs uppercase tracking-wider">
                    Play Wallet
                  </span>
                </div>
                <span className="text-white/50 text-xs">Gaming Funds</span>
              </div>
              <div className="text-white text-2xl font-bold">
                {wallet.play?.toLocaleString() || 0}{" "}
                <span className="text-white/40 text-sm">ETB</span>
              </div>
              {wallet.playDeposited > 0 && (
                <div className="mt-2 text-right">
                  <span className="text-white/50 text-xs">
                    Transferable: {wallet.playDeposited.toLocaleString()} ETB
                  </span>
                </div>
              )}
            </div>

            {/* Coins Card */}
            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <FaCoins className="text-yellow-400" size={16} />
                  </div>
                  <span className="text-white/60 text-xs uppercase tracking-wider">
                    Coins
                  </span>
                </div>
                <span className="text-white/50 text-xs">Earn from bets</span>
              </div>
              <div className="text-yellow-400 text-2xl font-bold">
                {wallet.coins?.toLocaleString() || 0}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/5">
                <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                  Recent Transactions
                </h3>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                    <FaHistory className="text-white/20" size={24} />
                  </div>
                  <p className="text-white/50 text-xs">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.slice(0, 20).map((transaction, idx) => {
                    const isPositive = transaction.amount > 0;
                    return (
                      <div key={transaction.id || idx} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                isPositive
                                  ? "bg-green-500/30 text-green-400"
                                  : "bg-red-500/30 text-red-400"
                              }`}
                            >
                              {getTransactionIcon(
                                transaction.type,
                                transaction.amount,
                              )}
                            </div>
                            <div>
                              <p className="text-white text-xs font-medium">
                                {transaction.description ||
                                  (transaction.type === "deposit"
                                    ? "Deposit"
                                    : transaction.type === "game_win"
                                      ? "Game Win"
                                      : transaction.type === "game_bet"
                                        ? "Game Bet"
                                        : "Transaction")}
                              </p>
                              <p className="text-white/40 text-[9px]">
                                {new Date(
                                  transaction.createdAt,
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-xs font-bold ${
                                isPositive ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {isPositive
                                ? `+${transaction.amount}`
                                : `${transaction.amount}`}
                            </p>
                            <p className="text-white/40 text-[9px] uppercase">
                              {transaction.status === "completed" || isPositive
                                ? "Success"
                                : transaction.status || "Pending"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav current="wallet" onNavigate={onNavigate} />
    </div>
  );
}
