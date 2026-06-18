import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch,
  FaUser,
  FaWallet,
  FaSave,
  FaUndo,
  FaEdit,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaTimesCircle,
  FaUserCircle,
  FaPlusCircle,
  FaMinusCircle,
} from "react-icons/fa";
import { MdDeleteForever, MdMoneyOff } from "react-icons/md";

export default function AdminUserBalanceAccess() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [mode, setMode] = useState("add"); // "add" | "deduct"
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isDeduct = mode === "deduct";
  const quickAmounts = [10, 20, 50, 100, 200, 500];

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
    setAmount("");
    setReason("");
    setFeedback(null);
  };

  const handleAdjustmentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setFeedback({
        type: "error",
        message: "Enter a valid amount greater than 0.",
      });
      return;
    }

    const currentMain = Number(selectedUser.wallet?.main || 0);
    if (isDeduct && value > currentMain) {
      setFeedback({
        type: "error",
        message: `Cannot deduct more than the current Main balance (${currentMain.toLocaleString()} ETB).`,
      });
      return;
    }

    const mainDelta = isDeduct ? -value : value;

    setIsAdjusting(true);
    setFeedback(null);

    try {
      const response = await apiFetch(
        `/admin/users/${selectedUser.id}/wallet-adjust`,
        {
          method: "POST",
          body: {
            mainDelta,
            playDelta: 0,
            reason: reason || "",
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

      setAmount("");
      setFeedback({
        type: "success",
        message: isDeduct
          ? `Deducted ${value.toLocaleString()} ETB from Main wallet.`
          : `Added ${value.toLocaleString()} ETB to Main wallet.`,
      });
    } catch (error) {
      console.error("Admin wallet adjustment failed:", error);
      setFeedback({
        type: "error",
        message:
          error?.message === "api_error_400"
            ? "Update rejected. Check the entered values."
            : `Failed to ${isDeduct ? "deduct" : "add"}. Please try again.`,
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const canReset = amount !== "" || reason.trim() !== "";

  return (
    <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]">
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <FaSearch className="text-amber-400" size={12} />
              </div>
              <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Search Users
              </h3>
            </div>

            <div className="relative">
              <input
                id="admin-user-search-input"
                type="text"
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all pr-10"
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
              className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
            >
              {/* User Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
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
                    <span className="text-white text-[10px]">
                      ID: {selectedUser.telegramId}
                    </span>
                  </div>
                  {selectedUser.phone && (
                    <div className="text-white text-[11px] mt-0.5">
                      {selectedUser.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet Balance */}
              <div className="mb-4">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FaWallet className="text-blue-400" size={12} />
                    <span className="text-white/40 text-[9px] uppercase">
                      Main
                    </span>
                  </div>
                  <div className="text-white font-bold text-lg">
                    {Number(selectedUser.wallet?.main || 0).toLocaleString()}{" "}
                    ETB
                  </div>
                </div>
              </div>

              {/* Adjustment Form — Add / Deduct on Main wallet */}
              <form onSubmit={handleAdjustmentSubmit} className="space-y-3">
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
                    {isDeduct ? "Deduct from Main (ETB)" : "Add to Main (ETB)"}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex flex-wrap gap-1">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt.toString())}
                      className="px-2 py-1 rounded-full bg-white/10 text-white/50 text-[9px] hover:bg-white/20 transition-all"
                    >
                      {isDeduct ? "-" : "+"}
                      {amt}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAmount("");
                      setReason("");
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
                    disabled={isAdjusting || !amount}
                    className={`flex-1 py-2 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 ${
                      isDeduct
                        ? "bg-gradient-to-r from-red-500 to-rose-600"
                        : "bg-gradient-to-r from-emerald-500 to-green-600"
                    }`}
                  >
                    {isAdjusting ? (
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
                        {isDeduct ? "Deduct" : "Add"}
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
          className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden"
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
                const isSelected = selectedUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className={`p-3 transition-all ${
                      isSelected ? "bg-amber-500/20" : "hover:bg-white/5"
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
                          {user.phone && (
                            <p className="text-white/30 text-[10px] truncate">
                              📱 {user.phone}
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
