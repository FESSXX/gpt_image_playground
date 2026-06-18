import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureImageCached } from '../store'
import { downloadImageIds } from './downloadImages'

vi.mock('../store', () => ({
  ensureImageCached: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('downloadImageIds', () => {
  it('triggers direct anchor downloads for public image URLs without fetching them', async () => {
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: vi.fn(),
    }
    const appendChild = vi.fn()
    const removeChild = vi.fn()

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    })
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('fetch should not run')
    }))

    const result = await downloadImageIds(['https://cdn.example.com/result.png'], 'task-raw')

    expect(result).toEqual({ successCount: 1, failCount: 0 })
    expect(anchor.href).toBe('https://cdn.example.com/result.png')
    expect(anchor.download).toBe('task-raw')
    expect(anchor.rel).toBe('noopener noreferrer')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('downloads resolved public image URLs without fetching them', async () => {
    vi.mocked(ensureImageCached).mockResolvedValue('https://cdn.example.com/stored.png')
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: vi.fn(),
    }

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('fetch should not run')
    }))

    const result = await downloadImageIds(['stored-image-id'], 'task-1')

    expect(result).toEqual({ successCount: 1, failCount: 0 })
    expect(anchor.href).toBe('https://cdn.example.com/stored.png')
    expect(anchor.download).toBe('task-1')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('downloads public image URLs through the image proxy when API proxy is available', async () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')
    const imageUrl = 'https://cdn.example.com/result.png?sig=1'
    const anchor = {
      href: '',
      download: '',
      rel: '',
      target: '',
      click: vi.fn(),
    }
    const objectUrl = 'blob:download'
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const revokeObjectURL = vi.fn()

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    })
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void) => {
        fn()
        return 1
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['image-bytes'], { type: 'image/png' }), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await downloadImageIds([imageUrl], 'task-proxy')

    expect(result).toEqual({ successCount: 1, failCount: 0 })
    expect(fetchMock).toHaveBeenCalledWith(`/image-proxy?url=${encodeURIComponent(imageUrl)}`)
    expect(anchor.href).toBe(objectUrl)
    expect(anchor.download).toBe('task-proxy.png')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl)
  })
})
