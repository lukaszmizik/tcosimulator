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
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0]
          if (url !== '/wasm_exec.js' && url !== '/dddparser.wasm') {
            next()
            return
          }
          const filePath = resolve(__dirname, '../tacho-viewer/public', url.slice(1))
          if (!existsSync(filePath)) {
            next()
            return
          }
          res.setHeader('Content-Type', url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
          res.end(readFileSync(filePath))
        })
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
        const parserPublic = resolve(__dirname, '../tacho-viewer/public')
        for (const fileName of ['wasm_exec.js', 'dddparser.wasm']) {
          const source = resolve(parserPublic, fileName)
          if (existsSync(source)) copyFileSync(source, resolve(__dirname, 'dist', fileName))
        }
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
  resolve: {
    alias: {
      'tacho-viewer-ddd-parser': resolve(__dirname, '../tacho-viewer/src/utils/dddParser.ts'),
      'tacho-viewer-ddd-mapper': resolve(__dirname, '../tacho-viewer/src/utils/dddMapper.ts'),
      'tacho-viewer-graph': resolve(__dirname, '../tacho-viewer/src/WorkWeekGraphView.tsx'),
      'tacho-viewer-language': resolve(__dirname, '../tacho-viewer/src/translations.ts'),
      'tacho-viewer-slot-graph': resolve(__dirname, '../tacho-viewer/src/utils/simulatorSlotGraph.ts'),
      'tacho-viewer-graph-days': resolve(__dirname, '../tacho-viewer/src/workWeekTxtParser.ts'),
    },
  },
  base: './',
})
