# Deck of Capitalist — Improvement Plan

Status at time of writing: commit `96cd0bf`, 37 unit tests, 36 e2e, clean build.
The engineering is not the problem. The design and the writing are.

This plan is ordered by leverage. Phase 1 is the difference between a toy and a
game; Phase 2 is the difference between "a Balatro clone set in Jakarta" and
something nobody else can make.

---

## Diagnosis (measured, not guessed)

Two headless simulations were run against the real engine, 200 deterministic
seeds each, playing the true best subset of every hand.

### Finding 1 — the targets sit below round-one play

Median score a greedy player actually reaches, with the target gate removed:

| Market | Skilled p50 | Naive p50 | Current target |
| --- | ---: | ---: | ---: |
| M1 | 3,344 | 3,344 | **260** |
| M2 | 3,496 | 3,352 | **420** |
| M4 | 3,688 | 3,284 | **880** |
| M6 | 3,976 | 3,336 | **1,540** |
| M8 | 4,160 | 3,313 | **2,520** |

A competent player beats the **final** market target on the **first** hand of the
**first** market. The entire eight-market curve is below what round-one play
produces. This is why `tests/balance.test.ts` reports 100% clear rates for
markets 1–7 at every difficulty, for a player who never discards and never shops.

### Finding 2 — progression is nearly inert (the more important one)

Across a full run, with 5 Tycoons hired and a renovation bought at every shop:

- **Skilled: 3,344 → 4,160 median. +24% over eight markets.**
- **Naive: 3,344 → 3,313. Flat. Literally zero growth.**

This kills the obvious fix. You cannot simply raise the targets — the
progression systems are physically incapable of producing more than about +25%,
so a steeper curve would just make the run unwinnable at market 5 instead of
trivially winnable at market 8.

Why progression does nothing:

- **Renovate** adds +5 chips to *one card* in a 40-card deck, once per shop.
  Seven shops = +35 chips total, on plays that already score ~3,000. Noise.
- **Tycoons** cap at 5 from a pool of 10, and most are additive
  (`chips_per_group`, `mult_per_group`). Additive bonuses cannot compound.
- Only two Tycoons are multiplicative (`power-player`, `lone-wolf`), and
  `lone-wolf` requires a one-card play, which is anti-synergistic with everything.
- **Acquisition** adds cards, which *dilutes* the deck and makes the good cards
  rarer. It is frequently a downgrade.

**Targets and progression must be fixed together, in the same change.**

---

## Phase 1 — Make the run capable of failing

### 1.1 Rebuild the power curve first

Add multiplicative sources so a strong build can compound. Target: a skilled
player should reach **8–10× their market-1 score** by market 8, instead of 1.24×.

| Change | File | Detail |
| --- | --- | --- |
| Raise Tycoon slots 5 → 7 | `src/game/engine.ts`, `reducer.ts` (`BUY_TYCOON` guard), `App.tsx` (`{n}/5` labels) | More room for a build to cohere |
| Expand pool 10 → 24+ Tycoons | `src/game/data.ts` | See Phase 2 — the new ones should be the Indonesian rewrite |
| Add `xmult_flat` effect | `types.ts`, `engine.ts` `scoreHand` | Unconditional ×1.5 / ×2 helpers, the backbone of compounding |
| Add `xmult_per_hand` effect | same | ×N when a specific pattern is played — rewards deck-building toward one pattern |
| Renovate: allow repeats, escalating price | `reducer.ts` `RENOVATE`, `ShopState.renovated` → `renovations: number` | Currently once per shop; make it `$4 × (1 + renovations)` and uncapped |
| Renovate scales | `reducer.ts` | `+5` flat → `+5` and also `bonus`-aware, so a card can be built into a bomb |
| Acquisition should not dilute | `reducer.ts` `BUY_ACQUISITION` | Offer *upgraded* copies (pre-renovated) or make acquisition replace rather than append |

### 1.2 Then steepen the targets

Replace `MARKET_TARGETS` in `src/game/engine.ts:13`. Proposed geometric curve,
ratio ≈ 1.38, anchored just under naive p10 for market 1 so a beginner clears it:

```ts
export const MARKET_TARGETS = [2800, 3900, 5400, 7400, 10200, 14000, 19300, 26700] as const;
```

9.5× across the run, against a target power curve of 8–10×. **These numbers are a
starting hypothesis, not a result.** Validate before shipping:

```bash
npx vitest run tests/balance.test.ts
```

Acceptance criteria for the curve:

- Naive policy win rate **< 15%** on Market difficulty (currently 99%)
- Skilled policy win rate **55–75%** on Market (currently 100%)
- Skilled on Street **75–90%**, on High Stakes **25–40%**
- No single round where the clear rate drops by more than half versus the round
  before — the existing `has no single round that walls the run off` test already
  guards this, keep it

`tests/balance.test.ts` already prints per-round clear rates; iterate the curve
against that output rather than by feel.

### 1.3 Give each market an identity

Right now every market is mechanically identical except the number. This is the
single biggest reason the loop is monotonous, and it is where the Indonesian
comedy can carry real mechanical weight.

Add a `MarketModifier` applied per round, drawn from a pool, shown on the target
medallion before the hand is dealt:

| Modifier | Effect | Why it is funny here |
| --- | --- | --- |
| **Banjir** (flood) | Heritage and Regional deeds score 0 this market | Kemang floods. Every Jakartan knows. The most obvious missing mechanic in the game. |
| **Macet** (gridlock) | Transit deeds score half | Self-explanatory |
| **Mati Lampu** (blackout) | Utility deeds score 0; first hand each market is dealt face-down | PLN |
| **Ganjil-Genap** | Only odd- or even-numbered chip values may be played | Real Jakarta plate policy |
| **Sidak** (inspection) | Tycoon effects disabled this market | The "oknum" shows up |
| **Musim Kawin** (wedding season) | Lifestyle deeds double, everything else −20% | Seasonal demand joke |
| **Reklamasi** | Deck is thinned by 3 random cards for this market only | Land reclamation |

Implementation: new `modifier` field on `GameState`, chosen in `NEXT_ROUND`,
consumed inside `scoreHand` via an optional third argument. Every modifier must
be visible **before** the player commits, or it is unfair rather than difficult.

### 1.4 Consumables

The genre's other compounding axis. A small pool of single-use items bought at
the Night Market, held 2 at a time:

- **Sertifikat** — permanently convert one deed to a different group
- **Notaris** — duplicate a deed in your deck
- **Pungli** — reroll the current market modifier
- **Uang Pelicin** — +1 hand this market only
- **Sita** — destroy 3 cards at once

---

## Phase 2 — Write it like an Indonesian actually wrote it

This is the moat. The scoring engine is a commodity; the cultural specificity is
not. Currently the setting is Indonesian and the *voice* is generic Anglo
board-game.

### 2.1 Rewrite all Tycoons

Every one of the current ten — Red Baron, Rail Magnate, Lone Wolf, Diversifier,
Blue Chip, Power Player, The Banker, The Insider, Heritage Trust, Green
Corridor — is generic Western business vocabulary. The tagline is *"Be a corrupt
tycoon"* and there is no notaris, no makelar, no oknum, no bos proyek. The
satire the slogan promises never arrives.

Replacement direction (names to finalise with the writer, effects mapped to
existing and new `TycoonEffect` kinds):

| Archetype | Effect shape | Note |
| --- | --- | --- |
| **Pak Notaris** | ×1.5 flat | The paperwork always gets done |
| **Makelar Tanah** | +mult per Regional deed | Land broker |
| **Oknum** | Ignores the market modifier | The fixer — should be expensive |
| **Anak Pejabat** | Shop prices −40%, but −1 discard | Nepotism has a cost |
| **Bos Proyek** | +chips per Industrial deed, scaling with markets cleared | Project boss |
| **Juragan Kos** | +chips per duplicate deed in hand | Boarding-house landlord |
| **Sultan Andara** | ×2 if the play contains an Elite deed | Crazy-rich meme |
| **Tukang Palak** | +$2 every hand played | Petty extortion |
| **Pak RT** | +1 discard per market | The neighbourhood chief who fixes things |
| **Investor Bodong** | ×3, but 25% chance to score 0 | Ponzi scheme |

### 2.2 Give the utilities and Whoosh their jokes

Currently **PLN and PDAM are the same card** — both `+15` chips, `UTILITY`,
mechanically identical. And **Whoosh is 20 chips, identical to MRT and Gambir** —
the most comedically loaded infrastructure project in the country given the same
stat block as a train station.

| Card | Proposed behaviour |
| --- | --- |
| **Whoosh Rail** | Very high chips, but only scores if **Bandung** is also in the play — it only goes one place |
| **PLN Power** | High chips, 20% chance to score 0 (mati lampu) |
| **PDAM Water** | Low base, but +5 chips permanently each time it is *not* played |
| **Batam Port** | Cheapest Transit; give it a smuggling gag — converts one deed's group on play |

This requires a per-card `effect` field on `CardTemplate`, which does not exist
yet. Small addition to `types.ts` and `scoreHand`.

### 2.3 Companion commentary

Two Konco (AntekAsync, Soloman) with one intro line each is not a comedic voice.
Each needs a reactive line bank keyed to events — big score, whiffed hand, last
hand, flood market, bankruptcy, Tycoon hired. **~30 lines per companion.** This
is cheap to write and is what makes a run feel authored.

### 2.4 Terminology

Already partly done (`96cd0bf` settled on "market", removed "blind"/"ante").
Remaining: the scoring hand named **`MONOPOLY`** must be renamed — see Legal.

---

## Phase 3 — Assets to generate

Existing inventory: 32 card illustrations, 10 Tycoon portraits, 2 companions,
3 backgrounds, title mark. All 512×800 WebP, all original project art. Total
~6 MB. Keep that pipeline and format for consistency.

| Asset | Count | Spec | Priority |
| --- | ---: | --- | --- |
| **New Tycoon portraits** | 14–24 | 512×800 WebP, match existing pixel-noir treatment and palette | **P0** — blocks Phase 2.1 |
| **Market modifier cards** | 7 | 512×800 WebP — a flooded Kemang street, gridlock, blackout skyline, etc. | **P0** — blocks 1.3 |
| **Consumable icons** | 5–8 | 256×256 WebP, flatter/iconic so they read at small size | P1 |
| **Companion expression sheets** | 2 × 4 | Neutral / pleased / alarmed / smug, to pair with the line banks | P1 |
| **New deed art** | 8–12 | If the deck expands past 32 templates | P2 |
| **Boss / final market art** | 1 | A distinct market-8 backdrop, currently reuses the table | P2 |

Generation notes:

- Prompt from the **existing** cards to keep the pixel-noir night-Jakarta look
  consistent — the current set is the style reference, do not restyle mid-deck.
- Modifier art should be **legible at ~90px tall**, since it renders in the HUD
  band. Compose for the crop, not the full frame.
- Keep everything original. No third-party game assets or characters — this is
  both a project rule and what keeps the commercial path open.

---

## Phase 4 — Legal, before any storefront

**Blocking issue.** The project currently combines property-set collection,
coloured property groups, railroads, utilities, "deeds", a property board-game
theme, the slogan **"Monopoly Citizen Asset"**, and a displayed scoring hand
literally named **Monopoly**. Hasbro is unusually aggressive about this
combination. This is not a vibes risk.

Required before any commercial listing:

1. Rename the `MONOPOLY` hand — `data.ts` `HANDS`, `types.ts` `HandKey`,
   `HAND_RECIPES` in `App.tsx`, plus tests. Suggest **"Penguasaan"** or
   **"Takeover"**.
2. Drop "Monopoly Citizen Asset" from the menu eyebrow and `index.html`.
3. Keep **"Deck of Capitalist"** as the title and **"Be a corrupt tycoon."** as
   the tagline — neither is a problem.

---

## Monetization, honestly

| Path | Verdict |
| --- | --- |
| **Indonesian brand / B2B playable campaign** (property tech, bank, telco) | **Strongest.** A genuinely funny local property roguelike is a real branded-content vehicle. Entirely dependent on Phase 2 landing. |
| **Steam premium ~$4.99** | Needs Phases 1–3 complete. 6–12 months. Reviewers will open with the Balatro comparison; a 10-helper, no-boss, no-consumable version reads as a demake. |
| **Mobile F2P cosmetics** | Worst fit. Genre monetizes badly F2P; regional ARPU needs scale you will not have. |
| **itch.io / donations** | Rounding error. |

The 44 original illustrations are a genuine ownable asset and de-risk all of the
above — provided Phase 4 is done first.

---

## Suggested order

1. **Phase 1.1 + 1.2 together**, validated by `tests/balance.test.ts`. Nothing
   else matters until the run can be lost.
2. **Phase 1.3** market modifiers — biggest fun-per-line-of-code in the project,
   and it is where the Indonesian jokes become mechanics rather than decoration.
3. **Phase 2.1 + 2.2** the rewrite, with Phase 3 P0 art in parallel.
4. **Phase 4** before anything ships commercially.
5. Phase 1.4 and the rest of Phase 3 as depth allows.

## Verification for every phase

```bash
npm run lint && npm run test && npm run build && npx playwright test
```

Plus `npx vitest run tests/balance.test.ts` for any change touching targets,
Tycoon effects, or scoring — that harness is the only defence against
re-introducing a flat difficulty curve.
