import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif:  ['"Instrument Serif"', '"Times New Roman"', 'serif'],
        sans:   ['Manrope', '-apple-system', 'system-ui', 'sans-serif'],
        mono:   ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        cq: {
          bg:       '#f4f1ea',
          warm:     '#ece8df',
          ink:      '#111111',
          soft:     '#2a2520',
          muted:    '#8a8579',
          line:     '#d8d3c6',
          lineSoft: '#e6e2d6',
          red:      '#c8311c',
          redDeep:  '#9b1f10',
          redTint:  '#f1d6cf',
          gold:     '#b89758',
        },
      },
    },
  },
  plugins: [],
}
export default config
