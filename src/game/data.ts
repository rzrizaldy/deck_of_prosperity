import type { CardTemplate, GroupKey, HandKey, Tycoon } from './types';

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
  MONOPOLY: { name: 'Monopoly', multiplier: 5, description: 'One completed asset group.' },
  CONGLOMERATE: { name: 'Conglomerate', multiplier: 7, description: 'A complete group plus another pair.' },
  DIVERSIFIED: { name: 'Diversified Portfolio', multiplier: 8, description: 'Five cards from five groups.' },
  TRANSPORT: { name: 'Transport Network', multiplier: 12, description: 'Four distinct railroads.' },
};

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
  { id: 'batam', name: 'Batam Port', chips: 12, group: 'SKY' },
  { id: 'malang', name: 'Malang', chips: 16, group: 'PINK' },
  { id: 'nusa-dua', name: 'Nusa Dua', chips: 21, group: 'ORANGE' },
  { id: 'bsd', name: 'BSD City', chips: 31, group: 'YELLOW' },
];

export const STARTING_DUPLICATES = ['medan', 'palembang', 'bandung', 'bogor', 'semarang', 'yogyakarta', 'solo', 'pln'];

export const TYCOONS: Tycoon[] = [
  { id: 'red-baron', name: 'Red Baron', description: '+15 chips for each Industrial deed.', cost: 6, effect: { kind: 'chips_per_group', group: 'RED', amount: 15 } },
  { id: 'rail-magnate', name: 'Rail Magnate', description: '+2 multiplier for each Transit card.', cost: 8, effect: { kind: 'mult_per_group', group: 'RAILROAD', amount: 2 } },
  { id: 'lone-wolf', name: 'Lone Wolf', description: '×2 multiplier on a one-card play.', cost: 6, effect: { kind: 'xmult_hand_size', size: 1, amount: 2 } },
  { id: 'diversifier', name: 'Diversifier', description: '+60 chips on Diversified Portfolio.', cost: 7, effect: { kind: 'chips_for_hand', hand: 'DIVERSIFIED', amount: 60 } },
  { id: 'blue-chip', name: 'Blue Chip', description: '+5 multiplier for each Elite deed.', cost: 9, effect: { kind: 'mult_per_group', group: 'BLUE', amount: 5 } },
  { id: 'power-player', name: 'Power Player', description: '×1.25 multiplier per Utility.', cost: 7, effect: { kind: 'xmult_per_group', group: 'UTILITY', amount: 1.25 } },
  { id: 'banker', name: 'The Banker', description: 'Raises the interest cap to $10.', cost: 5, effect: { kind: 'interest_cap', amount: 10 } },
  { id: 'insider', name: 'The Insider', description: 'All market prices are 20% lower.', cost: 7, effect: { kind: 'shop_discount', amount: 0.8 } },
  { id: 'heritage-trust', name: 'Heritage Trust', description: '+12 chips for each Heritage deed.', cost: 5, effect: { kind: 'chips_per_group', group: 'PINK', amount: 12 } },
  { id: 'green-corridor', name: 'Green Corridor', description: '+3 multiplier for each Golden Triangle deed.', cost: 8, effect: { kind: 'mult_per_group', group: 'GREEN', amount: 3 } },
];
