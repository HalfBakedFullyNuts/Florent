import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Flat-config equivalent of the former .eslintrc.json ("next/core-web-vitals").
// `eslint .` scans the whole repo (unlike the removed `next lint`), so build
// output and non-source folders are ignored explicitly.
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // React Compiler advisory added in eslint-plugin-react-hooks v7. Existing
      // effects (localStorage hydration, prop sync, refresh-on-open) are valid
      // without the compiler, which this project does not use. Revisit when
      // refactoring those effects.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'public/**',
    // Dev-only node scripts/pages; never linted by the former `next lint`
    'scripts/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
