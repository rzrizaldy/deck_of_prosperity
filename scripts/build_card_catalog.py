from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/generated/deck-of-capitalist-card-catalog.png"
FONT = "/System/Library/Fonts/Menlo.ttc"
TITLE = ROOT / "public/assets/title.png"

GROUPS = [
    ("HUNIAN", "#b85d5a", [
        ("Kampung Pesisir", "kampung-pesisir"), ("Rusun Pinggir Rel", "rusun-pinggir-rel"), ("Kontrakan Cipinang", "kontrakan-cipinang"), ("Perumahan Bekasi", "perumahan-bekasi"), ("Komplek Cibubur", "komplek-cibubur"),
        ("Kemang Townhouse", "kemang"), ("Pondok Indah", "pondok-indah"), ("Menteng", "menteng"), ("Pantai Indah Kapuk", "pantai-indah-kapuk"), ("Superblok SCBD", "scbd"),
    ]),
    ("KOMERSIAL", "#ca8d2d", [
        ("Warung Tenda", "warung-tenda"), ("Kios Pasar", "kios-pasar"), ("Ruko Depok", "ruko-depok"), ("Ruko BSD", "bsd"), ("Kafe Kemang", "kemang"),
        ("Blok M Plaza", "blok-m-plaza"), ("Senopati Strip", "senopati"), ("Kuningan Tower", "kuningan"), ("Sudirman Exchange", "sudirman"), ("SCBD District", "scbd"),
    ]),
    ("INDUSTRI", "#7858b7", [
        ("Gudang Dadap", "gudang-dadap"), ("Pabrik Cikarang", "pabrik-cikarang"), ("Kawasan Karawang", "kawasan-karawang"), ("Pelabuhan Tanjung Priok", "pelabuhan-tanjung-priok"), ("Smelter Sulawesi", "smelter-sulawesi"),
        ("Kilang Balikpapan", "balikpapan"), ("Batam Freeport", "batam"), ("Kawasan Kendal", "kawasan-kendal"), ("Morowali Estate", "morowali-estate"), ("Nusantara Megaproject", "nusantara-megaproject"),
    ]),
    ("UTILITAS", "#5d8797", [
        ("Sumur Kampung", "sumur-kampung"), ("PDAM Cabang", "pdam"), ("Gardu PLN", "pln"), ("Menara BTS", "menara-bts"), ("IPAL Kota", "ipal-kota"),
        ("Bendungan Jatiluhur", "bendungan-jatiluhur"), ("Jaringan Serat", "jaringan-serat"), ("Pembangkit Gas", "pembangkit-gas"), ("PLTA Cirata", "plta-cirata"), ("Grid Nusantara", "grid-nusantara"),
    ]),
    ("TRANSPORT", "#319b76", [
        ("Angkot Terminal", "angkot-terminal"), ("Stasiun KRL", "gambir"), ("Pelabuhan Merak", "pelabuhan-merak"), ("Tol Cipularang", "tol-cipularang"), ("MRT Jakarta", "mrt"),
        ("Bandara Soetta", "soetta"), ("Whoosh Rail", "whoosh"), ("Pelabuhan Batam", "batam"), ("Trans-Sumatra", "trans-sumatra"), ("Jaringan Logistik Nusantara", "jaringan-logistik-nusantara"),
    ]),
]


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def main() -> None:
    width, height = 3840, 2160
    canvas = Image.new("RGB", (width, height), "#071513")
    draw = ImageDraw.Draw(canvas)
    for y in range(height):
        shade = int(9 + y / height * 16)
        draw.line((0, y, width, y), fill=(2, shade, max(10, shade - 2)))
    title = Image.open(TITLE).convert("RGBA")
    title.thumbnail((1250, 590), Image.Resampling.LANCZOS)
    canvas.paste(title, ((width - title.width) // 2, 28), title)
    header_font = ImageFont.truetype(FONT, 30)
    rank_font = ImageFont.truetype(FONT, 34)
    name_font = ImageFont.truetype(FONT, 18)
    card_w, card_h, gap = 330, 260, 22
    left = (width - (10 * card_w + 9 * gap)) // 2
    top = 605
    for row, (group, color, assets) in enumerate(GROUPS):
        y = top + row * 305
        draw.rounded_rectangle((left - 18, y - 40, left + 10 * card_w + 9 * gap + 18, y + card_h + 18), radius=18, outline=color, width=3, fill="#0a1e1b")
        draw.text((left, y - 36), group, font=header_font, fill=color)
        for rank, (name, art_id) in enumerate(assets, start=1):
            x = left + (rank - 1) * (card_w + gap)
            art_path = ROOT / f"public/assets/cards/{art_id}.webp"
            art = fit(Image.open(art_path), (card_w - 12, card_h - 54))
            draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=14, outline=color, width=5, fill="#020b0a")
            canvas.paste(art, (x + 6, y + 6))
            draw.rectangle((x + 6, y + card_h - 46, x + card_w - 6, y + card_h - 6), fill="#071513")
            draw.text((x + 16, y + 13), str(rank), font=rank_font, fill="#fff0a1", stroke_width=2, stroke_fill="#071513")
            label = name.upper()
            while draw.textbbox((0, 0), label, font=name_font)[2] > card_w - 24 and len(label) > 3:
                label = label[:-4].rstrip() + "…"
            draw.text((x + 12, y + card_h - 38), label, font=name_font, fill="#f9ead0")
    canvas.save(OUT, "PNG", optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
