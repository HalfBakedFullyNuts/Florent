// "Emission" design tokens — see docs/UI_ASSESSMENT.md §6. Hex values mirror the CSS
// variables in src/app/globals.css; keep both in sync.
const emission = {
	void: '#0E0A14',
	dust: '#18121F',
	veil: '#221A2D',
	'veil-hi': '#2B2238',
	filament: '#342843',
	edge: '#76688E',
	ink: '#EEE8F4',
	'ink-2': '#B8AEC8',
	'ink-3': '#9489A6',
	halpha: '#F2508C',
	'halpha-soft': '#FF7AA8',
	'halpha-deep': '#2A1626',
	oiii: '#5FD4C4',
	danger: '#FF7A7A',
	caution: '#F5B544',
	res: {
		metal: '#C9CDD6',
		mineral: '#FF7A6B',
		food: '#7FD88F',
		energy: '#6DB3FF',
		rp: '#C59BFF',
		workers: '#FFAE5C',
		soldiers: '#FF8FA3',
		scientists: '#F4D35E',
		ground: '#D9A86C',
		orbital: '#8FA2FF',
	},
};

module.exports = {
	content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			colors: {
				...emission,
				// Legacy names kept as aliases so un-migrated classes inherit the new palette.
				'pink-nebula': {
					bg: emission.void,
					panel: emission.dust,
					'accent-primary': emission.halpha,
					'accent-secondary': emission['halpha-soft'],
					text: emission.ink,
					'text-secondary': emission['ink-3'],
					muted: emission['ink-2'],
					border: emission.filament,
					success: emission.res.food,
					warning: emission.caution
				}
			},
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
				display: ['var(--font-display)', 'var(--font-sans)', 'system-ui']
			},
			borderRadius: {
				ctl: '8px',
				panel: '12px'
			}
		}
		},
		plugins: [
			require('@tailwindcss/forms'),
			require('@tailwindcss/typography')
		]
	}
