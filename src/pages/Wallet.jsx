import React, { useEffect, useState } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../lib/auth/AuthProvider.jsx';
import { apiFetch } from '../lib/api/client.js';

export default function Wallet({ onNavigate }) {
    const { sessionId, user, isLoading: authLoading } = useAuth();
    const [wallet, setWallet] = useState({ main: 0, play: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('balance');
    const [transactions, setTransactions] = useState([]);
    const [profileData, setProfileData] = useState(null);
    const [displayPhone, setDisplayPhone] = useState(null);
    const [displayRegistered, setDisplayRegistered] = useState(false);

    // Transfer functionality removed - main and play wallets serve different purposes

    // History loading state
    const [historyLoading, setHistoryLoading] = useState(false);

    // Listen for wallet updates from WebSocket
    useEffect(() => {
        const handleWalletUpdate = (event) => {
            if (event.detail && event.detail.type === 'wallet_update') {
                const { main, play, source } = event.detail.payload;
                setWallet(prev => ({
                    ...prev,
                    main: main || prev.main,
                    play: play || prev.play
                }));

                // Show notification based on source
                if (source === 'win') {
                    showSuccess('Congratulations! You won the game!');
                } else if (source === 'main' || source === 'play') {
                    showSuccess(`Stake deducted from ${source} wallet`);
                }
            }
        };

        window.addEventListener('walletUpdate', handleWalletUpdate);
        return () => window.removeEventListener('walletUpdate', handleWalletUpdate);
    }, []);

    // Helper function to show success messages
    const showSuccess = (message) => {
        // You can implement a toast notification here
        console.log('Success:', message);
    };

    // Fetch wallet and profile data once
    useEffect(() => {
        if (authLoading || !sessionId) {
            setLoading(false);
            return;
        }
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch wallet data directly from /wallet endpoint (authoritative source)
                try {
                    const walletData = await apiFetch('/wallet', { sessionId });
                    
                    // Debug logging to verify wallet data
                    console.log('Wallet page wallet fetch:', {
                        main: walletData.main,
                        play: walletData.play,
                        balance: walletData.balance,
                        fullResponse: walletData
                    });

                    // Use actual wallet values - prioritize main/play fields, fall back to balance only if null/undefined
                    const mainValue = (walletData.main !== null && walletData.main !== undefined) 
                        ? walletData.main 
                        : (walletData.balance ?? 0);
                    const playValue = (walletData.play !== null && walletData.play !== undefined) 
                        ? walletData.play 
                        : 0;

                    setWallet({
                        main: mainValue,
                        play: playValue
                    });
                } catch (walletError) {
                    console.error('Wallet fetch error:', walletError);
                    // Fallback: try profile endpoint
                    try {
                        const profile = await apiFetch('/user/profile', { sessionId });
                        setProfileData(profile);
                        setDisplayPhone(profile?.user?.phone || null);
                        setDisplayRegistered(!!profile?.user?.isRegistered);

                        // Extract wallet data from profile response
                            if (profile?.wallet) {
                                const mainValue = (profile.wallet.main !== null && profile.wallet.main !== undefined) 
                                    ? profile.wallet.main 
                                    : (profile.wallet.balance ?? 0);
                                const playValue = (profile.wallet.play !== null && profile.wallet.play !== undefined) 
                                    ? profile.wallet.play 
                                    : 0;
                                setWallet({
                                    main: mainValue,
                                    play: playValue
                                });
                            }
                    } catch (e) {
                        console.error('Profile fetch error:', e);
                    }
                }
            } catch (error) {
                        console.error('Failed to fetch wallet data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sessionId, authLoading]); // Removed activeTab dependency

    // Fetch transactions only when history tab is active
    useEffect(() => {
        if (!sessionId || activeTab !== 'history') return;

        const fetchTransactions = async () => {
            try {
                setHistoryLoading(true);
                const transactionData = await apiFetch('/user/transactions', { sessionId });
                // Backend returns { transactions: { transactions: [...], total: 50 } }
                setTransactions(transactionData.transactions?.transactions || []);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
                setTransactions([]); // Ensure we have an empty array on error
            } finally {
                setHistoryLoading(false);
            }
        };
        fetchTransactions();
    }, [sessionId, activeTab]);

    // Transfer functions removed - main and play wallets serve different purposes
    return (
        <div className="wallet-page">
            {/* Header */}
            <header className="wallet-header">
                <div className="wallet-header-content">
                    <h1 className="wallet-title">Wallet</h1>
                </div>
            </header>

            <main className="wallet-main">
                {/* User Info Section */}
                <div className="wallet-panel">
                    <div className="wallet-user-info">
                        <div className="wallet-user-details">
                            <div className="wallet-user-icon">👤</div>
                            <div className="wallet-user-text">
                                <span className="wallet-user-name">
                                    {profileData?.user?.firstName || user?.firstName || 'Player'}
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

                    {/* Tabs */}
                    <div className="wallet-segmented">
                        <button
                            onClick={() => setActiveTab('balance')}
                            className={`wallet-seg ${activeTab === 'balance' ? 'active' : ''}`}
                        >
                            Balance
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`wallet-seg ${activeTab === 'history' ? 'active' : ''}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="wallet-loading">
                        <div className="wallet-spinner"></div>
                    </div>
                ) : activeTab === 'balance' ? (
                    /* Wallet Balances */
                    <div className="wallet-balances">
                        {/* Main Wallet */}
                        <div className="wallet-card">
                            <div className="wallet-card-content">
                                <div className="wallet-card-label">
                                    <span className="wallet-label-text">Main Wallet</span>
                                    <span className="wallet-label-icon">💰</span>
                                </div>
                                <span className="wallet-value">{wallet.main?.toLocaleString() || 0}</span>
                            </div>
                            <div className="wallet-card-description">
                                Primary balance for deposits and withdrawals
                            </div>
                        </div>

                        {/* Play Wallet */}
                        <div className="wallet-card">
                            <div className="wallet-card-content">
                                <div className="wallet-card-label">
                                    <span className="wallet-label-text">Play Wallet</span>
                                    <span className="wallet-label-icon">🎮</span>
                                </div>
                                <span className="wallet-value wallet-value-green">{wallet.play?.toLocaleString() || 0}</span>
                            </div>
                            <div className="wallet-card-description">
                                Gaming funds for placing bets and invite rewards
                            </div>
                        </div>

                    </div>
                ) : (
                    /* Transaction History */
                    <div className="wallet-history">
                        <h3 className="wallet-history-title">Recent Transactions</h3>
                        {historyLoading ? (
                            <div className="wallet-loading">
                                <div className="wallet-spinner"></div>
                                <div className="wallet-loading-text">Loading transactions...</div>
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
                                                <div className="wallet-transaction-description">{transaction.description || (transaction.type === 'deposit' ? 'Deposit' : 'Transaction')}</div>
                                                <div className="wallet-transaction-date">
                                                    {new Date(transaction.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="wallet-transaction-amount">
                                            <div className={`wallet-transaction-value ${transaction.amount > 0 ? 'positive' : 'negative'}`}>{transaction.amount > 0 ? `+${transaction.amount}` : `${transaction.amount}`}</div>
                                            <div className={`wallet-transaction-status ${transaction.status === 'Approved' || transaction.amount > 0 ? 'approved' : 'pending'}`}>{transaction.status || (transaction.amount > 0 ? 'Approved' : '')}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Transfer Section removed - main and play wallets serve different purposes */}
            </main>
            <BottomNav current="wallet" onNavigate={onNavigate} />
        </div>
    );
}

