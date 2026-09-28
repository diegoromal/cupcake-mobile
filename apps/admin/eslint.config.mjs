import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
const config = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  // Estes efeitos iniciam fetch e limpam o estado de erro antes da nova tentativa.
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
];
export default config;
