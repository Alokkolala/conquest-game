import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        accent:  '#c8a96e',
        danger:  '#8b2020',
      },
    },
  },
  plugins: [],
}
export default config
