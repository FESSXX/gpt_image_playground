import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { normalizeDevProxyConfig } from './src/lib/devProxy'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

function loadDevProxyConfig() {
  try {
    return normalizeDevProxyConfig(
      JSON.parse(readFileSync('./dev-proxy.config.json', 'utf-8')) as unknown,
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    throw error
  }
}

export default defineConfig(({ command }) => {
  const devProxyConfig = command === 'serve' ? loadDevProxyConfig() : null

  return {
    plugins: [
      react(),
      {
        name: 'image-url-proxy',
        configureServer(server) {
          server.middlewares.use('/image-proxy', async (req, res) => {
            try {
              const requestUrl = new URL(req.url || '/', 'http://localhost')
              const target = requestUrl.searchParams.get('url') || ''
              if (!/^https?:\/\//i.test(target)) {
                res.statusCode = 400
                res.end('Missing image url')
                return
              }

              const response = await fetch(target)
              res.statusCode = response.status
              const contentType = response.headers.get('content-type')
              const contentLength = response.headers.get('content-length')
              if (contentType) res.setHeader('Content-Type', contentType)
              if (contentLength) res.setHeader('Content-Length', contentLength)
              res.setHeader('Cache-Control', 'no-store')
              res.end(Buffer.from(await response.arrayBuffer()))
            } catch (error) {
              console.error(error)
              res.statusCode = 502
              res.end('Image proxy failed')
            }
          })
        },
      },
    ],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEV_PROXY_CONFIG__: JSON.stringify(devProxyConfig),
    },
    server: {
      host: true,
      proxy:
        devProxyConfig?.enabled
          ? {
              [devProxyConfig.prefix]: {
                target: devProxyConfig.target,
                changeOrigin: devProxyConfig.changeOrigin,
                secure: devProxyConfig.secure,
                rewrite: (path) =>
                  path.replace(
                    new RegExp(`^${devProxyConfig.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                    '',
                  ),
              },
            }
          : undefined,
    },
  }
})
