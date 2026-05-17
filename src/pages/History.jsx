import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../lib/auth/AuthProvider';
import { apiFetch } from '../lib/api/client';
import { motion } from 'framer-motion';
import { 
  FaHistory, 
  FaGamepad, 
  FaTrophy, 
  FaCoins, 
  FaCalendarAlt,
  FaArrowDown,
  FaArrowUp,
  FaWallet
} from 'react-icons/fa';
import { GiPlayButton, GiConfirmed } from 'react-icons/gi';

export default function History({ onNavigate }) {
    const { sessionId } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('games');

    useEffect(() => {
        if (!sessionId) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), 12000);

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const [transactionsData, gamesData] = await Promise.all([
                    apiFetch('/user/transactions', { sessionId, signal: controller.signal }).catch(() => ({ transactions: [] })),
                    apiFetch('/user/games', { sessionId, signal: controller.signal }).catch(() => ({ games: [] }))
                ]);

                // Safe data extraction
                const transactionsList = transactionsData?.transactions || [];
                const gamesList = gamesData?.games || [];
                
                setTransactions(transactionsList);
                setGames(gamesList);
            } catch (error) {
                console.error('Failed to fetch history data:', error);
                setError('Unable to load your history right now.');
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [sessionId]);

    const totalGames = games?.length || 0;
    const gamesWon = games?.filter(g => g?.userResult?.won)?.length || 0;
    const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;

    const tabs = [
        { key: 'games', label: 'Games', icon: <GiPlayButton size={12} /> },
        { key: 'transactions', label: 'Transactions', icon: <FaWallet size={12} /> }
    ];

    const getTransactionIcon = (type, amount) => {
        if (type === 'deposit') return <FaArrowDown className="text-green-400" size={12} />;
        if (type === 'game_win') return <FaTrophy className="text-yellow-400" size={12} />;
        if (type === 'game_bet') return <FaArrowUp className="text-red-400" size={12} />;
        if (amount > 0) return <FaArrowDown className="text-green-400" size={12} />;
        return <FaArrowUp className="text-red-400" size={12} />;
    };

    const getTransactionColor = (amount) => {
        return amount > 0 ? 'text-green-400' : 'text-red-400';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return 'N/A';
        }
    };

    const formatAmount = (amount) => {
        const num = Number(amount);
        if (isNaN(num)) return '0';
        return num.toLocaleString();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md pt-safe px-4 py-3">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                            <FaHistory className="text-yellow-400" size={14} />
                        </div>
                        <span className="text-white/70 text-xs font-medium">HISTORY</span>
                    </div>
                </div>
            </div>

            <main className="px-4 pb-24 pt-16">
                {/* Stats Cards */}
                {!loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-3 gap-3 mb-6"
                    >
                        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
                            <FaGamepad className="text-white/40 mx-auto mb-1" size={14} />
                            <div className="text-white font-bold text-lg">{totalGames}</div>
                            <div className="text-white/30 text-[9px] uppercase tracking-wider">Games</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
                            <FaTrophy className="text-yellow-400 mx-auto mb-1" size={14} />
                            <div className="text-yellow-400 font-bold text-lg">{gamesWon}</div>
                            <div className="text-white/30 text-[9px] uppercase tracking-wider">Wins</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
                            <GiConfirmed className="text-green-400 mx-auto mb-1" size={14} />
                            <div className="text-green-400 font-bold text-lg">{winRate}%</div>
                            <div className="text-white/30 text-[9px] uppercase tracking-wider">Win Rate</div>
                        </div>
                    </motion.div>
                )}

                {/* Tab Switcher */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-4"
                >
                    <div className="flex gap-1 bg-white/5 rounded-full p-0.5">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/40 hover:text-white/60'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Error State */}
                {error && !loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center mb-4"
                    >
                        <p className="text-red-400 text-xs mb-2">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/30 transition-all"
                        >
                            Try Again
                        </button>
                    </motion.div>
                )}

                {/* Games Tab */}
                {activeTab === 'games' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-2 px-1">
                            Recent Games
                        </h3>
                        
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        ) : !games || games.length === 0 ? (
                            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-8 text-center">
                                <FaGamepad className="text-white/20 mx-auto mb-2" size={24} />
                                <p className="text-white/30 text-xs">No games played yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {games.slice(0, 20).map((game, idx) => (
                                    <div
                                        key={game?.id || idx}
                                        className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                    game?.userResult?.won 
                                                        ? 'bg-green-500/20' 
                                                        : 'bg-red-500/20'
                                                }`}>
                                                    {game?.userResult?.won ? (
                                                        <FaTrophy className="text-yellow-400" size={12} />
                                                    ) : (
                                                        <FaArrowUp className="text-red-400" size={12} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-white text-xs font-medium">
                                                        Game {game?.gameId || 'N/A'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <FaCalendarAlt className="text-white/20" size={8} />
                                                        <p className="text-white/30 text-[9px]">
                                                            {formatDate(game?.finishedAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                                                game?.userResult?.won 
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : 'bg-red-500/20 text-red-400'
                                            }`}>
                                                {game?.userResult?.won ? 'WON' : 'LOST'}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <span className="text-white/30">Stake:</span>
                                                    <span className="text-white ml-1">{game?.stake || 0} ETB</span>
                                                </div>
                                                <div>
                                                    <span className="text-white/30">Prize:</span>
                                                    <span className="text-green-400 ml-1">{game?.userResult?.prize || 0} ETB</span>
                                                </div>
                                            </div>
                                            <div className="text-white/30 text-[9px]">
                                                {game?.status || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-2 px-1">
                            Recent Transactions
                        </h3>
                        
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        ) : !transactions || transactions.length === 0 ? (
                            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-8 text-center">
                                <FaWallet className="text-white/20 mx-auto mb-2" size={24} />
                                <p className="text-white/30 text-xs">No transactions yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {transactions.slice(0, 20).map((transaction, idx) => {
                                    const amount = Number(transaction?.amount) || 0;
                                    const isPositive = amount > 0;
                                    const type = transaction?.type || 'unknown';
                                    const status = transaction?.status || (isPositive ? 'completed' : 'pending');
                                    
                                    return (
                                        <div
                                            key={transaction?.id || idx}
                                            className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                        isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                                                    }`}>
                                                        {getTransactionIcon(type, amount)}
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-xs font-medium capitalize">
                                                            {type === 'deposit' ? 'Deposit' : 
                                                             type === 'game_win' ? 'Game Win' :
                                                             type === 'game_bet' ? 'Game Bet' :
                                                             type.replace('_', ' ')}
                                                        </p>
                                                        <p className="text-white/30 text-[9px]">
                                                            {formatDate(transaction?.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-xs font-bold ${getTransactionColor(amount)}`}>
                                                        {isPositive ? `+${formatAmount(amount)}` : `${formatAmount(amount)}`} ETB
                                                    </p>
                                                    <p className="text-white/30 text-[9px] capitalize">
                                                        {status === 'completed' ? 'Success' : 
                                                         status === 'pending' ? 'Pending' : 
                                                         status}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </main>

            <BottomNav current="history" onNavigate={onNavigate} />
        </div>
    );
}