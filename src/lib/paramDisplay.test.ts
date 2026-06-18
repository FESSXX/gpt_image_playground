import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import { getParamDisplay } from './paramDisplay'

const task: TaskRecord = {
  id: 'task-1',
  prompt: '',
  params: { ...DEFAULT_PARAMS, quality: 'auto', output_format: 'jpeg', moderation: 'low' },
  inputImageIds: [],
  outputImages: [],
  status: 'done',
  error: null,
  createdAt: 0,
  finishedAt: 0,
  elapsed: 0,
}

describe('getParamDisplay', () => {
  it('localizes user-visible labels without changing stored values', () => {
    expect(getParamDisplay(task, 'quality', { quality: 'high' })).toMatchObject({
      requestedValue: '自动',
      displayValue: '高',
      isAutoResolved: true,
    })
    expect(getParamDisplay(task, 'output_format').displayValue).toBe('JPEG')
    expect(getParamDisplay(task, 'moderation').displayValue).toBe('低')
    expect(task.params).toMatchObject({ quality: 'auto', output_format: 'jpeg', moderation: 'low' })
  })
})
