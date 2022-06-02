import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/use-transition-effect.ts',
  output: [
    {
      file: 'dist/use-transition-effect.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/use-transition-effect.mjs',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
  external: ['react', 'scheduler'],
};
