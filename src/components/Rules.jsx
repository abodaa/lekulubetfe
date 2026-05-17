import React, { useState } from "react";
import BottomNav from "./BottomNav";
import { motion } from "framer-motion";
import {
  FaLanguage,
  FaArrowLeft,
  FaGamepad,
  FaTrophy,
  FaGavel,
  FaRegGem,
  FaDiceD6,
  FaClock,
  FaEye,
  FaMousePointer,
  FaRegCheckCircle,
  FaRegTimesCircle,
  FaRegLightbulb,
  FaUsers,
  FaCrown,
  FaRegStar,
  FaRegHeart,
} from "react-icons/fa";
import {
  GiCardDraw,
  GiPlayButton,
  GiConfirmed,
  GiCancel,
} from "react-icons/gi";
import {
  MdEmojiEvents,
  MdOutlineRule,
  MdOutlineTipsAndUpdates,
} from "react-icons/md";
import { BiGlobe } from "react-icons/bi";

// ========== CONTENT STORAGE ==========
const content = {
  am: {
    header: {
      title: "የጨዋታ ህጎች",
    },
    tabs: {
      cards: "ካርዶች",
      play: "ጨዋታ",
      prizes: "ሽልማቶች",
      fair: "ፍትሃዊ",
    },
    cards: {
      title: "የካርድ ምርጫ መመሪያ",
      steps: [
        {
          step: 1,
          title: "ካርድ ይምረጡ",
          text: "በምዝገባ ወቅት ከ1-200 ያሉትን ማንኛውንም ካርድ ይምረጡ።",
          icon: <GiCardDraw size={16} />,
          color: "emerald",
        },
        {
          step: 2,
          title: "የካርድ ሁኔታ",
          text: "የማይገኙ ካርዶች በቀይ ይታያሉ። አረንጓዴ ካርዶችን ብቻ ይምረጡ።",
          icon: <FaEye size={16} />,
          color: "red",
        },
        {
          step: 3,
          title: "ቅድመ-እይታ",
          text: "ከማረጋገጥዎ በፊት በካርድዎ ላይ ያሉትን ቁጥሮች ይመልከቱ።",
          icon: <FaRegStar size={16} />,
          color: "blue",
        },
      ],
      tips: {
        title: "ምክሮች",
        icon: <MdOutlineTipsAndUpdates size={14} />,
        items: [
          "በቀይ ያልተለዩ ካርዶችን ይምረጡ",
          "ከማረጋገጥዎ በፊት ካርድዎን ይመልከቱ",
          "የምዝገባ ጊዜ ከማብቃቱ በፊት በፍጥነት ይምረጡ",
        ],
      },
      timer: {
        title: "የምዝገባ ሰዓት ቆጣሪ",
        text: "ምዝገባ ለአጭር ጊዜ ይቆያል። ሰዓት ቆጣሪው ከማብቃቱ በፊት ካርድዎን ለመምረጥ ዝግጁ ይሁኑ።",
      },
    },
    play: {
      title: "ጨዋታ",
      steps: [
        {
          step: 1,
          title: "ወደ ጨዋታ መግባት",
          text: "ወደ ጨዋታው ስንገባ በመረጥነው የካርድ ቁጥር መሰረት የመጫወቻ ካርድ እናገኛለን።",
          icon: <GiPlayButton size={14} />,
          color: "emerald",
        },
        {
          step: 2,
          title: "የጨዋታ ሰዓት ቆጣሪ",
          text: "ጨዋታው ቀሪ ሰከንዶችን በላይኛው ቀኝ በኩል መቁጠር ይጀምራል።",
          icon: <FaClock size={14} />,
          color: "orange",
        },
        {
          step: 3,
          title: "ቁጥሮች መጥራት",
          text: "ጨዋታው ሲጀምር ከ1 እስከ 75 ያሉ የተለያዩ ቁጥሮችን መጥራት ይጀምራል።",
          icon: <FaDiceD6 size={14} />,
          color: "emerald",
        },
        {
          step: 4,
          title: "ቁጥሮች ምልክት ማድረግ",
          text: "የተጠራው ቁጥር በመጫወቻ ካርዳችን ውስጥ ካለ በቁጥሩ ላይ ጠቅ በማድረግ መምረጥ እንችላለን።",
          icon: <FaMousePointer size={14} />,
          color: "blue",
        },
        {
          step: 5,
          title: "ቁጥሮች ማስወገድ",
          text: "የመረጥነውን ቁጥር መሰረዝ ከፈለግን እንደገና በቁጥሩ ላይ ጠቅ በማድረግ መሰረዝ እንችላለን።",
          icon: <GiCancel size={14} />,
          color: "yellow",
        },
      ],
      mechanics: {
        title: "የጨዋታ ስልቶች",
        icon: <FaGamepad size={14} />,
        items: [
          { title: "የቁጥር ክልል", text: "ከ1 እስከ 75" },
          { title: "ምልክት ማድረግ", text: "ጠቅ ያድርጉ" },
          { title: "ካርድ አቀማመጥ", text: "5x5 ፍርግርግ" },
          { title: "ሰዓት ቆጣሪ", text: "ቆጠራ ያሳያል" },
        ],
      },
    },
    prizes: {
      title: "ሽልማቶች",
      mainRule: {
        title: "የማሸነፊያ ዘዴ",
        icon: <FaCrown size={16} />,
        text: "ቁጥሮች ሲጠሩ ከመጫወቻ ካርዳችን ላይ በአግድም፣ በቋሚ፣ በሰያፍ ወይም በአራቱም ማዕዘኖች በመምረጥ ከታች ያለውን የ BINGO ቁልፍ በመጫን ወዲያውኑ ማሸነፍ እንችላለን።",
      },
      categories: [
        { icon: "➡️", title: "አግድም", text: "ማንኛውንም አግድም ረድፍ ማጠናቀቅ" },
        { icon: "⬇️", title: "ቋሚ", text: "ማንኛውንም ቋሚ አምድ ማጠናቀቅ" },
        { icon: "↘️", title: "ሰያፍ", text: "ማንኛውንም ሰያፍ መስመር ማጠናቀቅ" },
        { icon: "🔲", title: "አራት ማዕዘኖች", text: "የካርዱን አራት ማዕዘን ቁጥሮች ማመልከት" },
        { icon: "📏", title: "አንድ መስመር", text: "በካርዱ ላይ አንድ መስመር ቁጥሮች ማመልከት" },
      ],
      multipleWinners: {
        title: "በርካታ አሸናፊዎች",
        icon: <FaUsers size={14} />,
        text: "ሁለት ወይም ከዚያ በላይ ተጫዋቾች እኩል ካሸነፉ ሽልማቱ በመካከላቸው ይከፈላል።",
      },
    },
    fair: {
      title: "ፍትሃዊ ጨዋታ",
      penalty: {
        title: "የሐሰት BINGO ቅጣት",
        icon: <FaGavel size={16} />,
        violation: "የህግ መጣስ",
        text: "ያለ ትክክለኛ የማሸነፊያ ንድፍ BINGO ማወጅ ጥሰት ነው እና ቅጣት ሊያስከትል ይችላል።",
        consequences: {
          title: "ውጤቶች፦",
          items: ["🚫 ከአሁኑ ጨዋታ መወገድ", "💲 የመግቢያ ክፍያ ማጣት", "⏱ ጊዜያዊ እገዳ"],
        },
      },
      validConditions: {
        title: "ትክክለኛ BINGO",
        icon: <FaRegCheckCircle size={14} />,
        items: [
          "የተሟላ አግድም መስመር",
          "የተሟላ ቋሚ መስመር",
          "የተሟላ ሰያፍ መስመር",
          "አራቱም ማዕዘኖች ምልክት ተደርጎባቸዋል",
        ],
      },
      invalidAttempts: {
        title: "የማይሰሩ ሙከራዎች",
        icon: <FaRegTimesCircle size={14} />,
        items: [
          "ያልተሟሉ መስመሮች",
          "የዘፈቀደ ምልክቶች",
          "ያለጊዜው BINGO መጥራት",
          "የሐሰት ንድፍ የይገባኛል ጥያቄዎች",
        ],
      },
      proTips: {
        title: "ምክሮች",
        icon: <FaRegLightbulb size={14} />,
        items: [
          "BINGO ከመጫንዎ በፊት ንድፍዎን ያረጋግጡ",
          "በአንድ መስመር ላይ 5 ቁጥሮች መኖራቸውን ያረጋግጡ",
          "አራቱም ማዕዘኖች ምልክት መደረጉን ያረጋግጡ",
          "ጊዜ ይውሰዱ — ምንም ችኮላ የለም",
          "እርግጠኛ ካልሆኑ ይጠብቁ",
        ],
      },
    },
  },
  en: {
    header: {
      title: "Game Rules",
    },
    tabs: {
      cards: "Cards",
      play: "Play",
      prizes: "Prizes",
      fair: "Fair",
    },
    cards: {
      title: "Card Selection Guide",
      steps: [
        {
          step: 1,
          title: "Choose Your Card",
          text: "Pick any available card from 1-200 during registration.",
          icon: <GiCardDraw size={16} />,
          color: "emerald",
        },
        {
          step: 2,
          title: "Card Status",
          text: "Unavailable cards are marked in red. Select only green cards.",
          icon: <FaEye size={16} />,
          color: "red",
        },
        {
          step: 3,
          title: "Card Preview",
          text: "Preview the numbers on your card before confirming.",
          icon: <FaRegStar size={16} />,
          color: "blue",
        },
      ],
      tips: {
        title: "Tips",
        icon: <MdOutlineTipsAndUpdates size={14} />,
        items: [
          "Choose cards that are not marked in red",
          "Preview your card before confirming",
          "Select quickly before registration time ends",
        ],
      },
      timer: {
        title: "Registration Timer",
        text: "Registration lasts a short time. Be ready to choose your card before the timer runs out.",
      },
    },
    play: {
      title: "Gameplay",
      steps: [
        {
          step: 1,
          title: "Game Entry",
          text: "When you enter the game, you receive a playing card based on your selection.",
          icon: <GiPlayButton size={14} />,
          color: "emerald",
        },
        {
          step: 2,
          title: "Game Timer",
          text: "The game counts down the remaining seconds at the top right.",
          icon: <FaClock size={14} />,
          color: "orange",
        },
        {
          step: 3,
          title: "Number Calling",
          text: "Numbers from 1 to 75 are called randomly.",
          icon: <FaDiceD6 size={14} />,
          color: "emerald",
        },
        {
          step: 4,
          title: "Marking Numbers",
          text: "Click on called numbers to mark them on your card.",
          icon: <FaMousePointer size={14} />,
          color: "blue",
        },
        {
          step: 5,
          title: "Unmarking Numbers",
          text: "Click again to unmark a number if needed.",
          icon: <GiCancel size={14} />,
          color: "yellow",
        },
      ],
      mechanics: {
        title: "Game Mechanics",
        icon: <FaGamepad size={14} />,
        items: [
          { title: "Number Range", text: "1 to 75" },
          { title: "Marking", text: "Click to mark" },
          { title: "Card Layout", text: "5x5 Grid" },
          { title: "Timer", text: "Shows countdown" },
        ],
      },
    },
    prizes: {
      title: "Prizes",
      mainRule: {
        title: "Winning Pattern",
        icon: <FaCrown size={16} />,
        text: "Complete a horizontal row, vertical column, diagonal line, or all four corners, then press the BINGO button to win instantly.",
      },
      categories: [
        {
          icon: "➡️",
          title: "Horizontal",
          text: "Complete any horizontal row",
        },
        { icon: "⬇️", title: "Vertical", text: "Complete any vertical column" },
        { icon: "↘️", title: "Diagonal", text: "Complete any diagonal line" },
        {
          icon: "🔲",
          title: "Four Corners",
          text: "Mark all four corner numbers",
        },
        { icon: "📏", title: "One Line", text: "Mark any one line of numbers" },
      ],
      multipleWinners: {
        title: "Multiple Winners",
        icon: <FaUsers size={14} />,
        text: "If multiple players win, the prize is shared equally among them.",
      },
    },
    fair: {
      title: "Fair Play",
      penalty: {
        title: "False BINGO Penalty",
        icon: <FaGavel size={16} />,
        violation: "Rule Violation",
        text: "Claiming BINGO without a valid winning pattern is a violation and may result in penalties.",
        consequences: {
          title: "Consequences:",
          items: [
            "🚫 Removed from current game",
            "💲 Loss of entry fee",
            "⏱ Temporary ban from joining",
          ],
        },
      },
      validConditions: {
        title: "Valid BINGO",
        icon: <FaRegCheckCircle size={14} />,
        items: [
          "Complete horizontal row",
          "Complete vertical column",
          "Complete diagonal line",
          "All four corners marked",
        ],
      },
      invalidAttempts: {
        title: "Invalid Attempts",
        icon: <FaRegTimesCircle size={14} />,
        items: [
          "Incomplete lines",
          "Random markings",
          "Premature BINGO calls",
          "False pattern claims",
        ],
      },
      proTips: {
        title: "Pro Tips",
        icon: <FaRegLightbulb size={14} />,
        items: [
          "Double-check before clicking BINGO",
          "Ensure exactly 5 numbers in a line",
          "Verify all four corners for corner wins",
          "Take your time — no rush",
          "Wait for more numbers if unsure",
        ],
      },
    },
  },
};

// ========== STEP COLOR STYLES ==========
const stepColors = {
  emerald: "from-emerald-500 to-green-600",
  red: "from-red-500 to-rose-600",
  blue: "from-blue-500 to-indigo-600",
  orange: "from-orange-500 to-amber-600",
  yellow: "from-yellow-500 to-amber-500",
};

export default function Rules({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("cards");
  const [language, setLanguage] = useState("am"); // Amharic as default

  const t = content[language];
  const currentTabContent = t[activeTab];

  const renderTabContent = () => {
    if (activeTab === "cards") {
      return (
        <>
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white text-lg font-bold text-center mb-4"
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
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${stepColors[step.color]} flex items-center justify-center text-white flex-shrink-0 shadow-lg`}
              >
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-semibold mb-0.5">
                  {step.title}
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  {step.text}
                </p>
              </div>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs font-bold">
                {step.step}
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 backdrop-blur rounded-xl p-3 border border-yellow-500/20 mt-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                {t.cards.tips.icon}
              </div>
              <div className="text-yellow-400 text-xs font-bold">
                {t.cards.tips.title}
              </div>
            </div>
            <ul className="space-y-1">
              {t.cards.tips.items.map((item, idx) => (
                <li
                  key={idx}
                  className="text-white/50 text-xs flex items-center gap-2"
                >
                  <span className="text-yellow-400">✦</span> {item}
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
            <div className="flex items-center gap-2 mb-1">
              <FaClock className="text-white/40" size={12} />
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                {t.cards.timer.title}
              </div>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              {t.cards.timer.text}
            </p>
          </motion.section>
        </>
      );
    }

    if (activeTab === "play") {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg mb-2">
              <FaGamepad className="text-white text-2xl" />
            </div>
            <h3 className="text-white text-lg font-bold">{t.play.title}</h3>
          </div>

          {t.play.steps.map((step, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 backdrop-blur rounded-xl p-3 mb-2 flex items-start gap-3"
            >
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${stepColors[step.color]} flex items-center justify-center text-white flex-shrink-0 shadow-lg`}
              >
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-semibold mb-0.5">
                  {step.title}
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  {step.text}
                </p>
              </div>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs font-bold">
                {step.step}
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur rounded-xl p-3 border border-cyan-500/20 mt-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                {t.play.mechanics.icon}
              </div>
              <div className="text-cyan-400 text-xs font-bold">
                {t.play.mechanics.title}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {t.play.mechanics.items.map((item, idx) => (
                <div
                  key={idx}
                  className="text-center bg-white/5 rounded-lg p-2"
                >
                  <div className="text-white text-xs font-semibold">
                    {item.title}
                  </div>
                  <p className="text-white/50 text-xs">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.section>
        </>
      );
    }

    if (activeTab === "prizes") {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg mb-2">
              <FaTrophy className="text-white text-2xl" />
            </div>
            <h3 className="text-white text-lg font-bold">{t.prizes.title}</h3>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 backdrop-blur rounded-xl p-3 border border-amber-500/20 mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                {t.prizes.mainRule.icon}
              </div>
              <div className="text-amber-400 text-xs font-bold">
                {t.prizes.mainRule.title}
              </div>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              {t.prizes.mainRule.text}{" "}
              <span className="text-yellow-400 font-bold">BINGO</span>
            </p>
          </motion.section>

          <div className="grid grid-cols-1 gap-2 mb-3">
            {t.prizes.categories.map((cat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 backdrop-blur rounded-xl p-2 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-white text-sm">
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <div className="text-white text-xs font-semibold">
                    {cat.title}
                  </div>
                  <p className="text-white/50 text-xs">{cat.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 backdrop-blur rounded-xl p-3 border border-teal-500/20"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                {t.prizes.multipleWinners.icon}
              </div>
              <div className="text-teal-400 text-xs font-bold">
                {t.prizes.multipleWinners.title}
              </div>
            </div>
            <p className="text-white/40 text-xs ml-8">
              {t.prizes.multipleWinners.text}
            </p>
          </motion.section>
        </>
      );
    }

    if (activeTab === "fair") {
      return (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg mb-2">
              <FaGavel className="text-white text-2xl" />
            </div>
            <h3 className="text-white text-lg font-bold">{t.fair.title}</h3>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-r from-red-500/10 to-rose-500/10 backdrop-blur rounded-xl p-3 border border-red-500/20 mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                {t.fair.penalty.icon}
              </div>
              <div className="text-red-400 text-xs font-bold">
                {t.fair.penalty.title}
              </div>
            </div>
            <div className="text-white/60 text-xs font-semibold mb-1">
              {t.fair.penalty.violation}
            </div>
            <p className="text-white/40 text-xs mb-2 leading-relaxed">
              {t.fair.penalty.text}
            </p>
            <div className="bg-red-500/5 rounded-lg p-2">
              <div className="text-red-400 text-xs font-semibold mb-1">
                {t.fair.penalty.consequences.title}
              </div>
              <ul className="space-y-0.5">
                {t.fair.penalty.consequences.items.map((item, idx) => (
                  <li key={idx} className="text-white/40 text-xs">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur rounded-xl p-2 border border-green-500/20"
            >
              <div className="flex items-center gap-1 mb-1">
                {t.fair.validConditions.icon}
                <div className="text-green-400 text-xs font-bold">
                  {t.fair.validConditions.title}
                </div>
              </div>
              <ul className="space-y-0.5">
                {t.fair.validConditions.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-white/50 text-xs flex items-center gap-1"
                  >
                    <span className="text-green-400">✓</span> {item}
                  </li>
                ))}
              </ul>
            </motion.section>

            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-red-500/10 to-rose-500/10 backdrop-blur rounded-xl p-2 border border-red-500/20"
            >
              <div className="flex items-center gap-1 mb-1">
                {t.fair.invalidAttempts.icon}
                <div className="text-red-400 text-xs font-bold">
                  {t.fair.invalidAttempts.title}
                </div>
              </div>
              <ul className="space-y-0.5">
                {t.fair.invalidAttempts.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-white/50 text-xs flex items-center gap-1"
                  >
                    <span className="text-red-400">✗</span> {item}
                  </li>
                ))}
              </ul>
            </motion.section>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur rounded-xl p-3 border border-blue-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                {t.fair.proTips.icon}
              </div>
              <div className="text-blue-400 text-xs font-bold">
                {t.fair.proTips.title}
              </div>
            </div>
            <ul className="space-y-1">
              {t.fair.proTips.items.map((item, idx) => (
                <li
                  key={idx}
                  className="text-white/40 text-xs flex items-start gap-2"
                >
                  <span className="text-blue-400 text-xs">✦</span> {item}
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
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={() => onNavigate?.("game")}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
          >
            <FaArrowLeft size={14} />
          </button>

          <h2 className="text-white font-bold text-sm tracking-wide">
            {t.header.title}
          </h2>

          <button
            onClick={() => setLanguage(language === "am" ? "en" : "am")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/50 text-white/70 text-sm font-medium hover:text-white hover:bg-white/20 transition-all"
          >
            <BiGlobe size={12} />
            {language === "am" ? "English" : "አማርኛ"}
          </button>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* Tab Bar - Modern Pill Design */}
        <div className="bg-white/5 backdrop-blur rounded-full p-1 mb-6 shadow-lg">
          <div className="flex gap-1">
            {Object.keys(t.tabs).map((tab) => {
              const tabIcons = {
                cards: <FaRegGem size={12} />,
                play: <FaGamepad size={12} />,
                prizes: <MdEmojiEvents size={12} />,
                fair: <MdOutlineRule size={12} />,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-all ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-white/50 hover:text-white/60"
                  }`}
                >
                  {tabIcons[tab]}
                  {t.tabs[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-2">{renderTabContent()}</div>
      </main>

      <BottomNav current="game" onNavigate={onNavigate} />
    </div>
  );
}
