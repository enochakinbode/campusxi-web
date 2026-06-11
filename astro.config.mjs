import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import icon from "astro-icon"; // Import the integration engine


export default defineConfig({
  site: 'https://campusxi.com',
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    icon(), // Register the icon engine here
  ],
});
