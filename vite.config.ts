import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readFileSync, existsSync, copyFileSync, mkdirSync, readdirSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-ttf',
      configureServer(server) {
        server.middlewares.use('/ttf', (req, res, next) => {
          const filePath = resolve(__dirname, 'ttf' + req.url)
          if (existsSync(filePath)) {
            const data = readFileSync(filePath)
            const ext = filePath.split('.').pop()
            const types: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf' }
            res.setHeader('Content-Type', types[ext ?? ''] ?? 'application/octet-stream')
            res.end(data)
          } else {
            next()
          }
        })
      },
      closeBundle() {
        // PixeloidSans
        const sansSrc = resolve(__dirname, 'ttf/pixeloidsans')
        const sansDest = resolve(__dirname, 'dist/ttf/pixeloidsans')
        if (existsSync(sansSrc)) {
          mkdirSync(sansDest, { recursive: true })
          const files = readdirSync(sansSrc).filter((f) => f.endsWith('.ttf') || f.endsWith('.otf'))
          const sansFile = files.find((f) => /pixeloid\s*sans/i.test(f)) ?? files[0]
          if (sansFile) {
            copyFileSync(resolve(sansSrc, sansFile), resolve(sansDest, 'PixeloidSans.ttf'))
          }
        }
        // Casio FX 9860GII
        const casioSrc = resolve(__dirname, 'ttf/casio')
        const casioDest = resolve(__dirname, 'dist/ttf/casio')
        if (existsSync(casioSrc)) {
          mkdirSync(casioDest, { recursive: true })
          const files = readdirSync(casioSrc).filter((f) => f.endsWith('.ttf') || f.endsWith('.otf'))
          const casioFile = files.find((f) => /casio.*9860/i.test(f)) ?? files[0]
          if (casioFile) {
            copyFileSync(resolve(casioSrc, casioFile), resolve(casioDest, 'casio-fx-9860gii.ttf'))
          }
        }
      },
    },
  ],
  // Pro Electron file:// protokol – relativní cesty pro správné načtení assetů
  base: './',
})
