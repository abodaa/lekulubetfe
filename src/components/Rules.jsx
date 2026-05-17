import React, { useState } from 'react';
import BottomNav from './BottomNav';
import { motion } from 'framer-motion';
import { FaLanguage, FaArrowLeft } from 'react-icons/fa';

// ========== CONTENT STORAGE ==========
const content = {
  en: {
    header: {
      title: "Game Rules"
    },
    tabs: {
      cards: "Cards",
      play: "Play",
      prizes: "Prizes",
      fair: "Fair"
    },
    cards: {
      title: "Registration Guide",
      steps: [
        { step: 1, title: "Choose Your Card", text: "Pick any available card from 1-200 during registration.", color: "green" },
        { step: 2, title: "Card Status Indicator", text: "Unavailable cards are marked in red. Select only green cards.", color: "red" },
        { step: 3, title: "Card Preview", text: "Preview the numbers on your card before confirming.", color: "blue" }
      ],
      tips: {
        title: "Card Selection Tips",
        items: [
          "Choose cards that are not marked in red",
          "Preview your card before confirming",
          "Select quickly before registration time ends"
        ]
      },
      timer: {
        title: "Registration Timer",
        text: "Registration lasts a short time. Be ready to choose and confirm your card before the timer runs out."
      }
    },
    play: {
      title: "Play",
      steps: [
        { step: 1, title: "Game Entry", text: "When we enter the game, we get a playing card based on the card number we selected.", color: "green" },
        { step: 2, title: "Game Timer", text: "The game starts counting down the remaining seconds at the top right.", color: "orange" },
        { step: 3, title: "Number Calling", text: "When the game starts, it begins calling out different numbers from 1 to 75.", color: "green" },
        { step: 4, title: "Marking Numbers", text: "If the called number is inside our playing card, we can select it by clicking on the called number.", color: "blue" },
        { step: 5, title: "Unmarking Numbers", text: "If we want to erase the number we selected, we can erase it by clicking on the number itself again.", color: "yellow" }
      ],
      mechanics: {
        title: "Game Mechanics",
        items: [
          { title: "Number Range", text: "Numbers called are from 1 to 75" },
          { title: "Marking", text: "Click to mark/unmark numbers" },
          { title: "Card Layout", text: "5x5 grid with center FREE space" },
          { title: "Timer", text: "Countdown shows game start time" }
        ]
      }
    },
    prizes: {
      title: "Prizes",
      mainRule: {
        title: "Main Winning Rule",
        text: "When numbers are called, by selecting from our playing card either horizontally, vertically, diagonally, or all four corners, we can immediately win by pressing the BINGO button at the bottom."
      },
      categories: [
        { icon: "→", title: "Horizontal", text: "Completing any horizontal row (5 numbers in a line)" },
        { icon: "↓", title: "Vertical", text: "Completing any vertical column (5 numbers in a line)" },
        { icon: "↘", title: "Diagonal", text: "Completing any diagonal line (5 numbers in a line)" },
        { icon: "▶", title: "Four Corners", text: "Marking the four corner numbers of the card" },
        { icon: "▶", title: "One Line", text: "Marking one line of numbers on the card" }
      ],
      multipleWinners: {
        title: "Multiple Winners",
        text: "If two or more players win equally, the prize will be shared among them."
      }
    },
    fair: {
      title: "Fair Play",
      penalty: {
        title: "False BINGO Penalty",
        violation: "Rule Violation",
        text: "Claiming BINGO without a valid winning pattern is considered a violation and may result in penalties.",
        consequences: {
          title: "Consequences:",
          items: [
            "🚫 Immediate removal from current game",
            "💲 Loss of entry fee/stake",
            "⏱ Temporary ban from joining new games"
          ]
        }
      },
      validConditions: {
        title: "✔ Valid BINGO Conditions",
        items: [
          "Complete horizontal line (5 numbers)",
          "Complete vertical line (5 numbers)",
          "Complete diagonal line (5 numbers)",
          "All four corners marked"
        ]
      },
      invalidAttempts: {
        title: "🚫 Invalid BINGO Attempts",
        items: [
          "Incomplete lines or patterns",
          "Random marked numbers",
          "Premature BINGO calls",
          "False pattern claims"
        ]
      },
      proTips: {
        title: "✨ Pro Tips to Avoid Penalties",
        items: [
          "Double-check your pattern before clicking BINGO",
          "Make sure you have exactly 5 numbers in a line",
          "Verify all four corners are marked for corner wins",
          "Take your time — there's no rush to call BINGO",
          "If unsure, wait for more numbers to be called"
        ]
      }
    }
  },
  am: {
    header: {
      title: "የጨዋታ ህጎች"
    },
    tabs: {
      cards: "ካርዶች",
      play: "ጨዋታ",
      prizes: "ሽልማቶች",
      fair: "ፍትሃዊ"
    },
    cards: {
      title: "የምዝገባ መመሪያ",
      steps: [
        { step: 1, title: "ካርድ ይምረጡ", text: "በምዝገባ ወቅት ከ1-200 ያሉትን ማንኛውንም ካርድ ይምረጡ።", color: "green" },
        { step: 2, title: "የካርድ ሁኔታ አመላካች", text: "የማይገኙ ካርዶች በቀይ ይታያሉ። አረንጓዴ ካርዶችን ብቻ ይምረጡ።", color: "red" },
        { step: 3, title: "የካርድ ቅድመ-እይታ", text: "ከማረጋገጥዎ በፊት በካርድዎ ላይ ያሉትን ቁጥሮች ይመልከቱ።", color: "blue" }
      ],
      tips: {
        title: "የካርድ ምርጫ ምክሮች",
        items: [
          "በቀይ ያልተለዩ ካርዶችን ይምረጡ",
          "ከማረጋገጥዎ በፊት ካርድዎን ይመልከቱ",
          "የምዝገባ ጊዜ ከማብቃቱ በፊት በፍጥነት ይምረጡ"
        ]
      },
      timer: {
        title: "የምዝገባ ሰዓት ቆጣሪ",
        text: "ምዝገባ ለአጭር ጊዜ ይቆያል። ሰዓት ቆጣሪው ከማብቃቱ በፊት ካርድዎን ለመምረጥ ዝግጁ ይሁኑ።"
      }
    },
    play: {
      title: "ጨዋታ",
      steps: [
        { step: 1, title: "ወደ ጨዋታ መግባት", text: "ወደ ጨዋታው ስንገባ በመረጥነው የካርድ ቁጥር መሰረት የመጫወቻ ካርድ እናገኛለን።", color: "green" },
        { step: 2, title: "የጨዋታ ሰዓት ቆጣሪ", text: "ጨዋታው ቀሪ ሰከንዶችን በላይኛው ቀኝ በኩል መቁጠር ይጀምራል።", color: "orange" },
        { step: 3, title: "ቁጥሮች መጥራት", text: "ጨዋታው ሲጀምር ከ1 እስከ 75 ያሉ የተለያዩ ቁጥሮችን መጥራት ይጀምራል።", color: "green" },
        { step: 4, title: "ቁጥሮች ምልክት ማድረግ", text: "የተጠራው ቁጥር በመጫወቻ ካርዳችን ውስጥ ካለ በቁጥሩ ላይ ጠቅ በማድረግ መምረጥ እንችላለን።", color: "blue" },
        { step: 5, title: "ቁጥሮች ማስወገድ", text: "የመረጥነውን ቁጥር መሰረዝ ከፈለግን እንደገና በቁጥሩ ላይ ጠቅ በማድረግ መሰረዝ እንችላለን።", color: "yellow" }
      ],
      mechanics: {
        title: "የጨዋታ ስልቶች",
        items: [
          { title: "የቁጥር ክልል", text: "የሚጠሩት ቁጥሮች ከ1 እስከ 75 ናቸው" },
          { title: "ምልክት ማድረግ", text: "ቁጥሮችን ለማመልከት/ለማስወገድ ጠቅ ያድርጉ" },
          { title: "የካርድ አቀማመጥ", text: "5x5 ፍርግርግ ከመሃል ነጻ ቦታ ጋር" },
          { title: "ሰዓት ቆጣሪ", text: "የጨዋታ መጀመሪያ ሰዓትን ያሳያል" }
        ]
      }
    },
    prizes: {
      title: "ሽልማቶች",
      mainRule: {
        title: "ዋና የማሸነፊያ ህግ",
        text: "ቁጥሮች ሲጠሩ ከመጫወቻ ካርዳችን ላይ በአግድም፣ በቋሚ፣ በሰያፍ ወይም በአራቱም ማዕዘኖች በመምረጥ ከታች ያለውን የ BINGO ቁልፍ በመጫን ወዲያውኑ ማሸነፍ እንችላለን።"
      },
      categories: [
        { icon: "→", title: "አግድም", text: "ማንኛውንም አግድም ረድፍ ማጠናቀቅ (5 ቁጥሮች በአንድ መስመር)" },
        { icon: "↓", title: "ቋሚ", text: "ማንኛውንም ቋሚ አምድ ማጠናቀቅ (5 ቁጥሮች በአንድ መስመር)" },
        { icon: "↘", title: "ሰያፍ", text: "ማንኛውንም ሰያፍ መስመር ማጠናቀቅ (5 ቁጥሮች በአንድ መስመር)" },
        { icon: "▶", title: "አራት ማዕዘኖች", text: "የካርዱን አራት ማዕዘን ቁጥሮች ማመልከት" },
        { icon: "▶", title: "አንድ መስመር", text: "በካርዱ ላይ አንድ መስመር ቁጥሮች ማመልከት" }
      ],
      multipleWinners: {
        title: "በርካታ አሸናፊዎች",
        text: "ሁለት ወይም ከዚያ በላይ ተጫዋቾች እኩል ካሸነፉ ሽልማቱ በመካከላቸው ይከፈላል።"
      }
    },
    fair: {
      title: "ፍትሃዊ ጨዋታ",
      penalty: {
        title: "የሐሰት BINGO ቅጣት",
        violation: "የህግ መጣስ",
        text: "ያለ ትክክለኛ የማሸነፊያ ንድፍ BINGO ማወጅ ጥሰት ነው እና ቅጣት ሊያስከትል ይችላል።",
        consequences: {
          title: "ውጤቶች፦",
          items: [
            "🚫 ከአሁኑ ጨዋታ ወዲያውኑ መወገድ",
            "💲 የመግቢያ ክፍያ ማጣት",
            "⏱ አዲስ ጨዋታዎችን ለመቀላቀል ጊዜያዊ እገዳ"
          ]
        }
      },
      validConditions: {
        title: "✔ ትክክለኛ BINGO ሁኔታዎች",
        items: [
          "የተሟላ አግድም መስመር (5 ቁጥሮች)",
          "የተሟላ ቋሚ መስመር (5 ቁጥሮች)",
          "የተሟላ ሰያፍ መስመር (5 ቁጥሮች)",
          "አራቱም ማዕዘኖች ምልክት ተደርጎባቸዋል"
        ]
      },
      invalidAttempts: {
        title: "🚫 የማይሰሩ BINGO ሙከራዎች",
        items: [
          "ያልተሟሉ መስመሮች ወይም ንድፎች",
          "የዘፈቀደ ምልክት የተደረገባቸው ቁጥሮች",
          "ያለጊዜው BINGO መጥራት",
          "የሐሰት ንድፍ የይገባኛል ጥያቄዎች"
        ]
      },
      proTips: {
        title: "✨ ቅጣቶችን ለማስወገድ ጠቃሚ ምክሮች",
        items: [
          "BINGO ከመጫንዎ በፊት ንድፍዎን ሁለቴ ያረጋግጡ",
          "በአንድ መስመር ላይ በትክክል 5 ቁጥሮች መኖራቸውን ያረጋግጡ",
          "ለማዕዘን አሸናፊነት አራቱም ማዕዘኖች ምልክት መደረጉን ያረጋግጡ",
          "ጊዜ ይውሰዱ — BINGO ለመጥራት ምንም ችኮላ የለም",
          "እርግጠኛ ካልሆኑ ተጨማሪ ቁጥሮች እስኪጠሩ ይጠብቁ"
        ]
      }
    }
  }
};

// ========== STEP COLOR STYLES ==========
const stepColors = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500"
};

export default function Rules({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('cards');
  const [language, setLanguage] = useState('en'); // 'en' or 'am'

  const t = content[language];
  const currentTabContent = t[activeTab];

  const renderTabContent = () => {
    if (activeTab === 'cards') {
      return (
        <>
          <motion.h3 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white text-xl font-bold text-center mb-4"
          >
            {t.cards.title}
          </motion.h3>
          
          {t.cards.steps.map((step, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 backdrop-blur rounded-xl p-3 mb-2 flex items-start gap-3"
            >
              <div className={`w-7 h-7 rounded-full ${stepColors[step.color]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {step.step}
              </div>
              <div>
                <div className="text-white text-sm font-semibold mb-0.5">{step.title}</div>
                <p className="text-white/50 text-xs">{step.text}</p>
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-yellow-500/10 backdrop-blur rounded-xl p-3 border border-yellow-500/20 mt-3"
          >
            <div className="text-yellow-400 text-xs font-bold mb-2">{t.cards.tips.title}</div>
            <ul className="space-y-1">
              {t.cards.tips.items.map((item, idx) => (
                <li key={idx} className="text-white/60 text-xs flex items-center gap-2">
                  <span className="text-yellow-400">•</span> {item}
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10 mt-3"
          >
            <div className="text-white/70 text-xs font-bold mb-1">{t.cards.timer.title}</div>
            <p className="text-white/40 text-[11px]">{t.cards.timer.text}</p>
          </motion.section>
        </>
      );
    }

    if (activeTab === 'play') {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg mb-2">
              <span className="text-3xl">▶</span>
            </div>
            <h3 className="text-white text-xl font-bold">{t.play.title}</h3>
          </div>

          {t.play.steps.map((step, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 backdrop-blur rounded-xl p-3 mb-2 flex items-start gap-3"
            >
              <div className={`w-7 h-7 rounded-full ${stepColors[step.color]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {step.step}
              </div>
              <div>
                <div className="text-white text-sm font-semibold mb-0.5">{step.title}</div>
                <p className="text-white/50 text-xs">{step.text}</p>
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-cyan-500/10 backdrop-blur rounded-xl p-3 border border-cyan-500/20 mt-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 text-sm">⊞</span>
              <div className="text-cyan-400 text-xs font-bold">{t.play.mechanics.title}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {t.play.mechanics.items.map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-white text-xs font-semibold">{item.title}</div>
                  <p className="text-white/40 text-[9px]">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.section>
        </>
      );
    }

    if (activeTab === 'prizes') {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg mb-2">
              <span className="text-3xl">🏆</span>
            </div>
            <h3 className="text-white text-xl font-bold">{t.prizes.title}</h3>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-500/10 backdrop-blur rounded-xl p-3 border border-amber-500/20 mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400 text-sm">⭐</span>
              <div className="text-yellow-400 text-xs font-bold">{t.prizes.mainRule.title}</div>
            </div>
            <p className="text-white/60 text-xs leading-relaxed">
              {t.prizes.mainRule.text} <span className="text-yellow-400 font-bold">BINGO</span>
            </p>
          </motion.section>

          {t.prizes.categories.map((cat, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10 mb-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-white text-sm">{cat.icon}</span>
                </div>
                <div className="text-white text-sm font-semibold">{cat.title}</div>
              </div>
              <p className="text-white/40 text-[11px] ml-8">{cat.text}</p>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-teal-500/10 backdrop-blur rounded-xl p-3 border border-teal-500/20 mt-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-teal-400 text-sm">👥</span>
              <div className="text-teal-400 text-xs font-bold">{t.prizes.multipleWinners.title}</div>
            </div>
            <p className="text-white/40 text-[11px] ml-8">{t.prizes.multipleWinners.text}</p>
          </motion.section>
        </>
      );
    }

    if (activeTab === 'fair') {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center shadow-lg mb-2">
              <span className="text-3xl">🚫</span>
            </div>
            <h3 className="text-white text-xl font-bold">{t.fair.title}</h3>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-500/10 backdrop-blur rounded-xl p-3 border border-red-500/20 mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 text-sm">⚠</span>
              <div className="text-red-400 text-xs font-bold">{t.fair.penalty.title}</div>
            </div>
            <div className="text-white/60 text-xs font-semibold mb-1">{t.fair.penalty.violation}</div>
            <p className="text-white/40 text-[11px] mb-2">{t.fair.penalty.text}</p>
            <div className="bg-red-500/5 rounded-lg p-2">
              <div className="text-red-400 text-[10px] font-semibold mb-1">{t.fair.penalty.consequences.title}</div>
              <ul className="space-y-0.5">
                {t.fair.penalty.consequences.items.map((item, idx) => (
                  <li key={idx} className="text-white/40 text-[9px]">{item}</li>
                ))}
              </ul>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-green-500/10 backdrop-blur rounded-xl p-3 border border-green-500/20 mb-2"
          >
            <div className="text-green-400 text-xs font-bold mb-2">{t.fair.validConditions.title}</div>
            <ul className="space-y-1">
              {t.fair.validConditions.items.map((item, idx) => (
                <li key={idx} className="text-white/40 text-[10px] flex items-center gap-2">
                  <span className="text-green-400">✓</span> {item}
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-red-500/10 backdrop-blur rounded-xl p-3 border border-red-500/20 mb-2"
          >
            <div className="text-red-400 text-xs font-bold mb-2">{t.fair.invalidAttempts.title}</div>
            <ul className="space-y-1">
              {t.fair.invalidAttempts.items.map((item, idx) => (
                <li key={idx} className="text-white/40 text-[10px] flex items-center gap-2">
                  <span className="text-red-400">✗</span> {item}
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-blue-500/10 backdrop-blur rounded-xl p-3 border border-blue-500/20"
          >
            <div className="text-blue-400 text-xs font-bold mb-2">{t.fair.proTips.title}</div>
            <ul className="space-y-1">
              {t.fair.proTips.items.map((item, idx) => (
                <li key={idx} className="text-white/40 text-[10px] flex items-start gap-2">
                  <span className="text-blue-400">✨</span> {item}
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md pt-safe px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={() => onNavigate?.('game')}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          >
            <FaArrowLeft size={14} />
          </button>
          
          <h2 className="text-white font-bold text-sm">{t.header.title}</h2>
          
          <button
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/70 text-[10px] font-medium hover:bg-white/20 transition-all"
          >
            <FaLanguage size={10} />
            {language === 'en' ? 'አማርኛ' : 'English'}
          </button>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* Tab Bar */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-1 mb-4">
          <div className="flex gap-1">
            {Object.keys(t.tabs).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white/20 text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full transition-all duration-300"
            style={{ 
              width: activeTab === 'cards' ? '25%' : 
                     activeTab === 'play' ? '50%' : 
                     activeTab === 'prizes' ? '75%' : '100%' 
            }}
          />
        </div>

        {/* Tab Content */}
        <div className="space-y-2">
          {renderTabContent()}
        </div>
      </main>

      <BottomNav current="game" onNavigate={onNavigate} />
    </div>
  );
}