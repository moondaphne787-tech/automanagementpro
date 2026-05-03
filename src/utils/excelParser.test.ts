import { describe, it, expect } from 'vitest'
import { identifyColumn } from './excelParser'

describe('identifyColumn', () => {
  describe('精确匹配', () => {
    it('精确匹配"署名" → student_name', () => {
      const result = identifyColumn('署名')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('student_name')
    })

    it('精确匹配"今日主要学习内容" → content', () => {
      const result = identifyColumn('今日主要学习内容')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('content')
    })

    it('精确匹配"今日词库主要学习内容" → wordbank_content', () => {
      const result = identifyColumn('今日词库主要学习内容')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('wordbank_content')
    })

    it('精确匹配"学情反馈" → detail_feedback', () => {
      const result = identifyColumn('学情反馈')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('detail_feedback')
    })

    it('精确匹配带空格的列名（自动 trim）', () => {
      const result = identifyColumn('  署名  ')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('student_name')
    })
  })

  describe('相似列名区分（L5 修复核心验证）', () => {
    it('"今日主要学习内容" 不应被误识别为 wordbank_content', () => {
      const result = identifyColumn('今日主要学习内容')
      expect(result.field).toBe('content')
      expect(result.field).not.toBe('wordbank_content')
    })

    it('"今日词库主要学习内容" 应被正确识别为 wordbank_content', () => {
      const result = identifyColumn('今日词库主要学习内容')
      expect(result.field).toBe('wordbank_content')
    })

    it('列名包含"今日主要学习内容"时应正确映射', () => {
      const result = identifyColumn('【今日主要学习内容】')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('content')
    })

    it('列名包含"今日词库主要学习内容"时应正确映射', () => {
      const result = identifyColumn('【今日词库主要学习内容】')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('wordbank_content')
    })
  })

  describe('忽略列表', () => {
    it('包含"请各位助教自查"的列应被忽略', () => {
      const result = identifyColumn('请各位助教自查填写')
      expect(result.status).toBe('ignored')
      expect(result.field).toBeNull()
    })

    it('包含"当日计划本"的列应被忽略', () => {
      const result = identifyColumn('当日计划本链接')
      expect(result.status).toBe('ignored')
      expect(result.field).toBeNull()
    })

    it('包含"课程体验"的列应被忽略', () => {
      const result = identifyColumn('课程体验评分')
      expect(result.status).toBe('ignored')
      expect(result.field).toBeNull()
    })

    it('包含"评分"的列应被忽略', () => {
      const result = identifyColumn('综合评分')
      expect(result.status).toBe('ignored')
      expect(result.field).toBeNull()
    })

    it('包含"昵称"的列应被忽略', () => {
      const result = identifyColumn('学生昵称')
      expect(result.status).toBe('ignored')
      expect(result.field).toBeNull()
    })
  })

  describe('模糊匹配', () => {
    it('列名包含映射键时能正确识别', () => {
      const result = identifyColumn('学员年级（填写）')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('grade')
    })

    it('映射键包含列名时能正确识别', () => {
      // "词库" 是完整的映射键
      const result = identifyColumn('词库')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('wordbank')
    })
  })

  describe('未识别列', () => {
    it('完全不匹配的列名返回 unrecognized', () => {
      const result = identifyColumn('这是一个未知列')
      expect(result.status).toBe('unrecognized')
      expect(result.field).toBeNull()
    })

    it('空字符串返回 unrecognized', () => {
      const result = identifyColumn('')
      expect(result.status).toBe('unrecognized')
      expect(result.field).toBeNull()
    })

    it('只有空格的字符串返回 unrecognized', () => {
      const result = identifyColumn('   ')
      expect(result.status).toBe('unrecognized')
      expect(result.field).toBeNull()
    })
  })

  describe('边界情况', () => {
    it('精确匹配优先于忽略列表（当列名完全等于映射键时）', () => {
      // "词库" 既是映射键，如果忽略列表中有包含关系，精确匹配应优先
      const result = identifyColumn('词库')
      expect(result.status).toBe('recognized')
      expect(result.field).toBe('wordbank')
    })

    it('长键优先匹配：确保"今日词库主要学习内容"比"今日主要学习内容"优先', () => {
      // 这是一个关键的边界测试
      // 如果有一个列名同时包含两个键，应该优先匹配更长的键
      const result1 = identifyColumn('今日词库主要学习内容')
      expect(result1.field).toBe('wordbank_content')
      
      const result2 = identifyColumn('今日主要学习内容')
      expect(result2.field).toBe('content')
    })
  })

  describe('完整列名映射验证', () => {
    it('所有预定义列名都能正确识别', () => {
      const testCases = [
        { colName: '署名', expectedField: 'student_name' },
        { colName: '学生到课情况', expectedField: 'attendance' },
        { colName: '学员年级', expectedField: 'grade' },
        { colName: '学习时长', expectedField: 'duration_hours' },
        { colName: '助教老师', expectedField: 'teacher_name' },
        { colName: '今日主要学习内容', expectedField: 'content' },
        { colName: '今日词库主要学习内容', expectedField: 'wordbank_content' },
        { colName: '词库', expectedField: 'wordbank' },
        { colName: '已学到词库的第几关', expectedField: 'level' },
        { colName: '是否完成学习任务', expectedField: 'task_completed' },
        { colName: '未完成学习任务原因', expectedField: 'incomplete_reason' },
        { colName: '学情反馈', expectedField: 'detail_feedback' },
        { colName: '备注', expectedField: 'notes' },
      ]

      for (const { colName, expectedField } of testCases) {
        const result = identifyColumn(colName)
        expect(result.status).toBe('recognized')
        expect(result.field).toBe(expectedField)
      }
    })
  })
})