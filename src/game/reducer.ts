import {
  allCards, awardRound, chooseMarketModifier, createPlayer, deckSize, discardCards, emptyState, generateShop,
  makeCard, playCards, prepareMarket, priceFor, replaceCard, marketTarget, MAX_ROUNDS, MAX_TYCOONS, MIN_DECK_SIZE,
} from './engine';
import { GROUPS, MARKET_MODIFIERS } from './data';
import type { GameAction, GameEvent, GameState } from './types';

function event(state: GameState, actor: GameEvent['actor'], message: string): GameEvent[] {
  const next = [...state.events, { id: `${state.round}-${state.events.length}-${state.rngState}`, actor, message }];
  return next.slice(-8);
}

export function createRun(
  difficulty: GameState['difficulty'] = 'trader',
  seed = Date.now() >>> 0,
  muted = false,
  companion: GameState['companion'] = 'abah',
): GameState {
  const player = createPlayer('player', seed);
  const market = chooseMarketModifier(player.rngState);
  const prepared = prepareMarket(player.side, market.rngState, market.modifier);
  return {
    version: 2,
    phase: 'playing',
    difficulty,
    companion,
    round: 1,
    seed,
    rngState: prepared.rngState,
    player: prepared.side,
    modifier: market.modifier,
    marketExile: prepared.exiled,
    selectedIds: [],
    shop: null,
    events: [{ id: 'opening', actor: 'system', message: `${market.modifier.name}: ${market.modifier.summary} Kejar ${marketTarget(1, difficulty, market.modifier).toLocaleString()} dalam empat tangan.` }],
    lastPlayerScore: null,
    lastPlayedCards: [],
    muted,
    runScore: 0,
    reshuffles: 0,
  };
}

const RESHUFFLE_NOTE = 'Buangan diacak balik ke dek.';

function completeRound(state: GameState, playerScore: GameState['lastPlayerScore']): GameState {
  const runScore = state.runScore + state.player.score;
  const target = marketTarget(state.round, state.difficulty, state.modifier);
  if (state.player.score < target) {
    return {
      ...state, phase: 'gameover', runScore, lastPlayerScore: playerScore,
      selectedIds: [],
      events: event(state, 'system', `Target gagal: ${state.player.score.toLocaleString()} / ${target.toLocaleString()}.`),
    };
  }
  if (state.round >= MAX_ROUNDS) {
    return {
      ...state, phase: 'victory', runScore, lastPlayerScore: playerScore,
      selectedIds: [],
      events: event(state, 'system', 'Pasar terakhir tembus. Negara naik bareng kamu.'),
    };
  }
  const player = awardRound(state.player);
  const generated = generateShop(player.tycoons, state.rngState);
  return {
    ...state, phase: 'shop', player, shop: generated.shop, rngState: generated.rngState,
    runScore, selectedIds: [], lastPlayerScore: playerScore,
    events: event(state, 'system', 'Target tembus. Pasar Bersama kebuka.'),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_RUN':
      return { ...createRun(action.difficulty, action.seed, state.muted, action.companion), phase: 'intro' };
    case 'BEGIN_RUN':
      return state.phase === 'intro' ? { ...state, phase: 'playing' } : state;
    case 'LOAD':
      return {
        ...action.state,
        difficulty: action.state.difficulty ?? 'trader',
        companion: action.state.companion ?? 'abah',
        modifier: action.state.modifier ?? emptyState().modifier,
        marketExile: action.state.marketExile ?? [],
        player: { ...action.state.player, consumables: action.state.player.consumables ?? [] },
        shop: action.state.shop ? { ...action.state.shop, consumables: action.state.shop.consumables ?? [] } : null,
        selectedIds: [],
        lastPlayedCards: action.state.lastPlayedCards ?? [],
        reshuffles: action.state.reshuffles ?? 0,
      };
    case 'GO_MENU':
      return { ...state, phase: 'menu', selectedIds: [] };
    case 'SET_MUTED':
      return { ...state, muted: action.muted };
    case 'TOGGLE_CARD': {
      if (state.phase !== 'playing') return state;
      const exists = state.selectedIds.includes(action.cardId);
      if (!exists && state.selectedIds.length >= 5) return state;
      return { ...state, selectedIds: exists ? state.selectedIds.filter((id) => id !== action.cardId) : [...state.selectedIds, action.cardId] };
    }
    case 'PLAYER_DISCARD': {
      if (state.phase !== 'playing' || state.selectedIds.length === 0 || state.player.discardsLeft < 1) return state;
      try {
        const result = discardCards(state.player, state.selectedIds, state.rngState);
        const message = `Buang ${state.selectedIds.length} kartu.`;
        return {
          ...state, player: result.side, rngState: result.rngState, selectedIds: [],
          reshuffles: state.reshuffles + (result.reshuffled ? 1 : 0),
          events: event(state, 'player', result.reshuffled ? `${message} ${RESHUFFLE_NOTE}` : message),
        };
      } catch { return state; }
    }
    case 'PLAYER_PLAY': {
      if (state.phase !== 'playing' || state.selectedIds.length === 0 || state.player.handsLeft < 1) return state;
      try {
        const playerResult = playCards(state.player, state.selectedIds, state.rngState, { modifier: state.modifier });
        const message = `Dapat ${playerResult.score.total.toLocaleString()} dari ${playerResult.score.handName}.`;
        const interim: GameState = {
          ...state,
          player: playerResult.side,
          rngState: playerResult.rngState,
          selectedIds: [],
          lastPlayerScore: playerResult.score,
          lastPlayedCards: state.player.hand.filter((card) => state.selectedIds.includes(card.instanceId)),
          reshuffles: state.reshuffles + (playerResult.reshuffled ? 1 : 0),
          events: event(state, 'player', playerResult.reshuffled ? `${message} ${RESHUFFLE_NOTE}` : message),
        };
        if (playerResult.side.handsLeft === 0) return completeRound(interim, playerResult.score);
        return interim;
      } catch { return state; }
    }
    case 'BUY_TYCOON': {
      if (state.phase !== 'shop' || !state.shop || state.player.tycoons.length >= MAX_TYCOONS) return state;
      const tycoon = state.shop.tycoons.find((item) => item.id === action.tycoonId);
      if (!tycoon || state.player.tycoons.some((item) => item.id === tycoon.id)) return state;
      const price = priceFor(state.player, tycoon.cost);
      if (state.player.cash < price) return state;
      return {
        ...state,
        player: { ...state.player, cash: state.player.cash - price, tycoons: [...state.player.tycoons, tycoon] },
        events: event(state, 'player', `Ajak ${tycoon.name} masuk · $${price}.`),
      };
    }
    case 'BUY_CONSUMABLE': {
      if (state.phase !== 'shop' || !state.shop || state.player.consumables.length >= 2) return state;
      const consumable = state.shop.consumables.find((item) => item.id === action.consumableId);
      if (!consumable) return state;
      const price = priceFor(state.player, consumable.cost);
      if (state.player.cash < price) return state;
      return {
        ...state,
        player: { ...state.player, cash: state.player.cash - price, consumables: [...state.player.consumables, consumable] },
        shop: { ...state.shop, consumables: state.shop.consumables.filter((item) => item.id !== consumable.id) },
        events: event(state, 'player', `Beli ${consumable.name} · $${price}.`),
      };
    }
    case 'USE_CONSUMABLE': {
      if (state.phase !== 'playing') return state;
      const consumable = state.player.consumables.find((item) => item.id === action.consumableId);
      if (!consumable) return state;
      const selected = state.player.hand.filter((card) => state.selectedIds.includes(card.instanceId));
      const consume = (player: GameState['player'], message: string, extra: Partial<GameState> = {}): GameState => ({
        ...state, ...extra,
        player: { ...player, consumables: player.consumables.filter((item) => item.id !== consumable.id) },
        events: event(state, 'player', message),
      });
      if (consumable.id === 'SERTIFIKAT') {
        if (selected.length !== 1) return state;
        const card = selected[0];
        const keys = Object.keys(GROUPS) as Array<keyof typeof GROUPS>;
        const group = keys[(keys.indexOf(card.group) + 1) % keys.length];
        return consume(replaceCard(state.player, card.instanceId, (item) => ({ ...item, group })), `${card.name} sekarang jadi ${GROUPS[group].label}.`, { selectedIds: [] });
      }
      if (consumable.id === 'NOTARIS') {
        if (selected.length !== 1) return state;
        const card = selected[0];
        const copy = { ...card, instanceId: `${card.id}-notaris-${state.round}-${state.rngState}` };
        return consume({ ...state.player, discardPile: [...state.player.discardPile, copy] }, `Notaris nyalin ${card.name} ke dek.`, { selectedIds: [] });
      }
      if (consumable.id === 'PUNGLI') {
        const eligible = MARKET_MODIFIERS.filter((item) => item.id !== 'REKLAMASI' && item.id !== state.modifier.id);
        const index = state.rngState % eligible.length;
        const modifier = eligible[index];
        return consume(state.player, `Musyawarah ganti event jadi ${modifier.name}.`, { modifier, rngState: (state.rngState * 1664525 + 1013904223) >>> 0 });
      }
      if (consumable.id === 'UANG_PELICIN') {
        return consume({ ...state.player, handsLeft: state.player.handsLeft + 1 }, 'Gotong Royong kasih satu tangan ekstra.');
      }
      if (selected.length !== 3) return state;
      const selectedIds = new Set(selected.map((card) => card.instanceId));
      const player = { ...state.player, hand: state.player.hand.filter((card) => !selectedIds.has(card.instanceId)) };
      return consume(player, 'Kurasi buang tiga kartu. Dek lebih tipis.', { selectedIds: [] });
    }
    case 'BUY_ACQUISITION': {
      if (state.phase !== 'shop' || !state.shop) return state;
      const price = priceFor(state.player, 4 + Math.floor(state.shop.acquisition.chips / 15));
      if (state.player.cash < price) return state;
      // Contracts arrive already improved, so adding one is a deliberate power
      // spike rather than a strictly worse, deck-diluting vanilla draw.
      const card = { ...makeCard(state.shop.acquisition, `player-market-${state.round}-${state.rngState}`), bonus: 8 };
      return {
        ...state,
        player: { ...state.player, cash: state.player.cash - price, discardPile: [...state.player.discardPile, card] },
        events: event(state, 'player', `Ambil ${card.name} (+8 chip) · $${price}.`),
      };
    }
    case 'RENOVATE': {
      if (state.phase !== 'shop' || !state.shop) return state;
      const price = priceFor(state.player, 4 * (1 + state.shop.renovations));
      if (state.player.cash < price) return state;
      const target = allCards(state.player).find((card) => card.instanceId === action.cardId);
      if (!target) return state;
      const gain = 5 + Math.floor(target.bonus / 5);
      return {
        ...state,
        player: { ...replaceCard(state.player, action.cardId, (card) => ({ ...card, bonus: card.bonus + gain })), cash: state.player.cash - price },
        shop: { ...state.shop, renovations: state.shop.renovations + 1 },
        events: event(state, 'player', `Renov beres: +${gain} chip permanen · $${price}.`),
      };
    }
    case 'LIQUIDATE': {
      if (state.phase !== 'shop' || !state.shop || state.shop.liquidated || deckSize(state.player) <= MIN_DECK_SIZE) return state;
      const before = deckSize(state.player);
      const changed = replaceCard(state.player, action.cardId, () => null);
      if (deckSize(changed) === before) return state;
      return {
        ...state,
        player: { ...changed, cash: changed.cash + 1 },
        shop: { ...state.shop, liquidated: true },
        events: event(state, 'player', 'Satu aset dijual · +$1.'),
      };
    }
    case 'REROLL_SHOP': {
      if (state.phase !== 'shop' || !state.shop || state.player.cash < state.shop.rerollCost) return state;
      const paidPlayer = { ...state.player, cash: state.player.cash - state.shop.rerollCost };
      const generated = generateShop(paidPlayer.tycoons, state.rngState);
      return {
        ...state, player: paidPlayer, shop: { ...generated.shop, rerollCost: state.shop.rerollCost + 1 },
        rngState: generated.rngState, events: event(state, 'player', 'Lapak diacak ulang.'),
      };
    }
    case 'NEXT_ROUND': {
      if (state.phase !== 'shop' || !state.shop) return state;
      const market = chooseMarketModifier(state.rngState);
      const playerReset = prepareMarket(state.player, market.rngState, market.modifier, state.marketExile);
      return {
        ...state, phase: 'playing', round: state.round + 1, player: playerReset.side,
        rngState: playerReset.rngState, modifier: market.modifier, marketExile: playerReset.exiled,
        shop: null, selectedIds: [], lastPlayerScore: null, lastPlayedCards: [],
        events: [{ id: `round-${state.round + 1}`, actor: 'system', message: `${market.modifier.name}: ${market.modifier.summary} Kejar ${marketTarget(state.round + 1, state.difficulty, market.modifier).toLocaleString()}.` }],
      };
    }
    default:
      return state;
  }
}

export const initialState = emptyState(typeof localStorage !== 'undefined' ? localStorage.getItem('doc-muted') === 'true' : false);
