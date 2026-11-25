import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  logLevel: 'error',
})

try {
  await server.ssrLoadModule('/scripts/verify-lesson-runtime.ts')
} finally {
  await server.close()
}
