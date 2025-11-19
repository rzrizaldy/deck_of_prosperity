import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { 
  Coins, 
  TrendingUp, 
  Briefcase, 
  Building2, 
  Zap, 
  Trophy, 
  Skull, 
  ShoppingCart, 
  Play, 
  RefreshCw,
  ArrowRight,
  Train,
  Lightbulb,
  Home
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- UTILS ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- CONSTANTS ---

const CARD_COLORS = {
  BROWN: { name: 'Brown', color: 'bg-amber-900', border: 'border-amber-900', text: 'text-amber-900', count: 2, value: 10 },
  SKY: { name: 'Sky', color: 'bg-sky-400', border: 'border-sky-400', text: 'text-sky-400', count: 3, value: 15 },
  PINK: { name: 'Pink', color: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', count: 3, value: 20 },
  ORANGE: { name: 'Orange', color: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', count: 3, value: 25 },
  RED: { name: 'Red', color: 'bg-red-600', border: 'border-red-600', text: 'text-red-600', count: 3, value: 30 },
  YELLOW: { name: 'Yellow', color: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400', count: 3, value: 35 },
  GREEN: { name: 'Green', color: 'bg-green-600', border: 'border-green-600', text: 'text-green-600', count: 3, value: 40 },
  BLUE: { name: 'Blue', color: 'bg-blue-800', border: 'border-blue-800', text: 'text-blue-800', count: 2, value: 50 },
  RAILROAD: { name: 'Railroad', color: 'bg-neutral-950', border: 'border-neutral-950', text: 'text-neutral-950', count: 4, value: 25 },
  UTILITY: { name: 'Utility', color: 'bg-neutral-500', border: 'border-neutral-500', text: 'text-neutral-500', count: 2, value: 20 },
};

const TYCOONS = [
  { id: 't_red_chip', name: 'Red Baron', desc: '+15 Chips for every Red Property', cost: 5, type: 'chip_add', condition: { color: 'RED', value: 15 } },
  { id: 't_rail_mult', name: 'Tycoon Train', desc: '+4 Mult for every Railroad', cost: 6, type: 'mult_add', condition: { color: 'RAILROAD', value: 4 } },
  { id: 't_solo_xmult', name: 'Lone Wolf', desc: 'x1.5 Mult if hand has exactly 1 card', cost: 8, type: 'x_mult', condition: { count: 1, value: 1.5 } },
  { id: 't_all_chip', name: 'Diversifier', desc: '+50 Chips if hand has 5 colors', cost: 7, type: 'chip_bonus', condition: { type: 'DIVERSIFIED', value: 50 } },
  { id: 't_blue_mult', name: 'Blue Chip', desc: '+10 Mult for every Blue Property', cost: 7, type: 'mult_add', condition: { color: 'BLUE', value: 10 } },
  { id: 't_util_xmult', name: 'Power Player', desc: 'x1.2 Mult for every Utility', cost: 6, type: 'x_mult_per', condition: { color: 'UTILITY', value: 1.2 } },
  { id: 't_interest', name: 'Banker', desc: 'Interest cap raised to $10', cost: 5, type: 'passive', condition: { effect: 'interest_cap', value: 10 } },
  { id: 't_discount', name: 'Insider', desc: 'Shop prices 20% off', cost: 6, type: 'passive', condition: { effect: 'shop_discount', value: 0.8 } },
];

const BASE_DECK = [
  // Brown (2) - Regional Hubs
  { id: 'br1', name: 'Medan', value: 5, color: 'BROWN' }, 
  { id: 'br2', name: 'Palembang', value: 5, color: 'BROWN' },

  // Sky (3) - Java Cities
  { id: 'sk1', name: 'Bandung', value: 10, color: 'SKY' }, 
  { id: 'sk2', name: 'Bogor', value: 10, color: 'SKY' }, 
  { id: 'sk3', name: 'Semarang', value: 10, color: 'SKY' },

  // Pink (3) - Cultural Heritage
  { id: 'pk1', name: 'Yogyakarta', value: 15, color: 'PINK' }, 
  { id: 'pk2', name: 'Solo', value: 15, color: 'PINK' }, 
  { id: 'pk3', name: 'Surabaya', value: 15, color: 'PINK' },

  // Orange (3) - Bali Tourism
  { id: 'or1', name: 'Kuta Beach', value: 20, color: 'ORANGE' }, 
  { id: 'or2', name: 'Ubud', value: 20, color: 'ORANGE' }, 
  { id: 'or3', name: 'Seminyak', value: 20, color: 'ORANGE' },

  // Red (3) - Major Islands (Kalimantan/Sulawesi)
  { id: 'rd1', name: 'Balikpapan', value: 25, color: 'RED' }, 
  { id: 'rd2', name: 'Makassar', value: 25, color: 'RED' }, 
  { id: 'rd3', name: 'Manado', value: 25, color: 'RED' },

  // Yellow (3) - Jakarta Lifestyle
  { id: 'yl1', name: 'Kemang', value: 30, color: 'YELLOW' }, 
  { id: 'yl2', name: 'Senopati', value: 30, color: 'YELLOW' }, 
  { id: 'yl3', name: 'Pondok Indah', value: 30, color: 'YELLOW' },

  // Green (3) - Golden Triangle (Business)
  { id: 'gr1', name: 'Kuningan', value: 35, color: 'GREEN' }, 
  { id: 'gr2', name: 'Sudirman', value: 35, color: 'GREEN' }, 
  { id: 'gr3', name: 'Thamrin', value: 35, color: 'GREEN' },

  // Blue (2) - The Elite
  { id: 'bl1', name: 'Menteng', value: 50, color: 'BLUE' }, 
  { id: 'bl2', name: 'SCBD', value: 50, color: 'BLUE' },

  // Rails (4) - Transport Infrastructure
  { id: 'rr1', name: 'Gambir Stn', value: 20, color: 'RAILROAD' }, 
  { id: 'rr2', name: 'Soetta Airport', value: 20, color: 'RAILROAD' }, 
  { id: 'rr3', name: 'MRT Jakarta', value: 20, color: 'RAILROAD' }, 
  { id: 'rr4', name: 'Kereta Cepat', value: 20, color: 'RAILROAD' },

  // Utils (2) - Infrastructure
  { id: 'ut1', name: 'PLN (Power)', value: 15, color: 'UTILITY' }, 
  { id: 'ut2', name: 'PDAM (Water)', value: 15, color: 'UTILITY' },
];

const HAND_TYPES = {
  LIQUIDATION: { name: 'Liquidation', mult: 1, desc: 'No matching colors. Just selling assets.' },
  DEVELOPMENT: { name: 'Development', mult: 2, desc: '2 cards of the same color (e.g., 2 Reds).' }, // Dynamic mult: Color Mult x 1
  JOINT_VENTURE: { name: 'Joint Venture', mult: 4, desc: 'Two separate pairs (e.g., 2 Greens + 2 Rails).' },
  MONOPOLY: { name: 'Monopoly', mult: 4, desc: 'A complete color set (e.g., 3 Reds or 2 Blues).' }, // Dynamic mult: Color Mult x 2
  CONGLOMERATE: { name: 'Conglomerate', mult: 6, desc: 'A Full Set (Monopoly) + A Partial Set (Development).' }, // Dynamic mult: Color Mult x 3
  DIVERSIFIED: { name: 'Diversified Portfolio', mult: 8, desc: '5 cards of 5 completely different colors.' },
  TRANSPORT: { name: 'Transport Network', mult: 12, desc: 'All 4 Railroad cards.' },
};

// --- LOGIC ---

const generateDeck = () => {
  // BASE_DECK contains unique cards. To make a full deck we might need duplicates or just use the base deck.
  // The previous implementation generated cards based on counts. 
  // The prompt implies a "deck" but BASE_DECK has 32 cards. Balatro usually has 52.
  // Let's duplicate the BASE_DECK to make ~64 cards for better draw probability or just use it as is?
  // The prompt says "The deck... consists of ~40 cards". BASE_DECK has 32.
  // Let's add a few more duplicates of common low value cards (Brown, Sky) to reach ~40 or just use 32.
  // Let's use the BASE_DECK as the pool. To make it replayable, let's perhaps duplicate the entire set?
  // Or just use the unique set. 32 cards is small for 8 card hands (4 hands = 32 cards).
  // That means you draw the ENTIRE deck every round.
  // Let's duplicate the deck 2x to have 64 cards, allowing for variance.
  // OR just duplicate commons.
  // For simplicity and "Deckbuilder" feel, let's start with 1 copy of each (32 cards) + duplicate RAILROADS and UTILITIES and LOW tiers.
  
  let deck = [];
  let idCounter = 0;

  const addCard = (template) => {
      const colorDef = CARD_COLORS[template.color];
      deck.push({
        ...template,
        id: `card_${idCounter++}_${template.id}`,
        colorKey: template.color,
        ...colorDef, // Merge style props
        name: template.name, // Keep specific name
        value: template.value
      });
  };

  // Add all cards once
  BASE_DECK.forEach(c => addCard(c));

  // Add duplicates for variation (optional, but recommended for 4 hands of 8 cards = 32 cards needed minimum)
  // If we have exactly 32 cards, we have 0 variance in total deck composition per round.
  // Let's add a second copy of "Regional Hubs" (Brown) and "Java Cities" (Sky) and "Railroads" to pad it.
  BASE_DECK.filter(c => ['BROWN', 'SKY', 'RAILROAD'].includes(c.color)).forEach(c => addCard(c));

  return deck.sort(() => Math.random() - 0.5);
};

const calculateScore = (selectedCards, tycoons) => {
  if (selectedCards.length === 0) return { chips: 0, mult: 0, total: 0, handName: 'Empty' };

  let chips = selectedCards.reduce((sum, card) => sum + card.value, 0);
  let mult = 1;
  let handType = HAND_TYPES.LIQUIDATION;

  // Determine Hand Type
  const colorCounts = {};
  let railroadCount = 0;

  selectedCards.forEach(c => {
    colorCounts[c.colorKey] = (colorCounts[c.colorKey] || 0) + 1;
    if (c.colorKey === 'RAILROAD') railroadCount++;
  });
  
  const distinctColors = Object.keys(colorCounts).length;
  const hasMonopoly = Object.entries(colorCounts).some(([key, count]) => count >= CARD_COLORS[key].count);
  const hasPartial = Object.values(colorCounts).some(count => count >= 2);
  const pairsCount = Object.values(colorCounts).filter(count => count >= 2).length;

  if (railroadCount >= 4) {
    handType = HAND_TYPES.TRANSPORT;
  } else if (distinctColors >= 5) {
    handType = HAND_TYPES.DIVERSIFIED;
  } else if (hasMonopoly && hasPartial && !Object.entries(colorCounts).find(([key, count]) => count >= CARD_COLORS[key].count && count === selectedCards.length)) {
     // Conglomerate: Full Set + Partial Set. 
     // Note: Monopoly logic above returns true if ANY monopoly exists. 
     // We need to ensure we have extra cards forming at least a partial.
     // Actually Conglomerate is specific: Full Set + Partial.
     // Simple check: hasMonopoly AND hasPartial? 
     // If I have 3 Reds (Monopoly) and 2 Greens (Partial), that is Conglomerate.
     // If I have just 3 Reds, hasPartial is TRUE (3 >= 2). 
     // So strict check: Count of monopoly color cards + Count of partial color cards == total? Or just existence?
     // Let's assume existence.
     // Wait, if I have 3 Reds, hasPartial is true. distinctColors = 1.
     // Conglomerate implies at least 2 colors? Usually Full House is 3+2.
     if (distinctColors >= 2) handType = HAND_TYPES.CONGLOMERATE;
     else handType = HAND_TYPES.MONOPOLY;
  } else if (hasMonopoly) {
    handType = HAND_TYPES.MONOPOLY;
  } else if (pairsCount >= 2) {
    handType = HAND_TYPES.JOINT_VENTURE;
  } else if (hasPartial) {
    handType = HAND_TYPES.DEVELOPMENT;
  }

  mult = handType.mult;

  // Apply Tycoons
  tycoons.forEach(tycoon => {
    const { type, condition } = tycoon;
    
    if (type === 'chip_add') {
      const count = selectedCards.filter(c => c.colorKey === condition.color).length;
      chips += count * condition.value;
    } else if (type === 'mult_add') {
      const count = selectedCards.filter(c => c.colorKey === condition.color).length;
      mult += count * condition.value;
    } else if (type === 'x_mult') {
      if (selectedCards.length === condition.count) {
        mult *= condition.value;
      }
    } else if (type === 'chip_bonus') {
      if (handType.name === condition.type || (condition.type === 'DIVERSIFIED' && distinctColors >= 5)) {
        chips += condition.value;
      }
    } else if (type === 'x_mult_per') {
        const count = selectedCards.filter(c => c.colorKey === condition.color).length;
        // e.g. x1.2 per utility. logic: mult = mult * (1.2 ^ count) or mult * 1.2 * count? 
        // usually "x1.2 for every" means mult * (1.2 * count) is linear? or exponential?
        // Balatro interpretation: usually re-trigger or independent mults. 
        // Let's do linear stack for simplicity: mult * (1 + (0.2 * count)) or just iterative mult.
        // Let's interpret "x1.5 Mult" as a straight multiplier. "x1.2 per utility" -> mult *= Math.pow(1.2, count)
        if (count > 0) mult *= Math.pow(condition.value, count);
    }
  });

  return {
    chips,
    mult,
    total: Math.floor(chips * mult),
    handName: handType.name,
    baseMult: handType.mult // for display
  };
};

// --- COMPONENTS ---

const Card = ({ card, isSelected, onClick, disabled }) => {
  const Icon = card.colorKey === 'RAILROAD' ? Train : card.colorKey === 'UTILITY' ? Lightbulb : Building2;
  
  return (
    <button
      onClick={() => !disabled && onClick(card)}
      disabled={disabled}
      className={cn(
        "relative w-20 h-28 sm:w-24 sm:h-36 lg:w-28 lg:h-40 rounded-lg sm:rounded-xl border-2 transition-all duration-300 flex flex-col select-none shadow-xl",
        "bg-gradient-to-b from-slate-900 to-slate-950", // Dark card background with gradient
        isSelected 
          ? "border-yellow-400 -translate-y-3 sm:-translate-y-4 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-10 ring-4 ring-yellow-400/50 scale-110" 
          : "border-slate-700 hover:border-slate-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105",
        disabled && "opacity-50 cursor-not-allowed hover:translate-y-0 hover:scale-100"
      )}
    >
      {/* Header Color Strip */}
      <div className={cn("w-full h-5 sm:h-6 lg:h-7 flex items-center justify-center shadow-inner flex-shrink-0", card.color)}>
        <span className="text-[7px] sm:text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-white/95 drop-shadow-sm px-1">
           {card.colorKey === 'RAILROAD' ? 'RAIL' : card.colorKey === 'UTILITY' ? 'UTIL' : card.colorKey}
        </span>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-between p-1 sm:p-1.5 lg:p-2 min-h-0">
        <div className="mt-0.5 sm:mt-1 flex-shrink-0">
          <Icon size={24} className={cn("sm:w-7 sm:h-7 lg:w-9 lg:h-9 drop-shadow-md", card.text.replace('text-', 'text-').replace('900', '400').replace('800','400').replace('600','400').replace('500','400'))} />
        </div>

        <div className="w-full text-center mb-0.5 sm:mb-1 flex-shrink-0 overflow-hidden">
          <span className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold leading-tight text-white block px-0.5 line-clamp-2">{card.name}</span>
        </div>

        <div className="w-full flex justify-between items-center bg-slate-950/70 rounded px-1 sm:px-1.5 lg:px-2 py-0.5 border border-slate-800 flex-shrink-0">
           <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[7px] sm:text-[8px] lg:text-[10px] font-bold text-white shadow-lg">C</div>
           <span className="text-[10px] sm:text-xs lg:text-sm font-mono font-bold text-blue-300">{card.value}</span>
        </div>
      </div>
    </button>
  );
};

const TycoonBadge = ({ tycoon }) => (
  <div className="group relative flex flex-col items-center w-24 h-32 bg-slate-900 border border-yellow-600/50 rounded-lg p-2 hover:bg-slate-800 transition-all hover:scale-105 cursor-help shadow-lg">
     <div className="text-[9px] uppercase text-yellow-500 font-bold mb-1 tracking-widest">TYCOON</div>
     <div className="flex-1 flex items-center justify-center">
        <Briefcase size={32} className="text-yellow-400 drop-shadow-lg" />
     </div>
     <div className="text-center mt-1">
        <div className="text-[10px] leading-tight text-white font-bold line-clamp-2">{tycoon.name}</div>
     </div>
    
    {/* Tooltip */}
    <div className="absolute top-full mt-2 w-48 p-3 bg-slate-900 border border-yellow-600 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-xs">
      <p className="font-bold text-yellow-400 mb-1">{tycoon.name}</p>
      <p className="text-slate-300 leading-relaxed">{tycoon.desc}</p>
    </div>
  </div>
);

// --- MAIN GAME ---

export default function CapitalistPoker() {
  // State
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAY, SHOP, GAMEOVER
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCompendium, setShowCompendium] = useState(false);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [discardCount, setDiscardCount] = useState(3);
  const [handsLeft, setHandCount] = useState(4);
  
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0); // Current round score
  const [targetScore, setTargetScore] = useState(300);
  const [money, setMoney] = useState(0);
  const [bank, setBank] = useState(0); // Not used in simplified version per prompt specs, but let's stick to prompt: "Interest on savings". I'll assume Money IS the savings.

  const [tycoons, setTycoons] = useState([]);
  const [shopInventory, setShopInventory] = useState([]);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('cp_highscore') || '0'));

  const [lastHandScore, setLastHandScore] = useState(null); // For animation/feedback
  const [isScoring, setIsScoring] = useState(false);
  const [hasSave, setHasSave] = useState(false);

  // Derived
  const selectedCards = useMemo(() => hand.filter(c => selectedIds.has(c.id)), [hand, selectedIds]);
  const prediction = useMemo(() => calculateScore(selectedCards, tycoons), [selectedCards, tycoons]);

  // --- EFFECTS ---
  
  useEffect(() => {
    const saved = localStorage.getItem('cp_save_data');
    setHasSave(!!saved);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAY' || gameState === 'SHOP') {
      const saveData = {
        deck, 
        hand, 
        selectedIds: Array.from(selectedIds), 
        discardCount, 
        handsLeft,
        round, 
        score, 
        targetScore, 
        money, 
        tycoons, 
        shopInventory, 
        gameState,
        timestamp: Date.now()
      };
      localStorage.setItem('cp_save_data', JSON.stringify(saveData));
    }
  }, [deck, hand, selectedIds, discardCount, handsLeft, round, score, targetScore, money, tycoons, shopInventory, gameState]);

  // --- ACTIONS ---

  const startGame = () => {
    localStorage.removeItem('cp_save_data'); // Clear save on new game
    const newDeck = generateDeck();
    setDeck(newDeck);
    setRound(1);
    setScore(0);
    setTargetScore(300);
    setMoney(0);
    setTycoons([]);
    setHandCount(4);
    setDiscardCount(3);
    setGameState('PLAY');
    drawHand(newDeck, []);
  };

  const continueGame = () => {
    const saved = localStorage.getItem('cp_save_data');
    if (saved) {
      const data = JSON.parse(saved);
      setDeck(data.deck);
      setHand(data.hand);
      setSelectedIds(new Set(data.selectedIds));
      setDiscardCount(data.discardCount);
      setHandCount(data.handsLeft);
      setRound(data.round);
      setScore(data.score);
      setTargetScore(data.targetScore);
      setMoney(data.money);
      setTycoons(data.tycoons);
      setShopInventory(data.shopInventory);
      setGameState(data.gameState);
    }
  };

  const goToMenu = () => {
    setGameState('MENU');
  };

  const drawHand = (currentDeck, currentHand) => {
    const needed = 8 - currentHand.length;
    if (needed <= 0) return;

    const drawPile = [...currentDeck];
    const newHand = [...currentHand];
    
    for(let i=0; i<needed; i++) {
      if (drawPile.length > 0) {
        newHand.push(drawPile.pop());
      }
    }
    
    setDeck(drawPile);
    setHand(newHand);
    setSelectedIds(new Set());
  };

  const toggleCard = (card) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(card.id)) {
      newSet.delete(card.id);
    } else {
      if (newSet.size < 5) {
        newSet.add(card.id);
      }
    }
    setSelectedIds(newSet);
  };

  const playHand = async () => {
    if (selectedCards.length === 0 || handsLeft <= 0) return;

    setIsScoring(true);
    const result = calculateScore(selectedCards, tycoons);
    
    // Animation delay simulating scoring
    await new Promise(r => setTimeout(r, 600));
    
    const newScore = score + result.total;
    setScore(newScore);
    setHandCount(prev => prev - 1);
    setLastHandScore(result);

    // Remove played cards
    const newHand = hand.filter(c => !selectedIds.has(c.id));
    
    // Check Round Win/Loss logic happens after effect
    // But we need to wait for state update.
    // Let's just check logic in next effect or here immediately.
    // We'll update state and let the effect handle transition if needed or do it manually.
    
    // Draw replacement cards immediately? Usually in these games you play, score, then draw.
    // Wait, if handsLeft is 0, we don't draw.
    
    setTimeout(() => {
      setIsScoring(false);
      setLastHandScore(null);
      
      if (newScore >= targetScore) {
        winRound(newScore);
      } else {
         if (handsLeft - 1 === 0) {
           gameOver();
         } else {
           drawHand(deck, newHand);
         }
      }
    }, 1000);
  };

  const discardHand = () => {
    if (discardCount <= 0) return;
    const newHand = hand.filter(c => !selectedIds.has(c.id));
    setDiscardCount(prev => prev - 1);
    drawHand(deck, newHand);
  };

  const winRound = (finalScore) => {
    // Interest calculation
    const interestCap = tycoons.some(t => t.condition.effect === 'interest_cap') ? 10 : 5;
    const interest = Math.min(Math.floor(money / 5), interestCap);
    const roundReward = 5;
    const totalEarned = roundReward + interest;

    setMoney(prev => prev + totalEarned);
    setGameState('SHOP');
    generateShop();
  };

  const gameOver = () => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('cp_highscore', score.toString());
    }
    localStorage.removeItem('cp_save_data'); // Clear save on game over
    setGameState('GAMEOVER');
  };

  const nextRound = () => {
    // Reset for next round
    setRound(r => r + 1);
    setScore(0);
    setTargetScore(Math.floor(targetScore * 1.5));
    setHandCount(4);
    setDiscardCount(3);
    
    // Reshuffle full deck
    const newDeck = generateDeck(); // For now, reset deck. Ideally we keep deck changes if implemented.
    setDeck(newDeck);
    setGameState('PLAY');
    drawHand(newDeck, []);
  };

  const generateShop = () => {
    // Random 3 tycoons
    const pool = [...TYCOONS].sort(() => Math.random() - 0.5);
    setShopInventory(pool.slice(0, 3));
  };

  const buyTycoon = (tycoon) => {
    let price = tycoon.cost;
    // Apply discount
    if (tycoons.some(t => t.condition.effect === 'shop_discount')) {
      price = Math.ceil(price * 0.8);
    }

    if (money >= price && tycoons.length < 5) {
      setMoney(money - price);
      setTycoons([...tycoons, tycoon]);
      setShopInventory(shopInventory.filter(t => t.id !== tycoon.id));
    }
  };

  // --- RENDER HELPERS ---

  if (gameState === 'MENU') {
    return (
      <div className="min-h-screen bg-game-pattern flex flex-col items-center justify-center p-4 sm:p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 crt-overlay"></div>
        
        {/* Animated Background Elements - Monopoly inspired */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
           <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
           <div className="absolute bottom-20 right-20 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Hero Title Image */}
        <div className="relative z-10 w-full max-w-[280px] sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl mb-6 sm:mb-8 px-4 animate-float">
          <img 
            src="/assets/title.png" 
            alt="Deck of Capitalist - Roguelike Real Estate Trading"
            className="w-full h-auto drop-shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:drop-shadow-[0_0_60px_rgba(59,130,246,0.8)] transition-all duration-500"
            style={{
              imageRendering: 'pixelated',
              WebkitFontSmoothing: 'none',
              MozOsxFontSmoothing: 'grayscale'
            }}
            onError={(e) => {
              // Fallback to text if image doesn't load
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 tracking-tighter filter drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">DECK OF<br/>CAPITALIST</h1>';
            }}
          />
        </div>
        
        <p className="text-slate-300 mb-8 sm:mb-10 text-sm sm:text-base lg:text-lg max-w-md z-10 leading-relaxed px-4">
          <span className="text-yellow-400 font-bold text-base sm:text-lg lg:text-xl">Roguelike Real Estate Trading</span><br/>
          <span className="text-slate-400">Accumulate. Dominate. Greedy Like OKL.</span>
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm z-10">
          <button 
            onClick={startGame}
            className="group relative w-full py-4 sm:py-5 bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-500 text-slate-950 font-black text-xl sm:text-2xl rounded-xl hover:from-yellow-400 hover:via-yellow-500 hover:to-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-2xl hover:shadow-yellow-500/50 animate-pulse-glow"
          >
            {hasSave ? '🎲 NEW GAME' : '🎲 START TRADING'}
            <div className="absolute inset-0 rounded-xl ring-4 ring-yellow-300/50 group-hover:ring-yellow-200 transition-all pointer-events-none"></div>
          </button>
          
          {hasSave && (
            <button 
              onClick={continueGame}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white font-bold text-lg sm:text-xl rounded-xl border-2 border-slate-600 hover:border-slate-400 hover:from-slate-700 hover:to-slate-600 transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              ▶️ CONTINUE GAME
            </button>
          )}
          
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button 
              onClick={() => setShowCompendium(true)}
              className="group relative px-4 py-4 sm:py-5 bg-gradient-to-br from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-blue-100 font-bold rounded-xl border-2 border-blue-600/70 hover:border-blue-400 transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:shadow-blue-500/30"
            >
              <Briefcase className="inline-block mb-1" size={24} />
              <div className="font-black">CARDS</div>
              <div className="absolute inset-0 rounded-xl ring-2 ring-blue-400/0 group-hover:ring-blue-400/50 transition-all pointer-events-none"></div>
            </button>
            
            <button 
              onClick={() => setShowTutorial(true)}
              className="group relative px-4 py-4 sm:py-5 bg-gradient-to-br from-green-900 to-green-800 hover:from-green-800 hover:to-green-700 text-green-100 font-bold rounded-xl border-2 border-green-600/70 hover:border-green-400 transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:shadow-green-500/30"
            >
              <TrendingUp className="inline-block mb-1" size={24} />
              <div className="font-black">GUIDE</div>
              <div className="absolute inset-0 rounded-xl ring-2 ring-green-400/0 group-hover:ring-green-400/50 transition-all pointer-events-none"></div>
            </button>
          </div>
        </div>
        
        {highScore > 0 && (
          <div className="mt-12 text-slate-500 flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800 animate-in fade-in duration-1000 delay-500">
            <Trophy size={16} className="text-yellow-500" /> 
            <span className="text-sm font-bold">High Score: ${highScore.toLocaleString()}</span>
          </div>
        )}

        {showCompendium && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              
              <div className="flex justify-between items-center px-8 py-6 border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-3xl font-bold text-blue-400 flex items-center gap-3">
                   <Briefcase size={32} /> Card Database
                </h2>
                <button onClick={() => setShowCompendium(false)} className="text-slate-400 hover:text-white transition-colors">
                   <span className="text-2xl">✕</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                
                {/* Tycoons Section */}
                <section>
                   <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                      <Briefcase className="text-yellow-500" /> Tycoons
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {TYCOONS.map((tycoon, idx) => (
                         <div key={idx} className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex flex-col gap-2 hover:border-yellow-500/50 transition-colors">
                            <div className="flex justify-between items-start">
                               <Briefcase size={24} className="text-yellow-500" />
                               <span className="text-xs font-bold text-slate-500 font-mono">${tycoon.cost}</span>
                            </div>
                            <h4 className="text-sm font-bold text-white">{tycoon.name}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">{tycoon.desc}</p>
                         </div>
                      ))}
                   </div>
                </section>

                {/* Cards Section */}
                <section>
                   <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                      <Building2 className="text-blue-500" /> Property Deeds
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {BASE_DECK.map((card, idx) => {
                         const colorDef = CARD_COLORS[card.color];
                         return (
                            <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden flex flex-col group hover:scale-105 transition-all duration-300">
                               <div className={cn("h-2 w-full", colorDef.color)}></div>
                               <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                  <div className="flex justify-center py-2">
                                     {card.color === 'RAILROAD' ? <Train size={24} className="text-white" /> : 
                                      card.color === 'UTILITY' ? <Lightbulb size={24} className="text-white" /> :
                                      <Building2 size={24} className={colorDef.text.replace('900','400').replace('800','400').replace('600','400').replace('500','400')} />
                                     }
                                  </div>
                                  <div className="text-center">
                                     <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-0.5">{colorDef.name}</div>
                                     <div className="text-xs font-bold text-white leading-tight">{card.name}</div>
                                  </div>
                                  <div className="mt-2 flex justify-center">
                                     <span className="bg-slate-900 text-blue-300 text-xs font-mono px-2 py-0.5 rounded border border-slate-700 font-bold">${card.value}</span>
                                  </div>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </section>

              </div>
            </div>
          </div>
        )}

        {showTutorial && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border-2 border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              
              <div className="flex justify-between items-center px-6 sm:px-8 py-4 sm:py-6 border-b-2 border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-400 flex items-center gap-3">
                   <TrendingUp size={32} /> How to Play
                </h2>
                <button onClick={() => setShowTutorial(false)} className="text-slate-400 hover:text-white transition-colors hover:scale-110">
                   <span className="text-2xl">✕</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar">
                
                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    🎯 Objective
                  </h3>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    Survive as many rounds as possible by collecting rent from property combinations. Each round, the rent target increases. Fail to meet it, and you're bankrupt!
                  </p>
                </section>

                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    🎮 Gameplay Loop
                  </h3>
                  <ol className="space-y-3 text-slate-300 text-sm sm:text-base">
                    <li className="flex gap-3">
                      <span className="font-bold text-yellow-400 min-w-[24px]">1.</span>
                      <span><strong className="text-white">Select Cards:</strong> Choose up to 5 cards from your hand to form a property combination.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-yellow-400 min-w-[24px]">2.</span>
                      <span><strong className="text-white">Collect Rent:</strong> Play your hand to earn chips based on the combination's value and multiplier.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-yellow-400 min-w-[24px]">3.</span>
                      <span><strong className="text-white">Discard (Optional):</strong> Swap unwanted cards for new ones (limited uses per round).</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-yellow-400 min-w-[24px]">4.</span>
                      <span><strong className="text-white">Shop:</strong> Between rounds, buy Tycoons (passive buffs) to boost your scoring power.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-yellow-400 min-w-[24px]">5.</span>
                      <span><strong className="text-white">Repeat:</strong> Meet the rent target to advance to the next round with a higher goal.</span>
                    </li>
                  </ol>
                </section>

                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    🏆 Hand Rankings
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/70 border-b-2 border-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-yellow-400 font-bold">Hand</th>
                          <th className="px-3 py-2 text-blue-400 font-bold">Description</th>
                          <th className="px-3 py-2 text-red-400 font-bold text-center">Multiplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Liquidation</td>
                          <td className="px-3 py-2 text-slate-300">No matching colors</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×1</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Development</td>
                          <td className="px-3 py-2 text-slate-300">2 cards of same color</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×2</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Joint Venture</td>
                          <td className="px-3 py-2 text-slate-300">Two separate pairs</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×4</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Monopoly</td>
                          <td className="px-3 py-2 text-slate-300">Complete color set</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×4</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Conglomerate</td>
                          <td className="px-3 py-2 text-slate-300">Full set + Partial set</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×6</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Diversified Portfolio</td>
                          <td className="px-3 py-2 text-slate-300">5 different colors</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×8</td>
                        </tr>
                        <tr className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-bold text-white">Transport Network</td>
                          <td className="px-3 py-2 text-slate-300">All 4 Railroad cards</td>
                          <td className="px-3 py-2 text-center font-mono text-red-400">×12</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    💡 Pro Tips
                  </h3>
                  <ul className="space-y-2 text-slate-300 text-sm sm:text-base">
                    <li className="flex gap-2">
                      <span className="text-yellow-400">•</span>
                      <span>Focus on completing <strong className="text-white">Monopolies</strong> for consistent high scores.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-yellow-400">•</span>
                      <span>Save your <strong className="text-white">Discards</strong> for critical moments.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-yellow-400">•</span>
                      <span>Buy <strong className="text-white">Tycoons</strong> that synergize with your deck composition.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-yellow-400">•</span>
                      <span>The <strong className="text-white">Transport Network</strong> (4 Railroads) is the highest scoring hand!</span>
                    </li>
                  </ul>
                </section>

              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'GAMEOVER') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <Skull size={64} className="text-red-500 mb-6 animate-pulse" />
        <h2 className="text-5xl font-bold text-white mb-2">BANKRUPT</h2>
        <p className="text-red-400 mb-8 text-xl">You failed to pay the rent.</p>
        
        <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 mb-8 w-full max-w-xs">
          <div className="flex justify-between mb-2 text-slate-400">
            <span>Round Reached</span>
            <span className="text-white">{round}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Final Score</span>
            <span className="text-yellow-400 font-mono">${score.toLocaleString()}</span>
          </div>
        </div>

        <button 
          onClick={startGame}
          className="px-8 py-3 bg-slate-800 border border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500 transition-all rounded"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-pattern text-slate-100 flex flex-col overflow-hidden relative font-sans">
      <div className="absolute inset-0 crt-overlay pointer-events-none"></div>
      
      {/* --- HEADER: HUD --- */}
      <header className="h-16 sm:h-20 lg:h-24 bg-slate-900/95 backdrop-blur-md border-b-2 border-slate-800 flex items-center justify-between px-2 sm:px-4 lg:px-6 shrink-0 z-50 shadow-xl">
        {/* Left: Goal */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-8">
           <button 
            onClick={goToMenu}
            className="p-2 sm:p-3 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-yellow-400 transition-all border border-transparent hover:border-slate-700 hover:scale-110 active:scale-95"
            title="Back to Menu"
          >
            <Home size={20} className="sm:w-6 sm:h-6" />
          </button>

          <div className="flex flex-col gap-0.5 sm:gap-1">
             <div className="flex items-baseline gap-1 sm:gap-2 text-[8px] sm:text-xs font-bold tracking-widest uppercase text-slate-400">
                <span className="hidden sm:inline">Current</span>
                <span>Rent Target</span>
             </div>
             <div className="flex items-baseline gap-1 sm:gap-3">
                <span className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">${score.toLocaleString()}</span>
                <span className="text-sm sm:text-xl lg:text-2xl font-bold text-red-500">/ ${targetScore.toLocaleString()}</span>
             </div>
          </div>
        </div>

        {/* Center: Stats */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
          <div className="flex flex-col items-center bg-slate-800/70 border-2 border-blue-700/50 rounded-lg px-2 sm:px-3 lg:px-4 py-1 sm:py-2 min-w-[50px] sm:min-w-[70px] lg:min-w-[80px] shadow-lg">
             <span className="text-[8px] sm:text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Hands</span>
             <span className="text-lg sm:text-xl lg:text-2xl font-black text-white">{handsLeft}</span>
          </div>
          <div className="flex flex-col items-center bg-slate-800/70 border-2 border-red-700/50 rounded-lg px-2 sm:px-3 lg:px-4 py-1 sm:py-2 min-w-[50px] sm:min-w-[70px] lg:min-w-[80px] shadow-lg">
             <span className="text-[8px] sm:text-[10px] text-red-400 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Discards</span>
             <span className="text-lg sm:text-xl lg:text-2xl font-black text-white">{discardCount}</span>
          </div>
          <div className="flex flex-col items-center bg-yellow-900/30 border-2 border-yellow-700/70 rounded-lg px-2 sm:px-3 lg:px-4 py-1 sm:py-2 min-w-[60px] sm:min-w-[80px] lg:min-w-[100px] shadow-lg animate-pulse-glow">
             <span className="text-[8px] sm:text-[10px] text-yellow-500 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">$ Capital</span>
             <span className="text-lg sm:text-xl lg:text-2xl font-black text-yellow-400">${money}</span>
          </div>
        </div>

        {/* Right: Round */}
        <div className="flex flex-col items-end">
           <span className="text-[8px] sm:text-xs font-bold uppercase text-slate-500 tracking-widest">Round</span>
           <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-blue-500">{round}</span>
        </div>
      </header>

      {/* --- GAME AREA --- */}
      <main className="flex-1 relative flex flex-col items-center justify-between p-2 sm:p-4 lg:p-6">
        
        {/* Tycoons Area (Top Center) */}
        <div className="w-full flex justify-center min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]">
            <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
            {tycoons.map((t, i) => (
                <TycoonBadge key={i} tycoon={t} />
            ))}
            {tycoons.length === 0 && (
                <div className="flex flex-col items-center justify-center w-20 h-24 sm:w-24 sm:h-32 border-2 border-dashed border-slate-800 rounded-lg text-slate-700 select-none">
                   <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">No Tycoons</span>
                </div>
            )}
            </div>
        </div>

        {gameState === 'PLAY' && (
          <>
             {/* Hand Area (Bottom) */}
             <div className="flex-1 w-full flex flex-col justify-end items-center gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
                 
                 {/* Accumulation Area - Monopoly Style */}
                 <div className={cn(
                   "transition-all duration-500 transform",
                   selectedCards.length > 0 ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-90"
                 )}>
                   {selectedCards.length > 0 && (
                     <div className="flex flex-col items-center gap-3 sm:gap-4">
                       {/* Accumulation Label */}
                       <div className="text-xs sm:text-sm text-slate-400 uppercase tracking-widest font-bold">
                         📊 Accumulating Assets
                       </div>
                       
                       {/* Stacked Cards Display - Dramatic Stack */}
                       <div className="relative flex justify-center items-center min-h-[140px] sm:min-h-[180px] lg:min-h-[200px]">
                         {selectedCards.map((card, index) => {
                           // Create a cascading pile effect - like stacking money!
                           const totalCards = selectedCards.length;
                           const xOffset = (index - (totalCards - 1) / 2) * 25; // Wider spread
                           const yOffset = -index * 8; // Stack upward
                           const rotation = (index - (totalCards - 1) / 2) * 6; // Slight rotation
                           const scale = 1 + (index * 0.02); // Each card slightly bigger
                           
                           return (
                             <div
                               key={card.id}
                               className="absolute transition-all duration-700 ease-out hover:scale-110 hover:z-50"
                               style={{
                                 transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${scale})`,
                                 zIndex: 10 + index,
                                 filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                               }}
                             >
                               <div className="relative">
                                 {/* Stacking shadow effect - makes it look 3D */}
                                 <div className="absolute inset-0 bg-black/20 rounded-lg transform translate-y-1 translate-x-1 blur-sm"></div>
                                 <Card 
                                   card={card} 
                                   isSelected={true}
                                   onClick={toggleCard}
                                   disabled={isScoring}
                                 />
                                 {/* Money counter badge */}
                                 <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-400 to-yellow-600 text-slate-900 font-black text-xs sm:text-sm px-2 py-1 rounded-full border-2 border-yellow-300 shadow-lg animate-pulse">
                                   #{index + 1}
                                 </div>
                               </div>
                             </div>
                           );
                         })}
                         
                         {/* Wealth particles effect */}
                         {selectedCards.length > 0 && (
                           <>
                             <div className="absolute inset-0 pointer-events-none">
                               <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                               <div className="absolute top-4 right-1/4 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping opacity-75 animation-delay-300"></div>
                               <div className="absolute bottom-2 left-1/3 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-75 animation-delay-500"></div>
                             </div>
                           </>
                         )}
                       </div>
                       
                       {/* Score Prediction Pill */}
                       <div className="bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-md border-2 border-yellow-500/50 rounded-2xl pl-3 sm:pl-6 pr-4 sm:pr-8 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 lg:gap-6 shadow-2xl shadow-yellow-500/30">
                         <div className="flex flex-col items-end leading-none">
                           <span className="text-[8px] sm:text-[10px] text-yellow-300 uppercase font-black tracking-widest mb-0.5 sm:mb-1">{prediction.handName}</span>
                           <div className="flex items-baseline text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tighter">
                             <span className="text-blue-400">{prediction.chips}</span>
                             <span className="text-slate-600 mx-0.5 sm:mx-1 text-sm sm:text-xl">×</span>
                             <span className="text-red-500">{prediction.mult}</span>
                           </div>
                         </div>
                         <ArrowRight className="text-yellow-500 w-4 h-4 sm:w-6 sm:h-6" />
                         <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-yellow-400 tracking-tighter tabular-nums animate-pulse">
                           ${prediction.total.toLocaleString()}
                         </div>
                       </div>
                     </div>
                   )}
                 </div>

                {/* Cards Hand */}
                <div className="flex justify-center items-end -space-x-4 sm:-space-x-2 hover:space-x-0 sm:hover:space-x-1 transition-all duration-300 py-2 sm:py-4 px-2 sm:px-4 lg:px-8 overflow-x-auto max-w-full">
                {hand.map((card) => (
                    <Card 
                    key={card.id} 
                    card={card} 
                    isSelected={selectedIds.has(card.id)}
                    onClick={toggleCard}
                    disabled={isScoring}
                    />
                ))}
                </div>

                {/* Controls */}
                <div className="flex gap-2 sm:gap-4 w-full max-w-md">
                    <button 
                        onClick={playHand}
                        disabled={selectedCards.length === 0 || isScoring}
                        className="flex-1 py-3 sm:py-4 lg:py-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-black text-base sm:text-lg lg:text-xl rounded-xl shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-1 active:translate-y-0 transition-all uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-blue-500/50 disabled:border-slate-700"
                    >
                        💰 Collect Rent
                    </button>
                    <button 
                        onClick={discardHand}
                        disabled={discardCount <= 0 || selectedCards.length === 0 || isScoring}
                        className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 bg-slate-800 hover:bg-red-900/80 disabled:bg-slate-900 disabled:text-slate-700 text-red-400 font-bold text-sm sm:text-base lg:text-lg rounded-xl border-2 border-slate-700 hover:border-red-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={18} className="sm:w-5 sm:h-5" /> Discard
                    </button>
                </div>
             </div>
          </>
        )}

        {gameState === 'SHOP' && (
          <div className="w-full max-w-4xl bg-slate-900/50 backdrop-blur-md rounded-xl border border-slate-800 p-8 animate-in fade-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <ShoppingCart className="text-yellow-500" /> 
                  The Market
                </h2>
                <p className="text-slate-400">Invest your capital in new assets.</p>
              </div>
              <div className="text-right">
                 <div className="text-sm text-slate-500 uppercase">Capital</div>
                 <div className="text-3xl font-mono text-yellow-400">${money}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {shopInventory.map((item) => {
                let price = item.cost;
                 if (tycoons.some(t => t.condition.effect === 'shop_discount')) {
                    price = Math.ceil(price * 0.8);
                 }
                const canAfford = money >= price;
                return (
                  <div key={item.id} className="bg-slate-950 border border-slate-700 p-4 rounded hover:border-yellow-600 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <Briefcase className="text-slate-600 group-hover:text-yellow-500 transition-colors" />
                      <span className={cn("font-mono font-bold", canAfford ? "text-white" : "text-red-500")}>${price}</span>
                    </div>
                    <h3 className="font-bold text-lg text-white mb-1">{item.name}</h3>
                    <p className="text-sm text-slate-400 mb-4 h-10">{item.desc}</p>
                    <button 
                      onClick={() => buyTycoon(item)}
                      disabled={!canAfford}
                      className="w-full py-2 bg-slate-800 hover:bg-yellow-600 disabled:opacity-50 disabled:hover:bg-slate-800 text-white font-bold rounded transition-colors"
                    >
                      Buy
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
               <button 
                 onClick={nextRound}
                 className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg shadow-green-900/20 flex items-center gap-2"
               >
                 Next Round <ArrowRight size={18} />
               </button>
            </div>
          </div>
        )}

        {/* Scoring Overlay/Juice */}
        {isScoring && lastHandScore && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="text-6xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.5)] animate-bounce">
                 +${lastHandScore.total}
              </div>
           </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="h-8 bg-slate-950 text-[10px] text-slate-600 flex items-center justify-center gap-4">
         <span>DECK OF CAPITALIST v1.0</span>
         <span>•</span>
         <span>BUILD 2025</span>
      </footer>
    </div>
  );
}

