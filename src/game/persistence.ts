import type { GameState, SaveGameV2 } from './types';
import { CARD_TEMPLATES } from './data';

export const SAVE_KEY = 'deck-of-prosperity-save-v2';
export const LEGACY_SAVE_KEY = 'cp_save_data';
export const HIGH_SCORE_KEY = 'deck-of-prosperity-high-score';

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveGameV2;
    if (save.version !== 2 || save.state.version !== 2) return null;
    // Preserve runs created during the short pre-publish retone while removing
    // the prototype companion identifiers from the published runtime.
    const legacyCompanion = save.state.companion as string;
    if (legacyCompanion === 'gemoy' || legacyCompanion === 'sari') save.state.companion = 'abah';
    if (legacyCompanion === 'soloman' || legacyCompanion === 'bima') save.state.companion = 'azah';
    // IDs encode group + internal rank, so refresh published names/art after a
    // value-ladder rebalance while keeping each run's instances and upgrades.
    const templates = new Map(CARD_TEMPLATES.map((template) => [template.id, template]));
    const refreshCard = <T extends { id: string; bonus?: number }>(card: T): T => {
      const template = templates.get(card.id);
      return template ? { ...card, ...template, bonus: card.bonus } : card;
    };
    save.state.player.drawPile = save.state.player.drawPile.map(refreshCard);
    save.state.player.discardPile = save.state.player.discardPile.map(refreshCard);
    save.state.player.hand = save.state.player.hand.map(refreshCard);
    save.state.marketExile = save.state.marketExile.map(refreshCard);
    save.state.lastPlayedCards = save.state.lastPlayedCards.map(refreshCard);
    if (save.state.shop) save.state.shop.acquisition = refreshCard(save.state.shop.acquisition);
    return save.state;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  if (!['playing', 'shop'].includes(state.phase)) return;
  const save: SaveGameV2 = { version: 2, savedAt: Date.now(), state };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function migrateLegacySave(): boolean {
  if (!localStorage.getItem(LEGACY_SAVE_KEY)) return false;
  localStorage.removeItem(LEGACY_SAVE_KEY);
  return true;
}

export function recordHighScore(score: number): number {
  const legacy = Number(localStorage.getItem('cp_highscore') ?? 0);
  const current = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  const next = Math.max(score, legacy, current);
  localStorage.setItem(HIGH_SCORE_KEY, String(next));
  return next;
}
