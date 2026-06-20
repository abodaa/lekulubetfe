// Mini app translations. Add every key to BOTH `en` and `am`.
// Missing `am` keys fall back to `en`; missing keys return the key itself.

export const translations = {
  en: {
    // Common
    "common.loading": "Loading…",
    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.save": "Save",
    "common.close": "Close",
    "common.retry": "Retry",
    "common.etb": "ETB",

    // Bottom navigation
    "nav.home": "Home",
    "nav.play": "Play",
    "nav.wallet": "Wallet",
    "nav.history": "History",
    "nav.profile": "Profile",
    "nav.scores": "Scores",
    "nav.leaderboard": "Leaderboard",

    // Language
    "lang.title": "Language",
    "lang.subtitle": "Choose your language",
    "lang.english": "English",
    "lang.amharic": "አማርኛ",
    "lang.saved": "Language updated",

    // Profile
    "profile.title": "Profile",
    "profile.header": "MY PROFILE",
    "profile.verified": "Verified User",
    "profile.games_played": "Games Played",
    "profile.games_played_sub": "Games you've played",
    "profile.games_won": "Games Won",
    "profile.games_won_sub": "Games you've won",
    "profile.win_rate": "Win Rate",
    "profile.phone": "Phone",
    "profile.member_since": "Member Since",
    "profile.role": "Role",
    "profile.settings": "Settings",
    "profile.load_error": "Failed to load profile. Please try again.",
    "profile.referral": "Referral Program",
    "profile.invites": "Invites",
    "profile.reg_rewards": "Invitee Registration Rewards",
    "profile.credited_to": "Credited to",
    "common.try_again": "Try Again",
    "wallet.main": "Main Wallet",
    "wallet.main_sub": "Withdrawable",
    "wallet.bonus": "Bonus Wallet",
    "wallet.bonus_sub": "Promotional funds",
    "wallet.coins": "Coins",
    "wallet.coins_sub": "Earned from bets",
  },

  am: {
    // Common
    "common.loading": "በመጫን ላይ…",
    "common.back": "ተመለስ",
    "common.cancel": "ሰርዝ",
    "common.confirm": "አረጋግጥ",
    "common.save": "አስቀምጥ",
    "common.close": "ዝጋ",
    "common.retry": "እንደገና ሞክር",
    "common.etb": "ብር",

    // Bottom navigation
    "nav.home": "መነሻ",
    "nav.play": "ይጫወቱ",
    "nav.wallet": "ቦርሳ",
    "nav.history": "ታሪክ",
    "nav.profile": "መገለጫ",
    "nav.scores": "ውጤቶች",
    "nav.leaderboard": "ደረጃ ሰሌዳ",

    // Language
    "lang.title": "ቋንቋ",
    "lang.subtitle": "ቋንቋዎን ይምረጡ",
    "lang.english": "English",
    "lang.amharic": "አማርኛ",
    "lang.saved": "ቋንቋ ተዘምኗል",

    // Profile
    "profile.title": "መገለጫ",
    "profile.header": "የእኔ መገለጫ",
    "profile.verified": "የተረጋገጠ ተጠቃሚ",
    "profile.games_played": "የተጫወቱ ጨዋታዎች",
    "profile.games_played_sub": "የተጫወቷቸው ጨዋታዎች",
    "profile.games_won": "ያሸነፉ ጨዋታዎች",
    "profile.games_won_sub": "ያሸነፏቸው ጨዋታዎች",
    "profile.win_rate": "የማሸነፍ መጠን",
    "profile.phone": "ስልክ",
    "profile.member_since": "አባል ከሆኑበት",
    "profile.role": "ሚና",
    "profile.settings": "ቅንብሮች",
    "profile.load_error": "መገለጫ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
    "profile.referral": "የግብዣ ፕሮግራም",
    "profile.invites": "ግብዣዎች",
    "profile.reg_rewards": "የተጋበዙ ሰዎች ምዝገባ ሽልማት",
    "profile.credited_to": "የተከፈለበት",
    "common.try_again": "እንደገና ይሞክሩ",
    "wallet.main": "ዋና ቦርሳ",
    "wallet.main_sub": "ሊወጣ የሚችል",
    "wallet.bonus": "ቦነስ ቦርሳ",
    "wallet.bonus_sub": "የማስታወቂያ ገንዘብ",
    "wallet.coins": "ሳንቲሞች",
    "wallet.coins_sub": "ከውርርድ የተገኘ",
  },
};

export function translate(lang, key, vars) {
  const L = translations[lang] || translations.en;
  let s = L[key] != null ? L[key] : translations.en[key];
  if (s == null) s = key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return s;
}
