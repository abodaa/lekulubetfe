import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../lib/auth/AuthProvider';
import CartellaCard from '../components/CartellaCard';

function cardDataFromWinner(winner) {
    if (!winner) return null;
    try {
        if (winner.card && Array.isArray(winner.card) && winner.card.length === 5) {
            return winner.card;
        }
        if (winner.cardNumbers && Array.isArray(winner.cardNumbers) && winner.cardNumbers.length === 25) {
            return [
                winner.cardNumbers.slice(0, 5),
                winner.cardNumbers.slice(5, 10),
                winner.cardNumbers.slice(10, 15),
                winner.cardNumbers.slice(15, 20),
                winner.cardNumbers.slice(20, 25)
            ];
        }
    } catch (e) {
        console.error('Error processing card data:', e);
    }
    return null;
}

function calledNumbersForWinner(winner, gameCalledNumbers) {
    const winnerCalled = Array.isArray(winner?.called) ? winner.called : [];
    const gameCalled = Array.isArray(gameCalledNumbers) ? gameCalledNumbers : [];
    return winnerCalled.length > 0 ? winnerCalled : gameCalled;
}

/** One entry per distinct winning board (same user can appear twice with two cartelas). */
function dedupeWinningCartelas(winners) {
    const out = [];
    const seen = new Set();
    for (const w of winners) {
        const uid = String(w.userId ?? w.sessionId ?? '');
        const cid = String(w.cartelaNumber ?? w.cartela?.cartelaNumber ?? '');
        const key = `${uid}::${cid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(w);
    }
    return out;
}

export default function Winner({ onNavigate, onResetToGame }) {
    const { gameState } = useWebSocket();
    const { sessionId } = useAuth();
    const [countdown, setCountdown] = useState(0);

    // Server-synchronized countdown timer - uses only server's nextRegistrationStart timestamp
    useEffect(() => {
        const updateCountdown = () => {
            if (gameState.nextRegistrationStart) {
                const remaining = Math.max(0, Math.ceil((gameState.nextRegistrationStart - Date.now()) / 1000));
                setCountdown(remaining);
            } else {
                setCountdown(0);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [gameState.nextRegistrationStart]);

    // Navigate when backend starts new registration
    useEffect(() => {
        if (gameState.phase === 'registration') {
            onNavigate?.('cartela-selection');
        }
    }, [gameState.phase, onNavigate]);

    const winners = gameState.winners || [];
    const displayWinners = dedupeWinningCartelas(winners);
    const isMultiCartelas = displayWinners.length > 1;

    // Check if current user is a winner
    const isCurrentUserWinner = sessionId && winners.some(w =>
        w.userId === sessionId ||
        w.sessionId === sessionId ||
        (w.user && w.user.id && w.user.id.toString() === sessionId?.toString())
    );

    // Handle case when no winners (shouldn't happen, but handle gracefully)
    const hasWinners = winners.length > 0;

    // Show "no winner" state if no winners data
    if (!hasWinners) {
        return (
            <div className="app-container flex items-center justify-center min-h-screen py-4 px-4" style={{ background: '#cfade0' }}>
                <div className="w-full max-w-md">
                    {/* Main Card Container with Light Purple Background */}
                    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-4" style={{ background: '#cfade0' }}>
                        {/* Large Orange BINGO! Banner */}
                        <div className="w-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6 shrink-0 rounded-xl mx-2 mt-2" style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}>
                            <div className="text-center">
                                <h1 className="text-white font-extrabold text-5xl md:text-6xl tracking-wider mb-2 drop-shadow-lg">
                                    BINGO!
                                </h1>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="px-4 py-2 rounded-lg bg-gray-500 border-2 border-gray-600 flex items-center justify-center text-white font-bold text-lg shadow-lg" style={{ backgroundColor: '#6b7280', borderColor: '#4b5563', padding: '0.5rem 1rem' }}>
                                        🎯
                                    </div>
                                    <p className="text-white text-lg md:text-xl font-semibold">
                                        No Winner This Game
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Countdown Section - Orange Background with Large Number */}
                        <div className="px-4 pb-4 shrink-0">
                            <div className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3" style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}>
                                <div className="text-center">
                                    <div className="text-white text-sm font-semibold mb-1">
                                        አዲስ ጭዋታ ለመጀመር
                                    </div>
                                    <div className="text-white font-extrabold text-4xl md:text-5xl tracking-wider drop-shadow-lg leading-none">
                                        {countdown > 0 ? countdown : '0'}
                                    </div>
                                    <div className="text-white text-xs font-medium mt-1 opacity-90">
                                        {countdown > 0 ? (
                                            <>Auto-starting next game in {countdown} second{countdown !== 1 ? 's' : ''}</>
                                        ) : (
                                            <>Navigating to next game...</>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // Get winner name/identifier for each winner
    const getWinnerDisplayName = (winner) =>
        winner.name ||
        winner.playerName ||
        winner.firstName ||
        (winner.cartelaNumber ? `Cartella #${winner.cartelaNumber}` : 'Winner');

    // Build a unique winner list by user identity (userId / sessionId),
    // falling back to display name if needed
    const uniqueWinners = [];
    const seenKeys = new Set();

    winners.forEach((w) => {
        const key =
            w.userId ||
            w.sessionId ||
            (w.user && w.user.id) ||
            getWinnerDisplayName(w);

        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueWinners.push(w);
        }
    });

    const winnerNames = uniqueWinners.map(getWinnerDisplayName);

    const gameCalled = Array.isArray(gameState.calledNumbers) ? gameState.calledNumbers : [];

    return (
        <div className="app-container flex items-center justify-center min-h-screen py-4 px-4" style={{ background: '#cfade0' }}>
            <div className="w-full max-w-md">
                {/* Main Card Container with Light Purple Background */}
                <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-4">
                    {/* Large Orange BINGO! Banner */}
                    <div className="w-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6 shrink-0 rounded-xl mx-2 mt-2" style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}>
                        <div className="text-center">
                            <h1 className="text-white font-extrabold text-5xl md:text-6xl tracking-wider mb-2 drop-shadow-lg">
                                BINGO!
                            </h1>
                            <div className="flex flex-col items-center justify-center gap-1">
                                {winnerNames.slice(0, 3).map((name, idx) => (
                                    <div key={`${name}-${idx}`} className="flex items-center justify-center gap-3">
                                        <div
                                            className="px-4 py-2 rounded-lg bg-green-500 border-2 border-green-600 flex items-center justify-center text-white font-bold text-lg shadow-lg max-w-[220px] truncate"
                                            style={{ backgroundColor: '#22c55e', borderColor: '#16a34a', padding: '0.5rem 1rem' }}
                                        >
                                            {name}
                                        </div>
                                        <p className="text-white text-lg md:text-xl font-semibold">
                                            has won the game!
                                        </p>
                                    </div>
                                ))}
                                {winnerNames.length > 3 && (
                                    <p className="text-white text-lg font-semibold opacity-90">
                                        +{winnerNames.length - 3} more
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card Section with Light Purple Background */}
                    <div className="p-4 shrink-0">
                        <div
                            className={isMultiCartelas ? 'max-h-[min(58vh,520px)] overflow-y-auto overflow-x-hidden pr-1 -mr-1' : ''}
                            style={isMultiCartelas ? { WebkitOverflowScrolling: 'touch' } : undefined}>
                            <div className={`flex flex-col items-center ${isMultiCartelas ? 'gap-8 pb-2' : ''}`}>
                                {displayWinners.map((w, idx) => {
                                    const cardData = cardDataFromWinner(w);
                                    const calledNumbers = calledNumbersForWinner(w, gameCalled);
                                    const boardNumber = w.cartelaNumber || w.cardId || 'N/A';
                                    const label = getWinnerDisplayName(w);
                                    return (
                                        <div
                                            key={`${String(w.userId)}-${boardNumber}-${idx}`}
                                            className="w-full flex flex-col items-center shrink-0"
                                        >
                                            {isMultiCartelas && (
                                                <p className="text-purple-900 text-sm font-bold mb-2 text-center w-full">
                                                    {label}
                                                    <span className="text-purple-600 font-semibold"> · Board {boardNumber}</span>
                                                </p>
                                            )}
                                            <div className="w-full" style={{ padding: '15px 30px', boxSizing: 'border-box' }}>
                                                <div
                                                    className="w-full flex flex-col items-center justify-center"
                                                    style={{
                                                        background: '#cec2eb',
                                                        border: '2px solid #ffffff',
                                                        borderRadius: '12px',
                                                        padding: '8px',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    {cardData ? (
                                                        <CartellaCard
                                                            id={boardNumber}
                                                            card={cardData}
                                                            called={calledNumbers}
                                                            isPreview={false}
                                                            showWinningPattern={true}
                                                            showHeader={true}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="text-center p-8 rounded-xl border-2 border-purple-200/50 shadow-md w-full max-w-xs"
                                                            style={{ background: '#cec2eb' }}
                                                        >
                                                            <div className="text-3xl mb-2">🏆</div>
                                                            <div className="text-purple-700 text-sm font-semibold mb-1">
                                                                Cartella #{boardNumber}
                                                            </div>
                                                            <div className="text-gray-600 text-xs mt-2">
                                                                Card preview not available
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!isMultiCartelas && (
                                                        <div className="text-center mt-2 w-full">
                                                            <p className="text-purple-800 text-sm font-semibold">
                                                                Board number {boardNumber}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Countdown Section - Orange Background with Large Number */}
                    <div className="px-3 pb-3 shrink-0">
                        <div
                            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600"
                            style={{
                                background: 'linear-gradient(to right, #f97316, #ea580c)',
                                minHeight: '72px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div className="text-white font-extrabold text-5xl md:text-6xl tracking-wider drop-shadow-lg leading-none">
                                {countdown > 0 ? countdown : '0'}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );


}
