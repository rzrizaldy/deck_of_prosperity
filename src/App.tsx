import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BookOpen, Building2, Coins, Crown, Music, RotateCcw,
  ArrowDownUp, Eye, Maximize2, Minimize2, Sparkles, Target, Trash2, Trophy, Volume2, VolumeX, Wrench, X,
} from 'lucide-react';
import {
  getVolume, isBgmEnabled, playCompanionSfx, playSound, pulseHaptic, setBgmEnabled, setVolume,
  startBgm, stopBgm, unlockAudio,
} from './game/audio';
import { CARD_TEMPLATES, GROUPS, HANDS } from './game/data';
import { allCards, deckSize, MARKET_DIFFICULTY, marketTarget, MAX_TYCOONS, MIN_DECK_SIZE, priceFor, scoreHand } from './game/engine';
import { clearSave, loadSave, migrateLegacySave, recordHighScore, saveGame } from './game/persistence';
import { gameReducer, initialState } from './game/reducer';
import type { Card, Consumable, GameState, ScoreBreakdown, Tycoon } from './game/types';

type Dispatch = React.Dispatch<Parameters<typeof gameReducer>[1]>;
type Locale = 'id' | 'en';
type HandSort = 'class' | 'rank';
const LOCALE_KEY = 'doc-locale';
const LocaleContext = createContext<Locale>('id');
const useLocale = () => useContext(LocaleContext);
const tr = (locale: Locale, english: string, indonesian: string) => locale === 'id' ? indonesian : english;
const localizedGroup = (group: keyof typeof GROUPS, locale: Locale) => tr(locale, ({ RESIDENTIAL: 'Residential', COMMERCIAL: 'Commercial', INNOVATION: 'Industry & Innovation', INFRASTRUCTURE: 'Public Infrastructure' } as const)[group], GROUPS[group].label);
const localizedHand = (hand: ScoreBreakdown['hand'], locale: Locale) => tr(locale, ({ HIGH_ASSET: 'High Asset', PAIR: 'Pair', TWO_PAIRS: 'Two Pairs', THREE_KIND: 'Three of a Kind', STRAIGHT: 'Straight', FLUSH: 'Flush', FULL_HOUSE: 'Full House', FOUR_KIND: 'Four of a Kind', STRAIGHT_FLUSH: 'Straight Flush' } as const)[hand], HANDS[hand].name);
const localizedModifier = (modifier: GameState['modifier'], locale: Locale) => {
  const english = ({ BANJIR: ['Rainy Season', 'Residential assets rest for this market.'], MACET: ['Rush Hour', 'Transport assets score half chips this market.'], MATI_LAMPU: ['Network Care', 'Utility assets rest for this market.'], GANJIL_GENAP: ['Rotating Route', `Only ${modifier.parity ?? 'odd'}-chip assets score this market.`], SIDAK: ['Open Audit', 'Community partner effects pause this market.'], MUSIM_KAWIN: ['Market Festival', 'Commercial chips double; all other asset chips are −20%.'], REKLAMASI: ['District Renewal', 'Three random assets rest for this market only.'] } as const)[modifier.id];
  return locale === 'en' ? { name: english[0], summary: english[1] } : modifier;
};
const localizedConsumable = (item: Consumable, locale: Locale) => locale === 'id' ? item : ({
  SERTIFIKAT: { ...item, name: 'Certificate', description: 'Retitle one selected deed into the next asset group.' },
  NOTARIS: { ...item, name: 'Notary', description: 'Copy one selected deed into your discard pile.' },
  PUNGLI: { ...item, name: 'Community Forum', description: 'Reroll the public market event. District Renewal is off the table.' },
  UANG_PELICIN: { ...item, name: 'Gotong Royong', description: 'Gain one extra hand for this market only.' },
  SITA: { ...item, name: 'Portfolio Curation', description: 'Remove exactly three selected deeds from your hand.' },
}[item.id]);

const money = (value: number) => value.toLocaleString('en-US');
/** Every deed now draws from a shared, daylight illustration family by class.
 * Names, ranks, chips, and all scoring logic remain unchanged. */
const cardArt = (card: Card) => `/assets/cards/${card.artId}.png`;
const GROUP_SORT_ORDER = { RESIDENTIAL: 0, COMMERCIAL: 1, INNOVATION: 2, INFRASTRUCTURE: 3 } as const;
const clearedPercent = (score: number, target: number) =>
  Math.max(0, Math.min(100, Math.round((score / Math.max(1, target)) * 100)));

const COMPANIONS = {
  sari: {
    name: 'Sari Pertiwi',
    title: 'Arsitek Warga',
    asset: '/assets/companions/sari-pertiwi.png',
    intro: 'Mulai dari yang kuat, lalu tumbuhkan nilai bersama.',
  },
  bima: {
    name: 'Bima Pradana',
    title: 'Penggerak Koperasi',
    asset: '/assets/companions/bima-pradana.png',
    intro: 'Langkah kecil yang rapi bisa membangun banyak hal.',
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

function LanguageSwitch({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  return <div className="language-switch" role="group" aria-label="Language / Bahasa">
    <button className={locale === 'id' ? 'active' : ''} onClick={() => setLocale('id')} aria-pressed={locale === 'id'}>ID</button>
    <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button>
  </div>;
}

type ScoreStage = 'cards' | 'chips' | 'multiplier' | 'total';
interface ScoreSequence { cards: Card[]; score: ScoreBreakdown; stage: ScoreStage; id: number; }

function ScoreCascade({ sequence }: { sequence: ScoreSequence }) {
  const locale = useLocale();
  const { score, stage } = sequence;
  const chips = score.cardChips + score.bonusChips;
  const multiplier = score.baseMultiplier + score.bonusMultiplier;
  const showChips = stage !== 'cards';
  const showMultiplier = stage === 'multiplier' || stage === 'total';
  const showTotal = stage === 'total';
  return <div className={`score-cascade stage-${stage}`} aria-live="assertive" aria-label={`${tr(locale, 'Scoring', 'Menghitung')} ${localizedHand(score.hand, locale)}: ${money(score.total)}`}>
    <span className="cascade-hand">{localizedHand(score.hand, locale)}</span>
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
  const locale = useLocale();
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
      <img className="card-art" src={cardArt(card)} alt={onInspect ? `Inspect ${card.name} artwork` : ''} loading="lazy" />
      <span className="card-rank" aria-label={`Rank ${card.rank}`}>{card.rank}</span>
      {onInspect && <span className="inspect-hint" aria-hidden="true"><Eye /></span>}
      <span className="card-stripe">{localizedGroup(card.group, locale)}</span>
      <strong>{card.name}</strong>
      <span className="card-value"><Coins aria-hidden="true" /> {card.chips + card.bonus}</span>
      {card.bonus > 0 && <span className="upgrade">+{card.bonus}</span>}
    </button>
  );
}

function CardPreview({ card, onClose }: { card: Card; onClose: () => void }) {
  const locale = useLocale();
  const group = GROUPS[card.group];
  return <div className="card-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="card-preview" role="dialog" aria-modal="true" aria-label={`${card.name} card preview`} onMouseDown={(event) => event.stopPropagation()}>
      <button className="icon-button preview-close" onClick={onClose} aria-label="Close card preview"><X /></button>
      <img src={cardArt(card)} alt={`${card.name} optimistic prosperity illustration`} />
      <div className="preview-vignette" />
      <div className="preview-details">
        <span style={{ '--preview-group': group.color } as React.CSSProperties}>{localizedGroup(card.group, locale)}</span>
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
      <img src="/assets/tycoons/community-partners.png" alt={`${tycoon.name} community partner artwork`} />
      <div className="preview-vignette" />
      <div className="preview-details">
        <span><Crown /> Community partner</span>
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
    <img src="/assets/tycoons/community-partners.png" alt={`${tycoon.name} community partner`} loading="lazy" />
    <div className="tycoon-card-copy">
      <span><Crown aria-hidden="true" /> Partner</span>
      <h3>{tycoon.name}</h3>
      {!compact && <p>{tycoon.description}</p>}
      {children}
    </div>
  </>;
  if (compact && onInspect) return <button className="tycoon-card compact tycoon-inspect" onClick={onInspect} aria-label={`Inspect ${tycoon.name} Tycoon card`} type="button">{content}</button>;
  return <article className={`tycoon-card ${compact ? 'compact' : ''} ${bought ? 'bought' : ''}`}>{content}</article>;
}

function ScoreFormula({ score, label }: { score: ScoreBreakdown | null; label: string }) {
  const locale = useLocale();
  if (!score) return <div className="score-formula muted"><span>{label}</span><strong>Select up to five deeds</strong></div>;
  return (
    <div className="score-formula">
      <span>{label} · {localizedHand(score.hand, locale)}</span>
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
  HIGH_ASSET: ['RESIDENTIAL'], PAIR: ['RESIDENTIAL', 'COMMERCIAL'], TWO_PAIRS: ['RESIDENTIAL', 'COMMERCIAL', 'INNOVATION', 'INFRASTRUCTURE'],
  THREE_KIND: ['RESIDENTIAL', 'COMMERCIAL', 'INNOVATION'], STRAIGHT: ['RESIDENTIAL', 'COMMERCIAL', 'INNOVATION', 'INFRASTRUCTURE', 'RESIDENTIAL'],
  FLUSH: ['INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE'], FULL_HOUSE: ['RESIDENTIAL', 'COMMERCIAL', 'INNOVATION', 'INFRASTRUCTURE', 'RESIDENTIAL'],
  FOUR_KIND: ['RESIDENTIAL', 'COMMERCIAL', 'INNOVATION', 'INFRASTRUCTURE'], STRAIGHT_FLUSH: ['INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE', 'INFRASTRUCTURE'],
};

/**
 * The coloured mini-cards ARE the explanation of the pattern — matching colours
 * read as "same group" at a glance. The wording lives once, next to the name.
 */
function PortfolioRecipe({ hand }: { hand: keyof typeof HANDS }) {
  const locale = useLocale();
  const groups = HAND_RECIPES[hand];
  return (
    <div className="portfolio-recipe" aria-label={`${localizedHand(hand, locale)} ${tr(locale, 'card pattern', 'pola kartu')} `}>
      <div className="recipe-cards">
        {groups.map((group, index) => {
          const visual = GROUPS[group as keyof typeof GROUPS];
          return <span key={`${group}-${index}`} style={{ '--recipe-color': visual.color, '--recipe-ink': visual.ink } as React.CSSProperties}>
            {localizedGroup(group as keyof typeof GROUPS, locale).slice(0, 1)}
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
  const locale = useLocale();
  const transport = GROUPS.INFRASTRUCTURE;
  const swatch = { '--recipe-color': transport.color, '--recipe-ink': transport.ink } as React.CSSProperties;
  return (
    <figure className="scoring-example">
      <div className="example-cards">
        <span style={swatch}>3<b>15</b></span><span style={swatch}>4<b>20</b></span><span style={swatch}>5<b>25</b></span><span style={swatch}>6<b>30</b></span><span style={swatch}>7<b>35</b></span>
      </div>
      <figcaption>{tr(locale, 'Five consecutive ranks make a Straight. Five in the same class make a Flush. Do both and it is a Straight Flush.', 'Lima rank berurutan membentuk Koridor. Lima kartu satu kelas membentuk Satu Kelas. Dapatkan keduanya untuk Koridor Prime.')}</figcaption>
      <div className="example-maths">
        <span><small>{tr(locale, 'chips', 'chip')}</small><strong>125</strong></span>
        <i>×</i>
        <span><small>mult</small><strong>16</strong></span>
        <i>=</i>
        <span className="example-total"><small>{tr(locale, 'score', 'skor')}</small><strong>2,000</strong></span>
      </div>
      <figcaption>{tr(locale, 'Ranks are 1–10 in every class. Build runs for Straights, classes for Flushes, or matching ranks for pairs and houses.', 'Setiap kelas punya peringkat 1–10. Susun peringkat untuk Koridor, kumpulkan kelas untuk Satu Kelas, atau samakan peringkat untuk Pasangan dan Kawasan Lengkap.')}</figcaption>
    </figure>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  return (
    <Modal title={tr(locale, 'The Market Ledger', 'Buku Besar Pasar')} onClose={onClose}>
      <div className="guide-grid">
        <section>
          <h3>{tr(locale, 'Scoring, in one hand', 'Skor, dalam satu tangan')}</h3>
          <ScoringExample />
          <h3>{tr(locale, 'Each market', 'Setiap pasar')}</h3>
          <ol>
            <li>{tr(locale, 'You get four hands to beat the market target, and three discards to fix bad draws.', 'Kamu punya empat tangan untuk menembus target, dan tiga buang kartu untuk memperbaiki tangan buruk.')}</li>
            <li>{tr(locale, 'Clear the target and you are paid, then the Community Market opens to strengthen your deck.', 'Tembus target, raih bayaran, lalu Pasar Bersama terbuka untuk memperkuat dekmu.')}</li>
            <li>{tr(locale, 'Miss it and the run ends. Eight markets in a row wins the city.', 'Gagal dan permainan berakhir. Taklukkan delapan pasar untuk menguasai kota.')}</li>
          </ol>
          <h3>{tr(locale, 'Words you will see', 'Istilah penting')}</h3>
          <dl className="glossary">
            <div><dt>{tr(locale, 'Deed', 'Aset')}</dt><dd>{tr(locale, 'One property card. Its number is its chip value.', 'Satu kartu properti. Angkanya adalah nilai chip.')}</dd></div>
            <div><dt>{tr(locale, 'Group', 'Grup')}</dt><dd>{tr(locale, 'Deeds sharing a colour. Matching groups makes multipliers grow.', 'Aset yang berbagi warna. Menyamakan grup membuat multiplier naik.')}</dd></div>
            <div><dt>{tr(locale, 'Partner', 'Rekan')}</dt><dd>{tr(locale, 'A recruited community partner that adds chips or multiplier whenever its condition is met.', 'Rekan komunitas yang menambah chip atau pengali saat syaratnya terpenuhi.')}</dd></div>
            <div><dt>{tr(locale, 'Renovate', 'Renovasi')}</dt><dd>{tr(locale, 'Pay to give one deed +5 chips, permanently.', 'Bayar untuk memberi satu aset +5 chip secara permanen.')}</dd></div>
            <div><dt>{tr(locale, 'Liquidate', 'Likuidasi')}</dt><dd>{tr(locale, 'Destroy one deed for $1. A smaller deck draws your best cards more often.', 'Hancurkan satu aset demi $1. Dek lebih ramping lebih sering menarik kartu terbaik.')}</dd></div>
          </dl>
        </section>
        <section>
          <h3>{tr(locale, 'Portfolio patterns', 'Pola portofolio')}</h3>
          <p className="guide-note">{tr(locale, 'Every class holds ranks 1–10. Higher patterns are rarer and multiply much harder; the swatches show the required classes.', 'Setiap kelas memiliki peringkat 1–10. Pola tinggi lebih langka dan pengalinya lebih besar; kotak warna menunjukkan kelas yang diperlukan.')}</p>
          <div className="rank-list">
            {Object.entries(HANDS).map(([key, hand]) => (
              <div key={key} className="rank-row"><PortfolioRecipe hand={key as keyof typeof HANDS} /><span><strong>{localizedHand(key as keyof typeof HANDS, locale)}</strong><small>{locale === 'en' ? ({ HIGH_ASSET: 'No pattern; highest rank leads.', PAIR: 'Two matching ranks.', TWO_PAIRS: 'Two different matching ranks.', THREE_KIND: 'Three matching ranks.', STRAIGHT: 'Five consecutive ranks.', FLUSH: 'Five cards in one class.', FULL_HOUSE: 'Three matching ranks plus a pair.', FOUR_KIND: 'Four matching ranks.', STRAIGHT_FLUSH: 'Five consecutive ranks in one class.' } as Record<string, string>)[key] : hand.description}</small></span><b>×{hand.multiplier}</b></div>
            ))}
          </div>
          <h3>{tr(locale, 'Keyboard', 'Papan tombol')}</h3>
          <p>{tr(locale, '1–8 select cards · Enter commit · D discard · M mute', '1–8 pilih kartu · Enter mainkan · D buang · M senyap')}</p>
        </section>
      </div>
    </Modal>
  );
}

function Compendium({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  return (
    <Modal title={tr(locale, 'Property Compendium', 'Koleksi Aset')} onClose={onClose}>
      <p className="compendium-hint">{tr(locale, 'Click a deed illustration to inspect it full size.', 'Klik ilustrasi aset untuk melihatnya dalam ukuran penuh.')}</p>
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

function Menu({ state, saved, highScore, legacyCleared, dispatch, locale, setLocale }: {
  state: GameState; saved: GameState | null; highScore: number; legacyCleared: boolean; dispatch: Dispatch; locale: Locale; setLocale: (locale: Locale) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('trader');
  const [companion, setCompanion] = useState<GameState['companion']>('sari');
  const [guide, setGuide] = useState(false);
  const [compendium, setCompendium] = useState(false);
  return (
    <main className="menu-screen game-frame">
      <div className="menu-shade" />
      <section className="menu-brand">
        <LanguageSwitch locale={locale} setLocale={setLocale} />
        <div className="title-lockup">
          <div className="prosperity-brand" aria-label="Deck of Prosperity">
            <img className="prosperity-emblem" src="/assets/logo-prosperity-emblem-pixel.png" alt="Emblem Deck of Prosperity dengan pita Merah Putih" />
            <div className="prosperity-logo"><span>DECK OF</span><strong>PROSPERITY</strong></div>
            <span className="indonesia-flag" aria-label="Bendera Indonesia"><i /><b /></span>
          </div>
        </div>
        <p className="eyebrow">{tr(locale, 'Build value across the archipelago', 'Tumbuhkan nilai di seluruh kepulauan')}</p>
        <h1>{tr(locale, 'Make progress together.', 'Bertumbuh bersama.')}</h1>
        <p className="menu-copy">{tr(locale, 'Build a resilient portfolio that helps the city thrive.', 'Bangun portofolio tangguh yang ikut membuat kota berkembang.')}</p>
        <div className="high-score"><Trophy /> {tr(locale, 'Best run', 'Rekor permainan')} <strong>{money(highScore)}</strong></div>
      </section>
      <section className="menu-panel">
        {legacyCleared && <p className="notice">{tr(locale, 'The incompatible prototype save was retired. Your legacy high score remains.', 'Simpan prototipe lama tidak kompatibel telah dihapus. Rekor lamamu tetap tersimpan.')}</p>}
        <fieldset className="difficulty-picker">
          <legend>{tr(locale, 'Market difficulty · changes target scores only', 'Tingkat pasar · hanya mengubah target skor')}</legend>
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
          <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty, companion })}><Sparkles /> {tr(locale, 'Start market run', 'Mulai pasar')}</button>
          {saved && <button className="secondary large" onClick={() => dispatch({ type: 'LOAD', state: saved })}>{tr(locale, 'Continue round', 'Lanjut ronde')} {saved.round}</button>}
        </div>
        <div className="menu-subactions">
          <button onClick={() => setGuide(true)}><BookOpen /> <span>{tr(locale, 'How to play', 'Cara bermain')}</span></button>
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
  const locale = useLocale();
  const [guide, setGuide] = useState(false);
  const target = marketTarget(state.round, state.difficulty, state.modifier);
  return (
    <>
      <header className="game-hud">
        <div className="round-mark"><span>Market round</span><strong>{state.round}<small>/8</small></strong></div>
        <div className="market-progress" aria-label="Market progress">
          <div className="progress-figures">
            <span>Portfolio</span>
            <strong><AnimatedNumber value={state.player.score} active /></strong>
            <em>of</em>
            <span>{tr(locale, 'Target', 'Target')}</span>
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
  const locale = useLocale();
  const modifier = localizedModifier(state.modifier, locale);
  const target = money(marketTarget(1, state.difficulty, state.modifier));
  const buddy = COMPANIONS[state.companion];
  return <main className="intro-screen game-frame">
    <div className="intro-panel">
      <span className="eyebrow">{tr(locale, 'Market', 'Pasar')} 1 · {MARKET_DIFFICULTY[state.difficulty].label}</span>
      <h1>{tr(locale, `Reach ${target} in four hands.`, `Raih ${target} dalam empat tangan.`)}</h1>
      <div className="modifier-brief" role="note">
        <img src={`/assets/modifiers/${state.modifier.art}.webp`} alt="" />
        <span><b>{modifier.name}</b>{modifier.summary}</span>
      </div>
      {/* The first three things the player will actually touch, in order. The
          Night Market is deliberately left out — they meet it when they win. */}
      <ul className="intro-points">
        <li><Building2 aria-hidden="true" /><span>{tr(locale, 'Tap one to five deeds, then commit. Deeds of the same colour score far harder together.', 'Pilih satu sampai lima aset, lalu mainkan. Aset dengan warna sama menghasilkan skor jauh lebih besar.')}</span></li>
        <li><RotateCcw aria-hidden="true" /><span>{tr(locale, 'Bad draw? Discard up to three times to swap cards for new ones.', 'Kartu jelek? Buang kartu sampai tiga kali untuk menarik kartu baru.')}</span></li>
        <li><Target aria-hidden="true" /><span>{tr(locale, 'The bar at the top tracks how close you are. Run out of hands short of the target and the run ends.', 'Bar di atas menunjukkan jarak ke target. Kehabisan tangan sebelum target berarti permainan berakhir.')}</span></li>
      </ul>
      <div className="intro-companion"><img src={buddy.asset} alt="" /><p><b>{buddy.name}</b><span>“{buddy.intro}”</span></p></div>
      <div className="intro-actions">
        <button className="primary large" onClick={() => dispatch({ type: 'BEGIN_RUN' })}><Sparkles /> {tr(locale, 'Deal market one', 'Buka pasar pertama')}</button>
      </div>
    </div>
  </main>;
}

type KoncoMoment = 'opening' | 'ready' | 'bigScore' | 'whiff' | 'lastHand' | 'event' | 'default';

const KONCO_LINES: Record<keyof typeof COMPANIONS, Record<KoncoMoment, string[]>> = {
  sari: {
    opening: ['Pasar baru, peluang baru. Kita mulai dengan tenang!', 'Lihat event-nya, lalu rancang langkah pertama.', 'Tangan pertama bisa jadi pondasi yang kuat.', 'Meja sudah siap. Mari bangun sesuatu yang baik.'],
    ready: ['{selected} aset sudah siap. Yuk, wujudkan idenya!', 'Pola sudah terlihat. Saatnya bergerak bersama.', 'Multiplier-nya menjanjikan. Coba kita jalankan!', 'Portofolio sudah rapi. Mainkan dengan yakin.'],
    bigScore: ['{hand} untuk {score}! Kerja sama yang indah!', 'Nilainya tumbuh. Pertahankan ritme baik ini!', 'Hebat! Satu langkah lagi menuju target.', 'Itu contoh rencana yang berkembang dengan sehat.'],
    whiff: ['{score} adalah awal yang jujur. Kita bisa menyusun ulang.', 'Tidak apa-apa, selalu ada langkah berikutnya.', 'Kartu ini memberi kita informasi untuk keputusan yang lebih baik.', 'Setiap percobaan membuat portofolio makin matang.'],
    lastHand: ['Tangan terakhir. Pilih kombinasi yang paling kamu percaya.', 'Satu kesempatan lagi—tarik napas dan lihat polanya.', 'Kita sudah sampai sejauh ini. Mari selesaikan dengan baik.', 'Saatnya membuat nilai terbaik dari kartu yang ada.'],
    event: ['Kondisi berubah; rencana yang baik ikut menyesuaikan.', 'Alat baru membuka cara pandang baru.', 'Mari baca situasinya dan lanjutkan dengan optimis.', 'Perubahan kecil bisa membuka peluang besar.'],
    default: ['{remaining} lagi. Sedikit demi sedikit, target akan dekat.', 'Lihat pola, pilih langkah, lalu tumbuh.', 'Masih banyak ruang untuk keputusan yang cerdas.', 'Kita membangun nilai, satu portofolio pada satu waktu.'],
  },
  bima: {
    opening: ['Pasar baru terbuka. Kita punya ruang untuk membuat pilihan yang baik.', 'Atur napas. Event sudah memberi arah pertama.', 'Empat tangan cukup bila digunakan dengan penuh perhatian.', 'Mari mulai dari pola yang paling jelas.'],
    ready: ['{selected} aset sudah dipilih. Periksa kembali sinerginya.', 'Portofolio siap. Kombinasi yang rapi selalu punya potensi.', 'Multiplier sudah terlihat. Keputusanmu bisa dibuat dengan tenang.', 'Pilihan ada di meja. Mari jalankan yang paling bermakna.'],
    bigScore: ['{hand}, {score}. Nilai yang tumbuh dari rencana yang baik.', 'Pasar merespons. Simpan ritme ini untuk langkah berikutnya.', 'Itu skor yang sehat. Rayakan, lalu lanjutkan dengan bijak.', 'Bagus. Perencanaan yang konsisten memang terasa seperti ini.'],
    whiff: ['{score}. Kita belajar sesuatu untuk tangan berikutnya.', 'Kecil, tapi tetap sebuah langkah maju.', 'Angka itu sedang tumbuh. Beri ia kombinasi yang tepat.', 'Setiap portofolio memberi petunjuk untuk yang lebih baik.'],
    lastHand: ['Tangan terakhir. Percayai hitungan dan intuisi yang sudah kamu bangun.', 'Sisa satu kesempatan. Pilih kombinasi yang paling selaras.', 'Tarik napas, hitung lagi, lalu mainkan dengan mantap.', 'Ini saatnya angka bekerja untuk rencana kita.'],
    event: ['Pasar berubah, dan kita dapat beradaptasi dengan tenang.', 'Alat baru siap membantu. Gunakan saat momennya tepat.', 'Kondisi bergeser. Portofolio yang baik tahu cara ikut bergerak.', 'Catat event-nya; setiap perubahan membawa pelajaran.'],
    default: ['{remaining} lagi. Pelan dan rapi, target akan mendekat.', 'Target masih ada. Mari lihat jalan menuju jumlahnya.', 'Jangan lihat jumlahnya saja. Lihat sinergi di baliknya.', 'Masih ada ruang untuk keputusan yang lebih indah.'],
  },
};

function stableKoncoLine(lines: string[], key: string): string {
  let hash = 17;
  for (const character of key) hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
  return lines[Math.abs(hash) % lines.length];
}

function CompanionRail({ state }: { state: GameState }) {
  const buddy = COMPANIONS[state.companion];
  const selected = state.selectedIds.length;
  const remaining = Math.max(0, marketTarget(state.round, state.difficulty, state.modifier) - state.player.score);
  const lastEvent = state.events.at(-1)?.message ?? '';
  const moment: KoncoMoment = /hired|bought|Sita|retitled|copied|Pungli/i.test(lastEvent)
    ? 'event'
    : state.player.handsLeft === 1
      ? 'lastHand'
      : state.lastPlayerScore
        ? state.lastPlayerScore.total >= marketTarget(state.round, state.difficulty, state.modifier) * .15 ? 'bigScore' : 'whiff'
        : selected >= 1 ? 'ready' : state.player.score === 0 ? 'opening' : 'default';
  const message = stableKoncoLine(KONCO_LINES[state.companion][moment], `${state.seed}-${state.round}-${moment}-${lastEvent}`)
    .replace('{selected}', String(selected))
    .replace('{remaining}', money(remaining))
    .replace('{score}', state.lastPlayerScore ? money(state.lastPlayerScore.total) : '0')
    .replace('{hand}', state.lastPlayerScore?.handName ?? 'Portfolio');
  return <section className="companion-rail" aria-label={`${buddy.name}, your Konco`}>
    <div className="companion-bubble"><b>{buddy.name}</b><span>{message}</span></div>
    <img src={buddy.asset} alt={`${buddy.name}, ${buddy.title}`} />
  </section>;
}

function ConsumableRack({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const locale = useLocale();
  const selected = state.selectedIds.length;
  const canUse = (item: Consumable) => {
    if (item.id === 'SERTIFIKAT' || item.id === 'NOTARIS') return selected === 1;
    if (item.id === 'SITA') return selected === 3;
    return true;
  };
  return <section className="consumable-rack" aria-label={tr(locale, 'Held market tools', 'Peralatan pasar tersimpan')}>
    <header><span>{tr(locale, 'Market tools', 'Peralatan pasar')}</span><b>{state.player.consumables.length}/2</b></header>
    {state.player.consumables.length ? <div>
      {state.player.consumables.map((item) => <article key={item.id}>
        <img src={`/assets/consumables/${item.art}.webp`} alt="" />
        <span><b>{localizedConsumable(item, locale).name}</b><small>{localizedConsumable(item, locale).description}</small></span>
        <button
          className="secondary"
          disabled={!canUse(item)}
          title={!canUse(item) ? item.id === 'SITA' ? tr(locale, 'Select exactly three deeds first.', 'Pilih tepat tiga aset dulu.') : tr(locale, 'Select exactly one deed first.', 'Pilih tepat satu aset dulu.') : undefined}
          onClick={() => { unlockAudio(); dispatch({ type: 'USE_CONSUMABLE', consumableId: item.id }); playSound('purchase', state.muted); pulseHaptic(7); }}
        >{tr(locale, 'Use', 'Pakai')}</button>
      </article>)}
    </div> : <p>{tr(locale, 'Win a market to buy one-use tools.', 'Tembus satu pasar untuk membeli alat sekali pakai.')}</p>}
  </section>;
}

function GameTable({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const locale = useLocale();
  const modifier = localizedModifier(state.modifier, locale);
  const [busy, setBusy] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<Card | null>(null);
  const [inspectedTycoon, setInspectedTycoon] = useState<Tycoon | null>(null);
  const [sequence, setSequence] = useState<ScoreSequence | null>(null);
  const [discardingIds, setDiscardingIds] = useState<string[]>([]);
  const [reshuffling, setReshuffling] = useState(false);
  const [handSort, setHandSort] = useState<HandSort>('class');
  const selected = state.player.hand.filter((card) => state.selectedIds.includes(card.instanceId));
  const sortedHand = useMemo(() => [...state.player.hand].sort((left, right) => {
    if (handSort === 'rank') return left.rank - right.rank || left.group.localeCompare(right.group) || left.name.localeCompare(right.name);
    return GROUP_SORT_ORDER[left.group] - GROUP_SORT_ORDER[right.group] || left.rank - right.rank || left.name.localeCompare(right.name);
  }), [state.player.hand, handSort]);
  const prediction = useMemo(() => selected.length ? scoreHand(selected, state.player.tycoons, { modifier: state.modifier }) : null, [selected, state.player.tycoons, state.modifier]);
  const target = marketTarget(state.round, state.difficulty, state.modifier);
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
        const card = sortedHand[Number(event.key) - 1];
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
            <p>{busy
              ? tr(locale, 'Portfolio settling…', 'Portofolio sedang dihitung…')
              : state.lastPlayerScore
                ? tr(locale,
                  `You scored ${money(state.lastPlayerScore.total)} with ${localizedHand(state.lastPlayerScore.hand, locale)}.`,
                  `Kamu mencetak ${money(state.lastPlayerScore.total)} lewat ${localizedHand(state.lastPlayerScore.hand, locale)}.`)
                : state.events.at(-1)?.message}</p>
          </div>
        </aside>
        <section className="play-zone">
          {/* One name for one thing: "market", never "blind" or "ante" as well. */}
          <div className="table-kicker"><span>{tr(locale, 'Jakarta property market', 'Pasar properti Jakarta')}</span><b>{tr(locale, 'Market', 'Pasar')} {state.round} {tr(locale, 'of', 'dari')} 8</b></div>
          <div className="round-track" aria-label={`Hand ${5 - state.player.handsLeft} of 4`}>
            {Array.from({ length: 4 }, (_, index) => <span key={index} className={index >= state.player.handsLeft ? 'done' : ''} />)}
          </div>
          <div className="market-target">
            <span><Target aria-hidden="true" /> {MARKET_DIFFICULTY[state.difficulty].label} {tr(locale, 'target', 'target')}</span>
            <strong>{money(target)}</strong>
            <ProgressRail score={state.player.score} target={target} tone="table" />
            <small>{remaining ? tr(locale, `${money(remaining)} to clear`, `${money(remaining)} lagi untuk tembus`) : tr(locale, 'Target cleared', 'Target tercapai')}</small>
          </div>
          <div className="market-modifier" role="note" aria-label={`${modifier.name}: ${modifier.summary}`}>
            <img src={`/assets/modifiers/${state.modifier.art}.webp`} alt="" />
            <span><b>{modifier.name}</b>{modifier.summary}</span>
          </div>
          <section className="tycoon-shelf" aria-label="Your Tycoon helpers">
            <header><Crown aria-hidden="true" /><span>{tr(locale, 'Inner circle', 'Lingkar dalam')}</span><b>{state.player.tycoons.length}/{MAX_TYCOONS}</b></header>
            <div className="tycoon-lineup">
              {state.player.tycoons.length
                ? state.player.tycoons.map((tycoon) => <TycoonCard key={tycoon.id} tycoon={tycoon} compact onInspect={() => setInspectedTycoon(tycoon)} />)
                : <p>{tr(locale, 'Clear this market, then invite a partner at the Community Market.', 'Tembus pasar ini, lalu ajak rekan di Pasar Bersama.')}</p>}
            </div>
          </section>
          <div className={`played-tray ${state.lastPlayedCards.length ? 'has-cards' : ''}`} aria-live="polite">
            <span className="played-label">{state.lastPlayedCards.length ? tr(locale, 'Last portfolio played', 'Portofolio terakhir') : tr(locale, 'Play your first portfolio', 'Mainkan portofolio pertamamu')}</span>
            <div className="played-cards">
              {state.lastPlayedCards.map((card, index) => <AssetCard key={card.instanceId} card={card} compact index={index} onInspect={() => setInspectedCard(card)} />)}
            </div>
          </div>
          {sequence && <div className="score-sequence" aria-hidden="true">
            <div className="flight-cards">{sequence.cards.map((card, index) => <img key={card.instanceId} src={cardArt(card)} style={{ '--flight-index': index } as React.CSSProperties} alt="" />)}</div>
            <ScoreCascade sequence={sequence} />
          </div>}
          <div className="last-hands">
            <ScoreFormula score={state.lastPlayerScore} label={tr(locale, 'Your last hand', 'Tangan terakhirmu')} />
          </div>
          <ScoreFormula score={prediction} label={tr(locale, 'Selected hand', 'Tangan terpilih')} />
        </section>

        <aside className="player-panel">
          <div className="player-resource"><span>{tr(locale, 'Hands', 'Tangan')}</span><strong>{state.player.handsLeft}</strong></div>
          <div className="player-resource"><span>{tr(locale, 'Discards', 'Buang')}</span><strong>{state.player.discardsLeft}</strong></div>
          <div className="player-resource gold"><span>{tr(locale, 'Capital', 'Modal')}</span><strong>${state.player.cash}</strong></div>
          <div className={`deck-count ${reshuffling ? 'reshuffling' : ''}`}>
            <span>Deck</span><b>{deckSize(state.player)}</b>
            {reshuffling && <em aria-hidden="true">reshuffled</em>}
          </div>
          <ConsumableRack state={state} dispatch={dispatch} />
        </aside>
      </section>

      <section className="hand-dock" aria-label="Your hand">
        <div className="hand-cards">
          {sortedHand.map((card, index) => <AssetCard key={card.instanceId} card={card} index={index} selected={state.selectedIds.includes(card.instanceId)} departing={discardingIds.includes(card.instanceId)} onClick={() => toggle(card.instanceId)} onInspect={() => setInspectedCard(card)} />)}
        </div>
        <div className="play-actions">
          <div className="hand-sort" role="group" aria-label={tr(locale, 'Sort your hand', 'Urutkan tangan')}>
            <ArrowDownUp aria-hidden="true" />
            <button className={handSort === 'class' ? 'active' : ''} onClick={() => setHandSort('class')} type="button">{tr(locale, 'Class', 'Kelas')}</button>
            <button className={handSort === 'rank' ? 'active' : ''} onClick={() => setHandSort('rank')} type="button">{tr(locale, 'Rank', 'Peringkat')}</button>
          </div>
          <button className="secondary" disabled={!selected.length || state.player.discardsLeft < 1 || busy} onClick={discard}><RotateCcw /> {tr(locale, 'Discard', 'Buang')} <small>{selected.length || ''}</small></button>
          <button className="primary" disabled={!selected.length || busy} onClick={play}><Coins /> {busy ? tr(locale, 'Scoring portfolio…', 'Menghitung portofolio…') : tr(locale, 'Commit portfolio', 'Mainkan portofolio')}</button>
        </div>
      </section>
      {inspectedCard && <CardPreview card={inspectedCard} onClose={() => setInspectedCard(null)} />}
      {inspectedTycoon && <TycoonPreview tycoon={inspectedTycoon} onClose={() => setInspectedTycoon(null)} />}
    </main>
  );
}

function Shop({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const locale = useLocale();
  const [cardId, setCardId] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [spend, setSpend] = useState<{ amount: number; id: number } | null>(null);
  const shop = state.shop!;
  const deck = allCards(state.player).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const acquirePrice = priceFor(state.player, 4 + Math.floor(shop.acquisition.chips / 15));
  const renovatePrice = priceFor(state.player, 4 * (1 + shop.renovations));
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
          <div><span>{tr(locale, `Round ${state.round} secured`, `Ronde ${state.round} diamankan`)}</span><h1>{tr(locale, 'Community Market', 'Pasar Bersama')}</h1><p>{tr(locale, 'Turn the last win into a stronger deck.', 'Ubah kemenangan tadi menjadi dek yang lebih kuat.')}</p></div>
          <div className={`cash-pile ${spend ? 'spending' : ''}`}>
            <Coins /> ${state.player.cash}
            {spend && <b key={spend.id} className="spend-chip" aria-hidden="true">-${spend.amount}</b>}
          </div>
        </header>
        <section>
          <h2><Crown /> {tr(locale, 'Partner invitations', 'Undangan rekan')} <small>{state.player.tycoons.length}/{MAX_TYCOONS} {tr(locale, 'invited', 'diajak')}</small></h2>
          <div className="shop-grid">
            {shop.tycoons.map((tycoon) => {
              const price = priceFor(state.player, tycoon.cost);
              const owned = state.player.tycoons.some((item) => item.id === tycoon.id);
              return <TycoonCard key={tycoon.id} tycoon={tycoon} bought={flash === tycoon.id}>
                <button
                  disabled={owned || state.player.cash < price || state.player.tycoons.length >= MAX_TYCOONS}
                  onClick={() => buy({ type: 'BUY_TYCOON', tycoonId: tycoon.id }, tycoon.id, price)}
                >{owned ? 'Hired' : `Hire · $${price}`}</button>
              </TycoonCard>;
            })}
          </div>
        </section>
        <section>
          <h2><Building2 /> {tr(locale, 'Deed desk', 'Meja aset')}</h2>
          <div className="deed-market">
            <article className={`acquisition ${flash === 'acquire' ? 'bought' : ''}`}>
              <AssetCard card={{ ...shop.acquisition, instanceId: 'offer', bonus: 0 }} compact />
              <div>
                <h3>{tr(locale, 'Acquire this deed', 'Akuisisi aset ini')}</h3>
                <p>Adds an upgraded <b>{shop.acquisition.name}</b> (+8 chips) to your deck for the rest of the run. A contract must make the deck stronger, not just larger.</p>
                <button disabled={state.player.cash < acquirePrice} onClick={() => buy({ type: 'BUY_ACQUISITION' }, 'acquire', acquirePrice)}>{tr(locale, 'Acquire', 'Akuisisi')} · ${acquirePrice}</button>
              </div>
            </article>
            <article className={`deck-service ${flash === 'service' ? 'bought' : ''}`}>
              <h3>{tr(locale, 'Work on a deed you already own', 'Kelola aset yang sudah kamu miliki')}</h3>
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
                  <button disabled={!picked || state.player.cash < renovatePrice} onClick={() => buy({ type: 'RENOVATE', cardId: activeId }, 'service', renovatePrice)}>
                    <Wrench /> {tr(locale, 'Renovate', 'Renovasi')} · ${renovatePrice}
                  </button>
                  <small>
                    {picked
                      ? <>Upgrade #{shop.renovations + 1}: permanently raises <b>{picked.name}</b> from {picked.chips + picked.bonus} to <b>{picked.chips + picked.bonus + 5 + Math.floor(picked.bonus / 5)} chips</b>. Repeated work compounds the deed.</>
                      : 'Permanently upgrades the chosen deed. Repeated work compounds.'}
                  </small>
                </div>
                <div className="deed-action">
                  <button disabled={shop.liquidated || !canLiquidate} onClick={() => buy({ type: 'LIQUIDATE', cardId: activeId }, 'service', 0)}>
                    <Trash2 /> {shop.liquidated ? tr(locale, 'Liquidated', 'Dilikuidasi') : tr(locale, 'Liquidate · +$1', 'Likuidasi · +$1')}
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
        <section className="consumable-market">
          <h2><Coins /> {tr(locale, 'Market tools', 'Peralatan pasar')} <small>{state.player.consumables.length}/2 {tr(locale, 'held', 'disimpan')}</small></h2>
          <div className="consumable-offers">
            {shop.consumables.map((item) => {
              const price = priceFor(state.player, item.cost);
              return <article key={item.id} className={flash === item.id ? 'bought' : ''}>
                <img src={`/assets/consumables/${item.art}.webp`} alt="" />
                <div><h3>{localizedConsumable(item, locale).name}</h3><p>{localizedConsumable(item, locale).description}</p></div>
                <button disabled={state.player.cash < price || state.player.consumables.length >= 2} onClick={() => buy({ type: 'BUY_CONSUMABLE', consumableId: item.id }, item.id, price)}>{tr(locale, 'Buy', 'Beli')} · ${price}</button>
              </article>;
            })}
            {!shop.consumables.length && <p className="sold-out">No tools left on this stall.</p>}
          </div>
        </section>
      </div>
      {/* Pinned outside the scroll region so the exit is never below the fold. */}
      <footer className="shop-footer">
        <button className="secondary" disabled={state.player.cash < shop.rerollCost} onClick={() => buy({ type: 'REROLL_SHOP' }, 'reroll', shop.rerollCost)}><RotateCcw /> {tr(locale, 'Reroll', 'Acak ulang')} · ${shop.rerollCost}</button>
        <button className="primary" onClick={() => { unlockAudio(); dispatch({ type: 'NEXT_ROUND' }); playSound('draw', state.muted); }}>{tr(locale, 'Enter round', 'Masuk ronde')} {state.round + 1}</button>
      </footer>
    </main>
  );
}

function Ending({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const locale = useLocale();
  const won = state.phase === 'victory';
  return (
    <main className={`ending game-frame ${won ? 'won' : 'lost'}`} style={{ backgroundImage: `url(/assets/generated/${won ? 'victory-jakarta.webp' : 'bankruptcy-jakarta.webp'})` }}>
      <div className="ending-shade" />
      <section>
        {won ? <Trophy /> : <Coins />}
        <span>{won ? tr(locale, 'Eight markets conquered', 'Delapan pasar ditaklukkan') : tr(locale, `Run ended in round ${state.round}`, `Permainan berakhir di ronde ${state.round}`)}</span>
        <h1>{won ? tr(locale, 'The city thrives with you.', 'Kota ini tumbuh bersamamu.') : tr(locale, 'The next market can be brighter.', 'Pasar berikutnya bisa lebih cerah.')}</h1>
        <p>{won ? 'The final market has cleared.' : `You needed ${money(marketTarget(state.round, state.difficulty, state.modifier))} and closed at ${money(state.player.score)}.`}</p>
        <div className="ending-score"><span>{tr(locale, 'Run score', 'Skor permainan')}</span><strong>{money(state.runScore)}</strong></div>
        <div className="ending-actions">
          <button className="primary large" onClick={() => dispatch({ type: 'NEW_RUN', difficulty: state.difficulty, companion: state.companion })}><Sparkles /> {tr(locale, 'Run it back', 'Main lagi')}</button>
          <button className="ghost" onClick={() => dispatch({ type: 'GO_MENU' })}>{tr(locale, 'Return to title', 'Kembali ke judul')}</button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [locale, setLocale] = useState<Locale>(() => (typeof localStorage !== 'undefined' && localStorage.getItem(LOCALE_KEY) === 'en') ? 'en' : 'id');
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
  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>
      {state.phase === 'menu' && <Menu state={state} saved={saved} highScore={highScore} legacyCleared={legacyCleared} dispatch={dispatch} locale={locale} setLocale={setLocale} />}
      {state.phase === 'intro' && <Intro state={state} dispatch={dispatch} />}
      {state.phase === 'playing' && <GameTable state={state} dispatch={dispatch} />}
      {state.phase === 'shop' && <Shop state={state} dispatch={dispatch} />}
      {(state.phase === 'victory' || state.phase === 'gameover') && <Ending state={state} dispatch={dispatch} />}
      <div className="portrait-gate" role="status"><RotateCcw /><h2>Rotate to play</h2><p>Deck of Prosperity is built for landscape play. Your run is saved.</p></div>
    </LocaleContext.Provider>
  );
}
