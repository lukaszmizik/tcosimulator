import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'tacho-viewer-ddd-parser': resolve(__dirname, './vendor/cardviewer/src/utils/dddParser.ts'),
      'tacho-viewer-ddd-mapper': resolve(__dirname, './vendor/cardviewer/src/utils/dddMapper.ts'),
      'tacho-viewer-graph': resolve(__dirname, './vendor/cardviewer/src/WorkWeekGraphView.tsx'),
      'tacho-viewer-language': resolve(__dirname, './vendor/cardviewer/src/translations.ts'),
      'tacho-viewer-slot-graph': resolve(__dirname, './vendor/cardviewer/src/utils/simulatorSlotGraph.ts'),
      'tacho-viewer-graph-days': resolve(__dirname, './vendor/cardviewer/src/workWeekTxtParser.ts'),
      'tacho-viewer-card-graph': resolve(__dirname, './vendor/cardviewer/src/utils/cardToGraph.ts'),
    },
  },
  base: './',
})
