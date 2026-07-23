export type Difficulty = 'casual' | 'trader' | 'tycoon';
export type CompanionId = 'sari' | 'bima';
export type Phase = 'menu' | 'intro' | 'playing' | 'shop' | 'victory' | 'gameover';
export type GroupKey =
  | 'RESIDENTIAL' | 'COMMERCIAL' | 'INNOVATION' | 'INFRASTRUCTURE';

export type MarketModifierId =
  | 'BANJIR' | 'MACET' | 'MATI_LAMPU' | 'GANJIL_GENAP'
  | 'SIDAK' | 'MUSIM_KAWIN' | 'REKLAMASI';

export interface MarketModifier {
  id: MarketModifierId;
  name: string;
  summary: string;
  art: string;
  /** Ganjil-Genap is deliberately public before the player chooses a hand. */
  parity?: 'odd' | 'even';
}

export type ConsumableId = 'SERTIFIKAT' | 'NOTARIS' | 'PUNGLI' | 'UANG_PELICIN' | 'SITA';

/** One-use market tools; their effects are resolved exclusively by the reducer. */
export interface Consumable {
  id: ConsumableId;
  name: string;
  description: string;
  cost: number;
  art: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  group: GroupKey;
  /** Reuses a commissioned card illustration when this named asset has one. */
  artId?: string;
  chips: number;
  /** 1–13 rank. Five consecutive ranks form a Straight. */
  rank: number;
}

export interface Card extends CardTemplate {
  instanceId: string;
  bonus: number;
}

export type TycoonEffect =
  | { kind: 'chips_per_group'; group: GroupKey; amount: number }
  | { kind: 'mult_per_group'; group: GroupKey; amount: number }
  | { kind: 'xmult_per_group'; group: GroupKey; amount: number }
  | { kind: 'xmult_flat'; amount: number }
  | { kind: 'xmult_per_hand'; hand: HandKey; amount: number }
  | { kind: 'xmult_hand_size'; size: number; amount: number }
  | { kind: 'chips_for_hand'; hand: HandKey; amount: number }
  | { kind: 'interest_cap'; amount: number }
  | { kind: 'shop_discount'; amount: number };

export interface Tycoon {
  id: string;
  /** Allows new local writing to reuse an already-commissioned portrait safely. */
  artId?: string;
  name: string;
  description: string;
  cost: number;
  effect: TycoonEffect;
  /** Every helper contributes a small, visible compounding core to a build. */
  xmult?: number;
}

export type HandKey =
  | 'HIGH_ASSET' | 'PAIR' | 'TWO_PAIRS' | 'THREE_KIND' | 'STRAIGHT'
  | 'FLUSH' | 'FULL_HOUSE' | 'FOUR_KIND' | 'STRAIGHT_FLUSH';

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

export interface ScoreContext {
  modifier?: MarketModifier;
}

export interface PlayerState {
  drawPile: Card[];
  discardPile: Card[];
  hand: Card[];
  score: number;
  cash: number;
  tycoons: Tycoon[];
  consumables: Consumable[];
  handsLeft: number;
  discardsLeft: number;
}

export interface ShopState {
  tycoons: Tycoon[];
  acquisition: CardTemplate;
  rerollCost: number;
  renovations: number;
  liquidated: boolean;
  consumables: Consumable[];
}

export interface GameEvent {
  id: string;
  actor: 'player' | 'system';
  message: string;
}

export interface GameState {
  version: 2;
  phase: Phase;
  difficulty: Difficulty;
  companion: CompanionId;
  round: number;
  modifier: MarketModifier;
  /** Cards removed only for the active Reklamasi market and restored after it. */
  marketExile: Card[];
  seed: number;
  rngState: number;
  player: PlayerState;
  selectedIds: string[];
  shop: ShopState | null;
  events: GameEvent[];
  lastPlayerScore: ScoreBreakdown | null;
  lastPlayedCards: Card[];
  muted: boolean;
  runScore: number;
  /** Monotonic count of discard-pile recycles, used to cue reshuffle feedback. */
  reshuffles: number;
}

export type GameAction =
  | { type: 'NEW_RUN'; difficulty: Difficulty; companion?: CompanionId; seed?: number }
  | { type: 'BEGIN_RUN' }
  | { type: 'LOAD'; state: GameState }
  | { type: 'GO_MENU' }
  | { type: 'TOGGLE_CARD'; cardId: string }
  | { type: 'PLAYER_DISCARD' }
  | { type: 'PLAYER_PLAY' }
  | { type: 'BUY_TYCOON'; tycoonId: string }
  | { type: 'BUY_CONSUMABLE'; consumableId: ConsumableId }
  | { type: 'USE_CONSUMABLE'; consumableId: ConsumableId }
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
