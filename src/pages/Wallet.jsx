import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider.jsx";
import { apiFetch } from "../lib/api/client.js";

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
            setDisplayPhone(profile?.user?.phone || null);
            setDisplayRegistered(!!profile?.user?.isRegistered);
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

  return (
    <div className="wallet-page">
      <header className="wallet-header">
        <div className="wallet-header-content">
          <h1 className="wallet-title">Wallet</h1>
        </div>
      </header>

      <main className="wallet-main">
        <div className="wallet-panel">
          <div className="wallet-user-info">
            <div className="wallet-user-details">
              <div className="wallet-user-icon">👤</div>
              <div className="wallet-user-text">
                <span className="wallet-user-name">
                  {profileData?.user?.firstName || user?.firstName || "Player"}
                </span>
                {displayPhone && (
                  <span className="wallet-user-phone">{displayPhone}</span>
                )}
              </div>
            </div>
            {displayRegistered ? (
              <div className="wallet-status-verified">
                <span className="wallet-status-icon">✓</span>
                <span className="wallet-status-text">Verified</span>
              </div>
            ) : (
              <div className="wallet-status-unverified">
                <span className="wallet-status-icon">!</span>
                <span className="wallet-status-text">Not registered</span>
              </div>
            )}
          </div>

          <div className="wallet-segmented">
            <button
              onClick={() => setActiveTab("balance")}
              className={`wallet-seg ${activeTab === "balance" ? "active" : ""}`}
            >
              Balance
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`wallet-seg ${activeTab === "history" ? "active" : ""}`}
            >
              History
            </button>
          </div>
        </div>

        {loading ? (
          <div className="wallet-loading">
            <div className="wallet-spinner"></div>
          </div>
        ) : activeTab === "balance" ? (
          <div className="wallet-balances">
            {/* Main Wallet */}
            <div className="wallet-card">
              <div className="wallet-card-content">
                <div className="wallet-card-label">
                  <span className="wallet-label-text">Main Wallet</span>
                  <span className="wallet-label-icon">💰</span>
                </div>
                <span className="wallet-value">
                  {wallet.main?.toLocaleString() || 0}
                </span>
              </div>
              <div className="wallet-card-description">
                Withdrawable balance
              </div>
            </div>

            {/* Play Wallet */}
            <div className="wallet-card">
              <div className="wallet-card-content">
                <div className="wallet-card-label">
                  <span className="wallet-label-text">Play Wallet</span>
                  <span className="wallet-label-icon">🎮</span>
                </div>
                <span className="wallet-value wallet-value-green">
                  {wallet.play?.toLocaleString() || 0}
                </span>
              </div>
              <div className="wallet-card-description">
                Gaming funds and deposits
              </div>
            </div>

            {/* Coins */}
            <div className="wallet-card">
              <div className="wallet-card-content">
                <div className="wallet-card-label">
                  <span className="wallet-label-text">Coins</span>
                  <span className="wallet-label-icon">🪙</span>
                </div>
                <span className="wallet-value wallet-value-purple">
                  {wallet.coins?.toLocaleString() || 0}
                </span>
              </div>
              <div className="wallet-card-description">
                Earn 10% of every bet. Convert to Play balance.
              </div>
            </div>

            {/* Play Deposited (transferable) */}
            {wallet.playDeposited > 0 && (
              <div className="wallet-card">
                <div className="wallet-card-content">
                  <div className="wallet-card-label">
                    <span className="wallet-label-text">Play Deposited</span>
                    <span className="wallet-label-icon">💳</span>
                  </div>
                  <span className="wallet-value wallet-value-blue">
                    {wallet.playDeposited?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="wallet-card-description">
                  Transferable portion of Play wallet
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-history">
            <h3 className="wallet-history-title">Recent Transactions</h3>
            {historyLoading ? (
              <div className="wallet-loading">
                <div className="wallet-spinner"></div>
                <div className="wallet-loading-text">
                  Loading transactions...
                </div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="wallet-empty-state">
                <div className="wallet-empty-icon">📝</div>
                <div className="wallet-empty-text">No transactions yet</div>
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="wallet-transaction">
                  <div className="wallet-transaction-content">
                    <div className="wallet-transaction-info">
                      <div className="wallet-transaction-icon">📄</div>
                      <div className="wallet-transaction-details">
                        <div className="wallet-transaction-description">
                          {transaction.description ||
                            (transaction.type === "deposit"
                              ? "Deposit"
                              : "Transaction")}
                        </div>
                        <div className="wallet-transaction-date">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="wallet-transaction-amount">
                      <div
                        className={`wallet-transaction-value ${transaction.amount > 0 ? "positive" : "negative"}`}
                      >
                        {transaction.amount > 0
                          ? `+${transaction.amount}`
                          : `${transaction.amount}`}
                      </div>
                      <div
                        className={`wallet-transaction-status ${transaction.status === "Approved" || transaction.amount > 0 ? "approved" : "pending"}`}
                      >
                        {transaction.status ||
                          (transaction.amount > 0 ? "Approved" : "")}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      <BottomNav current="wallet" onNavigate={onNavigate} />
    </div>
  );
}
