import type { Config } from 'tailwindcss'

// PROVISIONAL: The kameraad-wireframe-prototype.html is a grayscale layout with no
// brand colours. These tokens are derived solely from the service colour values in
// docs/TECHNICAL-BASELINE.md (#C9962A primary gold, #E8B84B accent gold). The full
// dark/gold palette — including exact hex values, neutrals, and semantic aliases —
// awaits design-gate approval before Phase 2 UI work begins.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Gold scale — seeded from #C9962A (primary) and #E8B84B (accent)
        gold: {
          '50': '#FEFBF2',
          '100': '#FDF4D0',
          '200': '#F9E49C',
          '300': '#F3CD5C',
          '400': '#E8B84B', // accent (TECHNICAL-BASELINE seed)
          '500': '#D9A030',
          '600': '#C9962A', // primary (TECHNICAL-BASELINE seed)
          '700': '#A87820',
          '800': '#875C18',
          '900': '#6B4513',
          '950': '#3D2508',
        },
        // Dark scale — near-black background hierarchy
        dark: {
          '50': '#F5F5F6',
          '100': '#E9E9EB',
          '200': '#D3D3D7',
          '300': '#B2B2B8',
          '400': '#8A8A90',
          '500': '#6A6A70',
          '600': '#52525A',
          '700': '#3B3B42',
          '800': '#27272D',
          '900': '#18181D',
          '950': '#0C0C0F',
        },
      },
    },
  },
  plugins: [],
}

export default config
