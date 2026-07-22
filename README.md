# Deck of Capitalist

A browser-based, pixel-noir property roguelike set above nighttime Jakarta. Build portfolios, hire Tycoons, tune a persistent 40-card deck, and defeat a fair AI rival across eight market rounds.

## Play

The production URL is added here after the first DigitalOcean deployment.

Desktop and landscape mobile are supported. Portrait mobile displays a rotation prompt while preserving the current run.

## Rules

Each round gives both competitors an independently shuffled copy of their persistent deck, eight-card hands, four scoring plays, and three discard actions. Select one to five cards. After every committed hand the rival answers using the same scoring engine and only its own private state. Match or beat its total after four hands to advance.

| Portfolio | Requirement | Multiplier |
| --- | --- | ---: |
| Liquidation | No matching group | ×1 |
| Development | One incomplete pair | ×2 |
| Joint Venture | Two separate pairs | ×3 |
| Monopoly | One complete asset group | ×5 |
| Conglomerate | Complete group plus another pair | ×7 |
| Diversified Portfolio | Five distinct groups | ×8 |
| Transport Network | Four distinct railroads | ×12 |

Scoring is `(card chips + chip bonuses) × (base multiplier + multiplier bonuses) × multiplicative effects`.

Winning opens the Night Market. Hire up to five Tycoons, acquire deeds, renovate one deed by `+5` chips, liquidate one deed while the deck remains above 32 cards, or reroll the offers. Both rivals begin with `$4` and receive `$5 + interest` after each round.

## Fair AI

- **Casual** chooses probabilistically among strong legal plays.
- **Trader** uses deeper discard simulations and selects among the best candidates.
- **Tycoon** uses the deepest evaluation and commits the highest estimated-value play.

The bot never sees the player’s hand or RNG future. Every decision is seeded, reproducible, and submitted through the same play/discard functions used by the player.

## Development

```bash
npm install
npm run dev
npm run check
npm run test:e2e
```

The project uses React, TypeScript, Vite, Vitest, and Playwright. Saves are versioned in browser local storage. The application has no backend, accounts, analytics, or online leaderboard.

## Deployment

`.do/app.yaml` defines a DigitalOcean App Platform static site. It builds with `npm ci && npm run build`, publishes `dist`, and falls back to `index.html` for client-side navigation.

## Artwork

The table, rival portraits, and ending scenes are original pixel-noir assets generated for this project with OpenAI ImageGen. The UI, deed cards, and scoring visuals are code-native for legibility and responsive behavior.
