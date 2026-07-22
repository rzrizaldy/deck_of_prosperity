import type { CardTemplate, Consumable, GroupKey, HandKey, MarketModifier, Tycoon } from './types';

export const GROUPS: Record<GroupKey, { label: string; setSize: number; color: string; ink: string }> = {
  BROWN: { label: 'Regional', setSize: 2, color: '#8b5a2b', ink: '#fff5df' },
  SKY: { label: 'Java', setSize: 3, color: '#50c8ef', ink: '#071c2b' },
  PINK: { label: 'Heritage', setSize: 3, color: '#e4549b', ink: '#260919' },
  ORANGE: { label: 'Tourism', setSize: 3, color: '#f28b2d', ink: '#2b1203' },
  RED: { label: 'Industrial', setSize: 3, color: '#d84343', ink: '#fff1e7' },
  YELLOW: { label: 'Lifestyle', setSize: 3, color: '#f1c84c', ink: '#211702' },
  GREEN: { label: 'Golden Triangle', setSize: 3, color: '#2da66f', ink: '#031d12' },
  BLUE: { label: 'Elite', setSize: 2, color: '#315bb4', ink: '#eef4ff' },
  RAILROAD: { label: 'Transit', setSize: 4, color: '#2d3139', ink: '#f8d98b' },
  UTILITY: { label: 'Utility', setSize: 2, color: '#7d8794', ink: '#101419' },
};

export const HANDS: Record<HandKey, { name: string; multiplier: number; description: string }> = {
  LIQUIDATION: { name: 'Liquidation', multiplier: 1, description: 'No matching asset group.' },
  DEVELOPMENT: { name: 'Development', multiplier: 2, description: 'One incomplete pair.' },
  JOINT_VENTURE: { name: 'Joint Venture', multiplier: 3, description: 'Two separate pairs.' },
  TAKEOVER: { name: 'Takeover', multiplier: 5, description: 'One completed asset group.' },
  CONGLOMERATE: { name: 'Conglomerate', multiplier: 7, description: 'A complete group plus another pair.' },
  DIVERSIFIED: { name: 'Diversified Portfolio', multiplier: 8, description: 'Five cards from five groups.' },
  TRANSPORT: { name: 'Transport Network', multiplier: 12, description: 'Four distinct railroads.' },
};

/** Market events are public constraints, not surprise punishments. */
export const MARKET_MODIFIERS: MarketModifier[] = [
  { id: 'BANJIR', name: 'Banjir', summary: 'Regional and Heritage deeds score 0 this market.', art: 'banjir' },
  { id: 'MACET', name: 'Macet', summary: 'Transit deeds score half chips this market.', art: 'macet' },
  { id: 'MATI_LAMPU', name: 'Mati Lampu', summary: 'Utility deeds score 0 this market.', art: 'mati-lampu' },
  { id: 'GANJIL_GENAP', name: 'Ganjil-Genap', summary: 'Only odd-chip deeds score this market.', art: 'ganjil-genap', parity: 'odd' },
  { id: 'SIDAK', name: 'Sidak', summary: 'Tycoon effects are disabled this market.', art: 'sidak' },
  { id: 'MUSIM_KAWIN', name: 'Musim Kawin', summary: 'Lifestyle chips double; all other deed chips are −20%.', art: 'musim-kawin' },
  { id: 'REKLAMASI', name: 'Reklamasi', summary: 'Three random deeds are removed for this market only.', art: 'reklamasi' },
];

export const CONSUMABLES: Consumable[] = [
  { id: 'SERTIFIKAT', name: 'Sertifikat', description: 'Retitle one selected deed into the next asset group.', cost: 3, art: 'sertifikat' },
  { id: 'NOTARIS', name: 'Notaris', description: 'Copy one selected deed into your discard pile.', cost: 4, art: 'notaris' },
  { id: 'PUNGLI', name: 'Pungli', description: 'Reroll the public market event. Reklamasi is off the table.', cost: 3, art: 'pungli' },
  { id: 'UANG_PELICIN', name: 'Uang Pelicin', description: 'Gain one extra hand for this market only.', cost: 4, art: 'uang-pelicin' },
  { id: 'SITA', name: 'Sita', description: 'Destroy exactly three selected deeds from your hand.', cost: 4, art: 'sita' },
];

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: 'medan', name: 'Medan', chips: 5, group: 'BROWN' },
  { id: 'palembang', name: 'Palembang', chips: 5, group: 'BROWN' },
  { id: 'bandung', name: 'Bandung', chips: 10, group: 'SKY' },
  { id: 'bogor', name: 'Bogor', chips: 10, group: 'SKY' },
  { id: 'semarang', name: 'Semarang', chips: 10, group: 'SKY' },
  { id: 'yogyakarta', name: 'Yogyakarta', chips: 15, group: 'PINK' },
  { id: 'solo', name: 'Solo', chips: 15, group: 'PINK' },
  { id: 'surabaya', name: 'Surabaya', chips: 15, group: 'PINK' },
  { id: 'kuta', name: 'Kuta Beach', chips: 20, group: 'ORANGE' },
  { id: 'ubud', name: 'Ubud', chips: 20, group: 'ORANGE' },
  { id: 'seminyak', name: 'Seminyak', chips: 20, group: 'ORANGE' },
  { id: 'balikpapan', name: 'Balikpapan', chips: 25, group: 'RED' },
  { id: 'makassar', name: 'Makassar', chips: 25, group: 'RED' },
  { id: 'manado', name: 'Manado', chips: 25, group: 'RED' },
  { id: 'kemang', name: 'Kemang', chips: 30, group: 'YELLOW' },
  { id: 'senopati', name: 'Senopati', chips: 30, group: 'YELLOW' },
  { id: 'pondok-indah', name: 'Pondok Indah', chips: 30, group: 'YELLOW' },
  { id: 'kuningan', name: 'Kuningan', chips: 35, group: 'GREEN' },
  { id: 'sudirman', name: 'Sudirman', chips: 35, group: 'GREEN' },
  { id: 'thamrin', name: 'Thamrin', chips: 35, group: 'GREEN' },
  { id: 'menteng', name: 'Menteng', chips: 50, group: 'BLUE' },
  { id: 'scbd', name: 'SCBD', chips: 50, group: 'BLUE' },
  { id: 'gambir', name: 'Gambir Station', chips: 20, group: 'RAILROAD' },
  { id: 'soetta', name: 'Soetta Airport', chips: 20, group: 'RAILROAD' },
  { id: 'mrt', name: 'MRT Jakarta', chips: 20, group: 'RAILROAD' },
  { id: 'whoosh', name: 'Whoosh Rail', chips: 20, group: 'RAILROAD' },
  { id: 'pln', name: 'PLN Power', chips: 15, group: 'UTILITY' },
  { id: 'pdam', name: 'PDAM Water', chips: 15, group: 'UTILITY' },
  { id: 'batam', name: 'Batam Port', chips: 12, group: 'RAILROAD' },
  { id: 'malang', name: 'Malang', chips: 16, group: 'PINK' },
  { id: 'nusa-dua', name: 'Nusa Dua', chips: 21, group: 'ORANGE' },
  { id: 'bsd', name: 'BSD City', chips: 31, group: 'YELLOW' },
];

export const STARTING_DUPLICATES = ['medan', 'palembang', 'bandung', 'bogor', 'semarang', 'yogyakarta', 'solo', 'pln'];

const TYCOON_ROSTER: Tycoon[] = [
  { id: 'pak-notaris', name: 'Pak Notaris', description: '×1.5 multiplier. The paperwork always clears.', cost: 8, effect: { kind: 'xmult_flat', amount: 1.5 } },
  { id: 'makelar-tanah', artId: 'red-baron', name: 'Makelar Tanah', description: '+3 multiplier for each Regional deed.', cost: 5, effect: { kind: 'mult_per_group', group: 'BROWN', amount: 3 } },
  { id: 'oknum', artId: 'insider', name: 'Oknum', description: '×1.35 multiplier. The inspection looks away.', cost: 9, effect: { kind: 'xmult_flat', amount: 1.35 } },
  { id: 'anak-pejabat', artId: 'banker', name: 'Anak Pejabat', description: 'All Night Market prices are 40% lower.', cost: 7, effect: { kind: 'shop_discount', amount: 0.6 } },
  { id: 'bos-proyek', artId: 'power-player', name: 'Bos Proyek', description: '+25 chips for each Industrial deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'RED', amount: 25 } },
  { id: 'juragan-kos', artId: 'heritage-trust', name: 'Juragan Kos', description: '+20 chips for each Heritage deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'PINK', amount: 20 } },
  { id: 'sultan-andara', artId: 'blue-chip', name: 'Sultan Andara', description: '×2 multiplier when an Elite deed joins the play.', cost: 10, effect: { kind: 'xmult_per_group', group: 'BLUE', amount: 2 } },
  { id: 'tukang-palak', artId: 'lone-wolf', name: 'Tukang Palak', description: '+4 multiplier for each Lifestyle deed.', cost: 6, effect: { kind: 'mult_per_group', group: 'YELLOW', amount: 4 } },
  { id: 'pak-rt', artId: 'green-corridor', name: 'Pak RT', description: 'Raises the interest cap to $10.', cost: 5, effect: { kind: 'interest_cap', amount: 10 } },
  { id: 'investor-bodong', artId: 'diversifier', name: 'Investor Bodong', description: '×2.25 on a Diversified Portfolio. Trust the brochure.', cost: 8, effect: { kind: 'xmult_per_hand', hand: 'DIVERSIFIED', amount: 2.25 } },
  { id: 'raja-kavling', artId: 'red-baron', name: 'Raja Kavling', description: '×1.35 multiplier for each Regional deed.', cost: 8, effect: { kind: 'xmult_per_group', group: 'BROWN', amount: 1.35 } },
  { id: 'ibu-ibu-arisan', artId: 'heritage-trust', name: 'Ibu-Ibu Arisan', description: '+70 chips on a Development.', cost: 5, effect: { kind: 'chips_for_hand', hand: 'DEVELOPMENT', amount: 70 } },
  { id: 'mafia-parkir', artId: 'lone-wolf', name: 'Mafia Parkir', description: '×1.8 multiplier on a one-card play.', cost: 5, effect: { kind: 'xmult_hand_size', size: 1, amount: 1.8 } },
  { id: 'bandar-tol', artId: 'rail-magnate', name: 'Bandar Tol', description: '+3 multiplier for each Transit deed.', cost: 7, effect: { kind: 'mult_per_group', group: 'RAILROAD', amount: 3 } },
  { id: 'pengusaha-kafe', artId: 'green-corridor', name: 'Pengusaha Kafe', description: '+22 chips for each Lifestyle deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'YELLOW', amount: 22 } },
  { id: 'penguasa-sudirman', artId: 'green-corridor', name: 'Penguasa Sudirman', description: '+4 multiplier for each Golden Triangle deed.', cost: 7, effect: { kind: 'mult_per_group', group: 'GREEN', amount: 4 } },
  { id: 'tuan-tanah', artId: 'blue-chip', name: 'Tuan Tanah', description: '×2 multiplier on a Takeover.', cost: 9, effect: { kind: 'xmult_per_hand', hand: 'TAKEOVER', amount: 2 } },
  { id: 'pialang-saham', artId: 'banker', name: 'Pialang Saham', description: '×1.6 multiplier. Everything is priced in.', cost: 8, effect: { kind: 'xmult_flat', amount: 1.6 } },
  { id: 'bos-pelabuhan', artId: 'rail-magnate', name: 'Bos Pelabuhan', description: '+30 chips for each Transit deed.', cost: 7, effect: { kind: 'chips_per_group', group: 'RAILROAD', amount: 30 } },
  { id: 'sultan-kontainer', artId: 'power-player', name: 'Sultan Kontainer', description: '+45 chips for each Utility deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'UTILITY', amount: 45 } },
  { id: 'ibu-cosplay', artId: 'diversifier', name: 'Ibu Cosplay', description: '×1.9 multiplier on a Conglomerate.', cost: 8, effect: { kind: 'xmult_per_hand', hand: 'CONGLOMERATE', amount: 1.9 } },
  { id: 'raja-petak', artId: 'red-baron', name: 'Raja Petak', description: '+90 chips on a Joint Venture.', cost: 6, effect: { kind: 'chips_for_hand', hand: 'JOINT_VENTURE', amount: 90 } },
  { id: 'kolektor-ruko', artId: 'blue-chip', name: 'Kolektor Ruko', description: '×1.5 multiplier for each Elite deed.', cost: 9, effect: { kind: 'xmult_per_group', group: 'BLUE', amount: 1.5 } },
  { id: 'juragan-bali', artId: 'green-corridor', name: 'Juragan Bali', description: '+24 chips for each Tourism deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'ORANGE', amount: 24 } },
];

/**
 * A contract is always a meaningful investment. Conditional effects form the
 * build; the visible core multiplier makes buying into it compound over a run.
 */
const TYCOON_CORE_MULTIPLIER = 1.39;

export const TYCOONS: Tycoon[] = TYCOON_ROSTER.map((tycoon) => ({
  ...tycoon,
  cost: Math.max(3, Math.floor(tycoon.cost * 0.6)),
  xmult: tycoon.xmult ?? TYCOON_CORE_MULTIPLIER,
  description: `${tycoon.description} Core ×${TYCOON_CORE_MULTIPLIER}.`,
}));
