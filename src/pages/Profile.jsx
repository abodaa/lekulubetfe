import React, { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { apiFetch } from "../lib/api/client";

export default function Profile({ onNavigate }) {
  const [sound, setSound] = useState(true);
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
    wallet: { balance: 0, main: 0, play: 0, coins: 0, gamesWon: 0 },
  });
  const [inviteStats, setInviteStats] = useState({
    totalInvites: 0,
    totalRewards: 0,
    totalDepositsFromInvited: 0,
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
      const [profileRes, walletRes, inviteRes] = await Promise.all([
        apiFetch("/user/profile", { sessionId }).catch((err) => {
          if (err?.message === "api_error_404") {
            console.warn("Profile 404 - using auth user info only");
            return null;
          }
          throw err;
        }),
        apiFetch("/wallet", { sessionId }).catch((err) => {
          console.warn("Wallet fetch failed:", err);
          return { balance: 0, main: 0, play: 0, coins: 0, gamesWon: 0 };
        }),
        apiFetch("/user/invite-stats", { sessionId }).catch(() => null),
      ]);

      const userInfo = profileRes?.user || {
        firstName: user?.firstName || "User",
        lastName: user?.lastName || "",
        phone: user?.phone || null,
        isRegistered: user?.isRegistered || false,
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        registrationDate: new Date(),
      };

      const mainValue =
        walletRes.main !== null && walletRes.main !== undefined
          ? walletRes.main
          : (walletRes.balance ?? 0);
      const playValue =
        walletRes.play !== null && walletRes.play !== undefined
          ? walletRes.play
          : 0;

      setProfileData({
        user: userInfo,
        wallet: {
          balance: walletRes.balance ?? 0,
          main: mainValue,
          play: playValue,
          coins: walletRes.coins || 0,
          gamesWon: walletRes.gamesWon ?? 0,
        },
      });

      if (inviteRes) setInviteStats(inviteRes);
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

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-content">
          <div className="profile-avatar">{initials}</div>
          <h1 className="profile-name">{displayName}</h1>
          {profileData.user?.isRegistered && (
            <div className="profile-verified">
              <span className="profile-verified-icon">✓</span>
              <span className="profile-verified-text">Verified User</span>
            </div>
          )}
        </div>
      </header>

      <main className="profile-main">
        {loading ? (
          <div className="profile-loading">
            <div className="profile-spinner"></div>
            <div className="profile-loading-text">Loading profile...</div>
          </div>
        ) : error ? (
          <div className="profile-error">
            <div className="profile-error-icon">❌ Error Loading Data</div>
            <div className="profile-error-text">{error}</div>
            <button onClick={fetchProfileData} className="profile-retry-button">
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="profile-cards">
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">💰</span>
                  <span className="profile-card-label">Main Wallet</span>
                </div>
                <div className="profile-card-value">
                  {profileData.wallet.main?.toLocaleString() || 0}
                </div>
                <div className="profile-card-subtitle">Withdrawable</div>
              </div>
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">🎮</span>
                  <span className="profile-card-label">Play Wallet</span>
                </div>
                <div className="profile-card-value profile-card-value-green">
                  {profileData.wallet.play?.toLocaleString() || 0}
                </div>
                <div className="profile-card-subtitle">Game funds</div>
              </div>
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">🪙</span>
                  <span className="profile-card-label">Coins</span>
                </div>
                <div className="profile-card-value profile-card-value-purple">
                  {profileData.wallet.coins?.toLocaleString() || 0}
                </div>
                <div className="profile-card-subtitle">Earned from bets</div>
              </div>
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">🏆</span>
                  <span className="profile-card-label">Games Won</span>
                </div>
                <div className="profile-card-value">
                  {profileData.wallet.gamesWon?.toLocaleString() || 0}
                </div>
                <div className="profile-card-subtitle">Victories</div>
              </div>
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">👥</span>
                  <span className="profile-card-label">Invites</span>
                </div>
                <div className="profile-card-value">
                  {inviteStats.totalInvites || 0}
                </div>
                <div className="profile-card-subtitle">Friends invited</div>
              </div>
              <div className="profile-card">
                <div className="profile-card-title">
                  <span className="profile-card-icon">🎁</span>
                  <span className="profile-card-label">Invite Rewards</span>
                </div>
                <div className="profile-card-value profile-card-value-green">
                  {inviteStats.totalRewards?.toLocaleString() || 0}
                </div>
                <div className="profile-card-subtitle">
                  ETB earned (play wallet)
                  <br />
                  <span className="text-xs text-gray-400">
                    ETB 1 per invited user registration
                  </span>
                </div>
              </div>
              {inviteStats.inviteCode && (
                <div className="profile-card">
                  <div className="profile-card-title">
                    <span className="profile-card-icon">🔗</span>
                    <span className="profile-card-label">Invite Code</span>
                  </div>
                  <div className="profile-card-value profile-card-value-purple">
                    {inviteStats.inviteCode}
                  </div>
                  <div className="profile-card-subtitle">
                    Share with friends
                  </div>
                </div>
              )}
            </div>

            <div className="profile-settings">
              <h2 className="profile-settings-title">Settings</h2>
              <div className="profile-settings-row">
                <div className="profile-settings-content">
                  <div className="profile-settings-label">
                    <span className="profile-settings-icon">🔉</span>
                    <span className="profile-settings-text">Sound</span>
                  </div>
                  <button
                    onClick={() => setSound(!sound)}
                    className={`profile-switch ${sound ? "on" : ""}`}
                    aria-pressed={sound}
                  >
                    <span className="profile-switch-knob"></span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <BottomNav current="profile" onNavigate={onNavigate} />
    </div>
  );
}
