import React, { useState, useEffect, useRef } from 'react';
import CartellaCard from '../components/CartellaCard';
import { apiFetch } from '../lib/api/client';
import { useAuth } from '../lib/auth/AuthProvider';
import { useToast } from '../contexts/ToastContext';
import { useWebSocket } from '../contexts/WebSocketContext';

export default function CartelaSelection({ onNavigate, onResetToGame, stake, onCartelaSelected, onGameIdUpdate }) {
    const { sessionId } = useAuth();
    const { showError, showSuccess, showWarning } = useToast();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wallet, setWallet] = useState({ main: 0, play: 0 });
    const [walletLoading, setWalletLoading] = useState(true);
    const [alertBanners, setAlertBanners] = useState([]);
    const alertTimersRef = useRef(new Map());

    const { connected, gameState, selectCartella, deselectCartella, connectToStake, wsReadyState, isConnecting, lastEvent } = useWebSocket();
    const hasConnectedRef = useRef(false);
    const rejoinTriedRef = useRef(false);
    const roomCheckTimerRef = useRef(null);

    // Connect to WebSocket when component mounts with stake
    useEffect(() => {
        if (stake && sessionId && !hasConnectedRef.current) {
            console.log('CartelaSelection - Connecting to WebSocket for stake:', stake);
            hasConnectedRef.current = true;
            connectToStake(stake);
        }
    }, [stake, sessionId, connectToStake]);

    // Reset connection ref when stake changes
    useEffect(() => {
        hasConnectedRef.current = false;
        rejoinTriedRef.current = false;
    }, [stake]);

    // Force registration start if room is in 'waiting' or 'inactive' state
    useEffect(() => {
        if (!stake || !connected) return;

        // Clear any existing room check timer
        if (roomCheckTimerRef.current) {
            clearTimeout(roomCheckTimerRef.current);
        }

        // If connected but no active game, rejoin to trigger room creation
        if (gameState.phase === 'waiting' && !gameState.gameId) {
            roomCheckTimerRef.current = setTimeout(() => {
                console.log('CartelaSelection - No active game for stake', stake, '- rejoining to create room');
                connectToStake(stake);
                rejoinTriedRef.current = false; // Reset to allow rejoin
            }, 2000);
        }

        return () => {
            if (roomCheckTimerRef.current) {
                clearTimeout(roomCheckTimerRef.current);
            }
        };
    }, [stake, connected, gameState.phase, gameState.gameId, connectToStake]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (roomCheckTimerRef.current) {
                clearTimeout(roomCheckTimerRef.current);
            }
        };
    }, []);

    // Reset transient UI state when component mounts
    useEffect(() => {
        console.log('CartelaSelection - Component mounted, resetting selected card');
        setError(null);
    }, []);

    // Reset selected card when we're in registration phase (new game starting)
    useEffect(() => {
        if (gameState.phase === 'registration') {
            console.log('CartelaSelection - Resetting selected card for new game registration');
            setError(null);
        }
    }, [gameState.phase, gameState.gameId, gameState.playersCount, gameState.takenCards, connected, wsReadyState]);

    // Reset when gameId changes (new game) - but only if we're in registration phase
    useEffect(() => {
        if (gameState.gameId && gameState.phase === 'registration') {
            console.log('CartelaSelection - New gameId detected in registration phase, resetting selection');
        }
    }, [gameState.gameId, gameState.phase]);

    // Special handling for navigation from Winner page
    useEffect(() => {
        if (gameState.phase === 'announce' || gameState.winners?.length > 0) {
            console.log('CartelaSelection - Coming from Winner page, clearing all state');
            setError(null);
            if (stake && sessionId) {
                console.log('CartelaSelection - Reconnecting WebSocket after Winner page navigation');
                connectToStake(stake);
            }
        }
    }, [gameState.phase, gameState.winners, stake, sessionId]);

    // If we are connected but not in registration, rejoin once to fetch fresh snapshot
    useEffect(() => {
        if (!stake || !sessionId) return;
        if (!connected || isConnecting) return;
        if (rejoinTriedRef.current) return;

        const notReadyForSelection = gameState.phase !== 'registration';
        if (notReadyForSelection) {
            rejoinTriedRef.current = true;
            console.log('CartelaSelection - Auto rejoin to fetch fresh snapshot');
            connectToStake(stake);
        }
    }, [stake, sessionId, connected, isConnecting, gameState.phase, gameState.countdown, connectToStake]);

    // Handle page visibility changes to maintain connection
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && stake && sessionId) {
                setTimeout(() => {
                    if (!connected) {
                        console.log('Reconnecting WebSocket after page visibility change');
                        connectToStake(stake);
                    }
                }, 100);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [stake, sessionId, connected, connectToStake]);

    // Update gameId in parent component when it changes
    useEffect(() => {
        if (gameState.gameId) {
            console.log('CartelaSelection - GameId updated:', gameState.gameId);
            onGameIdUpdate?.(gameState.gameId);
        }
    }, [gameState.gameId, onGameIdUpdate]);

    // Fetch wallet data
    useEffect(() => {
        const fetchWallet = async () => {
            if (!sessionId) return;
            try {
                setWalletLoading(true);
                const walletResponse = await apiFetch('/wallet', { sessionId });
                const mainValue = (walletResponse.main !== null && walletResponse.main !== undefined) 
                    ? walletResponse.main : (walletResponse.balance ?? 0);
                const playValue = (walletResponse.play !== null && walletResponse.play !== undefined) 
                    ? walletResponse.play : 0;
                setWallet({ main: mainValue, play: playValue });
            } catch (walletErr) {
                console.error('Error fetching wallet from /wallet:', walletErr);
                try {
                    const profileResponse = await apiFetch('/user/profile', { sessionId });
                    if (profileResponse.wallet) {
                        setWallet({
                            main: profileResponse.wallet.main ?? profileResponse.wallet.balance ?? 0,
                            play: profileResponse.wallet.play ?? profileResponse.wallet.balance ?? 0
                        });
                    } else {
                        setWallet({ main: 0, play: 0 });
                    }
                } catch (profileErr) {
                    console.error('Error fetching wallet fallback:', profileErr);
                    setWallet({ main: 0, play: 0 });
                }
            } finally {
                setWalletLoading(false);
            }
        };
        fetchWallet();
    }, [sessionId]);

    // Apply wallet updates from WebSocket
    useEffect(() => {
        if (!gameState?.walletUpdate) return;
        const update = gameState.walletUpdate;
        setWallet(prev => ({
            main: update.main ?? prev.main ?? 0,
            play: update.play ?? prev.play ?? 0
        }));
    }, [gameState.walletUpdate]);

    const [retryCount, setRetryCount] = useState(0);

    // Fetch all cards from server
    useEffect(() => {
        const fetchCards = async () => {
            if (!sessionId) return;
            try {
                setLoading(true);
                setError(null);
                const response = await apiFetch('/api/cartellas', { sessionId });
                if (response.success && Array.isArray(response.cards)) {
                    if (response.cards.length === 0) {
                        setError('No cards available right now. Please refresh.');
                        setCards([]);
                    } else {
                        setCards(response.cards);
                        setError(null);
                    }
                } else {
                    setError('Failed to load cards');
                }
            } catch (err) {
                console.error('Error fetching cards:', err);
                setError('Failed to load cards from server');
            } finally {
                setLoading(false);
            }
        };
        fetchCards();
    }, [sessionId, retryCount]);

    // Handle game state changes and navigation
    useEffect(() => {
        const selectedNumbers = Array.isArray(gameState.yourSelections) ? gameState.yourSelections : [];
        const hasCards = Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0;
        const isGameRunning = gameState.phase === 'running' && gameState.gameId;
        const isGameStarting = gameState.phase === 'starting' && gameState.gameId;
        const hasPlayers = typeof gameState.playersCount === 'number' && gameState.playersCount >= 2;
        const shouldGoToGameLayout = (isGameRunning || isGameStarting) && hasPlayers;

        if (shouldGoToGameLayout) {
            console.log('🎮 NAVIGATION TRIGGERED - Game starting/running');
            onGameIdUpdate?.(gameState.gameId);
            let cardNumbersToPass = [];
            if (hasCards && Array.isArray(gameState.yourCards)) {
                cardNumbersToPass = gameState.yourCards.map(card => card.cardNumber || card).filter(num => num != null);
            } else if (selectedNumbers.length > 0) {
                cardNumbersToPass = selectedNumbers;
            }
            onCartelaSelected?.(cardNumbersToPass);
            onNavigate?.('game-layout', true);
        }
    }, [gameState.phase, gameState.gameId, gameState.yourSelections, gameState.yourCards, onCartelaSelected, onGameIdUpdate, onNavigate]);

    // Show message if game cancelled
    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type === 'game_cancelled' && lastEvent.payload?.reason === 'NOT_ENOUGH_PLAYERS') {
            showWarning('Not Enough Player');
        }
        if (lastEvent.type === 'selection_rejected' && lastEvent.payload?.reason === 'LIMIT_REACHED') {
            showError('You can select only 1 cartela.');
        }
    }, [lastEvent, showWarning, showError]);

    // Handle registration expired alert
    useEffect(() => {
        const hasSelection = Array.isArray(gameState?.yourSelections) && gameState.yourSelections.length > 0;
        const countdownZero = typeof gameState?.countdown === 'number' && gameState.countdown <= 0;
        const registrationExpired = gameState?.phase === 'registration' && countdownZero && !hasSelection;
        const msg = 'Registration time has ended due to low number of players. Please wait for the next game to start.';

        setAlertBanners(prev => {
            const hasExpiredMsg = prev.includes(msg);
            if (registrationExpired && !hasExpiredMsg) return [...prev, msg];
            if (!registrationExpired && hasExpiredMsg) return prev.filter(m => m !== msg);
            return prev;
        });
    }, [gameState?.phase, gameState?.countdown, gameState?.yourSelections]);

    // Auto-dismiss alerts after 3 seconds
    useEffect(() => {
        const currentMessages = new Set(alertBanners);
        alertTimersRef.current.forEach((timer, msg) => {
            if (!currentMessages.has(msg)) {
                clearTimeout(timer);
                alertTimersRef.current.delete(msg);
            }
        });
        alertBanners.forEach((alertMsg) => {
            if (!alertTimersRef.current.has(alertMsg)) {
                const timer = setTimeout(() => {
                    setAlertBanners(prev => prev.filter(msg => msg !== alertMsg));
                    alertTimersRef.current.delete(alertMsg);
                }, 3000);
                alertTimersRef.current.set(alertMsg, timer);
            }
        });
    }, [alertBanners]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            alertTimersRef.current.forEach(timer => clearTimeout(timer));
            alertTimersRef.current.clear();
        };
    }, []);

    // Handle card selection
    const handleCardSelect = async (cardNumber) => {
        const cardNum = Number(cardNumber);

        if (walletLoading) {
            showError('Loading wallet information. Please wait a moment and try again.');
            return;
        }

        const selectedNumbers = Array.isArray(gameState.yourSelections) ? gameState.yourSelections : [];

        // Allow selection even when not in registration - just show a friendly message
        if (gameState.phase !== 'registration') {
            const waitMsg = 'Please wait until the current game finishes. You can select cartela when registration starts again.';
            setAlertBanners(prev => {
                if (prev.includes(waitMsg)) return prev;
                return [...prev, waitMsg];
            });
            showError(waitMsg);
            return;
        }

        if (!connected || wsReadyState !== WebSocket.OPEN) {
            showError('Not connected to game server. Please refresh and try again.');
            return;
        }

        // Toggle behavior: if already selected, deselect it
        if (selectedNumbers.includes(cardNum)) {
            try {
                const success = deselectCartella(cardNum);
                if (success) showSuccess(`Cartella #${cardNum} deselected!`);
                else showError('Failed to deselect cartella. Please try again.');
            } catch (err) {
                console.error('Error deselecting cartella:', err);
                showError('Failed to deselect cartella. Please try again.');
            }
            return;
        }

        // Max 1 cartela per user
        if (selectedNumbers.length >= 1) {
            const currentCard = selectedNumbers[0];
            if (currentCard === cardNum) return;
            const isTakenByOthers = gameState.takenCards.some(taken => Number(taken) === cardNum);
            if (isTakenByOthers) {
                const takenMsg = 'ተይዟል ሌላ ይምረጡ';
                setAlertBanners(prev => (prev.includes(takenMsg) ? prev : [...prev, takenMsg]));
                showError(takenMsg);
                return;
            }
            try {
                deselectCartella(currentCard);
                selectCartella(cardNum);
                showSuccess(`Cartella #${cardNum} selected! Waiting for game to start...`);
            } catch (err) {
                console.error('Error switching cartella:', err);
                showError('Failed to switch cartela. Please try again.');
            }
            return;
        }

        // Check balance
        const totalBalance = (wallet.main || 0) + (wallet.play || 0);
        const needed = Number(stake);
        if (totalBalance < needed) {
            const msg = 'Insufficient fund';
            setAlertBanners(prev => [...prev, msg]);
            showError(msg);
            return;
        }

        // Check if card is already taken
        const isTakenByOthers = gameState.takenCards.some(taken => Number(taken) === cardNum) && !selectedNumbers.includes(cardNum);
        if (isTakenByOthers) {
            const takenMsg = 'ተይዟል ሌላ ይምረጡ';
            setAlertBanners(prev => {
                if (prev.includes(takenMsg)) return prev;
                return [...prev, takenMsg];
            });
            showError(takenMsg);
            return;
        }

        try {
            const success = selectCartella(cardNum);
            if (success) showSuccess(`Cartella #${cardNum} selected! Waiting for game to start...`);
            else showError('Failed to select cartella. Please try again.');
        } catch (err) {
            console.error('Error selecting cartella:', err);
            showError('Failed to select cartella. Please try again.');
        }
    };

    const timerSeconds = (gameState.phase === 'registration' && gameState.registrationEndTime)
        ? Math.max(0, Math.ceil((gameState.registrationEndTime - Date.now()) / 1000))
        : (gameState.phase === 'waiting' ? '--' : (gameState.countdown || 0));

    const selectedNumbers = Array.isArray(gameState.yourSelections) ? gameState.yourSelections : [];
    const selectedCards = selectedNumbers
        .map(n => ({ number: n, card: cards[n - 1] }))
        .filter(x => x.card);

    const cardsReady = Array.isArray(cards) && cards.length > 0;

    if (loading || !cardsReady) {
        return (
            <div className="app-container joy-bingo-bg">
                <header className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <div className="wallet-box">
                                <div className="wallet-label">Wallet</div>
                                <div className="wallet-value text-blue-400">
                                    {walletLoading ? '...' : ((wallet.main || 0) + (wallet.play || 0)).toLocaleString()}
                                </div>
                            </div>
                            <div className="wallet-box">
                                <div className="wallet-label">Stake</div>
                                <div className="wallet-value">{stake}</div>
                            </div>
                        </div>
                        <div className="timer-box">
                            <div className="timer-countdown">{timerSeconds}s</div>
                            <div className="timer-status">
                                {gameState.phase === 'registration' && `Registration open... (${gameState.playersCount} players)`}
                                {gameState.phase === 'waiting' && 'Waiting for room...'}
                                {gameState.phase === 'starting' && `Starting game...`}
                                {gameState.phase === 'running' && 'Game in progress!'}
                                {gameState.phase === 'announce' && 'Game finished!'}
                            </div>
                        </div>
                    </div>
                </header>
                <main className="p-4 flex items-center justify-center min-h-96">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
                        <p className="text-purple-600 font-medium mt-3">Loading...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container joy-bingo-bg">
                <header className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <div className="wallet-box">
                                <div className="wallet-label">Wallet</div>
                                <div className="wallet-value text-blue-400">
                                    {walletLoading ? '...' : ((wallet.main || 0) + (wallet.play || 0)).toLocaleString()}
                                </div>
                            </div>
                            <div className="wallet-box">
                                <div className="wallet-label">Stake</div>
                                <div className="wallet-value">{stake}</div>
                            </div>
                        </div>
                        <div className="timer-box">
                            <div className="timer-countdown">{timerSeconds}s</div>
                            <div className="timer-status">
                                {gameState.phase === 'registration' && `Registration open... (${gameState.playersCount} players)`}
                                {gameState.phase === 'waiting' && 'Waiting for room...'}
                                {gameState.phase === 'starting' && `Starting game...`}
                                {gameState.phase === 'running' && 'Game in progress!'}
                                {gameState.phase === 'announce' && 'Game finished!'}
                            </div>
                        </div>
                    </div>
                </header>
                <main className="p-4 flex flex-col items-center justify-center min-h-64">
                    <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg max-w-md">
                        <div className="flex items-center gap-2 text-yellow-400">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <div className="font-semibold">Limited Mode</div>
                                <div className="text-sm text-yellow-300">{error}</div>
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={() => setRetryCount((c) => c + 1)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors">
                        Retry
                    </button>
                </main>
            </div>
        );
    }

    return (
        <div className="app-container relative joy-bingo-bg">
            {/* Alert Banners */}
            {Array.isArray(alertBanners) && alertBanners.length > 0 && (
                <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
                    {alertBanners.map((alertMsg, index) => (
                        <div key={index} className="alert-banner-appeal animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                            <div className="alert-icon-wrapper">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="alert-message-text">{alertMsg}</div>
                            <button onClick={() => setAlertBanners(prev => prev.filter((_, i) => i !== index))} className="alert-dismiss-btn" aria-label="Dismiss">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <header className="p-4 mb-0">
                <div className="game-info-bar-light flex items-stretch rounded-lg flex-nowrap mobile-info-bar" style={{ marginBottom: '1rem' }}>
                    <div className="info-box info-box-timer flex-1 flex items-center justify-center">
                        <span className="timer-value">{timerSeconds}s</span>
                    </div>
                    <div className="info-box flex-1">
                        <div className="info-label">Wallet</div>
                        <div className="info-value">{walletLoading ? '...' : ((wallet.main || 0) + (wallet.play || 0)).toLocaleString()}</div>
                    </div>
                    <div className="info-box flex-1">
                        <div className="info-label">Stake</div>
                        <div className="info-value">{stake}</div>
                    </div>
                    {gameState.phase === 'registration' && (
                        <div className="info-box flex-1">
                            <div className="info-label">Players</div>
                            <div className="info-value">{gameState.playersCount || 0}</div>
                        </div>
                    )}
                </div>
            </header>

            <main className="p-4 mt-2 pb-6 flex flex-col gap-4">
                <div className="mx-4 mb-6">
                    <div className="cartela-grid-scrollable rounded-lg p-4 max-h-[320px] min-h-[260px] overflow-y-auto" style={{ background: '#cfade0' }}>
                        <div className="cartela-numbers-grid">
                            {Array.from({ length: cards.length }, (_, i) => i + 1).map((cartelaNumber) => {
                                const cartelaNum = Number(cartelaNumber);
                                const hasCards = Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0;
                                const shouldShowTakenCards = gameState.phase === 'registration' || hasCards;
                                const isTaken = shouldShowTakenCards
                                    ? gameState.takenCards.some(taken => Number(taken) === cartelaNum)
                                    : false;
                                const isSelected = selectedNumbers.includes(cartelaNum);
                                const takenByMe = selectedNumbers.includes(cartelaNum);
                                return (
                                    <button key={cartelaNumber} onClick={() => handleCardSelect(cartelaNum)} disabled={false}
                                        className={`cartela-number-btn-light ${isTaken ? (takenByMe ? 'cartela-selected-light' : 'cartela-taken-light') : (isSelected ? 'cartela-selected-light' : 'cartela-normal-light')}`}
                                        title={`Cartella #${cartelaNumber}`}>
                                        {cartelaNumber}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {selectedCards.length > 0 && (gameState.phase === 'registration' || (Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0)) && (
                    <div style={{ marginTop: '40px' }}>
                        <div className="rounded-lg p-2">
                            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', boxSizing: 'border-box' }}>
                                {selectedCards.slice(0, 1).map(({ number, card }) => (
                                    <CartellaCard key={number} id={number} card={card} called={gameState.calledNumbers || []} selectedNumber={null} isPreview={true} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}