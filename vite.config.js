// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',   // Permite acceso desde otras PCs
    port: 5173,        // Puerto fijo
    strictPort: true, // Evita que cambie el puerto
  },
})
