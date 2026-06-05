import type { Config } from 'tailwindcss'

// Design tokens ported from docs/design/gate-a/colors_and_type.css
// (Design Gate A approved 2026-06-05). The gate-a package is the binding
// visual reference; never hard-code hex values in components — consume
// these tokens (or the CSS custom properties mirrored in globals.css).
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/emails/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ---- Brand gold (gate-a) ----
        gold: {
          DEFAULT: '#C9A24B', // --gold: buttons, rules, accents
          bright: '#E1B34B', //  --gold-bright: lit highlight / hover on dark
          pale: '#E8D29F', //    --gold-pale: shimmer / gold text on deep ink
          deep: '#9A7B33', //    --gold-deep: bronze — pressed states, fine detail
        },
        // ---- Ink / dark neutrals (warm black) ----
        ink: {
          DEFAULT: '#16140F', // --ink: primary dark surface + text on paper
          2: '#211E18', //        --ink-2: raised card on a dark ground
          3: '#2E2A22', //        --ink-3: hairlines / dividers on dark
        },
        charcoal: '#2C2E33', //   --charcoal: signage slate
        // ---- Paper / light neutrals (warm cream) ----
        paper: {
          DEFAULT: '#F6F1E7', // --paper: primary light ground
          2: '#EDE6D6', //        --paper-2: sunk panel / alt rows
        },
        smoke: '#8A857B', //      --smoke: muted ink — captions, meta
        stone: '#B8B2A6', //      --stone: disabled / faint
        // ---- Semantic body text on paper ----
        fg2: '#4A453C',
        // ---- Hairlines ----
        'line-paper': 'rgba(22, 20, 15, 0.14)',
        'line-ink': 'rgba(232, 210, 159, 0.18)',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
        display: ['var(--font-oswald)', 'Arial Narrow', 'sans-serif'],
        body: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        display: '0.04em', // --track-display
        eyebrow: '0.32em', // --track-eyebrow
      },
      borderRadius: {
        sm: '2px', // --r-sm — slab-edged, not soft
        md: '4px', // --r-md
        lg: '8px', // --r-lg
        pill: '999px', // --r-pill
      },
      boxShadow: {
        1: '0 1px 2px rgba(22,20,15,.08), 0 1px 1px rgba(22,20,15,.04)',
        2: '0 6px 18px rgba(22,20,15,.12)',
        3: '0 18px 50px rgba(22,20,15,.22)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.22,1,.36,1)', // --ease-out (house easing)
      },
    },
  },
  plugins: [],
}

export default config
