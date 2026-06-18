import React, { useState, useMemo } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaGift,
  FaSearch,
  FaUserCircle,
  FaWallet,
  FaCoins,
  FaSave,
  FaUndo,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaPlusCircle,
  FaMinusCircle,
  FaHistory,
} from "react-icons/fa";
import { GiMoneyStack } from "react-icons/gi";

export default function AdminBonus() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [mode, setMode] = useState("add"); // "add" | "deduct"
  const [feedback, setFeedback] = useState(null);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const throttledSearchRef = React.useRef(null);

  const selectedUser = useMemo(
    () => results.find((user) => user.id === selectedUserId) || null,
    [results, selectedUserId],
  );

  const performSearch = React.useCallback(async (term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedUserId(null);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setFeedback(null);

    try {
      const response = await apiFetch(
        `/admin/users/search?query=${encodeURIComponent(trimmed)}`,
      );
      const users = response?.users || [];
      setResults(users);
    } catch (error) {
      console.error("Admin user search failed:", error);
      setSearchError("Search failed. Please try again.");
      setResults([]);
      setSelectedUserId(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (value) => {
    setQuery(value);
    if (throttledSearchRef.current) {
      clearTimeout(throttledSearchRef.current);
    }
    throttledSearchRef.current = setTimeout(() => performSearch(value), 250);
  };

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    setBonusAmount("");
    setBonusReason("");
    setFeedback(null);
    setShowHistory(false);
  };

  const isDeduct = mode === "deduct";

  const handleAddBonus = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const amount = Number(bonusAmount);
    if (isNaN(amount) || amount <= 0) {
      setFeedback({
        type: "error",
        message: "Please enter a valid amount greater than 0.",
      });
      return;
    }

    if (amount > 10000) {
      setFeedback({
        type: "error",
        message: "Maximum amount is 10,000 ETB per transaction.",
      });
      return;
    }

    if (isDeduct) {
      const currentBonus = Number(selectedUser.wallet?.bonus || 0);
      if (amount > currentBonus) {
        setFeedback({
          type: "error",
          message: `Cannot deduct more than the current Bonus balance (${currentBonus.toLocaleString()} ETB).`,
        });
        return;
      }
    }

    setIsAdding(true);
    setFeedback(null);

    const endpoint = isDeduct ? "bonus-deduct" : "bonus-add";

    try {
      const response = await apiFetch(
        `/admin/users/${selectedUser.id}/${endpoint}`,
        {
          method: "POST",
          body: {
            amount: amount,
            reason:
              bonusReason.trim() ||
              (isDeduct ? "Admin adjustment" : "Admin credit"),
          },
        },
      );

      if (response.success) {
        // For a deduct the backend clamps at 0 and returns the real amount.
        const applied = isDeduct
          ? response.deducted != null
            ? response.deducted
            : amount
          : amount;

        // Update user's wallet in the results list
        setResults((prev) =>
          prev.map((user) =>
            user.id === selectedUser.id
              ? {
                  ...user,
                  wallet: {
                    ...user.wallet,
                    bonus: isDeduct
                      ? Math.max(0, (user.wallet?.bonus || 0) - applied)
                      : (user.wallet?.bonus || 0) + applied,
                  },
                }
              : user,
          ),
        );

        setBonusAmount("");
        setBonusReason("");
        setFeedback({
          type: "success",
          message: isDeduct
            ? `Successfully deducted ETB ${applied.toLocaleString()} from bonus wallet.`
            : `Successfully added ETB ${applied.toLocaleString()} to bonus wallet.`,
        });

        // Refresh bonus history
        fetchBonusHistory(selectedUser.id);
      }
    } catch (error) {
      console.error("Admin bonus update failed:", error);
      setFeedback({
        type: "error",
        message:
          error?.message === "api_error_400"
            ? isDeduct
              ? "Cannot deduct more than the current Bonus balance."
              : "Invalid request. Check the amount."
            : `Failed to ${isDeduct ? "deduct" : "add"} bonus. Please try again.`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const fetchBonusHistory = async (userId) => {
    try {
      const response = await apiFetch(
        `/admin/users/${userId}/bonus-history`,
      ).catch(() => []);
      setBonusHistory(response?.transactions || []);
      setShowHistory(true);
    } catch (error) {
      console.error("Failed to fetch bonus history:", error);
    }
  };

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]">
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaGift className="text-amber-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              Bonus Wallet Management
            </h3>
          </div>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <FaSearch className="text-white/30" size={12} />
            <span className="text-white/60 text-xs">Search User</span>
          </div>

          <input
            type="text"
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all"
            placeholder="Search by name, username, or Telegram ID..."
            value={query}
            onChange={(event) => handleSearchInput(event.target.value)}
          />

          {isSearching && (
            <div className="mt-2 flex justify-center">
              <FaSpinner className="text-white/40 animate-spin" size={14} />
            </div>
          )}

          {searchError && (
            <div className="mt-2 text-red-400 text-[10px] flex items-center gap-1">
              <FaExclamationCircle size={10} />
              {searchError}
            </div>
          )}
        </motion.div>

        {/* Search Results */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden mb-4"
          >
            <div className="px-3 py-2 border-b border-white/10">
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Search Results
              </span>
            </div>
            <div className="divide-y divide-white/10 max-h-60 overflow-y-auto">
              {results.map((user) => {
                const isSelected = selectedUserId === user.id;
                const bonus = Number(user.wallet?.bonus || 0).toLocaleString();

                return (
                  <div
                    key={user.id}
                    className={`p-3 cursor-pointer transition-all ${isSelected ? "bg-amber-500/20" : "hover:bg-white/5"}`}
                    onClick={() => handleSelectUser(user.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                          <FaUserCircle className="text-white/40" size={16} />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-white text-[10px]">
                            @{user.username || "no username"}
                          </p>
                          {user.phone && (
                            <p className="text-white text-[11px]">
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-[9px]">Bonus</p>
                        <p className="text-amber-400 text-sm font-bold">
                          {bonus} ETB
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2 text-green-400 text-[9px] flex items-center gap-1">
                        <FaCheckCircle size={8} />
                        Selected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Add Bonus Form */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
            >
              {/* User Info */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center">
                  <FaUserCircle className="text-white" size={20} />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h4>
                  <p className="text-white text-[10px]">
                    @{selectedUser.username || "no username"} · ID:{" "}
                    {selectedUser.telegramId}
                  </p>
                  {selectedUser.phone && (
                    <p className="text-white text-[11px]">
                      {selectedUser.phone}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => fetchBonusHistory(selectedUser.id)}
                  className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white/50 text-[9px] hover:bg-white/20 transition-all"
                >
                  <FaHistory size={10} />
                  History
                </button>
              </div>

              {/* Current Wallet */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <GiMoneyStack className="text-blue-400" size={12} />
                    <span className="text-white/40 text-[9px]">Main</span>
                  </div>
                  <div className="text-white font-bold text-sm">
                    {Number(selectedUser.wallet?.main || 0).toLocaleString()}{" "}
                    ETB
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FaGift className="text-amber-400" size={12} />
                    <span className="text-white/40 text-[9px]">
                      Bonus Wallet
                    </span>
                  </div>
                  <div className="text-amber-400 font-bold text-lg">
                    {Number(selectedUser.wallet?.bonus || 0).toLocaleString()}{" "}
                    ETB
                  </div>
                  <div className="text-white/20 text-[8px] mt-1">
                    Non-withdrawable | Used when Main is empty
                  </div>
                </div>
              </div>

              {/* Add Bonus Form */}
              <form onSubmit={handleAddBonus} className="space-y-3">
                {/* Add / Deduct toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("add");
                      setFeedback(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      !isDeduct
                        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                        : "bg-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    <FaPlusCircle size={11} />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("deduct");
                      setFeedback(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      isDeduct
                        ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg"
                        : "bg-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    <FaMinusCircle size={11} />
                    Deduct
                  </button>
                </div>

                <div>
                  <label className="text-white/50 text-[10px] font-medium mb-1 block">
                    {isDeduct ? "Deduct Amount (ETB)" : "Bonus Amount (ETB)"}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="10000"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all"
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex flex-wrap gap-1">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBonusAmount(amt.toString())}
                      className="px-2 py-1 rounded-full bg-white/10 text-white/50 text-[9px] hover:bg-white/20 transition-all"
                    >
                      {isDeduct ? "-" : "+"}
                      {amt}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-white/50 text-[10px] font-medium mb-1 block">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={bonusReason}
                    onChange={(e) => setBonusReason(e.target.value)}
                    placeholder="e.g., Promotion, Daily Reward, Compensation"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBonusAmount("");
                      setBonusReason("");
                      setFeedback(null);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-white/60 text-xs font-medium flex items-center justify-center gap-1 hover:bg-white/20 transition-all"
                  >
                    <FaUndo size={10} />
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding || !bonusAmount}
                    className={`flex-1 py-2 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 ${
                      isDeduct
                        ? "bg-gradient-to-r from-red-500 to-rose-600"
                        : "bg-gradient-to-r from-amber-500 to-amber-600"
                    }`}
                  >
                    {isAdding ? (
                      <>
                        <FaSpinner className="animate-spin" size={10} />
                        {isDeduct ? "Deducting..." : "Adding..."}
                      </>
                    ) : (
                      <>
                        {isDeduct ? (
                          <FaMinusCircle size={10} />
                        ) : (
                          <FaPlusCircle size={10} />
                        )}
                        {isDeduct ? "Deduct Bonus" : "Add Bonus"}
                      </>
                    )}
                  </button>
                </div>

                {feedback && (
                  <div
                    className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                      feedback.type === "error"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {feedback.type === "error" ? (
                      <FaExclamationCircle size={12} />
                    ) : (
                      <FaCheckCircle size={12} />
                    )}
                    {feedback.message}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bonus History Modal */}
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] rounded-2xl border border-white/10 w-full max-w-sm max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaGift className="text-amber-400" size={14} />
                  <h3 className="text-white font-semibold text-sm">
                    Bonus History
                  </h3>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-white/40 hover:text-white/70"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto max-h-[60vh] p-3">
                {bonusHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <FaHistory
                      className="text-white/20 mx-auto mb-2"
                      size={24}
                    />
                    <p className="text-white/30 text-xs">
                      No bonus transactions found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bonusHistory.map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="bg-white/5 rounded-xl p-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white text-xs font-medium">
                              +{tx.amount} ETB
                            </p>
                            <p className="text-white/30 text-[9px]">
                              {formatDate(tx.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white/40 text-[8px] uppercase">
                              Bonus Balance
                            </p>
                            <p className="text-amber-400 text-xs font-bold">
                              {tx.balanceAfter?.bonus || 0} ETB
                            </p>
                          </div>
                        </div>
                        {tx.description && (
                          <p className="text-white/30 text-[8px] mt-1 truncate">
                            {tx.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
