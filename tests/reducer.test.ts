import { describe, expect, it } from 'vitest';
import { rankLegalPlays } from '../src/game/bot';
import { generateShop } from '../src/game/engine';
import { createRun, gameReducer } from '../src/game/reducer';
import type { GameState } from '../src/game/types';

function commitBest(state: GameState): GameState {
  const ids = rankLegalPlays(state.player)[0].cards.map((card) => card.instanceId);
  let current = state;
  ids.forEach((cardId) => { current = gameReducer(current, { type: 'TOGGLE_CARD', cardId }); });
  return gameReducer(current, { type: 'PLAYER_PLAY' });
}

describe('campaign reducer', () => {
  it('creates independently shuffled equal-size decks from one seed', () => {
    const run = createRun('trader', 100);
    expect(run.player.hand).toHaveLength(8);
    expect(run.bot.hand).toHaveLength(8);
    expect(run.player.drawPile).toHaveLength(32);
    expect(run.bot.drawPile).toHaveLength(32);
    expect(run.player.hand.map((card) => card.instanceId)).not.toEqual(run.bot.hand.map((card) => card.instanceId));
  });

  it('resolves a full four-bout round without illegal state', () => {
    let run = createRun('casual', 2026);
    for (let hand = 0; hand < 4; hand += 1) run = commitBest(run);
    expect(['shop', 'gameover']).toContain(run.phase);
    expect(run.player.handsLeft).toBe(0);
    expect(run.bot.handsLeft).toBe(0);
    expect(run.runScore).toBeGreaterThan(0);
  }, 20_000);

  it('caps selection at five cards and rejects empty plays', () => {
    let run = createRun('trader', 55);
    run.player.hand.forEach((card) => { run = gameReducer(run, { type: 'TOGGLE_CARD', cardId: card.instanceId }); });
    expect(run.selectedIds).toHaveLength(5);
    const empty = createRun('trader', 55);
    expect(gameReducer(empty, { type: 'PLAYER_PLAY' })).toBe(empty);
  });

  it('supports acquisition, renovation, liquidation, and Tycoon purchases', () => {
    const run = createRun('trader', 909);
    const generated = generateShop([], run.rngState);
    let market: GameState = {
      ...run,
      phase: 'shop',
      shop: generated.shop,
      player: { ...run.player, cash: 100 },
    };
    const startingSize = market.player.hand.length + market.player.drawPile.length + market.player.discardPile.length;
    market = gameReducer(market, { type: 'BUY_TYCOON', tycoonId: market.shop!.tycoons[0].id });
    expect(market.player.tycoons).toHaveLength(1);
    market = gameReducer(market, { type: 'BUY_ACQUISITION' });
    expect(market.player.hand.length + market.player.drawPile.length + market.player.discardPile.length).toBe(startingSize + 1);
    const cardId = market.player.hand[0].instanceId;
    market = gameReducer(market, { type: 'RENOVATE', cardId });
    expect(market.player.hand.find((card) => card.instanceId === cardId)?.bonus).toBe(5);
    market = gameReducer(market, { type: 'LIQUIDATE', cardId });
    expect(market.player.hand.some((card) => card.instanceId === cardId)).toBe(false);
  });

  it('resolves explicit final-round victory and defeat states', () => {
    const base = createRun('casual', 404);
    const selected = base.player.hand[0].instanceId;
    const finalBase: GameState = {
      ...base,
      round: 8,
      selectedIds: [selected],
      player: { ...base.player, handsLeft: 1, score: 1_000_000 },
      bot: { ...base.bot, handsLeft: 1, score: 0 },
    };
    expect(gameReducer(finalBase, { type: 'PLAYER_PLAY' }).phase).toBe('victory');
    const losing: GameState = {
      ...finalBase,
      player: { ...finalBase.player, score: 0 },
      bot: { ...finalBase.bot, score: 1_000_000 },
    };
    expect(gameReducer(losing, { type: 'PLAYER_PLAY' }).phase).toBe('gameover');
  }, 20_000);
});
