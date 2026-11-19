import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  logLevel: 'error',
})

try {
  const mod = await server.ssrLoadModule('/scripts/verify-vehicle-day-block3.ts')
  mod.main()
} finally {
  await server.close()
}
