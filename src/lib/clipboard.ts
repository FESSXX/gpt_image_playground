import { getImageProxyUrl, isImageProxyAvailable } from './imageProxy'

export async function copyTextToClipboard(text: string) {
  let asyncClipboardError: unknown = null

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (err) {
      asyncClipboardError = err
    }
  }

  if (copyTextWithExecCommand(text)) return

  throw asyncClipboardError ?? new Error('Clipboard API is not available')
}

export async function copyImageSourceToClipboard(src: string | Promise<string | undefined>) {
  const resolvedSrc = await Promise.resolve(src)
  if (!resolvedSrc) throw new Error('Image source is not available')

  if (isHttpUrl(resolvedSrc) && isImageProxyAvailable()) {
    try {
      const res = await fetch(getImageProxyUrl(resolvedSrc))
      const blob = await res.blob()
      await writeImageBlobToClipboard(blob)
      return
    } catch {
      // Fall through to HTML image copy when the deployment has no working image proxy.
    }
  }

  if (isHttpUrl(resolvedSrc)) {
    if (await writeRemoteImageHtmlToClipboard(resolvedSrc)) return
    if (copyImageElementWithExecCommand(resolvedSrc)) return
    throw new Error('当前浏览器无法在跨域限制下复制原始图片')
  }

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard image API is not available')
    }

    const res = await fetch(resolvedSrc)
    const blob = await res.blob()
    await writeImageBlobToClipboard(blob)
  } catch (err) {
    throw err
  }
}

export function getClipboardFailureMessage(fallback: string, err: unknown) {
  if (isEmbeddedPage() && isClipboardPermissionError(err)) {
    return '复制失败：内嵌页面未授予剪贴板权限'
  }

  if (err instanceof Error && err.message.startsWith('当前浏览器不支持')) {
    return `复制失败：${err.message}`
  }

  return fallback
}

function copyTextWithExecCommand(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'

  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

function copyImageElementWithExecCommand(src: string) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const wrapper = document.createElement('div')
  const img = document.createElement('img')
  wrapper.contentEditable = 'true'
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '0'
  img.src = src
  img.alt = ''
  wrapper.appendChild(img)
  document.body.appendChild(wrapper)

  const selection = window.getSelection()
  if (!selection) {
    document.body.removeChild(wrapper)
    return false
  }

  try {
    const range = document.createRange()
    range.selectNode(wrapper)
    selection.removeAllRanges()
    selection.addRange(range)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    selection.removeAllRanges()
    document.body.removeChild(wrapper)
  }
}

async function writeRemoteImageHtmlToClipboard(src: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([`<img src="${escapeHtmlAttribute(src)}">`], { type: 'text/html' }),
      }),
    ])
    return true
  } catch {
    return false
  }
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function writeImageBlobToClipboard(blob: Blob) {
  if (!blob.type.startsWith('image/')) throw new Error('Clipboard item is not an image')

  const clipboardItems: Record<string, Blob | Promise<Blob>> = {}
  const customType = `web ${blob.type}`

  if (isClipboardTypeSupported(customType)) {
    clipboardItems[customType] = blob
  }

  if (blob.type === 'image/png') {
    clipboardItems['image/png'] = blob
  } else if (isClipboardTypeSupported('image/png')) {
    clipboardItems['image/png'] = imageBlobToPngBlob(blob)
  }

  if (Object.keys(clipboardItems).length === 0) {
    throw new Error('当前浏览器不支持图像剪贴板写入')
  }

  await navigator.clipboard.write([
    new ClipboardItem(clipboardItems),
  ])
}

function isClipboardTypeSupported(type: string) {
  const supports = (ClipboardItem as typeof ClipboardItem & { supports?: (type: string) => boolean }).supports
  return supports ? supports(type) : type === 'image/png'
}

async function imageBlobToPngBlob(blob: Blob): Promise<Blob> {
  const image = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(image, 0, 0)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob)
        else reject(new Error('Image conversion failed'))
      }, 'image/png')
    })
  } finally {
    image.close()
  }
}

function isEmbeddedPage() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isClipboardPermissionError(err: unknown) {
  if (!(err instanceof Error)) return false

  return (
    err.name === 'NotAllowedError' ||
    /permission|permissions policy|not allowed|denied/i.test(err.message)
  )
}
