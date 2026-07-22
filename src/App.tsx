import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BookOpen, Building2, Coins, Crown, Music, RotateCcw,
  Eye, Maximize2, Minimize2, Sparkles, Target, Trash2, Trophy, Volume2, VolumeX, Wrench, X,
} from 'lucide-react';
import {
  getVolume, isBgmEnabled, playCompanionSfx, playSound, pulseHaptic, setBgmEnabled, setVolume,
  startBgm, stopBgm, unlockAudio,
} from './game/audio';
import { CARD_TEMPLATES, GROUPS, HANDS } from './game/data';
import { allCards, deckSize, MARKET_DIFFICULTY, marketTarget, MIN_DECK_SIZE, priceFor, scoreHand } from './game/engine';
import { clearSave, loadSave, migrateLegacySave, recordHighScore, saveGame } from './game/persistence';
import { gameReducer, initialState } from './game/reducer';
import type { Card, Difficulty, GameState, ScoreBreakdown, Tycoon } from './game/types';

type Dispatch = React.Dispatch<Parameters<typeof gameReducer>[1]>;

const money = (value: number) => value.toLocaleString('en-US');
const clearedPercent = (score: number, target: number) =>
  Math.max(0, Math.min(100, Math.round((score / Math.max(1, target)) * 100)));

const COMPANIONS = {
  gemoy: {
    name: 'AntekAsync',
    title: 'The All-Caps Enforcer',
    asset: '/assets/companions/gemoy.png',
    intro: 'Big moves, bigger grin. Show the market who owns the table.',
  },
  soloman: {
    name: 'Soloman',
    title: 'The Royal Counselor',
    asset: '/assets/companions/soloman.png',
    intro: 'A calm hand wins loud markets. Build the multiplier before the spectacle.',
  },
} as const;

function AnimatedNumber({ value, active = false, duration = 460 }: { value: number; active?: boolean; duration?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <span className={active ? 'number-pop' : ''}>{money(shown)}</span>;
}

/** Shared horizontal fill used by the HUD and the table medallion. */
function ProgressRail({ score, target, tone = 'hud' }: { score: number; target: number; tone?: 'hud' | 'table' }) {
  const percent = clearedPercent(score, target);
  return (
    <div
      className={`progress-rail ${tone} ${percent >= 100 ? 'cleared' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`Market target ${percent}% cleared`}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

function AudioControls({ state, dispatch, compact = false }: { state: GameState; dispatch: Dispatch; compact?: boolean }) {
  const [volume, setLevel] = useState(() => getVolume());
  const [bgm, setBgm] = useState(() => isBgmEnabled());
  const toggleMute = () => {
    unlockAudio();
    dispatch({ type: 'SET_MUTED', muted: !state.muted });
  };
  const changeVolume = (next: number) => {
    unlockAudio();
    setLevel(setVolume(next));
    if (!state.muted && next > 0) playSound('select', false);
  };
  const toggleBgm = () => {
    unlockAudio();
    const next = setBgmEnabled(!bgm);
    setBgm(next);
    if (next && !state.muted) startBgm(false); else stopBgm();
  };
  return (
    <div className={`audio-controls ${compact ? 'compact' : ''}`}>
      <button
        className={compact ? 'icon-button' : ''}
        onClick={toggleMute}
        aria-pressed={state.muted}
        aria-label={state.muted ? 'Unmute sound' : 'Mute sound'}
      >
        {state.muted ? <VolumeX /> : <Volume2 />}{!compact && <span>Sound</span>}
      </button>
      <input
        className="volume-slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        onChange={(event) => changeVolume(Number(event.target.value) / 100)}
        aria-label="Volume"
        title={`Volume ${Math.round(volume * 100)}%`}
      />
      <button
        className={`${compact ? 'icon-button' : ''} ${bgm ? '' : 'off'}`}
        onClick={toggleBgm}
        aria-pressed={bgm}
        aria-label={bgm ? 'Turn background music off' : 'Turn background music on'}
      >
        <Music />{!compact && <span>Music</span>}
      </button>
    </div>
  );
}

function FullscreenButton() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Some mobile browsers do not permit page fullscreen; the safe-area canvas remains usable.
    }
  };
  return <button className="icon-button fullscreen-button" onClick={() => void toggle()} aria-pressed={active} aria-label={active ? 'Exit full screen' : 'Full screen'} title={active ? 'Exit full screen' : 'Tap for full screen'}>{active ? <Minimize2 /> : <Maximize2 />}</button>;
}

type ScoreStage = 'cards' | 'chips' | 'multiplier' | 'total';
interface ScoreSequence { cards: Card[]; score: ScoreBreakdown; stage: ScoreStage; id: number; }

function ScoreCascade({ sequence }: { sequence: ScoreSequence }) {
  const { score, stage } = sequence;
  const chips = score.cardChips + score.bonusChips;
  const multiplier = score.baseMultiplier + score.bonusMultiplier;
  const showChips = stage !== 'cards';
  const showMultiplier = stage === 'multiplier' || stage === 'total';
  const showTotal = stage === 'total';
  return <div className={`score-cascade stage-${stage}`} aria-live="assertive" aria-label={`Scoring ${score.handName}: ${money(score.total)}`}>
    <span className="cascade-hand">{score.handName}</span>
    <div className={showChips ? 'cascade-part live' : 'cascade-part'}><small>CHIPS</small><strong>{showChips && <AnimatedNumber value={chips} active />}</strong></div>
    <i className={showMultiplier ? 'live' : ''}>×</i>
    <div className={showMultiplier ? 'cascade-part live multiplier' : 'cascade-part multiplier'}><small>MULT</small><strong>{showMultiplier && <AnimatedNumber value={multiplier} active />}</strong></div>
    {score.multiplicative !== 1 && <em className={showMultiplier ? 'live' : ''}>× {score.multiplicative.toFixed(2)}</em>}
    <div className={showTotal ? 'cascade-total live' : 'cascade-total'}><small>PORTFOLIO VALUE</small><strong>{showTotal && <AnimatedNumber value={score.total} active duration={620} />}</strong></div>
  </div>;
}

function AssetCard({ card, selected = false, compact = false, departing = false, onClick, onInspect, index }: {
  card: Card; selected?: boolean; compact?: boolean; departing?: boolean; onClick?: () => void; onInspect?: () => void; index?: number;
}) {
  const group = GROUPS[card.group];
  const holdTimer = useRef<number>();
  const hoverTimer = useRef<number>();
  const held = useRef(false);
  const stopPreviewTimers = () => {
    if (holdTimer.current !== undefined) window.clearTimeout(holdTimer.current);
    if (hoverTimer.current !== undefined) window.clearTimeout(hoverTimer.current);
    holdTimer.current = undefined;
    hoverTimer.current = undefined;
  };
  const beginHolding = () => {
    if (!onInspect || !onClick) return;
    held.current = false;
    stopPreviewTimers();
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      onInspect();
    }, 620);
  };
  const beginHoverPreview = () => {
    if (!onInspect || !onClick) return;
    stopPreviewTimers();
    hoverTimer.current = window.setTimeout(() => {
      held.current = true;
      onInspect();
    }, 2000);
  };
  return (
    <button
      className={`asset-card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''} ${departing ? 'departing' : ''} ${onInspect ? 'inspectable' : ''}`}
      style={{ '--group': group.color, '--group-ink': group.ink, '--card-index': index ?? 0 } as React.CSSProperties}
      onClick={() => {
        if (held.current) { held.current = false; return; }
        if (onClick) { onClick(); return; }
        onInspect?.();
      }}
      onPointerDown={beginHolding}
      onPointerUp={stopPreviewTimers}
      onPointerCancel={stopPreviewTimers}
      onPointerEnter={beginHoverPreview}
      onPointerLeave={stopPreviewTimers}
      aria-pressed={selected}
      /* The ordinal is the 1-8 keyboard shortcut, so only selectable hand cards get one. */
      aria-label={`${onClick && index !== undefined ? `${index + 1}. ` : ''}${card.name}, ${card.chips + card.bonus} chips`}
      type="button"
    >
      <img className="card-art" src={`/assets/cards/${card.id}.webp`} alt={onInspect ? `Inspect ${card.name} artwork` : ''} loading="lazy" />
      {onInspect && <span className="inspect-hint" aria-hidden="true"><Eye /></span>}
      <span className="card-stripe">{group.label}</span>
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

function TycoonPreview({ tycoon, onClose }: { tycoon: Tycoon; onClose: () => void }) {
  return <div className="card-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="card-preview tycoon-preview" role="dialog" aria-modal="true" aria-label={`${tycoon.name} Tycoon card preview`} onMouseDown={(event) => event.stopPropagation()}>
      <button className="icon-button preview-close" onClick={onClose} aria-label="Close Tycoon preview"><X /></button>
      <img src={`/assets/tycoons/${tycoon.id}.webp`} alt={`${tycoon.name} pixel-noir Tycoon artwork`} />
      <div className="preview-vignette" />
      <div className="preview-details">
        <span><Crown /> Tycoon helper</span>
        <h2>{tycoon.name}</h2>
        <p>{tycoon.description}</p>
        <small>Recruited helpers stay in your Inner Circle for the full run.</small>
      </div>
    </section>
  </div>;
}

function TycoonCard({ tycoon, compact = false, bought = false, children, onInspect }: {
  tycoon: Tycoon; compact?: boolean; bought?: boolean; children?: React.ReactNode; onInspect?: () => void;
}) {
  const content = <>
    <img src={`/assets/tycoons/${tycoon.id}.webp`} alt={`${tycoon.name} tycoon helper`} loading="lazy" />
    <div className="tycoon-card-copy">
      <span><Crown aria-hidden="true" /> Tycoon</span>
      <h3>{tycoon.name}</h3>
      {!compact && <p>{tycoon.description}</p>}
      {children}
    </div>
  </>;
  if (compact && onInspect) return <button className="tycoon-card compact tycoon-inspect" onClick={onInspect} aria-label={`Inspect ${tycoon.name} Tycoon card`} type="button">{content}</button>;
  return <article className={`tycoon-card ${compact ? 'compact' : ''} ${bought ? 'bought' : ''}`}>{content}</article>;
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

/**
 * The coloured mini-cards ARE the explanation of the pattern — matching colours
 * read as "same group" at a glance. The wording lives once, next to the name.
 */
function PortfolioRecipe({ hand }: { hand: keyof typeof HANDS }) {
  const groups = HAND_RECIPES[hand];
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
    </div>
  );
}

/**
 * The chips x mult formula is the whole game and was only ever shown as a live
 * readout mid-hand. One worked example teaches it before the first card.
 */
function ScoringExample() {
  const java = GROUPS.SKY;
  const swatch = { '--recipe-color': java.color, '--recipe-ink': java.ink } as React.CSSProperties;
  return (
    <figure className="scoring-example">
      <div className="example-cards">
        <span style={swatch}>Bandung<b>10</b></span>
        <span style={swatch}>Bogor<b>10</b></span>
      </div>
      <figcaption>Two <b>Java</b> deeds make a pair — that is a <b>Development</b>.</figcaption>
      <div className="example-maths">
        <span><small>chips</small><strong>20</strong></span>
        <i>×</i>
        <span><small>mult</small><strong>2</strong></span>
        <i>=</i>
        <span className="example-total"><small>score</small><strong>40</strong></span>
      </div>
      <figcaption>Add the deed values, multiply by the pattern. Bigger patterns pay far more, so five weak cards often beat two strong ones.</figcaption>
    </figure>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="The Market Ledger" onClose={onClose}>
      <div className="guide-grid">
        <section>
          <h3>Scoring, in one hand</h3>
          <ScoringExample />
          <h3>Each market</h3>
          <ol>
            <li>You get <b>four hands</b> to beat the market target, and <b>three discards</b> to fix bad draws.</li>
            <li>Clear the target and you are paid, then the <b>Night Market</b> opens to upgrade your deck.</li>
            <li>Miss it and the run ends. Eight markets in a row wins the city.</li>
          </ol>
          <h3>Words you will see</h3>
          <dl className="glossary">
            <div><dt>Deed</dt><dd>One property card. Its number is its chip value.</dd></div>
            <div><dt>Group</dt><dd>Deeds sharing a colour, like the three Java cities. Matching groups is how multipliers grow.</dd></div>
            <div><dt>Tycoon</dt><dd>A hired helper that adds chips or multiplier whenever its condition is met.</dd></div>
            <div><dt>Renovate</dt><dd>Pay to give one deed +5 chips, permanently.</dd></div>
            <div><dt>Liquidate</dt><dd>Destroy one deed for $1. A smaller deck draws your best cards more often.</dd></div>
          </dl>
        </section>
        <section>
          <h3>Portfolio patterns</h3>
          <p className="guide-note">Higher patterns are rarer and multiply far harder. The swatches show which groups the cards must come from.</p>
          <div className="rank-list">
            {Object.entries(HANDS).map(([key, hand]) => (
              <div key={key} className="rank-row"><PortfolioRecipe hand={key as keyof typeof HANDS} /><span><strong>{hand.name}</strong><small>{hand.description}</small></span><b>×{hand.multiplier}</b></div>
            ))}
          </div>
          <h3>Keyboard</h3>
          <p><kbd>1–8</kbd> select cards · <kbd>Enter</kbd> commit · <kbd>D</kbd> discard · <kbd>M</kbd> mute</p>
        </section>
      </div>
    </Modal>
  );
}

function Compendium({ onClose }: { onClose: () => void }) {
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  return (
    <Modal title="Property Compendium" onClose={onClose}>
      <p className="compendium-hint">Click a deed illustration to inspect it full size.</p>
      <div className="compendium">
        {CARD_TEMPLATES.map((template, index) => {
          const card = { ...template, instanceId: `catalog-${index}`, bonus: 0 };
          return <AssetCard key={template.id} card={card} compact onInspect={() => setInspectedCard(card)} />;
        })}
      </div>
      {inspectedCard && <CardPreview card={inspectedCard} onClose={() => setInspectedCard(null)} />}
    </Modal>
  );
}

function Menu({ state, saved, highScore, legacyCleared, dispatch }: {
  state: GameState; saved: GameState | null; highScore: number; legacyCleared: boolean; dispatch: Dispatch;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('trader');
  const [companion, setCompanion] = useState<GameState['companion']>('gemoy');
  const [guide, setGuide] = useState(false);
  const [compendium, setCompendium] = useState(false);
  return (
    <main className="menu-screen game-frame">
      <div className="menu-shade" />
      <section className="menu-brand">
        <div className="title-lockup">
          <img src="/assets/title.png" alt="Deck of Capitalist" />
        </div>
        <p className="eyebrow">Monopoly your archipelago</p>
        <h1>Dominate 58%.</h1>
        <p className="menu-copy">Be a ruthless tycoon.</p>
        <div className="high-score"><Trophy /> Best run <strong>{money(highScore)}</strong></div>
      </section>
      <section className="menu-panel">
        {legacyCleared && <p className="notice">The incompatible prototype save was retired. Your legacy high score remains.</p>}
        <fieldset className="difficulty-picker">
          <legend>Market difficulty · changes target scores only</legend>
          {(['casual', 'trader', 'tycoon'] as Difficulty[]).map((item) => (
            <button key={item} className={difficulty === item ? 'active' : ''} onClick={() => setDifficulty(item)} type="button">
              <strong>{MARKET_DIFFICULTY[item].label}</strong><small>{MARKET_DIFFICULTY[item].description}</small>
            </button>
          ))}
        </fieldset>
        <fieldset className="companion-picker">
          <legend>Choose your Konco</legend>
          {(Object.entries(COMPANIONS) as [GameState['companion'], typeof COMPANIONS[keyof typeof COMPANIONS]][]).map(([id, buddy]) => (
            <button key={id} className={companion === id ? 'active' : ''} onClick={() => setCompanion(id)} type="button" aria-pressed={companion === id}>
              <img src={buddy.asset} alt="" />
              <span><strong>{buddy.name}</strong><small>{buddy.title}</small></span>
            </button>
          ))}
        </fieldset>
        <div className="menu-actions">
          <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty, companion })}><Sparkles /> Start market run</button>
          {saved && <button className="secondary large" onClick={() => dispatch({ type: 'LOAD', state: saved })}>Continue round {saved.round}</button>}
        </div>
        <div className="menu-subactions">
          <button onClick={() => setGuide(true)}><BookOpen /> <span>How to play</span></button>
          <button onClick={() => setCompendium(true)}><Building2 /> <span>Cards</span></button>
          <AudioControls state={state} dispatch={dispatch} />
        </div>
      </section>
      {guide && <Guide onClose={() => setGuide(false)} />}
      {compendium && <Compendium onClose={() => setCompendium(false)} />}
    </main>
  );
}

function Hud({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const [guide, setGuide] = useState(false);
  const target = marketTarget(state.round, state.difficulty);
  return (
    <>
      <header className="game-hud">
        <div className="round-mark"><span>Market round</span><strong>{state.round}<small>/8</small></strong></div>
        <div className="market-progress" aria-label="Market progress">
          <div className="progress-figures">
            <span>Portfolio</span>
            <strong><AnimatedNumber value={state.player.score} active /></strong>
            <em>of</em>
            <span>Target</span>
            <b>{money(target)}</b>
          </div>
          <ProgressRail score={state.player.score} target={target} />
        </div>
        <div className="hud-actions">
          <AudioControls state={state} dispatch={dispatch} compact />
          <FullscreenButton />
          <button className="icon-button" onClick={() => setGuide(true)} aria-label="Open rules"><BookOpen /></button>
          <button className="icon-button" onClick={() => dispatch({ type: 'GO_MENU' })} aria-label="Return to menu"><X /></button>
        </div>
      </header>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </>
  );
}

function Intro({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const target = money(marketTarget(1, state.difficulty));
  const buddy = COMPANIONS[state.companion];
  return <main className="intro-screen game-frame">
    <div className="intro-panel">
      <span className="eyebrow">Market 1 · {MARKET_DIFFICULTY[state.difficulty].label} difficulty</span>
      <h1>Reach {target} in four hands.</h1>
      {/* The first three things the player will actually touch, in order. The
          Night Market is deliberately left out — they meet it when they win. */}
      <ul className="intro-points">
        <li><Building2 aria-hidden="true" /><span>Tap <b>one to five deeds</b>, then commit. Deeds of the <b>same colour</b> score far harder together.</span></li>
        <li><RotateCcw aria-hidden="true" /><span>Bad draw? <b>Discard up to three times</b> to swap cards for new ones.</span></li>
        <li><Target aria-hidden="true" /><span>The bar at the top tracks how close you are. Run out of hands short of the target and the run ends.</span></li>
      </ul>
      <div className="intro-companion"><img src={buddy.asset} alt="" /><p><b>{buddy.name}</b><span>“{buddy.intro}”</span></p></div>
      <div className="intro-actions">
        <button className="primary large" onClick={() => dispatch({ type: 'BEGIN_RUN' })}><Sparkles /> Deal market one</button>
      </div>
    </div>
  </main>;
}

function CompanionRail({ state }: { state: GameState }) {
  const buddy = COMPANIONS[state.companion];
  const selected = state.selectedIds.length;
  const remaining = Math.max(0, marketTarget(state.round, state.difficulty) - state.player.score);
  const loud = state.lastPlayerScore
    ? `${state.lastPlayerScore.handName.toUpperCase()} FOR ${money(state.lastPlayerScore.total)}!!! KEEP CRUSHING IT!!!`
    : selected >= 2
      ? `${selected} DEEDS READY!!! STOP THINKING, COMMIT IT!!!`
      : state.player.discardsLeft === 0
        ? 'NO MORE REDRAWS!!! MAKE THIS COUNT!!!'
        : `${money(remaining)} LEFT!!! BUY, BUILD, BULLDOZE!!!`;
  const dry = state.lastPlayerScore
    ? `${state.lastPlayerScore.handName}, ${money(state.lastPlayerScore.total)}. Lumayan. Angka juga bisa bersopan santun.`
    : selected >= 2
      ? `${selected} deed sudah dipilih. Kalau berkenan, cek multiplier sebelum gegabah.`
      : state.player.discardsLeft === 0
        ? 'Diskon kesempatan sudah habis. Seperti biasa, keputusan tetap milikmu.'
        : `${money(remaining)} lagi. Pelan saja; pasar tidak ke mana-mana.`;
  const message = state.companion === 'gemoy' ? loud : dry;
  return <section className="companion-rail" aria-label={`${buddy.name}, your Konco`}>
    <div className="companion-bubble"><b>{buddy.name}</b><span>{message}</span></div>
    <img src={buddy.asset} alt={`${buddy.name}, ${buddy.title}`} />
  </section>;
}

function GameTable({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const [busy, setBusy] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const [inspectedTycoon, setInspectedTycoon] = useState<Tycoon | null>(null);
  const [sequence, setSequence] = useState<ScoreSequence | null>(null);
  const [discardingIds, setDiscardingIds] = useState<string[]>([]);
  const [reshuffling, setReshuffling] = useState(false);
  const selected = state.player.hand.filter((card) => state.selectedIds.includes(card.instanceId));
  const prediction = useMemo(() => selected.length ? scoreHand(selected, state.player.tycoons) : null, [selected, state.player.tycoons]);
  const target = marketTarget(state.round, state.difficulty);
  const remaining = Math.max(0, target - state.player.score);

  const toggle = (cardId: string) => {
    unlockAudio();
    const removing = state.selectedIds.includes(cardId);
    dispatch({ type: 'TOGGLE_CARD', cardId });
    playSound(removing ? 'deselect' : 'select', state.muted);
    pulseHaptic(5);
  };
  const play = () => {
    if (!selected.length || !prediction || busy) return;
    unlockAudio();
    setBusy(true);
    const id = Date.now();
    setSequence({ cards: selected, score: prediction, stage: 'cards', id });
    playSound('play', state.muted);
    playCompanionSfx(state.companion, state.muted);
    pulseHaptic(8);
    window.setTimeout(() => { setSequence((current) => current?.id === id ? { ...current, stage: 'chips' } : current); playSound('chips', state.muted); pulseHaptic(5); }, 280);
    window.setTimeout(() => { setSequence((current) => current?.id === id ? { ...current, stage: 'multiplier' } : current); playSound('multiplier', state.muted); pulseHaptic(6); }, 600);
    window.setTimeout(() => { dispatch({ type: 'PLAYER_PLAY' }); setSequence((current) => current?.id === id ? { ...current, stage: 'total' } : current); playSound('score', state.muted); pulseHaptic([12, 22, 18]); }, 900);
    window.setTimeout(() => { setSequence((current) => current?.id === id ? null : current); setBusy(false); }, 1680);
  };
  const discard = () => {
    if (!selected.length || busy) return;
    unlockAudio();
    setBusy(true);
    setDiscardingIds(selected.map((card) => card.instanceId));
    playSound('discard', state.muted);
    pulseHaptic(10);
    window.setTimeout(() => dispatch({ type: 'PLAYER_DISCARD' }), 310);
    window.setTimeout(() => { setDiscardingIds([]); setBusy(false); }, 520);
  };

  // Recycling the discard pile is a real deck event, so it gets its own cue.
  const reshuffles = state.reshuffles;
  const seenReshuffles = useRef(reshuffles);
  useEffect(() => {
    if (reshuffles === seenReshuffles.current) return;
    seenReshuffles.current = reshuffles;
    playSound('shuffle', state.muted);
    setReshuffling(true);
    const timer = window.setTimeout(() => setReshuffling(false), 640);
    return () => window.clearTimeout(timer);
  }, [reshuffles, state.muted]);

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
    <main className="game-screen game-frame">
      <Hud state={state} dispatch={dispatch} />
      <section className="table-layout">
        <aside className="commentary-panel">
          <CompanionRail state={state} />
          <div className="market-log" aria-live="polite">
            <span>Market desk</span>
            <p>{busy ? 'Portfolio settling…' : state.events.at(-1)?.message}</p>
          </div>
        </aside>
        <section className="play-zone">
          {/* One name for one thing: "market", never "blind" or "ante" as well. */}
          <div className="table-kicker"><span>Jakarta property market</span><b>Market {state.round} of 8</b></div>
          <div className="round-track" aria-label={`Hand ${5 - state.player.handsLeft} of 4`}>
            {Array.from({ length: 4 }, (_, index) => <span key={index} className={index >= state.player.handsLeft ? 'done' : ''} />)}
          </div>
          <div className="market-target">
            <span><Target aria-hidden="true" /> {MARKET_DIFFICULTY[state.difficulty].label} target</span>
            <strong>{money(target)}</strong>
            <ProgressRail score={state.player.score} target={target} tone="table" />
            <small>{remaining ? `${money(remaining)} to clear` : 'Target cleared'}</small>
          </div>
          <section className="tycoon-shelf" aria-label="Your Tycoon helpers">
            <header><Crown aria-hidden="true" /><span>Inner circle</span><b>{state.player.tycoons.length}/5</b></header>
            <div className="tycoon-lineup">
              {state.player.tycoons.length
                ? state.player.tycoons.map((tycoon) => <TycoonCard key={tycoon.id} tycoon={tycoon} compact onInspect={() => setInspectedTycoon(tycoon)} />)
                : <p>Clear this market, then hire a Tycoon at the Night Market.</p>}
            </div>
          </section>
          <div className={`played-tray ${state.lastPlayedCards.length ? 'has-cards' : ''}`} aria-live="polite">
            <span className="played-label">{state.lastPlayedCards.length ? 'Last portfolio played' : 'Play your first portfolio'}</span>
            <div className="played-cards">
              {state.lastPlayedCards.map((card, index) => <AssetCard key={card.instanceId} card={card} compact index={index} onInspect={() => setInspectedCard(card)} />)}
            </div>
          </div>
          {sequence && <div className="score-sequence" aria-hidden="true">
            <div className="flight-cards">{sequence.cards.map((card, index) => <img key={card.instanceId} src={`/assets/cards/${card.id}.webp`} style={{ '--flight-index': index } as React.CSSProperties} alt="" />)}</div>
            <ScoreCascade sequence={sequence} />
          </div>}
          <div className="last-hands">
            <ScoreFormula score={state.lastPlayerScore} label="Your last hand" />
          </div>
          <ScoreFormula score={prediction} label="Selected hand" />
        </section>

        <aside className="player-panel">
          <div className="player-resource"><span>Hands</span><strong>{state.player.handsLeft}</strong></div>
          <div className="player-resource"><span>Discards</span><strong>{state.player.discardsLeft}</strong></div>
          <div className="player-resource gold"><span>Capital</span><strong>${state.player.cash}</strong></div>
          <div className={`deck-count ${reshuffling ? 'reshuffling' : ''}`}>
            <span>Deck</span><b>{deckSize(state.player)}</b>
            {reshuffling && <em aria-hidden="true">reshuffled</em>}
          </div>
        </aside>
      </section>

      <section className="hand-dock" aria-label="Your hand">
        <div className="hand-cards">
          {state.player.hand.map((card, index) => <AssetCard key={card.instanceId} card={card} index={index} selected={state.selectedIds.includes(card.instanceId)} departing={discardingIds.includes(card.instanceId)} onClick={() => toggle(card.instanceId)} onInspect={() => setInspectedCard(card)} />)}
        </div>
        <div className="play-actions">
          <button className="secondary" disabled={!selected.length || state.player.discardsLeft < 1 || busy} onClick={discard}><RotateCcw /> Discard <small>{selected.length || ''}</small></button>
          <button className="primary" disabled={!selected.length || busy} onClick={play}><Coins /> {busy ? 'Scoring portfolio…' : 'Commit portfolio'}</button>
        </div>
      </section>
      {inspectedCard && <CardPreview card={inspectedCard} onClose={() => setInspectedCard(null)} />}
      {inspectedTycoon && <TycoonPreview tycoon={inspectedTycoon} onClose={() => setInspectedTycoon(null)} />}
    </main>
  );
}

function Shop({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const [cardId, setCardId] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [spend, setSpend] = useState<{ amount: number; id: number } | null>(null);
  const shop = state.shop!;
  const deck = allCards(state.player).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const acquirePrice = priceFor(state.player, 4 + Math.floor(shop.acquisition.chips / 15));
  const renovatePrice = priceFor(state.player, 4);
  // Falling back to the first card in the rack keeps the highlight on screen and
  // survives a liquidate, which removes whatever was selected.
  const activeId = deck.some((card) => card.instanceId === cardId) ? cardId : (deck[0]?.instanceId ?? '');
  const picked = deck.find((card) => card.instanceId === activeId) ?? null;
  const canLiquidate = deckSize(state.player) > MIN_DECK_SIZE;

  const buy = useCallback((action: Parameters<typeof gameReducer>[1], key: string, cost: number) => {
    unlockAudio();
    dispatch(action);
    playSound('purchase', state.muted);
    pulseHaptic(8);
    setFlash(key);
    setSpend({ amount: cost, id: Date.now() });
    window.setTimeout(() => setFlash((current) => (current === key ? null : current)), 520);
  }, [dispatch, state.muted]);

  useEffect(() => {
    if (!spend) return;
    const timer = window.setTimeout(() => setSpend(null), 900);
    return () => window.clearTimeout(timer);
  }, [spend]);

  return (
    <main className="shop-screen game-frame">
      <Hud state={state} dispatch={dispatch} />
      <div className="shop-wrap">
        <header className="shop-heading">
          <div><span>Round {state.round} secured</span><h1>The Night Market</h1><p>Turn the last win into a stronger deck.</p></div>
          <div className={`cash-pile ${spend ? 'spending' : ''}`}>
            <Coins /> ${state.player.cash}
            {spend && <b key={spend.id} className="spend-chip" aria-hidden="true">-${spend.amount}</b>}
          </div>
        </header>
        <section>
          <h2><Crown /> Tycoon contracts <small>{state.player.tycoons.length}/5 hired</small></h2>
          <div className="shop-grid">
            {shop.tycoons.map((tycoon) => {
              const price = priceFor(state.player, tycoon.cost);
              const owned = state.player.tycoons.some((item) => item.id === tycoon.id);
              return <TycoonCard key={tycoon.id} tycoon={tycoon} bought={flash === tycoon.id}>
                <button
                  disabled={owned || state.player.cash < price || state.player.tycoons.length >= 5}
                  onClick={() => buy({ type: 'BUY_TYCOON', tycoonId: tycoon.id }, tycoon.id, price)}
                >{owned ? 'Hired' : `Hire · $${price}`}</button>
              </TycoonCard>;
            })}
          </div>
        </section>
        <section>
          <h2><Building2 /> Deed desk</h2>
          <div className="deed-market">
            <article className={`acquisition ${flash === 'acquire' ? 'bought' : ''}`}>
              <AssetCard card={{ ...shop.acquisition, instanceId: 'offer', bonus: 0 }} compact />
              <div>
                <h3>Acquire this deed</h3>
                <p>Adds a <b>{shop.acquisition.name}</b> to your deck for the rest of the run. Your deck grows to {deckSize(state.player) + 1} cards.</p>
                <button disabled={state.player.cash < acquirePrice} onClick={() => buy({ type: 'BUY_ACQUISITION' }, 'acquire', acquirePrice)}>Acquire · ${acquirePrice}</button>
              </div>
            </article>
            <article className={`deck-service ${flash === 'service' ? 'bought' : ''}`}>
              <h3>Work on a deed you already own</h3>
              {/* A scrolling rack of real cards — picking your own deed should feel
                  like handling the deck, not filling in a form. */}
              <div className="deed-picker" role="radiogroup" aria-label="Choose a deed from your deck">
                {deck.map((card) => (
                  <AssetCard
                    key={card.instanceId}
                    card={card}
                    compact
                    selected={card.instanceId === activeId}
                    onClick={() => { setCardId(card.instanceId); playSound('select', state.muted); }}
                  />
                ))}
              </div>
              <div className="deed-actions">
                <div className="deed-action">
                  <button disabled={shop.renovated || state.player.cash < renovatePrice} onClick={() => buy({ type: 'RENOVATE', cardId: activeId }, 'service', renovatePrice)}>
                    <Wrench /> {shop.renovated ? 'Renovated' : `Renovate · $${renovatePrice}`}
                  </button>
                  <small>
                    {picked
                      ? <>Permanently upgrades <b>{picked.name}</b> from {picked.chips + picked.bonus} to <b>{picked.chips + picked.bonus + 5} chips</b>, every round from now on.</>
                      : 'Permanently adds +5 chips to the chosen deed.'}
                  </small>
                </div>
                <div className="deed-action">
                  <button disabled={shop.liquidated || !canLiquidate} onClick={() => buy({ type: 'LIQUIDATE', cardId: activeId }, 'service', 0)}>
                    <Trash2 /> {shop.liquidated ? 'Liquidated' : 'Liquidate · +$1'}
                  </button>
                  <small>
                    {canLiquidate
                      ? <>Destroys <b>{picked ? picked.name : 'the chosen deed'}</b> for $1. A thinner deck ({deckSize(state.player) - 1} cards) draws your best deeds more often.</>
                      : <>Your deck is at the {MIN_DECK_SIZE}-card minimum, so nothing can be destroyed.</>}
                  </small>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
      {/* Pinned outside the scroll region so the exit is never below the fold. */}
      <footer className="shop-footer">
        <button className="secondary" disabled={state.player.cash < shop.rerollCost} onClick={() => buy({ type: 'REROLL_SHOP' }, 'reroll', shop.rerollCost)}><RotateCcw /> Reroll · ${shop.rerollCost}</button>
        <button className="primary" onClick={() => { unlockAudio(); dispatch({ type: 'NEXT_ROUND' }); playSound('draw', state.muted); }}>Enter round {state.round + 1}</button>
      </footer>
    </main>
  );
}

function Ending({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const won = state.phase === 'victory';
  return (
    <main className={`ending game-frame ${won ? 'won' : 'lost'}`} style={{ backgroundImage: `url(/assets/generated/${won ? 'victory-jakarta.webp' : 'bankruptcy-jakarta.webp'})` }}>
      <div className="ending-shade" />
      <section>
        {won ? <Trophy /> : <Coins />}
        <span>{won ? 'Eight markets conquered' : `Run ended in round ${state.round}`}</span>
        <h1>{won ? 'The city is yours.' : 'The market collected.'}</h1>
        <p>{won ? 'The final market has cleared.' : `You needed ${money(marketTarget(state.round, state.difficulty))} and closed at ${money(state.player.score)}.`}</p>
        <div className="ending-score"><span>Run score</span><strong>{money(state.runScore)}</strong></div>
        <div className="ending-actions">
          <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty: state.difficulty, companion: state.companion })}><Sparkles /> Run it back</button>
          <button className="ghost" onClick={() => dispatch({ type: 'GO_MENU' })}>Return to title</button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [saved, setSaved] = useState<GameState | null>(() => loadSave());
  const [legacyCleared] = useState(() => migrateLegacySave());
  const [highScore, setHighScore] = useState(() => recordHighScore(0));

  // Autoplay policy: the context may only start inside a user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const phase = state.phase;
  const muted = state.muted;
  useEffect(() => {
    if (muted || (phase !== 'playing' && phase !== 'shop')) { stopBgm(); return; }
    startBgm(false);
  }, [phase, muted]);
  useEffect(() => stopBgm, []);

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
      {state.phase === 'intro' && <Intro state={state} dispatch={dispatch} />}
      {state.phase === 'playing' && <GameTable state={state} dispatch={dispatch} />}
      {state.phase === 'shop' && <Shop state={state} dispatch={dispatch} />}
      {(state.phase === 'victory' || state.phase === 'gameover') && <Ending state={state} dispatch={dispatch} />}
      <div className="portrait-gate" role="status"><RotateCcw /><h2>Rotate to trade</h2><p>Deck of Capitalist is built for landscape play. Your run is saved.</p></div>
    </>
  );
}
