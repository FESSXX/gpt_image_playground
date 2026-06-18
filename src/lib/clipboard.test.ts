import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyImageSourceToClipboard } from './clipboard'

describe('copyImageSourceToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('copies proxied remote images as image blobs when API proxy is available', async () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')
    const write = vi.fn()
    class ClipboardItemStub {
      items: Record<string, Blob | Promise<Blob>>
      constructor(items: Record<string, Blob | Promise<Blob>>) {
        this.items = items
      }
    }

    vi.stubGlobal('navigator', {
      clipboard: {
        write,
      },
    })
    vi.stubGlobal('ClipboardItem', ClipboardItemStub)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image-bytes'], { type: 'image/png' }), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })))

    await expect(copyImageSourceToClipboard('https://cdn.example.com/image.png?sig=1')).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith('/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Fimage.png%3Fsig%3D1')
    const clipboardItem = write.mock.calls[0][0][0] as ClipboardItemStub
    expect(clipboardItem.items).toHaveProperty('image/png')
  })

  it('falls back to native image copying for remote images when fetch fails', async () => {
    const write = vi.fn()
    class ClipboardItemStub {
      items: Record<string, Blob>
      constructor(items: Record<string, Blob>) {
        this.items = items
      }
    }

    vi.stubGlobal('navigator', {
      clipboard: {
        write,
      },
    })
    vi.stubGlobal('ClipboardItem', ClipboardItemStub)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await expect(copyImageSourceToClipboard('https://cdn.example.com/image.png')).resolves.toBeUndefined()
    const clipboardItem = write.mock.calls[0][0][0] as ClipboardItemStub
    await expect(clipboardItem.items['text/html'].text()).resolves.toBe('<img src="https://cdn.example.com/image.png">')
  })
})
