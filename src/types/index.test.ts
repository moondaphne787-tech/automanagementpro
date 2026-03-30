import { describe, it, expect } from 'vitest'
import { TEACHER_UPGRADE_THRESHOLDS, TRAINING_STAGE_LABELS } from './index'

describe('TEACHER_UPGRADE_THRESHOLDS', () => {
  it('should be defined and exported', () => {
    expect(TEACHER_UPGRADE_THRESHOLDS).toBeDefined()
  })

  it('should have probation threshold with correct values', () => {
    expect(TEACHER_UPGRADE_THRESHOLDS.probation).toEqual({
      hours: 2,
      nextStage: 'intern',
      nextLabel: '实习期'
    })
  })

  it('should have intern threshold with correct values', () => {
    expect(TEACHER_UPGRADE_THRESHOLDS.intern).toEqual({
      hours: 10,
      nextStage: 'formal',
      nextLabel: '正式助教'
    })
  })

  it('probation nextStage should match TRAINING_STAGE_LABELS', () => {
    const { nextStage } = TEACHER_UPGRADE_THRESHOLDS.probation
    expect(TRAINING_STAGE_LABELS[nextStage]).toBe('实习期')
  })

  it('intern nextStage should match TRAINING_STAGE_LABELS', () => {
    const { nextStage } = TEACHER_UPGRADE_THRESHOLDS.intern
    expect(TRAINING_STAGE_LABELS[nextStage]).toBe('正式助教')
  })

  it('should only have probation and intern keys (not formal)', () => {
    const keys = Object.keys(TEACHER_UPGRADE_THRESHOLDS)
    expect(keys).toEqual(['probation', 'intern'])
    expect(keys).not.toContain('formal')
  })
})