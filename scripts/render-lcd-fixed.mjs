import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const mod = await server.ssrLoadModule('/scripts/render-lcd-fixed.tsx')
  mod.main()
} finally {
  await server.close()
}
