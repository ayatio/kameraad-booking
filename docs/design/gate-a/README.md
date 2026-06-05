# Kameraad Haarsnijder — Design System

> *"A gentleman's retreat."* The last refuge for men of all ages — even
> those who don't book a service are welcome to take a break from
> everyday life.

Kameraad Haarsnijder (Dutch: *Comrade Haircutter*) is a vintage-styled
men's barbershop at **Parijsstraat 29, 3000 Leuven, Belgium**. Its tagline
is *haarsnijder en barbier* — haircutter and barber. The brand sells the
feeling of an old-school gentleman's club: warm wood, white subway tile,
mounted curiosities, classic pomades (Reuzel, Layrite), and a chair you're
welcome to sit in even if you're just escaping the day.

This design system distills that world into a reusable kit: gold-on-ink
signage, warm cream paper, black-&-white portraiture, and clean condensed
type. The client loves the **simplicity** of the current site and wants it
**updated, lighter, calmer** — *less is more*. This system keeps the
vintage soul (gold, ink, B&W) but trades the heavy gold-textured image
headers for simple typographic headers in the same gold.

---

## Sources

All material was gathered from the live brand presence (no codebase or
Figma was provided):

- **Website:** https://www.kameraadhaarsnijder.be/ — a single-page
  Webflow site (hero wordmark, intro, team, photo gallery, address,
  opening hours, contact).
- **Booking:** https://www.kameraadhaarsnijder.be/afspraak-maken
- **Instagram:** https://www.instagram.com/kameraadhaarsnijder/

Real brand assets (logos, gold wordmarks, team portraits, interior &
shopfront photography) were downloaded into `/assets`. The original site's
section headers are **bitmap gold-textured wordmarks** (KAMERAAD, BARBIER,
GET IN TOUCH) — preserved as images; see Iconography.

---

## Brand at a glance

| | |
|---|---|
| **Name** | Kameraad Haarsnijder |
| **What** | Men's barbershop / gentleman's retreat |
| **Where** | Parijsstraat 29, 3000 Leuven, Belgium |
| **Hours** | Tue–Sat 10:00–20:00 · Mon/Sun/holidays "check Instagram" |
| **Contact** | info@kameraadhaarsnijder.be · +32 486 33 67 14 |
| **Team** | Avraz · Adil · Simar · Bas |
| **Languages** | Dutch (primary) + English copy on site |

---

## CONTENT FUNDAMENTALS

**Voice.** Warm, understated, a little wry. It sells a *feeling* (refuge,
brotherhood, a pause) rather than a hard service pitch. Confident but never
loud — the opposite of a discount-cut chain.

**Person.** Speaks as **"we"** (the shop) to **"you"** (the guest):
*"You can contact us by phone, however we're probably serving other
customers. Feel free to book an appointment."* Friendly, honest, slightly
self-deprecating.

**Bilingual.** Dutch is the native tongue (*haarsnijder*, *barbier*,
*Boek een afspraak*), with parallel English copy (*Book an appointment*).
Keep both registers available; default UI labels in Dutch with English
alongside where space allows.

**Casing.** The wordmark is all-caps **KAMERAAD** with a script
*HaarSnijder* beneath. Section labels read as confident uppercase
(BARBIER, GET IN TOUCH, ADDRESS). Body copy is sentence case. Team names
appear as given — sometimes caps (ADIL, SIMAR), sometimes title (Avraz,
Bas); normalize to uppercase for consistency in this system.

**Tone examples (verbatim from site):**
- *"Kameraadhaarsnijder grew out of the idea that there was no such thing
  as a gentleman's retreat."*
- *"Even customers who do not purchase a service are always welcome to take
  a break from everyday life."*
- *"Holidays: Check Instagram"* — practical, human, low-fuss.
- *"Barber Wanted"* — recruiting in plain English.

**Emoji:** none. Not part of the brand. Don't introduce them.

**Vibe words:** retreat · brotherhood · craft · vintage · calm · honest ·
unhurried.

---

## VISUAL FOUNDATIONS

**Palette.** Three families, no more.
- **Gold** `#C9A24B` — the single brand accent. Used for the wordmark,
  hairline ornaments, rules, button fills, and small flourishes. Has a
  lit highlight `#E1B34B`, a pale shimmer `#E8D29F` for gold-on-dark text,
  and a deep bronze `#9A7B33` for pressed states / fine detail.
- **Ink** `#16140F` — a *warm* near-black (not pure #000). The dark
  ground and primary text on paper. The street signage uses a cooler
  slate `#2C2E33`.
- **Paper** `#F6F1E7` — warm cream, the light ground. Plus white surfaces
  and a warm muted "smoke" grey `#8A857B` for captions.

Color is used **sparingly** — gold is a seasoning, not a sauce. Most of any
layout is paper or ink with one gold moment.

**Type.** An editorial serif, a condensed label, a warm body — exactly as
used on the live site.
- **Display / headings:** *Playfair Display* — a high-contrast editorial
  serif. Carries every large heading in **sentence case** with a gold
  *italic* accent (use `<em>`). Tight tracking (−0.01em). Weights 400–700.
  Token: `--font-serif`; helpers `.km-display`, `.km-h1/2/3`.
- **Labels / eyebrows / nav / buttons:** *Oswald* — condensed grotesque,
  uppercase, wide tracking (0.32em eyebrows, 0.14em nav/buttons). The quiet
  UI voice. Token: `--font-display`; helpers `.km-eyebrow`, `.km-label`.
- **Body:** *Hanken Grotesk* — humanist sans, warm and quiet, line-height
  1.6. Weights 400–600. Token: `--font-body`.
- All three are **free Google Fonts** loaded via CDN — nothing to upload.
- *(The original gold-textured wordmark / brush-script "HaarSnijder" face is
  custom and is kept only as image assets — never re-typeset it.)*

**Backgrounds.** No gradients-as-decoration, no purple, no glassmorphism.
Grounds are flat paper or flat ink. Imagery — full-bleed B&W portraits and
warm interior shots — does the heavy lifting. Optional very subtle paper
grain is acceptable; keep it near-invisible.

**Imagery vibe.** Two registers: (1) **team portraits in black & white**
(grainy, intimate, high-contrast) and (2) **warm natural-color interior /
shopfront** photography (brick, wood, tile, tungsten light). When mixing,
favour B&W for people and warm color for place. Never over-saturate.

**Hairline ornament.** A signature motif: a thin gold rule — dash, dot,
dash — sitting above/below a label (lifted from the gold wordmarks). Use it
to frame section headers instead of boxes. Defined as `.km-ornament`.

**Borders & cards.** Restrained. Hairline borders (`--line-on-paper` /
`--line-on-ink`) over heavy strokes. Corner radii are **small** (2–8px) —
this is a slab-and-tile world, not a soft rounded one. Cards are mostly
flat with a hairline or a gentle shadow; avoid the "rounded card + colored
left-border" cliché entirely.

**Shadows.** Soft, warm, low. Three steps only (`--shadow-1/2/3`), tinted
with ink not black. Elevation is subtle; this brand whispers.

**Spacing.** 4px base step (4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96).
Layouts are generous and unhurried — lots of paper around a small amount of
content. Honour the "less is more" brief with whitespace.

**Motion.** Quiet and slow. Gentle fades and short rises (180–360ms,
ease-out). No bounces, no parallax circus, no infinite loops. Hover =
slight darken / gold-lift; press = small shrink (~0.98) or shift to bronze.
Respect `prefers-reduced-motion`.

**Transparency / blur.** Used only for image protection — a soft ink
gradient (not a frosted capsule) behind text laid over photography. No
decorative blur.

---

## ICONOGRAPHY

The brand is **nearly icon-free** — it leans on photography, the gold
wordmark, and the hairline ornament rather than a UI icon set.

- **No built-in icon font** exists in the source. The only icons on the
  site are **social glyphs** (Facebook, Twitter/X, Instagram, YouTube) as
  small SVGs in the footer.
- **Gold-textured bitmap wordmarks** act as "section icons": `logo-gold`,
  `hero-banner` (full lockup), `barber-gold` (BARBIER), `get-in-touch-gold`.
  These are preserved in `/assets` and should be used as-is for hero/brand
  moments — never redrawn.
- **No emoji, no unicode-symbol icons.**
- **Substitute icon set (flagged):** for any *new* UI affordances (arrows,
  clock, pin, phone, chevrons) this system uses **Lucide** via CDN
  (`https://unpkg.com/lucide@latest`) — thin, even-stroke, vintage-friendly.
  This is a substitution; the brand has no icon system of its own. Keep
  icons rare, thin, and gold or ink.

When in doubt: a hairline ornament or a photograph beats an icon here.

---

## Index — what's in this system

**Root**
- `README.md` — this file.
- `Brand Guide.html` — the full visual brand & design-system guide (read first).
  Covers essence, logo, colour, type, the ornament, spacing, components,
  imagery, voice, iconography, **motion & video, social (Instagram), email &
  notifications**, and developer handoff.
- `Kameraad Homepage.html` — finished, multilingual reference homepage
  (booking flow, comforts section, strolling walk-in gentleman, 5-language switcher).
- `Kameraad Mobile.html` — the responsive homepage shown on iPhone frames
  (hero / booking / comforts / footer).
- `colors_and_type.css` — all color + type tokens (CSS vars) and semantic
  helpers (`.km-h1`, `.km-eyebrow`, `.km-label`, `.km-ornament`, dark theme
  via `.on-ink`).
- `i18n.js` — 5-language dictionary + switcher (`window.KH` API; see
  Multilingual below).
- `image-slot.js` — drag-and-drop image placeholder used by the
  retreat-comforts section.
- `SKILL.md` — Agent-Skill manifest for reuse in Claude Code.

**/assets** — real brand imagery
- `logo-gold.png`, `logo-white.png`, `hero-banner.png` (full lockup),
  `barber-gold.png`, `get-in-touch-gold.png` — gold wordmarks.
- `team-avraz/adil/simar/bas.jpg` — B&W team portraits.
- `gallery-*.jpg` — interior, shopfront, products. `barber-wanted.png`.

**/fonts** — (substitute fonts are loaded from Google Fonts CDN; see the
font flag below — no local files shipped).

**/preview** — design-system cards (rendered in the Design System tab):
colors, type, spacing/elevation, components, brand.

**/ui_kits/website** — high-fidelity recreation of the one-page site as
modular JSX components + an interactive `index.html`.

---

## MULTILINGUAL (i18n)

The homepage ships in **five languages**, switchable from the dock pill:
**Leuvens** (local dialect), **Nederlands** (default), **English**,
**Français**, **Español**. The system lives in `i18n.js`:

- Markup is tagged with `data-i18n="key"` (textContent),
  `data-i18n-html="key"` (innerHTML, for the gold `<em>` accents) and
  `data-i18n-ph="key"` (placeholders).
- `window.KH` is the API: `KH.t(key)`, `KH.list(key)` (for day/month
  arrays), `KH.setLang(code)`, `KH.onChange(fn)`. Choice persists in
  `localStorage` (`kh_lang`).
- The booking flow subscribes via `KH.onChange` and re-renders dynamic
  strings (service names, barber labels, dates, summary, confirmation)
  live on switch.
- ⚠️ **Leuvens needs Adil's review** — the dialect strings in `i18n.js`
  are a first approximation; Adil delivers the definitive Leuvens copy.

---

## ⚠️ Flags / substitutions (please confirm)

1. **Fonts are free Google Fonts — not placeholders.** *Playfair Display*
   (display/headings), *Oswald* (labels/nav/buttons) and *Hanken Grotesk*
   (body) are loaded via the Google Fonts CDN; nothing to upload. They are
   the chosen brand faces. Only the custom gold **KAMERAAD wordmark**
   lettering is image-only (kept in `/assets`) — never re-typeset it.
2. **Icons are substituted (Lucide via CDN)** — the brand has no icon set.
3. **No codebase / Figma** was provided; everything is reconstructed from
   the public site + Instagram. If you have the Webflow export or brand
   files, share them to tighten the recreation.
