/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#eef2ff',100:'#e0e7ff',500:'#6366f1',600:'#4f46e5',700:'#4338ca' },
        ocean: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
        teal: { 400:'#2dd4bf',500:'#14b8a6',600:'#0d9488' },
        water: { light:'#e0e7ff',mid:'#6366f1',dark:'#4338ca' },
      },
      fontFamily: {
        sans: ['Inter','system-ui','sans-serif'],
        display: ['Inter','system-ui','sans-serif'],
      },
      animation: {
        'bubble-rise': 'bubbleRise 6s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'wave': 'wave 8s ease-in-out infinite',
        'fish-swim': 'fishSwim 12s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        bubbleRise: {
          '0%': { transform:'translateY(0) scale(1)', opacity:'0.7' },
          '50%': { transform:'translateY(-40vh) scale(1.1) translateX(10px)', opacity:'0.5' },
          '100%': { transform:'translateY(-100vh) scale(0.5)', opacity:'0' },
        },
        float: {
          '0%,100%': { transform:'translateY(0)' },
          '50%': { transform:'translateY(-10px)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow:'0 0 5px rgba(14,165,233,0.4)' },
          '50%': { boxShadow:'0 0 20px rgba(14,165,233,0.8), 0 0 40px rgba(14,165,233,0.4)' },
        },
        wave: {
          '0%': { transform:'translateX(-100%)' },
          '100%': { transform:'translateX(100%)' },
        },
        fishSwim: {
          '0%': { transform:'translateX(-100px)' },
          '100%': { transform:'translateX(calc(100vw + 100px))' },
        },
        shimmer: {
          '0%': { backgroundPosition:'-1000px 0' },
          '100%': { backgroundPosition:'1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
