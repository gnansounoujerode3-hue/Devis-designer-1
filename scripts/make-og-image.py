#!/usr/bin/env python3
# ============================================================
# scripts/make-og-image.py — visuel de partage (og:image)
# ------------------------------------------------------------
# WhatsApp, Facebook, LinkedIn… n'affichent AUCUNE image si la page ne
# déclare pas d'`og:image` : le lien paraît alors en gris, sans visuel
# (et l'image doit être un PNG/JPG à URL absolue, pas un SVG).
#
# Ce script dessine la vignette 1200×630 à partir de rien d'autre que du
# texte : pas de capture d'écran à faire, donc rien qui puisse dériver
# entre la copie de l'app et le visuel. Les couleurs et le vocabulaire
# viennent de la charte (fond #F0F0F0, accent #0057FF, cartes blanches).
#
# Usage :
#   pip install pillow           # seule dépendance
#   python3 scripts/make-og-image.py
#   python3 scripts/make-og-image.py --out public/og-image.png --size 1200x630
#
# Si aucune police « bold » n'est trouvée sur le système, le gras est
# simulé au trait (stroke_width) : le rendu reste net, juste un peu moins fin.
# ============================================================
from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ACCENT = (0, 87, 255)        # #0057FF — couleur de l'app
ACCENT_SOFT = (0, 87, 255, 26)
BG = (240, 240, 240)         # #F0F0F0
CARD = (255, 255, 255)
INK = (17, 17, 17)           # #111
MUTED = (102, 102, 102)      # #666
FAINT = (140, 140, 140)
LINE = (232, 232, 232)
SOFT = (246, 247, 250)

FONT_CANDIDATES = [
    # (fichier gras, fichier normal) — le premier trouvé gagne
    ("/usr/share/fonts/truetype/inter/Inter-Bold.ttf", "/usr/share/fonts/truetype/inter/Inter-Regular.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    ("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf"),
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"),
    ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"),
]


def fonts() -> tuple:
    """(gras, normal) — résolutions successives : système, matplotlib, police par défaut de Pillow."""
    for bold_path, reg_path in FONT_CANDIDATES:
        if os.path.exists(bold_path) and os.path.exists(reg_path):
            return bold_path, reg_path, False
    try:  # matplotlib embarque DejaVu ; utile dans les environnements sans polices
        import matplotlib

        d = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf")
        b, r = os.path.join(d, "DejaVuSans-Bold.ttf"), os.path.join(d, "DejaVuSans.ttf")
        if os.path.exists(b) and os.path.exists(r):
            return b, r, False
    except Exception:
        pass
    return None, None, True  # défaut de Pillow + faux gras au trait


class Type:
    def __init__(self, bold_path, reg_path, stub):
        self.bold_path, self.reg_path, self.stub = bold_path, reg_path, stub

    def face(self, size, bold=False):
        path = (self.bold_path if bold else self.reg_path) or None
        if path:
            return ImageFont.truetype(path, size)
        return ImageFont.load_default(size=size)

    def text(self, draw, xy, s, size, color, bold=False, tracking=0):
        x, y = xy
        f = self.face(size, bold)
        # trait additionnel = faux gras quand la police n'a pas de version bold
        stroke = max(1, int(round(size / 34))) if (bold and self.stub) else 0
        if tracking:
            for ch in s:
                draw.text((x, y), ch, font=f, fill=color, stroke_width=stroke, stroke_fill=color)
                x += draw.textlength(ch, font=f) + tracking
            return x
        draw.text((x, y), s, font=f, fill=color, stroke_width=stroke, stroke_fill=color)
        return x + draw.textlength(s, font=f)

    def width(self, draw, s, size, bold=False):
        return draw.textlength(s, font=self.face(size, bold))


def rrect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def chip(draw, ty, x, y, label, size=26):
    pad_x, pad_y = 20, 12
    w = ty.width(draw, label, size) + pad_x * 2
    h = size + pad_y * 2
    rrect(draw, (x, y, x + w, y + h), h // 2, fill=(255, 255, 255), outline=(224, 224, 224), width=2)
    ty.text(draw, (x + pad_x, y + pad_y - 4), label, size, ACCENT, bold=True)
    return w


def mock_document(img, ty, box):
    """Aperçu d'un devis dessiné aux proportions A4 : c'est le « visuel » du produit."""
    x0, y0, x1, y1 = box
    pw, ph = x1 - x0, y1 - y0
    # ombre douce
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x0 + 8, y0 + 16, x1 + 8, y1 + 16), radius=10, fill=(0, 0, 0, 90))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))

    d = ImageDraw.Draw(img, "RGBA")
    rrect(d, (x0, y0, x1, y1), 10, fill=CARD)
    m = int(pw * 0.075)                      # marge intérieure
    top = y0 + int(ph * 0.075)

    # bandeau d'en-tête
    band_h = int(ph * 0.105)
    rrect(d, (x0, y0, x1, y0 + band_h), 10, fill=ACCENT)
    d.rectangle((x0, y0 + band_h - 12, x1, y0 + band_h), fill=ACCENT)
    ty.text(d, (x0 + m, y0 + band_h * 0.28), "DEVIS", int(pw * 0.058), (255, 255, 255), bold=True, tracking=2)
    num = "DEV-2026-014"
    ty.text(d, (x1 - m - ty.width(d, num, int(pw * 0.04)), y0 + band_h * 0.36), num, int(pw * 0.04), (255, 255, 255, 220))

    # bloc émetteur / client, sous le bandeau
    y = y0 + band_h + 20
    col_w = (pw - 2 * m - 18) // 2
    for i, (label, lines) in enumerate((("ATELIER KODJO", 3), ("Client", 3))):
        cx = x0 + m + i * (col_w + 18)
        ty.text(d, (cx, y), label, int(pw * 0.032), INK if i == 0 else MUTED, bold=(i == 0))
        for k in range(lines):
            w = col_w * (1.0 - 0.22 * k) if i == 1 else col_w * (0.7 - 0.15 * k)
            d.rectangle((cx, y + int(pw * 0.055) + k * 13, cx + w, y + int(pw * 0.055) + k * 13 + 6),
                        fill=(236, 236, 236) if i == 1 else (244, 244, 244))
    y += int(pw * 0.24)

    # tableau
    head_y = y
    d.rectangle((x0 + m, head_y, x1 - m, head_y + int(pw * 0.05)), fill=SOFT)
    tx = int(pw * 0.03)
    ty.text(d, (x0 + m + 12, head_y + 6), "Désignation", tx, MUTED, bold=True)
    qty_x, amt_x = x1 - m - 12 - 128, x1 - m - 12
    for lbl, rx in (("Qté", qty_x + 62), ("Montant", amt_x)):
        ty.text(d, (rx - ty.width(d, lbl, tx), head_y + 6), lbl, tx, MUTED, bold=True)
    y = head_y + int(pw * 0.05)
    row_h = int(pw * 0.058)
    for i in range(3):
        ry = y + i * row_h
        d.rectangle((x0 + m + 12, ry + row_h * 0.34, x0 + m + 12 + col_w * (0.88 - 0.1 * i), ry + row_h * 0.34 + 7),
                    fill=(238, 238, 238))
        for wx, wbar in ((qty_x + 34, 28), (amt_x - 92, 92)):
            d.rectangle((wx, ry + row_h * 0.34, wx + wbar, ry + row_h * 0.34 + 7), fill=(222, 226, 234))
        d.line((x0 + m, ry + row_h, x1 - m, ry + row_h), fill=LINE, width=1)
    y += 3 * row_h + 4

    # conditions à gauche (le vide du milieu serait illisible)
    cy = y + 8
    ty.text(d, (x0 + m, cy), "Conditions", int(pw * 0.028), FAINT, bold=True)
    for k in range(2):
        d.rectangle((x0 + m, cy + 20 + k * 13, x0 + m + col_w * (1.28 - 0.3 * k), cy + 26 + k * 13),
                    fill=(243, 244, 246))

    # totaux : bloc droit autonome, sous un filet d'accent (colonne à part, pas de chevauchement)
    tot_w = int(pw * 0.62)
    tot_x = amt_x - tot_w
    ty_ = int(pw * 0.03)
    ty.text(d, (tot_x, cy + 2), "Sous-total", ty_, MUTED)
    d.rectangle((amt_x - 92, cy + 6, amt_x, cy + 13), fill=(222, 226, 234))
    ty.text(d, (tot_x, cy + 26), "TVA 18 %", ty_, FAINT)
    d.rectangle((amt_x - 68, cy + 30, amt_x, cy + 37), fill=(228, 231, 238))
    d.line((tot_x - 10, cy + 54, amt_x, cy + 54), fill=ACCENT, width=3)
    amt_size = int(pw * 0.044)
    lbl_size = int(pw * 0.032)
    amt = "1 250 000 F CFA"
    # le montant garde sa place : l'étiquette s'arrête avant, jamais par-dessus
    amt_w = ty.width(d, amt, amt_size, True)
    ty.text(d, (amt_x - amt_w, cy + 62), amt, amt_size, ACCENT, bold=True)
    ty.text(d, (tot_x, cy + 64), "TOTAL TTC", lbl_size, INK, bold=True)

    # bas de page : signature
    fy = y1 - int(ph * 0.115)
    d.line((x0 + m, fy - 14, x0 + m + int(pw * 0.4), fy - 14), fill=LINE, width=1)
    pts = []
    for t in range(0, 100, 4):
        px = x0 + m + 10 + t * (pw * 0.0032)
        py = fy - 26 - int(9 * (1 if t % 16 < 8 else -1) * (0.4 + 0.6 * abs(((t % 40) - 20) / 20)))
        pts.append((px, py))
    d.line(pts, fill=(70, 70, 70, 200), width=3, joint="curve")
    ty.text(d, (x0 + m, fy + 2), "Signature du client · 07/09/2026", int(pw * 0.03), FAINT)
    stamp = "BROUILLON"
    sw = ty.width(d, stamp, int(pw * 0.034), bold=True)
    rrect(d, (x1 - m - sw - 24, fy - 6, x1 - m, fy + int(pw * 0.058)), 6, outline=(198, 205, 216), width=2)
    ty.text(d, (x1 - m - sw - 12, fy + 2), stamp, int(pw * 0.034), (150, 158, 172), bold=True, tracking=1)


def main() -> int:
    ap = argparse.ArgumentParser(description="Génère la vignette de partage (og:image).")
    ap.add_argument("--out", default="public/og-image.png")
    ap.add_argument("--size", default="1200x630")
    ap.add_argument("--logo", default="src/assets/logo.png")
    ap.add_argument("--title", default="Vos devis et factures, mis en page comme un studio.")
    ap.add_argument("--sub", default="12 modèles, signature du client, export PDF vectoriel.")
    ap.add_argument("--chips", default="20 exports offerts|XOF · EUR · USD|Mobile Money")
    ap.add_argument("--url", default="devis-designer-app.gnansounoujerode3.workers.dev")
    ap.add_argument("--note", default="Aucune installation, aucun compte.",
                    help="ligne discrète sous le domaine ; '' pour l'omettre")
    a = ap.parse_args()

    W, H = (int(v) for v in a.size.lower().split("x"))
    img = Image.new("RGB", (W, H), BG).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    ty = Type(*fonts())

    # léger dégradé d'accent en haut + filet vertical entre texte et document
    band = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for x in range(W):
        t = x / W
        bd.line((x, 0, x, 96), fill=(ACCENT[0], ACCENT[1], ACCENT[2], int(70 - 55 * t)))
    img.alpha_composite(band, (0, 0))
    d.rectangle((0, 0, W, 6), fill=ACCENT)

    # --- colonne de gauche : marque + promesse + preuve ---
    # Le bloc a des emplacements fixes ; le texte rétrécit jusqu'à tenir dans sa
    # case. Comme ça, changer --title ou --sub ne peut pas faire se chevaucher
    # les lignes ni disparaître un mot (le piège classique de la vignette).
    pad = 72
    col_x, col_w = pad, 640
    SLOT_TITLE = (196, 392)
    SLOT_SUB = (402, 470)
    SLOT_CHIPS = 484
    SLOT_FOOT = 546

    logo_size = 100
    if a.logo and os.path.exists(a.logo):
        lg = Image.open(a.logo).convert("RGBA")
        lg.thumbnail((logo_size, logo_size), Image.LANCZOS)
        rrect(d, (col_x - 6, 62, col_x + logo_size + 6, 62 + logo_size + 6), 26, fill=(255, 255, 255))
        img.alpha_composite(lg.resize((logo_size, logo_size), Image.LANCZOS), (col_x, 68))
        nx = col_x + logo_size + 24
    else:
        nx = col_x
    ty.text(d, (nx, 74), "Devis Designer", 44, INK, bold=True, tracking=-0.5)
    ty.text(d, (nx, 126), "devis · factures · signatures", 24, MUTED)

    def wrap(text, size, bold, width):
        out, cur = [], ""
        for w_ in text.split():
            cand = (cur + " " + w_).strip()
            if ty.width(d, cand, size, bold) > width and cur:
                out.append(cur)
                cur = w_
            else:
                cur = cand
        if cur:
            out.append(cur)
        return out

    def fit(text, sizes, bold, width, box, leading):
        lo, hi = box
        for size in sizes:
            lines = wrap(text, size, bold, width)
            need = len(lines) * leading(size)
            if len(lines) <= 3 and need <= hi - lo and all(ty.width(d, t, size, bold) <= width for t in lines):
                return size, lines, leading(size), max(0, (hi - lo - need) // 2)
        size = sizes[-1]
        lines = wrap(text, size, bold, width)[:3]
        return size, lines, leading(size), 0

    t_size, title_lines, t_lead, t_off = fit(a.title, [54, 50, 46, 42, 38], True, col_w, SLOT_TITLE, lambda z: int(z * 1.16))
    for i, ln in enumerate(title_lines):
        ty.text(d, (col_x, SLOT_TITLE[0] + t_off + i * t_lead), ln, t_size, INK, bold=True)

    s_size, sub_lines, s_lead, s_off = fit(a.sub, [27, 25, 23, 21], False, col_w, SLOT_SUB, lambda z: int(z * 1.45))
    for i, ln in enumerate(sub_lines):
        ty.text(d, (col_x, SLOT_SUB[0] + s_off + i * s_lead), ln, s_size, MUTED)

    labels = [c.strip() for c in a.chips.split("|") if c.strip()]
    size = 26
    while size > 14:
        total = sum(ty.width(d, t, size, True) + 40 for t in labels) + 12 * (len(labels) - 1)
        if total <= col_w:
            break
        size -= 1
    x = col_x
    for label in labels:
        x += chip(d, ty, x, SLOT_CHIPS, label, size) + 12

    # pied : domaine en pastille + note, sur la même ligne.
    # Un sous-domaine peut être long (devis-designer-app.<compte>.workers.dev) : on réduit
    # le corps de la pastille jusqu'à ce qu'elle tienne dans la colonne, on réduit la note,
    # et si les deux ne tiennent toujours pas, c'est la NOTE qui saute — jamais l'adresse.
    # Une adresse tronquée serait un mensonge sur le seul truc que le visiteur doit retenir.
    note = a.note
    u_size = 27
    while u_size > 18 and col_x + ty.width(d, a.url, u_size, True) + 44 + (20 + ty.width(d, note, 20) if note else 0) > col_x + col_w:
        u_size -= 1
    uw = ty.width(d, a.url, u_size, True)
    note_size = 24
    note_x = col_x + uw + 64
    while note and note_size > 14 and note_x + ty.width(d, note, note_size) > col_x + col_w:
        note_size -= 1   # la note ne passe jamais sous le document
    below = bool(note) and note_x + ty.width(d, note, note_size) > col_x + col_w
    if below:
        # Plus de place à droite de la pastille : la note passe dessous (petit corps),
        # elle ne disparaît pas, et l'adresse garde toute sa largeur.
        note_size = 16
        while note_size > 11 and col_x + ty.width(d, note, note_size) > col_w:
            note_size -= 1
        if col_x + ty.width(d, note, note_size) > col_w or SLOT_FOOT + 60 + note_size > H - 8:
            note = ""        # vraiment trop étroit : on renonce à la note, jamais à l'adresse
    rrect(d, (col_x, SLOT_FOOT, col_x + uw + 44, SLOT_FOOT + 48), 24, fill=ACCENT)
    ty.text(d, (col_x + 22, SLOT_FOOT + (48 - u_size) // 2 - 2), a.url, u_size, (255, 255, 255), bold=True)
    if note:
        if below:
            ty.text(d, (col_x + 2, SLOT_FOOT + 56), note, note_size, FAINT)
        else:
            ty.text(d, (note_x, SLOT_FOOT + (48 - note_size) // 2 - 2), note, note_size, FAINT)

    # --- colonne de droite : le document ---
    doc_w, doc_h = 372, 526
    mock_document(img, ty, (W - pad - doc_w + 26, (H - doc_h) // 2 - 4, W - pad + 26, (H - doc_h) // 2 - 4 + doc_h))

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    out = img.convert("RGB")
    out.save(a.out, "PNG", optimize=True)
    kb = os.path.getsize(a.out) / 1000
    print(f"✔ {a.out} — {W}×{H}, {kb:.0f} ko")
    if kb > 400:
        print("⚠ Plus de 400 ko : WhatsApp charge la vignette, mais c'est lourd pour un simple lien.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
