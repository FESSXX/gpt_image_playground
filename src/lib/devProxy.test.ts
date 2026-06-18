import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApiUrl } from './devProxy'
import { getImageProxyUrl } from './imageProxy'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildApiUrl', () => {
  it('uses the same-origin proxy prefix when API proxy is enabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'images/edits', null, true)).toBe(
      '/api-proxy/images/edits',
    )
  })

  it('leaves API versioning to the proxy target when proxying', () => {
    expect(buildApiUrl('http://api.example.com', 'images/generations', null, true)).toBe(
      '/api-proxy/images/generations',
    )
  })

  it('uses a configured proxy prefix when one is available', () => {
    expect(
      buildApiUrl(
        'http://api.example.com/v1',
        'responses',
        {
          enabled: true,
          prefix: '/openai-proxy',
          target: 'http://api.example.com/v1',
          changeOrigin: true,
          secure: false,
        },
        true,
      ),
    ).toBe('/openai-proxy/responses')
  })

  it('uses the configured API URL directly when API proxy is disabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'responses', null, false)).toBe(
      'http://api.example.com/v1/responses',
    )
  })

  it('routes remote image URLs through the image proxy when API proxy is available', () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')

    expect(getImageProxyUrl('https://cdn.example.com/image.png?sig=1')).toBe(
      '/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Fimage.png%3Fsig%3D1',
    )
  })
})
