import type { CardTemplate, Consumable, GroupKey, HandKey, MarketModifier, Tycoon } from './types';

export const GROUPS: Record<GroupKey, { label: string; setSize: number; color: string; ink: string }> = {
  RESIDENTIAL: { label: 'Hunian', setSize: 13, color: '#b85d5a', ink: '#fff3df' },
  COMMERCIAL: { label: 'Komersial', setSize: 13, color: '#ca8d2d', ink: '#241604' },
  INNOVATION: { label: 'Industri & Inovasi', setSize: 13, color: '#7858b7', ink: '#f4efff' },
  INFRASTRUCTURE: { label: 'Infrastruktur Publik', setSize: 13, color: '#319b76', ink: '#021c12' },
};

export const HANDS: Record<HandKey, { name: string; multiplier: number; description: string }> = {
  HIGH_ASSET: { name: 'Aset Tinggi', multiplier: 1, description: 'Tidak ada pola; peringkat tertinggi memimpin.' },
  PAIR: { name: 'Pasangan', multiplier: 2, description: 'Dua aset dengan peringkat sama.' },
  TWO_PAIRS: { name: 'Dua Pasang', multiplier: 3, description: 'Dua pasangan peringkat berbeda.' },
  THREE_KIND: { name: 'Tiga Serupa', multiplier: 4, description: 'Tiga aset dengan peringkat sama.' },
  STRAIGHT: { name: 'Koridor', multiplier: 6, description: 'Lima peringkat berurutan, kelas bebas.' },
  FLUSH: { name: 'Satu Kelas', multiplier: 7, description: 'Lima aset dari kelas yang sama.' },
  FULL_HOUSE: { name: 'Kawasan Lengkap', multiplier: 9, description: 'Tiga serupa ditambah satu pasangan.' },
  FOUR_KIND: { name: 'Empat Serupa', multiplier: 12, description: 'Empat aset dengan peringkat sama.' },
  STRAIGHT_FLUSH: { name: 'Koridor Utama', multiplier: 16, description: 'Lima peringkat berurutan dalam satu kelas.' },
};

/** Market events are public constraints, not surprise punishments. */
export const MARKET_MODIFIERS: MarketModifier[] = [
  { id: 'BANJIR', name: 'Musim Hujan', summary: 'Aset Hunian beristirahat satu pasar ini.', art: 'banjir' },
  { id: 'MACET', name: 'Jam Sibuk', summary: 'Aset Infrastruktur menghasilkan setengah chip di pasar ini.', art: 'macet' },
  { id: 'MATI_LAMPU', name: 'Perawatan Jaringan', summary: 'Aset Infrastruktur beristirahat satu pasar ini.', art: 'mati-lampu' },
  { id: 'GANJIL_GENAP', name: 'Rute Bergilir', summary: 'Hanya aset chip ganjil yang bernilai di pasar ini.', art: 'ganjil-genap', parity: 'odd' },
  { id: 'SIDAK', name: 'Audit Terbuka', summary: 'Efek semua rekan berhenti sejenak di pasar ini.', art: 'sidak' },
  { id: 'MUSIM_KAWIN', name: 'Festival Pasar', summary: 'Chip Komersial dua kali lipat; aset lain −20%.', art: 'musim-kawin' },
  { id: 'REKLAMASI', name: 'Penataan Kawasan', summary: 'Tiga aset acak beristirahat hanya untuk pasar ini.', art: 'reklamasi' },
];

export const CONSUMABLES: Consumable[] = [
  { id: 'SERTIFIKAT', name: 'Sertifikat', description: 'Ubah satu aset terpilih ke grup aset berikutnya.', cost: 3, art: 'sertifikat' },
  { id: 'NOTARIS', name: 'Notaris', description: 'Salin satu aset terpilih ke tumpukan buangan.', cost: 4, art: 'notaris' },
  { id: 'PUNGLI', name: 'Musyawarah', description: 'Acak ulang event pasar publik. Penataan Kawasan tidak ikut.', cost: 3, art: 'pungli' },
  { id: 'UANG_PELICIN', name: 'Semangat Gotong Royong', description: 'Dapatkan satu tangan ekstra hanya untuk pasar ini.', cost: 4, art: 'uang-pelicin' },
  { id: 'SITA', name: 'Kurasi Portofolio', description: 'Singkirkan tepat tiga aset terpilih dari tanganmu.', cost: 4, art: 'sita' },
];

const ASSET_CLASSES: Array<{ group: GroupKey; assets: Array<{ name: string; artId?: string }> }> = [
  { group: 'COMMERCIAL', assets: [
    { name: 'Pasar Beringharjo', artId: '01-pasar-beringharjo' }, { name: 'Warung Tegal', artId: '02-warung-tegal' }, { name: 'Kafe Kota Tua', artId: '03-kafe-kota-tua' }, { name: 'Ruko Cibubur', artId: '04-ruko-cibubur' }, { name: 'Pasar Atas Bukittinggi', artId: '05-pasar-atas-bukittinggi' },
    { name: 'Malioboro', artId: '06-malioboro' }, { name: 'Blok M', artId: '07-blok-m' }, { name: 'Braga Bandung', artId: '08-braga-bandung' }, { name: 'Pasar Terapung', artId: '09-pasar-terapung' }, { name: 'Kuningan', artId: '10-kuningan' }, { name: 'Senopati', artId: '11-senopati' }, { name: 'SCBD', artId: '12-scbd' }, { name: 'PIK', artId: '13-pik' },
  ] },
  { group: 'INNOVATION', assets: [
    { name: 'Pabrik Cikarang', artId: '14-pabrik-cikarang' }, { name: 'Kawasan Karawang', artId: '15-kawasan-karawang' }, { name: 'Batam Tech Hub', artId: '16-batam-tech-hub' }, { name: 'Kawasan Industri Kendal', artId: '17-kawasan-kendal' }, { name: 'Morowali', artId: '18-morowali' }, { name: 'Bandung Tech Hub', artId: '19-bandung-tech-hub' }, { name: 'BRIN Serpong', artId: '20-brin-serpong' },
    { name: 'Universitas Gadjah Mada', artId: '21-ugm' }, { name: 'Institut Teknologi Bandung', artId: '22-itb' }, { name: 'Universitas Indonesia', artId: '23-ui' }, { name: 'PENS Surabaya', artId: '24-pens' }, { name: 'Universitas Airlangga', artId: '25-unair' }, { name: 'Universitas Hasanuddin', artId: '26-unhas' },
  ] },
  { group: 'RESIDENTIAL', assets: [
    { name: 'Kampung Naga', artId: '27-kampung-naga' }, { name: 'Rusun Tanah Abang', artId: '28-rusun-tanah-abang' }, { name: 'Kontrakan Cipinang', artId: '29-kontrakan-cipinang' }, { name: 'Perumahan Bekasi', artId: '30-perumahan-bekasi' }, { name: 'Komplek Cibubur', artId: '31-komplek-cibubur' }, { name: 'Kampung Pelangi Semarang', artId: '32-kampung-pelangi' }, { name: 'Kemang Townhouse', artId: '33-kemang-townhouse' },
    { name: 'Pondok Indah', artId: '34-pondok-indah' }, { name: 'Menteng', artId: '35-menteng' }, { name: 'Kota Baru Parahyangan', artId: '36-kota-baru-parahyangan' }, { name: 'Pantai Indah Kapuk', artId: '37-pik-residential' }, { name: 'Rusun Pasar Rumput', artId: '38-rusun-pasar-rumput' }, { name: 'Kampung Code', artId: '39-kampung-code' },
  ] },
  { group: 'INFRASTRUCTURE', assets: [
    { name: 'Sumur Kampung', artId: '40-sumur-kampung' }, { name: 'PDAM Jatiluhur', artId: '41-pdam-jatiluhur' }, { name: 'Gardu PLN', artId: '42-gardu-pln' }, { name: 'Menara BTS', artId: '43-menara-bts' }, { name: 'IPAL Kota', artId: '44-ipal-kota' }, { name: 'PLTA Cirata', artId: '45-plta-cirata' }, { name: 'Jaringan Serat Nusantara', artId: '46-jaringan-serat' },
    { name: 'MRT Jakarta', artId: '47-mrt-jakarta' }, { name: 'Stasiun Gambir', artId: '48-stasiun-gambir' }, { name: 'Pelabuhan Merak', artId: '49-pelabuhan-merak' }, { name: 'Bandara Soekarno-Hatta', artId: '50-bandara-soetta' }, { name: 'Whoosh', artId: '51-whoosh' }, { name: 'Trans-Sumatra', artId: '52-trans-sumatra' },
  ] },
];

export const CARD_TEMPLATES: CardTemplate[] = ASSET_CLASSES.flatMap(({ group, assets }) =>
  Array.from({ length: 13 }, (_, index) => {
    const rank = index + 1;
    const asset = assets[index];
    return { id: `${group.toLowerCase()}-${rank}`, name: asset.name, artId: asset.artId, chips: rank * 5, rank, group };
  }),
);
export const STARTING_DUPLICATES: string[] = [];

const TYCOON_ROSTER: Tycoon[] = [
  { id: 'pak-notaris', name: 'Pak Notaris', description: '×1.5 multiplier. Dokumennya selalu rapi.', cost: 8, effect: { kind: 'xmult_flat', amount: 1.5 } },
  { id: 'makelar-tanah', artId: 'red-baron', name: 'Bu Rani Hunian', description: '+3 multiplier untuk tiap aset Hunian.', cost: 5, effect: { kind: 'mult_per_group', group: 'RESIDENTIAL', amount: 3 } },
  { id: 'oknum', artId: 'insider', name: 'Kak Dimas Data', description: '×1.35 multiplier. Keputusan berbasis data.', cost: 9, effect: { kind: 'xmult_flat', amount: 1.35 } },
  { id: 'anak-pejabat', artId: 'banker', name: 'Bu Sinta Koperasi', description: 'Semua harga Pasar Bersama 40% lebih murah.', cost: 7, effect: { kind: 'shop_discount', amount: 0.6 } },
  { id: 'bos-proyek', artId: 'power-player', name: 'Mas Arif Karya', description: '+25 chip untuk tiap aset Industri & Inovasi.', cost: 6, effect: { kind: 'chips_per_group', group: 'INNOVATION', amount: 25 } },
  { id: 'juragan-kos', artId: 'heritage-trust', name: 'Ibu Mira Hunian', description: '+20 chip untuk tiap aset Hunian.', cost: 6, effect: { kind: 'chips_per_group', group: 'RESIDENTIAL', amount: 20 } },
  { id: 'sultan-andara', artId: 'blue-chip', name: 'Kak Naya Niaga', description: '×2 multiplier saat aset Komersial ikut dimainkan.', cost: 10, effect: { kind: 'xmult_per_group', group: 'COMMERCIAL', amount: 2 } },
  { id: 'tukang-palak', artId: 'lone-wolf', name: 'Pak Joko Usaha', description: '+4 multiplier untuk tiap aset Komersial.', cost: 6, effect: { kind: 'mult_per_group', group: 'COMMERCIAL', amount: 4 } },
  { id: 'pak-rt', artId: 'green-corridor', name: 'Pak RT', description: 'Batas bunga naik menjadi $10.', cost: 5, effect: { kind: 'interest_cap', amount: 10 } },
  { id: 'investor-bodong', artId: 'diversifier', name: 'Bu Laras Strategi', description: '×2.25 pada Koridor Utama. Rencananya matang.', cost: 8, effect: { kind: 'xmult_per_hand', hand: 'STRAIGHT_FLUSH', amount: 2.25 } },
  { id: 'raja-kavling', artId: 'red-baron', name: 'Pak Wira Kawasan', description: '×1.35 multiplier untuk tiap aset Hunian.', cost: 8, effect: { kind: 'xmult_per_group', group: 'RESIDENTIAL', amount: 1.35 } },
  { id: 'ibu-ibu-arisan', artId: 'heritage-trust', name: 'Ibu-Ibu Arisan', description: '+70 chip pada Pasangan.', cost: 5, effect: { kind: 'chips_for_hand', hand: 'PAIR', amount: 70 } },
  { id: 'mafia-parkir', artId: 'lone-wolf', name: 'Mbak Rosi Mobilitas', description: '×1.8 multiplier saat hanya memainkan satu kartu.', cost: 5, effect: { kind: 'xmult_hand_size', size: 1, amount: 1.8 } },
  { id: 'bandar-tol', artId: 'rail-magnate', name: 'Pak Adi Transit', description: '+3 multiplier untuk tiap aset Infrastruktur.', cost: 7, effect: { kind: 'mult_per_group', group: 'INFRASTRUCTURE', amount: 3 } },
  { id: 'pengusaha-kafe', artId: 'green-corridor', name: 'Pengusaha Kafe', description: '+22 chip untuk tiap aset Komersial.', cost: 6, effect: { kind: 'chips_per_group', group: 'COMMERCIAL', amount: 22 } },
  { id: 'penguasa-sudirman', artId: 'green-corridor', name: 'Penguasa Sudirman', description: '+4 multiplier untuk tiap aset Komersial.', cost: 7, effect: { kind: 'mult_per_group', group: 'COMMERCIAL', amount: 4 } },
  { id: 'tuan-tanah', artId: 'blue-chip', name: 'Bu Tania Tata Ruang', description: '×2 multiplier pada Kawasan Lengkap.', cost: 9, effect: { kind: 'xmult_per_hand', hand: 'FULL_HOUSE', amount: 2 } },
  { id: 'pialang-saham', artId: 'banker', name: 'Pak Bayu Finansial', description: '×1.6 multiplier. Angkanya terarah.', cost: 8, effect: { kind: 'xmult_flat', amount: 1.6 } },
  { id: 'bos-pelabuhan', artId: 'rail-magnate', name: 'Kak Raka Pelabuhan', description: '+30 chip untuk tiap aset Infrastruktur.', cost: 7, effect: { kind: 'chips_per_group', group: 'INFRASTRUCTURE', amount: 30 } },
  { id: 'sultan-kontainer', artId: 'power-player', name: 'Mbak Sasa Energi', description: '+45 chip untuk tiap aset Infrastruktur.', cost: 6, effect: { kind: 'chips_per_group', group: 'INFRASTRUCTURE', amount: 45 } },
  { id: 'ibu-cosplay', artId: 'diversifier', name: 'Ibu Cosplay', description: '×1.9 multiplier pada Satu Kelas.', cost: 8, effect: { kind: 'xmult_per_hand', hand: 'FLUSH', amount: 1.9 } },
  { id: 'raja-petak', artId: 'red-baron', name: 'Raja Petak', description: '+90 chip pada Dua Pasang.', cost: 6, effect: { kind: 'chips_for_hand', hand: 'TWO_PAIRS', amount: 90 } },
  { id: 'kolektor-ruko', artId: 'blue-chip', name: 'Kolektor Ruko', description: '×1.5 multiplier untuk tiap aset Komersial.', cost: 9, effect: { kind: 'xmult_per_group', group: 'COMMERCIAL', amount: 1.5 } },
  { id: 'juragan-bali', artId: 'green-corridor', name: 'Juragan Bali', description: '+24 chip untuk tiap aset Hunian.', cost: 6, effect: { kind: 'chips_per_group', group: 'RESIDENTIAL', amount: 24 } },
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
  description: `${tycoon.description} Inti ×${TYCOON_CORE_MULTIPLIER}.`,
}));
