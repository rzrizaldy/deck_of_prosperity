# Deck of Prosperity

A bright Indonesian property-card roguelike about building value together. It keeps the original Balatro × Monopoly Deal scoring, deck-building, markets, and progression intact—only the published identity, illustration system, characters, copy, and audio have been retuned for optimism.

## Play

**[Play Deck of Prosperity](https://deck-of-prosperity.allrize.tech)**

The game is solo: select one to five deed cards, make scoring portfolios, clear eight escalating market targets, then improve the persistent deck at the Community Market.

## Rules

Every market gives an independently shuffled copy of the persistent deck, an eight-card hand, four scoring plays, and three discard actions. Market difficulty only changes published target scores. Scoring is:

`(card chips + chip bonuses) × (base multiplier + multiplier bonuses) × multiplicative effects`

After clearing a target, invite Community Partners, acquire deeds, renovate one deed, curate one deed while the deck remains above the minimum, or reroll the offers. The gameplay model deliberately remains unchanged from the original private prototype.

## Development

```bash
npm install
npm run check
npm run test:e2e
```

The project uses React, TypeScript, Vite, Vitest, and Playwright. Saves are local to the browser; there is no backend, account system, analytics, or online leaderboard.

## Deployment

`.do/app.yaml` defines a DigitalOcean App Platform static site. It builds with `npm ci && npm run build`, publishes `dist`, and falls back to `index.html` for client-side navigation.

## Artwork and audio

The published edition uses new ImageGen-created light prosperity illustration families for all deed cards, Community Partner cards, companions, and the landing backdrop. All interface composition remains code-native for clarity and responsive play. Audio is procedural Web Audio: a bright gamelan-and-kalimba loop plus warm interaction cues, with no inherited character voice clips.
