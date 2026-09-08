import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves from a repository subpath; Vercel and a custom domain
// serve from the root. BASE_PATH carries the bare repository name rather than a
// path, because Git Bash on Windows rewrites values that look like POSIX paths.
const repo = process.env.BASE_PATH?.replace(/^\/|\/$/g, '')

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  plugins: [react()],
})
