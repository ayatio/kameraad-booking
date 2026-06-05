# Kameraad Haarsnijder — Developer Handover

> For **Claude** & **Hermes**. This package is a high-fidelity, working
> reference build of the Kameraad website + a complete design system. Build
> production against it: reuse the tokens, the copy, the i18n model, and the
> interaction patterns. **Don't redesign** — replicate.

---

## 1. What this is

Kameraad Haarsnijder is a vintage barbershop & "gentleman's retreat" in
Leuven (Parijsstraat 29). This repo contains:

- A **design system** (tokens, type, components, voice, imagery, motion,
  social/email templates) — see `Brand Guide.html` and `README.md`.
- A **working reference homepage** (`Kameraad Homepage.html`) — the source of
  truth for layout, interactions, booking flow, i18n and responsive behaviour.
- Supporting mocks for **mobile** and for **option exploration**.

Everything is plain HTML/CSS/vanilla JS driven by CSS custom properties — no
build step, no framework. Port it into whatever stack Hermes uses
(Next/Astro/Webflow/etc.) by keeping the tokens and the markup semantics.

---

## 2. Files — what to read, in order

| File | Role for the developer |
|---|---|
| **`README.md`** | Brand context, content fundamentals, visual foundations, iconography, file index. Read first. |
| **`Brand Guide.html`** | The full visual system, presentable. Logo, colour, type, ornament, spacing, components, imagery, voice, **motion & video, social (Instagram), email & notifications**, dev-handoff notes. |
| **`colors_and_type.css`** | **All design tokens** (CSS custom properties) + `.km-*` helper classes. The single source of truth for colour & type. Import this everywhere. |
| **`Kameraad Homepage.html`** | The reference implementation. Copy its structure, CSS and JS patterns. |
| **`i18n.js`** | 5-language dictionary + `window.KH` runtime. The translation contract (see §5). |
| **`image-slot.js`** | Drag-drop image placeholder used by the "comforts" section (client fills these in). |
| **`Kameraad Mobile.html`** | The homepage shown in iPhone frames (hero / booking / comforts / footer) — a visual mobile reference, not production. |
| **`Walk-in Options.html`** | Exploration of walk-in placements (decided: in-dock nav indicator). Reference only. |
| **`Mobile Booking Options.html`** | Exploration of mobile booking layouts (decided: **horizontal popup wizard**). Reference only. |
| `/assets` | Logos (gold/white wordmark), team portraits, photography, Instagram glyph. |
| `/ui_kits/website` | Modular JSX recreation of the site (component reference). |
| `/preview` | Design-system tab cards. |
| `SKILL.md` | Agent-skill manifest (for reusing this as a Claude skill). |

---

## 3. Design tokens (build against these)

Defined in `colors_and_type.css`. **Never hard-code hex** — consume the vars.

- **Colour:** gold accent (`--gold #C9A24B`, `--gold-bright`, `--gold-pale`,
  `--gold-deep`), warm ink darks (`--ink #16140F`, `--ink-2`, `--ink-3`),
  warm paper lights (`--paper #F6F1E7`, `--paper-2`), warm neutrals. Semantic:
  `--bg --surface --fg1 --fg2 --accent --border`. Dark sections add `.on-ink`.
- **Type:** **Playfair Display** (serif) for display/headings — sentence case,
  gold `<em>` italic accent; **Oswald** (condensed caps) for
  eyebrows/labels/nav/buttons; **Hanken Grotesk** for body. All free Google
  Fonts (loaded via CDN in `colors_and_type.css`). Helpers: `.km-display
  .km-h1/2/3 .km-eyebrow .km-label .km-lead .km-body .km-small .km-ornament`.
- **Spacing/radius/shadow:** `--space-1…9` (4px base), small radii
  (`--r-sm 2px … --r-pill 999px` — slab-edged, not soft), warm low shadows
  `--shadow-1/2/3`.
- **Motion:** house easing `--ease-out: cubic-bezier(.22,1,.36,1)`. Quiet —
  short rise+fade on enter, gentle parallax, no bounces/loops. Respect
  `prefers-reduced-motion`.

The custom **wordmark** (gold KAMERAAD lockup) is an image asset in `/assets`
— never re-typeset or recolour it.

---

## 4. Key interaction patterns to reproduce

All implemented in `Kameraad Homepage.html` (read the `<script>` at the bottom).

1. **Hero** — full-bleed street photo, gold wordmark fixed top-centre **only
   on the hero** (fades out on scroll). Headline + photo parallax.
2. **Floating dock** — glass pill, bottom-centre, sticky, subtle gold
   border-glow once scrolled.
3. **Walk-in status indicator** (in the dock, first nav item) — informational,
   **not clickable**; **green when open, red when closed**. Open =
   **Tue–Sun, 10:00–20:00** (closed Mondays + outside hours), computed live in
   JS (`setInterval`, 60s). Custom **little-gentleman cursor** on hover.
4. **Booking flow** — step-by-step: service → barber (filtered to those who do
   the chosen service) → date (skips Mondays) → time. Auto-advances; each done
   step collapses with its pick + a gold ✓. Confirmation: "Tot snel, kameraad."
   - **Desktop:** inline card (accordion).
   - **Mobile (≤680px):** opens as a **full-screen popup wizard** — one step
     per screen, progress dots, back ←, close ✕ (top-right) + Esc. Logo & dock
     are hidden while open; card is `z-index:2000; inset:0`. Triggered by the
     in-section "Boek je stoel →" button and the dock "Boek nu".
5. **Comforts section** — 5 drag-drop `image-slot`s (coffee/whiskey/rum/
   papers/shaving foam) the client fills in.
6. **Footer** — giant image-masked "Kom langs" text with background-position
   parallax.
7. **Responsive** — mobile dock = centered pill with **only** walk-in + Boek
   nu + language (other nav links dropped). No horizontal overflow (root
   `overflow-x: hidden`). See the `@media (max-width: 940/680/620/560)` blocks.

---

## 5. Internationalisation (i18n)

`i18n.js` ships **5 languages**: **Leuvens** (local dialect), **Nederlands**
(default), **English**, **Français**, **Español**. Switcher lives in the dock.

- Tag markup: `data-i18n="key"` (textContent), `data-i18n-html="key"`
  (innerHTML, for gold `<em>` accents), `data-i18n-ph="key"` (placeholders).
- Runtime API: `window.KH` → `KH.t(key)`, `KH.list(key)` (day/month arrays),
  `KH.setLang(code)`, `KH.onChange(fn)`. Persists to `localStorage` (`kh_lang`).
- The booking flow subscribes via `KH.onChange` and re-renders dynamic strings
  (services, barbers, dates, summary) on language switch.
- **Production note:** for a real CMS, lift the `DICT` object in `i18n.js` into
  your translation store; keep the `data-i18n*` attribute contract.

---

## 6. Content & data the client still owes (placeholders in the build)

Wire these to real data; today they're tasteful placeholders:

- **Services & prices** — `Knippen €27 · Baard €18 · Knippen + Baard €40 ·
  Kind €20`. Confirm real menu.
- **Barber → which services** roster — in the booking JS (`BARBERS` array:
  Avraz / Adil / Simar / Bas). Confirm who does what, and **map the real
  portrait photo to each barber**.
- **Booking backend** — the flow is a realistic **mock** (no calendar/payment).
  Wire to the real scheduling system; keep `data-svc` ids stable.
- **Leuvens copy** — the dialect strings in `i18n.js` are a first
  approximation; **Adil delivers the definitive Leuvens translation.**
- **Comforts photos** — the 5 `image-slot`s await real images.
- **Opening hours / address / Instagram handle** — verify
  (`@kameraadhaarsnijder`, Parijsstraat 29, Tue–Sun 10:00–20:00).

---

## 7. Iconography & assets

- The brand is nearly icon-free — it leans on photography, the gold wordmark
  and the hairline ornament. The only social channel/glyph is **Instagram**
  (`assets/icon-instagram.svg`).
- For any new UI affordances use **Lucide** (thin, even-stroke) sparingly —
  e.g. the icon variant in `Mobile Booking Options.html` loads Lucide from CDN.
- Imagery: **people in B&W** (grainy, high-contrast); **place in warm natural
  colour**. Never over-saturate.

---

## 8. Quick start

```html
<!-- 1 · tokens + fonts -->
<link rel="stylesheet" href="colors_and_type.css">
<!-- 2 · i18n (optional but recommended) -->
<script src="i18n.js"></script>
<!-- 3 · build sections against the tokens -->
<section>                       <!-- light by default -->
  <p class="km-eyebrow" data-i18n="ritual.eyebrow">Intro</p>
  <h2 class="km-h2" data-i18n-html="ritual.heading">De laatste <em>herenretraite</em></h2>
</section>
<section class="on-ink"> … same markup, dark themed … </section>
```

Theme any section dark by adding `.on-ink`. Everything else flows from the
tokens. When in doubt, open `Kameraad Homepage.html` and copy the pattern.

---

*Reconstructed from the public site + Instagram; no Webflow export or Figma
was provided. Fonts are free Google Fonts. Questions → start from
`Kameraad Homepage.html` and `Brand Guide.html`.*
