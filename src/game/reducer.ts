import { botShop, resolveBotBout } from './bot';
import {
  awardRound, createCompetitor, deckSize, discardCards, emptyState, generateShop,
  makeCard, playCards, priceFor, replaceCard, resetForRound, marketTarget, MAX_ROUNDS, MIN_DECK_SIZE,
} from './engine';
import type { GameAction, GameEvent, GameState } from './types';

function event(state: GameState, actor: GameEvent['actor'], message: string): GameEvent[] {
  const next = [...state.events, { id: `${state.round}-${state.events.length}-${state.rngState}`, actor, message }];
  return next.slice(-8);
}

export function createRun(difficulty: GameState['difficulty'], seed = Date.now() >>> 0, muted = false): GameState {
  const player = createCompetitor('player', seed);
  const bot = createCompetitor('bot', player.rngState);
  return {
    version: 2,
    phase: 'playing',
    difficulty,
    round: 1,
    seed,
    rngState: bot.rngState,
    player: player.side,
    bot: bot.side,
    selectedIds: [],
    shop: null,
    events: [{ id: 'opening', actor: 'system', message: `Market 1 opens. Reach ${marketTarget(1).toLocaleString()} in four hands.` }],
    lastPlayerScore: null,
    lastBotScore: null,
    muted,
    runScore: 0,
  };
}

function completeRound(state: GameState, playerScore: GameState['lastPlayerScore'], botScore: GameState['lastBotScore']): GameState {
  const runScore = state.runScore + state.player.score;
  const target = marketTarget(state.round);
  if (state.player.score < target) {
    return {
      ...state, phase: 'gameover', runScore, lastPlayerScore: playerScore,
      lastBotScore: botScore, selectedIds: [],
      events: event(state, 'system', `Market target missed: ${state.player.score.toLocaleString()} / ${target.toLocaleString()}.`),
    };
  }
  if (state.round >= MAX_ROUNDS) {
    return {
      ...state, phase: 'victory', runScore, lastPlayerScore: playerScore,
      lastBotScore: botScore, selectedIds: [],
      events: event(state, 'system', 'The Chairman concedes. Jakarta is yours.'),
    };
  }
  const player = awardRound(state.player);
  const bot = awardRound(state.bot);
  const generated = generateShop(player.tycoons, state.rngState);
  return {
    ...state, phase: 'shop', player, bot, shop: generated.shop, rngState: generated.rngState,
    runScore, selectedIds: [], lastPlayerScore: playerScore, lastBotScore: botScore,
    events: event(state, 'system', `Target cleared${state.player.score >= state.bot.score ? ' — you also beat the benchmark' : ''}. The night market is open.`),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_RUN':
      return { ...createRun(action.difficulty, action.seed, state.muted), phase: 'intro' };
    case 'BEGIN_RUN':
      return state.phase === 'intro' ? { ...state, phase: 'playing' } : state;
    case 'LOAD':
      return { ...action.state, selectedIds: [] };
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
        return {
          ...state, player: result.side, rngState: result.rngState, selectedIds: [],
          events: event(state, 'player', `You recycled ${state.selectedIds.length} deed${state.selectedIds.length === 1 ? '' : 's'}.`),
        };
      } catch { return state; }
    }
    case 'PLAYER_PLAY': {
      if (state.phase !== 'playing' || state.selectedIds.length === 0 || state.player.handsLeft < 1) return state;
      try {
        const playerResult = playCards(state.player, state.selectedIds, state.rngState);
        const botResult = resolveBotBout(state.bot, state.difficulty, playerResult.rngState);
        const interim: GameState = {
          ...state,
          player: playerResult.side,
          bot: botResult.side,
          rngState: botResult.rngState,
          selectedIds: [],
          lastPlayerScore: playerResult.score,
          lastBotScore: botResult.score,
          events: event(state, 'bot', `${state.round === MAX_ROUNDS ? 'The Chairman' : 'The Broker'}${botResult.discarded ? ` recycled ${botResult.discarded}, then` : ''} scored ${botResult.score.total.toLocaleString()} with ${botResult.score.handName}.`),
        };
        interim.events = event(interim, 'player', `You scored ${playerResult.score.total.toLocaleString()} with ${playerResult.score.handName}.`);
        if (playerResult.side.handsLeft === 0) return completeRound(interim, playerResult.score, botResult.score);
        return interim;
      } catch { return state; }
    }
    case 'BUY_TYCOON': {
      if (state.phase !== 'shop' || !state.shop || state.player.tycoons.length >= 5) return state;
      const tycoon = state.shop.tycoons.find((item) => item.id === action.tycoonId);
      if (!tycoon || state.player.tycoons.some((item) => item.id === tycoon.id)) return state;
      const price = priceFor(state.player, tycoon.cost);
      if (state.player.cash < price) return state;
      return {
        ...state,
        player: { ...state.player, cash: state.player.cash - price, tycoons: [...state.player.tycoons, tycoon] },
        events: event(state, 'player', `You hired ${tycoon.name} for $${price}.`),
      };
    }
    case 'BUY_ACQUISITION': {
      if (state.phase !== 'shop' || !state.shop) return state;
      const price = priceFor(state.player, 4 + Math.floor(state.shop.acquisition.chips / 15));
      if (state.player.cash < price) return state;
      const card = makeCard(state.shop.acquisition, `player-market-${state.round}-${state.rngState}`);
      return {
        ...state,
        player: { ...state.player, cash: state.player.cash - price, discardPile: [...state.player.discardPile, card] },
        events: event(state, 'player', `You acquired ${card.name} for $${price}.`),
      };
    }
    case 'RENOVATE': {
      if (state.phase !== 'shop' || !state.shop || state.shop.renovated) return state;
      const price = priceFor(state.player, 4);
      if (state.player.cash < price) return state;
      return {
        ...state,
        player: { ...replaceCard(state.player, action.cardId, (card) => ({ ...card, bonus: card.bonus + 5 })), cash: state.player.cash - price },
        shop: { ...state.shop, renovated: true },
        events: event(state, 'player', `Renovation complete: +5 permanent chips for $${price}.`),
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
        events: event(state, 'player', 'One deed was liquidated for $1.'),
      };
    }
    case 'REROLL_SHOP': {
      if (state.phase !== 'shop' || !state.shop || state.player.cash < state.shop.rerollCost) return state;
      const paidPlayer = { ...state.player, cash: state.player.cash - state.shop.rerollCost };
      const generated = generateShop(paidPlayer.tycoons, state.rngState);
      return {
        ...state, player: paidPlayer, shop: { ...generated.shop, rerollCost: state.shop.rerollCost + 1 },
        rngState: generated.rngState, events: event(state, 'player', 'Market inventory rerolled.'),
      };
    }
    case 'NEXT_ROUND': {
      if (state.phase !== 'shop' || !state.shop) return state;
      const botPurchase = botShop(state.bot, state.shop, state.rngState);
      const playerReset = resetForRound(state.player, botPurchase.rngState);
      const botReset = resetForRound(botPurchase.side, playerReset.rngState);
      return {
        ...state,
        phase: 'playing', round: state.round + 1, player: playerReset.side, bot: botReset.side,
        rngState: botReset.rngState, shop: null, selectedIds: [], lastPlayerScore: null, lastBotScore: null,
        events: [{ id: `round-${state.round + 1}`, actor: 'system', message: `${botPurchase.message} Market ${state.round + 1}: reach ${marketTarget(state.round + 1).toLocaleString()}.` }],
      };
    }
    default:
      return state;
  }
}

export const initialState = emptyState(typeof localStorage !== 'undefined' ? localStorage.getItem('doc-muted') === 'true' : false);
