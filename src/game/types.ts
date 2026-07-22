export type Difficulty = 'casual' | 'trader' | 'tycoon';
export type Phase = 'menu' | 'playing' | 'shop' | 'victory' | 'gameover';
export type GroupKey =
  | 'BROWN' | 'SKY' | 'PINK' | 'ORANGE' | 'RED'
  | 'YELLOW' | 'GREEN' | 'BLUE' | 'RAILROAD' | 'UTILITY';

export interface CardTemplate {
  id: string;
  name: string;
  group: GroupKey;
  chips: number;
}

export interface Card extends CardTemplate {
  instanceId: string;
  bonus: number;
}

export type TycoonEffect =
  | { kind: 'chips_per_group'; group: GroupKey; amount: number }
  | { kind: 'mult_per_group'; group: GroupKey; amount: number }
  | { kind: 'xmult_per_group'; group: GroupKey; amount: number }
  | { kind: 'xmult_hand_size'; size: number; amount: number }
  | { kind: 'chips_for_hand'; hand: HandKey; amount: number }
  | { kind: 'interest_cap'; amount: number }
  | { kind: 'shop_discount'; amount: number };

export interface Tycoon {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: TycoonEffect;
}

export type HandKey =
  | 'LIQUIDATION' | 'DEVELOPMENT' | 'JOINT_VENTURE'
  | 'MONOPOLY' | 'CONGLOMERATE' | 'DIVERSIFIED' | 'TRANSPORT';

export interface ScoreBreakdown {
  hand: HandKey;
  handName: string;
  cardChips: number;
  bonusChips: number;
  baseMultiplier: number;
  bonusMultiplier: number;
  multiplicative: number;
  total: number;
  notes: string[];
}

export interface CompetitorState {
  drawPile: Card[];
  discardPile: Card[];
  hand: Card[];
  score: number;
  cash: number;
  tycoons: Tycoon[];
  handsLeft: number;
  discardsLeft: number;
}

export interface ShopState {
  tycoons: Tycoon[];
  acquisition: CardTemplate;
  rerollCost: number;
  renovated: boolean;
  liquidated: boolean;
}

export interface GameEvent {
  id: string;
  actor: 'player' | 'bot' | 'system';
  message: string;
}

export interface GameState {
  version: 2;
  phase: Phase;
  difficulty: Difficulty;
  round: number;
  seed: number;
  rngState: number;
  player: CompetitorState;
  bot: CompetitorState;
  selectedIds: string[];
  shop: ShopState | null;
  events: GameEvent[];
  lastPlayerScore: ScoreBreakdown | null;
  lastBotScore: ScoreBreakdown | null;
  muted: boolean;
  runScore: number;
}

export interface BotDecision {
  kind: 'play' | 'discard';
  cardIds: string[];
  expectedScore: number;
  rationale: string;
}

export type GameAction =
  | { type: 'NEW_RUN'; difficulty: Difficulty; seed?: number }
  | { type: 'LOAD'; state: GameState }
  | { type: 'GO_MENU' }
  | { type: 'TOGGLE_CARD'; cardId: string }
  | { type: 'PLAYER_DISCARD' }
  | { type: 'PLAYER_PLAY' }
  | { type: 'BUY_TYCOON'; tycoonId: string }
  | { type: 'BUY_ACQUISITION' }
  | { type: 'RENOVATE'; cardId: string }
  | { type: 'LIQUIDATE'; cardId: string }
  | { type: 'REROLL_SHOP' }
  | { type: 'NEXT_ROUND' }
  | { type: 'SET_MUTED'; muted: boolean };

export interface SaveGameV2 {
  version: 2;
  savedAt: number;
  state: GameState;
}
