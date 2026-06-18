import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadImageIds } from './downloadImages'

afterEach(() => {
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
})
