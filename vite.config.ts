import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from a repository subpath, while Vercel and a
// custom domain serve it from the root. Set BASE_PATH for the Pages build.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
