import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekitOptions } from './sveltekit.options.js';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(sveltekitOptions),
  ],
});
