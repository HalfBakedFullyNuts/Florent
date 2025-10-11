module.exports = {
	content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			colors: {
				'pink-nebula': {
					bg: '#120c18',
					panel: '#21182c',
					'accent-primary': '#e91e63',
					'accent-secondary': '#ff4081',
					text: '#e1dce6',
					muted: '#a39cb0',
					border: '#3c2d4a',
					success: '#00b0ff',
					warning: '#ffab40'
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial']
			}
		}
		},
		plugins: [
			require('@tailwindcss/forms'),
			require('@tailwindcss/typography')
		]
	}