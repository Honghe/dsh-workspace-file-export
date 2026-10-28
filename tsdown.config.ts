import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { name: string }

/**
 * Client half: one CJS bundle wrapped in the Web page's
 * `window.__ModuleLoader__.load({ id, factory })` closure, the same artifact
 * shape dsh's own client packages emit. `react` stays external because the
 * page's module table supplies it through the factory's `require`.
 *
 * The Host half (`index.js`) is plain dependency-free ESM and needs no build.
 */
export default defineConfig({
  entry: ['src/client/index.tsx'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  // A browser artifact handled by the page loader, not a Node library:
  // no type declarations, no source map, no minification.
  dts: false,
  sourcemap: false,
  minify: false,
  // Emit client.js beside package.json; never clean the package root.
  outDir: '.',
  clean: false,
  deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  outputOptions: {
    entryFileNames: 'client.js',
    chunkFileNames: 'client.[name].js',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
  },
})
