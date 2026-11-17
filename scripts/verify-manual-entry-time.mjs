import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const mod = await server.ssrLoadModule('/scripts/verify-manual-entry-time.ts')
  mod.main()
} finally {
  await server.close()
}
