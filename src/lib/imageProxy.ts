import { isApiProxyAvailable } from './devProxy'

const IMAGE_PROXY_PATH = '/image-proxy'

export function isImageProxyAvailable(): boolean {
  return (import.meta.env.DEV && import.meta.env.MODE !== 'test') || isApiProxyAvailable()
}

export function buildImageProxyUrl(url: string): string {
  return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}`
}

export function getImageProxyUrl(url: string): string {
  return isImageProxyAvailable() && /^https?:\/\//i.test(url) ? buildImageProxyUrl(url) : url
}
