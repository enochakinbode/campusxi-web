import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://campusxi.com',
  output: 'server',
  adapter: vercel()
});
