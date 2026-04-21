/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        slate: {
          850: '#172033'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem'
      },
      boxShadow: {
        glass: '0 8px 32px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
        lift: '0 20px 40px -12px rgba(16, 185, 129, 0.22)',
        glow: '0 0 40px rgba(16, 185, 129, 0.35)'
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        float: 'float 7s ease-in-out infinite',
        pulseGlow: 'pulseGlow 4s ease-in-out infinite'
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(2deg)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' }
        }
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, rgba(236,253,245,0.97) 0%, rgba(255,255,255,0.92) 45%, rgba(209,250,229,0.55) 100%)',
        'cta-green':
          'linear-gradient(120deg, #059669 0%, #10b981 40%, #34d399 100%)'
      }
    }
  },
  plugins: []
};
