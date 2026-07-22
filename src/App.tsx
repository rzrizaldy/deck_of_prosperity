import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  BookOpen, Bot, Building2, Coins, Crown, RotateCcw,
  Eye, Sparkles, Train, Trash2, Trophy, Volume2, VolumeX, Wrench, X, Zap,
} from 'lucide-react';
import { playSound } from './game/audio';
import { CARD_TEMPLATES, GROUPS, HANDS } from './game/data';
import { allCards, deckSize, marketTarget, priceFor, scoreHand } from './game/engine';
import { clearSave, loadSave, migrateLegacySave, recordHighScore, saveGame } from './game/persistence';
import { gameReducer, initialState } from './game/reducer';
import type { Card, Difficulty, GameState, ScoreBreakdown, Tycoon } from './game/types';

const money = (value: number) => value.toLocaleString('en-US');

function AssetCard({ card, selected = false, compact = false, onClick, onInspect, index }: {
  card: Card; selected?: boolean; compact?: boolean; onClick?: () => void; onInspect?: () => void; index?: number;
}) {
  const group = GROUPS[card.group];
  const Icon = card.group === 'RAILROAD' ? Train : card.group === 'UTILITY' ? Zap : Building2;
  return (
    <button
      className={`asset-card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''} ${onInspect ? 'inspectable' : ''}`}
      style={{ '--group': group.color, '--group-ink': group.ink, '--card-index': index ?? 0 } as React.CSSProperties}
      onClick={(event) => {
        if (onInspect && (event.target as HTMLElement).closest('.card-art')) { onInspect(); return; }
        onClick?.();
      }}
      aria-pressed={selected}
      aria-label={`${index !== undefined ? `${index + 1}. ` : ''}${card.name}, ${card.chips + card.bonus} chips`}
      type="button"
    >
      <img className="card-art" src={`/assets/cards/${card.id}.webp`} alt={onInspect ? `Inspect ${card.name} artwork` : ''} loading="lazy" />
      {onInspect && <span className="inspect-hint" aria-hidden="true"><Eye /></span>}
      <span className="card-stripe">{group.label}</span>
      <Icon aria-hidden="true" />
      <strong>{card.name}</strong>
      <span className="card-value"><Coins aria-hidden="true" /> {card.chips + card.bonus}</span>
      {card.bonus > 0 && <span className="upgrade">+{card.bonus}</span>}
    </button>
  );
}

function CardPreview({ card, onClose }: { card: Card; onClose: () => void }) {
  const group = GROUPS[card.group];
  return <div className="card-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="card-preview" role="dialog" aria-modal="true" aria-label={`${card.name} card preview`} onMouseDown={(event) => event.stopPropagation()}>
      <button className="icon-button preview-close" onClick={onClose} aria-label="Close card preview"><X /></button>
      <img src={`/assets/cards/${card.id}.webp`} alt={`${card.name} pixel-noir property illustration`} />
      <div className="preview-vignette" />
      <div className="preview-details">
        <span style={{ '--preview-group': group.color } as React.CSSProperties}>{group.label}</span>
        <h2>{card.name}</h2>
        <div><b><Coins /> {card.chips + card.bonus}</b>{card.bonus > 0 && <small>Renovation +{card.bonus}</small>}</div>
        <p>{group.label} deed · click outside to return to the table</p>
      </div>
    </section>
  </div>;
}

function TycoonToken({ tycoon }: { tycoon: Tycoon }) {
  return <div className="tycoon-token" title={tycoon.description}><Crown /> <span>{tycoon.name}</span></div>;
}

function ScoreFormula({ score, label }: { score: ScoreBreakdown | null; label: string }) {
  if (!score) return <div className="score-formula muted"><span>{label}</span><strong>Select up to five deeds</strong></div>;
  return (
    <div className="score-formula">
      <span>{label} · {score.handName}</span>
      <strong>
        {score.cardChips + score.bonusChips}
        <small> × </small>
        {score.baseMultiplier + score.bonusMultiplier}
        {score.multiplicative !== 1 && <em> × {score.multiplicative.toFixed(2)}</em>}
        <b>= {money(score.total)}</b>
      </strong>
      {score.notes.length > 0 && <small>{score.notes.join(' · ')}</small>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

const HAND_RECIPES: Record<string, string[]> = {
  LIQUIDATION: ['BROWN', 'SKY', 'PINK'],
  DEVELOPMENT: ['SKY', 'SKY'],
  JOINT_VENTURE: ['BROWN', 'BROWN', 'PINK', 'PINK'],
  MONOPOLY: ['BROWN', 'BROWN'],
  CONGLOMERATE: ['BROWN', 'BROWN', 'PINK', 'PINK'],
  DIVERSIFIED: ['BROWN', 'SKY', 'PINK', 'ORANGE', 'RED'],
  TRANSPORT: ['RAILROAD', 'RAILROAD', 'RAILROAD', 'RAILROAD'],
};

function PortfolioRecipe({ hand }: { hand: keyof typeof HANDS }) {
  const groups = HAND_RECIPES[hand];
  const isConglomerate = hand === 'CONGLOMERATE';
  return (
    <div className="portfolio-recipe" aria-label={`${HANDS[hand].name} card pattern`}>
      <div className="recipe-cards">
        {groups.map((group, index) => {
          const visual = GROUPS[group as keyof typeof GROUPS];
          return <span key={`${group}-${index}`} style={{ '--recipe-color': visual.color, '--recipe-ink': visual.ink } as React.CSSProperties}>
            {hand === 'TRANSPORT' ? '↔' : visual.label.slice(0, 1)}
          </span>;
        })}
      </div>
      <small>{isConglomerate ? 'complete set + pair' : HANDS[hand].description}</small>
    </div>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="The Market Ledger" onClose={onClose}>
      <div className="guide-grid">
        <section>
          <h3>How the duel works</h3>
          <ol>
            <li>Draw eight deeds. Select one to five and score a portfolio.</li>
            <li>Use up to three discards per round to improve your hand.</li>
            <li>A published Market Target is the win condition. Clear it within four hands.</li>
            <li>The rival answers under the same rules as an atmospheric benchmark; beating it earns bragging rights, not survival.</li>
            <li>Clear eight escalating markets, then take the city.</li>
          </ol>
        </section>
        <section>
          <h3>Portfolio rankings</h3>
          <div className="rank-list">
            {Object.entries(HANDS).map(([key, hand]) => (
              <div key={key} className="rank-row"><PortfolioRecipe hand={key as keyof typeof HANDS} /><span><strong>{hand.name}</strong><small>{hand.description}</small></span><b>×{hand.multiplier}</b></div>
            ))}
          </div>
        </section>
        <section>
          <h3>Keyboard</h3>
          <p><kbd>1–8</kbd> select cards · <kbd>Enter</kbd> commit · <kbd>D</kbd> discard · <kbd>M</kbd> mute</p>
        </section>
      </div>
    </Modal>
  );
}

function Compendium({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Property Compendium" onClose={onClose}>
      <div className="compendium">
        {CARD_TEMPLATES.map((template, index) => <AssetCard key={template.id} card={{ ...template, instanceId: `catalog-${index}`, bonus: 0 }} compact />)}
      </div>
    </Modal>
  );
}

function Menu({ state, saved, highScore, legacyCleared, dispatch }: {
  state: GameState; saved: GameState | null; highScore: number; legacyCleared: boolean;
  dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('trader');
  const [guide, setGuide] = useState(false);
  const [compendium, setCompendium] = useState(false);
  return (
    <main className="menu-screen">
      <div className="menu-shade" />
      <section className="menu-panel">
        <img src="/assets/title.png" alt="Deck of Capitalist" className="title-art" />
        <p className="eyebrow">A pixel-noir property roguelike</p>
        <h1>Outplay the market.<br />Own the night.</h1>
        <p className="menu-copy">Build ruthless portfolios, hire tycoons, and clear eight escalating Jakarta market targets.</p>
        {legacyCleared && <p className="notice">The incompatible prototype save was retired. Your legacy high score remains.</p>}
        <fieldset className="difficulty-picker">
          <legend>Rival difficulty</legend>
          {(['casual', 'trader', 'tycoon'] as Difficulty[]).map((item) => (
            <button key={item} className={difficulty === item ? 'active' : ''} onClick={() => setDifficulty(item)} type="button">
              <strong>{item}</strong><small>{item === 'casual' ? 'Bold, imperfect' : item === 'trader' ? 'Calculated' : 'Relentless'}</small>
            </button>
          ))}
        </fieldset>
        <div className="menu-actions">
          <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty })}><Sparkles /> Start market run</button>
          {saved && <button className="secondary large" onClick={() => dispatch({ type: 'LOAD', state: saved })}>Continue round {saved.round}</button>}
        </div>
        <div className="menu-subactions">
          <button onClick={() => setGuide(true)}><BookOpen /> How to play</button>
          <button onClick={() => setCompendium(true)}><Building2 /> Cards</button>
          <button onClick={() => dispatch({ type: 'SET_MUTED', muted: !state.muted })}>{state.muted ? <VolumeX /> : <Volume2 />} Sound</button>
        </div>
        <div className="high-score"><Trophy /> Best run <strong>{money(highScore)}</strong></div>
      </section>
      {guide && <Guide onClose={() => setGuide(false)} />}
      {compendium && <Compendium onClose={() => setCompendium(false)} />}
    </main>
  );
}

function Hud({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]> }) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      <header className="game-hud">
        <div className="round-mark"><span>Market round</span><strong>{state.round}<small>/8</small></strong></div>
        <div className="duel-score" aria-label="Market score and target">
          <div><span>You</span><strong>{money(state.player.score)}</strong></div>
          <b>→</b>
          <div><span>Target</span><strong>{money(marketTarget(state.round))}</strong></div>
        </div>
        <div className="hud-actions">
          <span className={`difficulty-tag ${state.difficulty}`}>{state.difficulty}</span>
          <button className="icon-button" onClick={() => setGuide(true)} aria-label="Open rules"><BookOpen /></button>
          <button className="icon-button" onClick={() => dispatch({ type: 'SET_MUTED', muted: !state.muted })} aria-label={state.muted ? 'Unmute' : 'Mute'}>{state.muted ? <VolumeX /> : <Volume2 />}</button>
          <button className="icon-button" onClick={() => dispatch({ type: 'GO_MENU' })} aria-label="Return to menu"><X /></button>
        </div>
      </header>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </>
  );
}

function Intro({ dispatch }: { dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]> }) {
  const [page, setPage] = useState(0);
  const pages = [
    ['Beat the market', `Every market publishes a target. Market 1 needs ${money(marketTarget(1))}; clear it with four scoring hands.`],
    ['Build a portfolio', 'Select one to five deeds. The preview explains chips × multiplier before you commit. Pairs and complete groups scale fast.'],
    ['Control the deck', 'Discard up to three times to redraw. Cleared markets pay cash and open the Night Market for tycoons, renovations, and acquisitions.'],
  ];
  return <main className="intro-screen">
    <div className="intro-panel">
      <span className="eyebrow">Market briefing · {page + 1}/3</span>
      <h1>{pages[page][0]}</h1><p>{pages[page][1]}</p>
      <div className="intro-progress">{pages.map((_, index) => <i key={index} className={index <= page ? 'active' : ''} />)}</div>
      <div className="intro-actions">
        {page > 0 && <button className="secondary" onClick={() => setPage(page - 1)}>Back</button>}
        {page < pages.length - 1 ? <button className="primary" onClick={() => setPage(page + 1)}>Next</button> : <button className="primary" onClick={() => dispatch({ type: 'BEGIN_RUN' })}><Sparkles /> Deal market one</button>}
      </div>
    </div>
  </main>;
}

function GameTable({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]> }) {
  const [busy, setBusy] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const selected = state.player.hand.filter((card) => state.selectedIds.includes(card.instanceId));
  const prediction = useMemo(() => selected.length ? scoreHand(selected, state.player.tycoons) : null, [selected, state.player.tycoons]);
  const rivalName = state.round === 8 ? 'The Chairman' : 'Market Watcher';
  const portrait = state.round === 8 ? '/assets/generated/final-chairman-v2.png' : '/assets/generated/rival-broker-v2.png';

  const toggle = (cardId: string) => { dispatch({ type: 'TOGGLE_CARD', cardId }); playSound('select', state.muted); };
  const play = () => {
    if (!selected.length || busy) return;
    setBusy(true);
    window.setTimeout(() => {
      dispatch({ type: 'PLAYER_PLAY' });
      playSound('score', state.muted);
      setBusy(false);
    }, 620);
  };
  const discard = () => {
    if (!selected.length || busy) return;
    dispatch({ type: 'PLAYER_DISCARD' });
    playSound('discard', state.muted);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= '1' && event.key <= '8') {
        const card = state.player.hand[Number(event.key) - 1];
        if (card) toggle(card.instanceId);
      } else if (event.key === 'Enter') play();
      else if (event.key.toLowerCase() === 'd') discard();
      else if (event.key.toLowerCase() === 'm') dispatch({ type: 'SET_MUTED', muted: !state.muted });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <main className="game-screen">
      <Hud state={state} dispatch={dispatch} />
      <section className="table-layout">
        <aside className="rival-panel">
          <img src={portrait} alt={rivalName} />
          <div><span>Your rival</span><h2>{rivalName}</h2><p>{busy ? 'Calculating every angle…' : state.events.at(-2)?.message ?? 'Waiting for your move.'}</p></div>
          <div className="rival-resources"><span><b>{state.bot.handsLeft}</b> hands</span><span><b>{state.bot.discardsLeft}</b> discards</span><span><b>${state.bot.cash}</b> capital</span></div>
          <div className="token-row">{state.bot.tycoons.map((tycoon) => <TycoonToken key={tycoon.id} tycoon={tycoon} />)}</div>
        </aside>

        <section className="play-zone">
          <div className="round-track" aria-label={`Hand ${5 - state.player.handsLeft} of 4`}>
            {Array.from({ length: 4 }, (_, index) => <span key={index} className={index >= state.player.handsLeft ? 'done' : ''} />)}
          </div>
          <div className="market-target"><span>Market target</span><strong>{money(marketTarget(state.round))}</strong><small>{money(Math.max(0, marketTarget(state.round) - state.player.score))} remaining</small></div>
          <div className={`played-tray ${state.lastPlayedCards.length ? 'has-cards' : ''}`} aria-live="polite">
            <span className="played-label">{state.lastPlayedCards.length ? 'Last portfolio played' : 'Play your first portfolio'}</span>
            <div className="played-cards">
              {state.lastPlayedCards.map((card, index) => <AssetCard key={card.instanceId} card={card} compact index={index} onInspect={() => setInspectedCard(card)} />)}
            </div>
          </div>
          <div className="last-hands">
            <ScoreFormula score={state.lastPlayerScore} label="Your last hand" />
            <ScoreFormula score={state.lastBotScore} label="Rival response" />
          </div>
          <div className="event-ticker" aria-live="polite">{busy ? `${rivalName} studies the market…` : state.events.at(-1)?.message}</div>
          <ScoreFormula score={prediction} label="Projected return" />
        </section>

        <aside className="player-panel">
          <div className="player-resource"><span>Hands</span><strong>{state.player.handsLeft}</strong></div>
          <div className="player-resource"><span>Discards</span><strong>{state.player.discardsLeft}</strong></div>
          <div className="player-resource gold"><span>Capital</span><strong>${state.player.cash}</strong></div>
          <div className="deck-count"><span>Deck</span><b>{deckSize(state.player)}</b></div>
          <div className="token-row">{state.player.tycoons.map((tycoon) => <TycoonToken key={tycoon.id} tycoon={tycoon} />)}</div>
        </aside>
      </section>

      <section className="hand-dock" aria-label="Your hand">
        <div className="hand-cards">
          {state.player.hand.map((card, index) => <AssetCard key={card.instanceId} card={card} index={index} selected={state.selectedIds.includes(card.instanceId)} onClick={() => toggle(card.instanceId)} onInspect={() => setInspectedCard(card)} />)}
        </div>
        <div className="play-actions">
          <button className="secondary" disabled={!selected.length || state.player.discardsLeft < 1 || busy} onClick={discard}><RotateCcw /> Discard <small>{selected.length || ''}</small></button>
          <button className="primary" disabled={!selected.length || busy} onClick={play}><Coins /> {busy ? 'Rival thinking…' : 'Commit portfolio'}</button>
        </div>
      </section>
      {inspectedCard && <CardPreview card={inspectedCard} onClose={() => setInspectedCard(null)} />}
    </main>
  );
}

function Shop({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]> }) {
  const [cardId, setCardId] = useState(allCards(state.player)[0]?.instanceId ?? '');
  const shop = state.shop!;
  const deck = allCards(state.player).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const acquirePrice = priceFor(state.player, 4 + Math.floor(shop.acquisition.chips / 15));
  const buy = (action: Parameters<typeof gameReducer>[1]) => { dispatch(action); playSound('purchase', state.muted); };
  return (
    <main className="shop-screen">
      <Hud state={state} dispatch={dispatch} />
      <div className="shop-wrap">
        <header className="shop-heading"><div><span>Round {state.round} secured</span><h1>The Night Market</h1><p>Turn the last win into a stronger deck.</p></div><div className="cash-pile"><Coins /> ${state.player.cash}</div></header>
        <section>
          <h2><Crown /> Tycoon contracts <small>{state.player.tycoons.length}/5 hired</small></h2>
          <div className="shop-grid">
            {shop.tycoons.map((tycoon) => {
              const price = priceFor(state.player, tycoon.cost);
              const owned = state.player.tycoons.some((item) => item.id === tycoon.id);
              return <article className="shop-card" key={tycoon.id}><Crown /><h3>{tycoon.name}</h3><p>{tycoon.description}</p><button disabled={owned || state.player.cash < price || state.player.tycoons.length >= 5} onClick={() => buy({ type: 'BUY_TYCOON', tycoonId: tycoon.id })}>{owned ? 'Hired' : `Hire · $${price}`}</button></article>;
            })}
          </div>
        </section>
        <section>
          <h2><Building2 /> Deed desk</h2>
          <div className="deed-market">
            <article className="acquisition"><AssetCard card={{ ...shop.acquisition, instanceId: 'offer', bonus: 0 }} compact /><div><h3>Acquire deed</h3><p>Add this card permanently to your discard pile.</p><button disabled={state.player.cash < acquirePrice} onClick={() => buy({ type: 'BUY_ACQUISITION' })}>Acquire · ${acquirePrice}</button></div></article>
            <article className="deck-service">
              <select aria-label="Choose a deed" value={cardId} onChange={(event) => setCardId(event.target.value)}>
                {deck.map((card) => <option value={card.instanceId} key={card.instanceId}>{GROUPS[card.group].label} · {card.name} · {card.chips + card.bonus}</option>)}
              </select>
              <button disabled={shop.renovated || state.player.cash < priceFor(state.player, 4)} onClick={() => buy({ type: 'RENOVATE', cardId })}><Wrench /> {shop.renovated ? 'Renovated' : `Renovate +5 · $${priceFor(state.player, 4)}`}</button>
              <button disabled={shop.liquidated || deckSize(state.player) <= 32} onClick={() => buy({ type: 'LIQUIDATE', cardId })}><Trash2 /> {shop.liquidated ? 'Liquidated' : 'Liquidate · +$1'}</button>
            </article>
          </div>
        </section>
        <footer className="shop-footer">
          <button className="secondary" disabled={state.player.cash < shop.rerollCost} onClick={() => buy({ type: 'REROLL_SHOP' })}><RotateCcw /> Reroll · ${shop.rerollCost}</button>
          <button className="primary" onClick={() => { dispatch({ type: 'NEXT_ROUND' }); playSound('draw', state.muted); }}>Enter round {state.round + 1}</button>
        </footer>
      </div>
    </main>
  );
}

function Ending({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]> }) {
  const won = state.phase === 'victory';
  return (
    <main className={`ending ${won ? 'won' : 'lost'}`} style={{ backgroundImage: `url(/assets/generated/${won ? 'victory-jakarta.webp' : 'bankruptcy-jakarta.webp'})` }}>
      <div className="ending-shade" />
      <section>
        {won ? <Trophy /> : <Bot />}
        <span>{won ? 'Eight markets conquered' : `Run ended in round ${state.round}`}</span>
        <h1>{won ? 'The city is yours.' : 'The market collected.'}</h1>
        <p>{won ? 'The final market has cleared.' : `You needed ${money(marketTarget(state.round))} and closed at ${money(state.player.score)}.`}</p>
        <div className="ending-score"><span>Run score</span><strong>{money(state.runScore)}</strong></div>
        <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty: state.difficulty })}><Sparkles /> Run it back</button>
        <button className="ghost" onClick={() => dispatch({ type: 'GO_MENU' })}>Return to title</button>
      </section>
    </main>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [saved, setSaved] = useState<GameState | null>(() => loadSave());
  const [legacyCleared] = useState(() => migrateLegacySave());
  const [highScore, setHighScore] = useState(() => recordHighScore(0));

  useEffect(() => {
    saveGame(state);
    if (state.phase === 'playing' || state.phase === 'shop') setSaved(state);
    if (state.phase === 'victory' || state.phase === 'gameover') {
      clearSave();
      setSaved(null);
      setHighScore(recordHighScore(state.runScore));
      playSound(state.phase === 'victory' ? 'victory' : 'defeat', state.muted);
    }
    localStorage.setItem('doc-muted', String(state.muted));
  }, [state]);

  return (
    <>
      {state.phase === 'menu' && <Menu state={state} saved={saved} highScore={highScore} legacyCleared={legacyCleared} dispatch={dispatch} />}
      {state.phase === 'intro' && <Intro dispatch={dispatch} />}
      {state.phase === 'playing' && <GameTable state={state} dispatch={dispatch} />}
      {state.phase === 'shop' && <Shop state={state} dispatch={dispatch} />}
      {(state.phase === 'victory' || state.phase === 'gameover') && <Ending state={state} dispatch={dispatch} />}
      <div className="portrait-gate" role="status"><RotateCcw /><h2>Rotate to trade</h2><p>Deck of Capitalist is built for landscape play. Your run is saved.</p></div>
    </>
  );
}
