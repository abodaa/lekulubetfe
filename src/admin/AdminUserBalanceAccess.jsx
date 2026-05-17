import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch,
  FaUser,
  FaWallet,
  FaCoins,
  FaSave,
  FaUndo,
  FaEdit,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaTimesCircle,
  FaUserCircle,
} from "react-icons/fa";
import { MdDeleteForever, MdMoneyOff } from "react-icons/md";

export default function AdminUserBalanceAccess() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [adjustment, setAdjustment] = useState({
    mainDelta: "",
    playDelta: "",
    reason: "",
  });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const selectedUser = useMemo(
    () => results.find((user) => user.id === selectedUserId) || null,
    [results, selectedUserId],
  );

  const throttledSearchRef = React.useRef(null);

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
    setAdjustment({
      mainDelta: "",
      playDelta: "",
      reason: "",
    });
    setFeedback(null);
  };

  const updateAdjustmentField = (field, value) => {
    setAdjustment((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getNumber = (value) => {
    if (value === "" || value === null || value === undefined) {
      return 0;
    }
    const num = Number(value);
    return Number.isNaN(num) ? NaN : num;
  };

  const handleAdjustmentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    const mainDelta = getNumber(adjustment.mainDelta);
    const playDelta = getNumber(adjustment.playDelta);

    if (Number.isNaN(mainDelta) || Number.isNaN(playDelta)) {
      setFeedback({ type: "error", message: "Amounts must be valid numbers." });
      return;
    }

    if (mainDelta === 0 && playDelta === 0) {
      setFeedback({
        type: "error",
        message: "Add or subtract at least one amount before saving.",
      });
      return;
    }

    setIsAdjusting(true);
    setFeedback(null);

    try {
      const response = await apiFetch(
        `/admin/users/${selectedUser.id}/wallet-adjust`,
        {
          method: "POST",
          body: {
            mainDelta,
            playDelta,
            reason: adjustment.reason || "",
          },
        },
      );

      const updatedWallet = response?.wallet;
      if (updatedWallet) {
        setResults((prev) =>
          prev.map((user) =>
            user.id === selectedUser.id
              ? { ...user, wallet: updatedWallet }
              : user,
          ),
        );
      }

      setAdjustment((prev) => ({
        ...prev,
        mainDelta: "",
        playDelta: "",
      }));

      setFeedback({ type: "success", message: "Wallet updated successfully." });
    } catch (error) {
      console.error("Admin wallet adjustment failed:", error);
      setFeedback({
        type: "error",
        message:
          error?.message === "api_error_400"
            ? "Update rejected. Check the entered values."
            : "Failed to update wallet. Please try again.",
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const hasPendingChanges = () => {
    const mainDelta = getNumber(adjustment.mainDelta);
    const playDelta = getNumber(adjustment.playDelta);
    return (
      (!Number.isNaN(mainDelta) && mainDelta !== 0) ||
      (!Number.isNaN(playDelta) && playDelta !== 0)
    );
  };

  const canReset =
    adjustment.mainDelta !== "" ||
    adjustment.playDelta !== "" ||
    (adjustment.reason || "").trim() !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                <FaSearch className="text-purple-400" size={12} />
              </div>
              <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Search Users
              </h3>
            </div>

            <div className="relative">
              <input
                id="admin-user-search-input"
                type="text"
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-all pr-10"
                placeholder="Search by name, username, or Telegram ID..."
                value={query}
                onChange={(event) => handleSearchInput(event.target.value)}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isSearching ? (
                  <FaSpinner className="text-white/40 animate-spin" size={14} />
                ) : (
                  <FaSearch className="text-white/30" size={14} />
                )}
              </div>
            </div>

            {searchError && (
              <div className="mt-2 text-red-400 text-[10px] flex items-center gap-1">
                <FaExclamationCircle size={10} />
                {searchError}
              </div>
            )}
          </div>
        </motion.div>

        {/* Selected User Editor */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4 mb-4"
            >
              {/* User Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <FaUserCircle className="text-white" size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold text-sm">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedUser.username && (
                      <span className="text-white/30 text-[9px]">
                        @{selectedUser.username}
                      </span>
                    )}
                    <span className="text-white/20 text-[9px]">
                      ID: {selectedUser.telegramId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallet Balances */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FaWallet className="text-blue-400" size={12} />
                    <span className="text-white/40 text-[9px] uppercase">
                      Main
                    </span>
                  </div>
                  <div className="text-white font-bold text-sm">
                    {Number(selectedUser.wallet?.main || 0).toLocaleString()}{" "}
                    ETB
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FaCoins className="text-emerald-400" size={12} />
                    <span className="text-white/40 text-[9px] uppercase">
                      Play
                    </span>
                  </div>
                  <div className="text-white font-bold text-sm">
                    {Number(selectedUser.wallet?.play || 0).toLocaleString()}{" "}
                    ETB
                  </div>
                </div>
              </div>

              {/* Adjustment Form */}
              <form onSubmit={handleAdjustmentSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/50 text-[10px] font-medium mb-1 block">
                      Main Adjustment
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustment.mainDelta}
                      onChange={(event) =>
                        updateAdjustmentField("mainDelta", event.target.value)
                      }
                      placeholder="+/- amount"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] font-medium mb-1 block">
                      Play Adjustment
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustment.playDelta}
                      onChange={(event) =>
                        updateAdjustmentField("playDelta", event.target.value)
                      }
                      placeholder="+/- amount"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Reason for adjustment (optional)"
                  value={adjustment.reason}
                  onChange={(event) =>
                    updateAdjustmentField("reason", event.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustment({
                        mainDelta: "",
                        playDelta: "",
                        reason: "",
                      });
                      setFeedback(null);
                    }}
                    disabled={isAdjusting || !canReset}
                    className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-white/60 text-xs font-medium flex items-center justify-center gap-1 hover:bg-white/20 transition-all disabled:opacity-50"
                  >
                    <FaUndo size={10} />
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjusting || !hasPendingChanges()}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-medium flex items-center justify-center gap-1 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isAdjusting ? (
                      <>
                        <FaSpinner className="animate-spin" size={10} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave size={10} />
                        Save
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

        {/* Search Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Search Results
            </h3>
          </div>

          {results.length === 0 && query.trim() !== "" && !isSearching ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                <FaUser className="text-white/20" size={20} />
              </div>
              <p className="text-white/30 text-xs">No results found</p>
              <p className="text-white/20 text-[10px] mt-1">
                Try a different name or username
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {results.map((user) => {
                const main = Number(user.wallet?.main || 0).toLocaleString();
                const play = Number(user.wallet?.play || 0).toLocaleString();
                const isSelected = selectedUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className={`p-3 transition-all ${
                      isSelected ? "bg-purple-500/20" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <FaUserCircle className="text-white/40" size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {user.firstName} {user.lastName}
                          </p>
                          {user.username && (
                            <p className="text-white/30 text-[10px] truncate">
                              @{user.username}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mr-3">
                        <div className="text-right">
                          <p className="text-white/40 text-[9px]">Main</p>
                          <p className="text-white text-xs font-semibold">
                            {main}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/40 text-[9px]">Play</p>
                          <p className="text-white text-xs font-semibold">
                            {play}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectUser(user.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/10 text-white/60 hover:bg-white/20"
                        }`}
                      >
                        {isSelected ? (
                          <span className="flex items-center gap-1">
                            <FaCheckCircle size={10} />
                            Editing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <FaEdit size={10} />
                            Edit
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
