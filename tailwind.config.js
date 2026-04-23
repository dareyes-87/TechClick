/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8eef5',
          100: '#c5d5e6',
          200: '#9eb9d4',
          300: '#779dc2',
          400: '#5988b5',
          500: '#1F4E79',
          600: '#1b4569',
          700: '#163958',
          800: '#112d47',
          900: '#0c2036',
        },
        accent: {
          50: '#fff3e0',
          100: '#ffe0b2',
          200: '#ffcc80',
          300: '#ffb74d',
          400: '#ffa726',
          500: '#FF8C00',
          600: '#e67e00',
          700: '#cc7000',
          800: '#b36200',
          900: '#995400',
        },
      },
    },
  },
  plugins: [],
}
