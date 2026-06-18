import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { createDefaultOpenAIProfile, DEFAULT_SETTINGS } from './apiProfiles'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'

const transparentPngDataUrl = 'data:image/png;base64,iVBORw0KGgo='
const apiImageB64 = 'aW1hZ2U='

function createOptions(settings = DEFAULT_SETTINGS) {
  return {
    settings,
    prompt: 'edit this image',
    params: DEFAULT_PARAMS,
    inputImageDataUrls: [transparentPngDataUrl],
  }
}

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('data:')) {
      return new Response(new Blob(['png'], { type: 'image/png' }))
    }

    const body = url.endsWith('/responses')
      ? { output: [{ type: 'image_generation_call', result: apiImageB64 }] }
      : { data: [{ b64_json: apiImageB64 }] }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('callOpenAICompatibleImageApi', () => {
  it('uses the Images edit endpoint when the configured agent profile is not a Responses profile', async () => {
    const fetchMock = stubFetch()
    vi.stubGlobal('fetch', fetchMock)
    const profile = createDefaultOpenAIProfile({ apiKey: 'key', apiMode: 'images' })

    await callOpenAICompatibleImageApi(createOptions(), profile)

    const apiUrl = fetchMock.mock.calls.map(([input]) => String(input)).find((url) => !url.startsWith('data:'))
    expect(apiUrl).toBe('https://api.openai.com/v1/images/edits')
  })

  it('reroutes OpenAI image edits to Responses only when the agent profile is a Responses profile', async () => {
    const fetchMock = stubFetch()
    vi.stubGlobal('fetch', fetchMock)
    const imageProfile = createDefaultOpenAIProfile({ id: 'images', apiKey: 'key', apiMode: 'images' })
    const responsesProfile = createDefaultOpenAIProfile({ id: 'responses', apiKey: 'key', apiMode: 'responses' })
    const settings = {
      ...DEFAULT_SETTINGS,
      profiles: [imageProfile, responsesProfile],
      activeProfileId: imageProfile.id,
      agentProfileId: responsesProfile.id,
    }

    await callOpenAICompatibleImageApi(createOptions(settings), imageProfile)

    const apiUrl = fetchMock.mock.calls.map(([input]) => String(input)).find((url) => !url.startsWith('data:'))
    expect(apiUrl).toBe('https://api.openai.com/v1/responses')
  })
})
