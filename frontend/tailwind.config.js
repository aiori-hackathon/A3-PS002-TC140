module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: { 900: '#0a0e1a', 800: '#0d1224', 700: '#111827', 600: '#1a2236' },
        accent: { green: '#00ff9d', blue: '#00b4ff', red: '#ff4d6d', yellow: '#ffd700' }
      }
    }
  },
  plugins: []
}
