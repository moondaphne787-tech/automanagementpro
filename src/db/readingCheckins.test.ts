import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 函数
const mockDbQuery = vi.fn()
const mockDbQueryOne = vi.fn()

// Mock crypto.randomUUID
const mockUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
vi.stubGlobal('crypto', {
  randomUUID: () => mockUuid,
})

// Mock window.electronAPI
;(globalThis as any).window = {
  electronAPI: {
    dbQuery: mockDbQuery,
    dbQueryOne: mockDbQueryOne,
    isElectron: true,
  },
}

// 动态导入 readingCheckinDb，在 mock 设置之后
const { readingCheckinDb } = await import('./readingCheckins')

describe('readingCheckinDb - P2-4: 主键类型统一为 UUID TEXT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkYesterday - INSERT 时使用 UUID 主键', () => {
    it('INSERT 语句应包含 id 字段并使用 UUID 值', async () => {
      // 模拟数据库返回
      mockDbQuery.mockResolvedValueOnce({ changes: 1 })

      const studentId = 'student-123'
      const result = await readingCheckinDb.checkYesterday(studentId)

      // 验证成功返回
      expect(result.success).toBe(true)
      expect(result.inserted).toBe(true)

      // 验证 SQL 语句包含 id 字段
      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('INSERT OR IGNORE INTO reading_checkins (id, student_id, checked_date)')
      expect(sqlCall).toContain('VALUES (?, ?, ?)')

      // 验证参数：第一个参数应为 UUID
      const params = mockDbQuery.mock.calls[0][1]
      expect(params[0]).toBe(mockUuid)  // id: UUID
      expect(params[1]).toBe(studentId)  // student_id
      // params[2] 是昨日日期，格式为 YYYY-MM-DD
      expect(params[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/)  // 日期格式验证
    })

    it('UUID 应使用 crypto.randomUUID() 生成标准格式', async () => {
      mockDbQuery.mockResolvedValueOnce({ changes: 1 })

      await readingCheckinDb.checkYesterday('student-123')

      const params = mockDbQuery.mock.calls[0][1]
      const uuid = params[0]

      // 验证 UUID 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // 其中 y 应为 8、9、a 或 b
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuid).toMatch(uuidPattern)
    })

    it('重复打卡应被 IGNORE 忽略，返回 inserted=false', async () => {
      // 模拟 UNIQUE 约束冲突导致的 IGNORE
      mockDbQuery.mockResolvedValueOnce({ changes: 0 })

      const result = await readingCheckinDb.checkYesterday('student-123')

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(false)
    })
  })

  describe('uncheckYesterday - 删除打卡记录', () => {
    it('DELETE 语句应正确使用 student_id 和 checked_date', async () => {
      mockDbQuery.mockResolvedValueOnce({ changes: 1 })

      const studentId = 'student-123'
      const result = await readingCheckinDb.uncheckYesterday(studentId)

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)

      // 验证 SQL 语句
      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('DELETE FROM reading_checkins')
      expect(sqlCall).toContain('WHERE student_id = ? AND checked_date = ?')

      // 验证参数
      const params = mockDbQuery.mock.calls[0][1]
      expect(params[0]).toBe(studentId)
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)  // 昨日日期
    })

    it('删除不存在记录应返回 deleted=false', async () => {
      mockDbQuery.mockResolvedValueOnce({ changes: 0 })

      const result = await readingCheckinDb.uncheckYesterday('student-123')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(false)
    })
  })

  describe('getMonthSummary - 查询统计', () => {
    it('查询应正确关联 reading_checkins 表', async () => {
      // 模拟学员列表返回
      mockDbQuery.mockResolvedValueOnce([
        { id: 'student-1', name: '小明', monthly_count: 5, checked_yesterday: 1 },
        { id: 'student-2', name: '小红', monthly_count: 3, checked_yesterday: 0 },
      ])
      mockDbQueryOne.mockResolvedValueOnce({ count: 2 })
      mockDbQueryOne.mockResolvedValueOnce({ count: 1 })

      const result = await readingCheckinDb.getMonthSummary(2026, 4)

      expect(result.totalStudents).toBe(2)
      expect(result.yesterdayCheckedCount).toBe(1)
      expect(result.students).toHaveLength(2)
      expect(result.students[0].checkedYesterday).toBe(true)
      expect(result.students[1].checkedYesterday).toBe(false)

      // 验证主查询 SQL 使用了正确的表别名
      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('FROM students s')
      expect(sqlCall).toContain('LEFT JOIN reading_checkins rc')
      expect(sqlCall).toContain('ON rc.student_id = s.id')
    })
  })

  describe('batchCheckYesterday - 批量昨日打卡', () => {
    it('应为多个学生批量插入打卡记录', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 1 })

      const studentIds = ['student-1', 'student-2', 'student-3']
      const result = await readingCheckinDb.batchCheckYesterday(studentIds)

      expect(result.success).toBe(true)
      expect(result.insertedCount).toBe(3)
      expect(result.yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // 验证调用了 3 次 INSERT
      expect(mockDbQuery).toHaveBeenCalledTimes(3)

      // 每次调用都应使用 UUID 主键
      for (let i = 0; i < 3; i++) {
        const sql = mockDbQuery.mock.calls[i][0]
        expect(sql).toContain('INSERT OR IGNORE INTO reading_checkins (id, student_id, checked_date)')
        const params = mockDbQuery.mock.calls[i][1]
        expect(params[0]).toBe(mockUuid) // UUID
        expect(params[1]).toBe(studentIds[i]) // student_id
      }
    })

    it('重复打卡的学生应被 IGNORE，insertedCount 只计算实际插入数', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ changes: 1 })  // student-1: 新插入
        .mockResolvedValueOnce({ changes: 0 })  // student-2: 已存在，被忽略
        .mockResolvedValueOnce({ changes: 1 })  // student-3: 新插入

      const result = await readingCheckinDb.batchCheckYesterday(['student-1', 'student-2', 'student-3'])

      expect(result.success).toBe(true)
      expect(result.insertedCount).toBe(2)
    })

    it('空数组应返回 insertedCount=0', async () => {
      const result = await readingCheckinDb.batchCheckYesterday([])

      expect(result.success).toBe(true)
      expect(result.insertedCount).toBe(0)
      expect(mockDbQuery).not.toHaveBeenCalled()
    })
  })

  describe('主键类型一致性验证', () => {
    it('reading_checkins 表主键应为 TEXT 类型（UUID），与其他表一致', async () => {
      // 此测试验证设计目标：
      // v16 迁移后，reading_checkins.id 的类型应为 TEXT PRIMARY KEY
      // 与 students.id、billing.id、class_records.id 等保持一致
      
      // 在实际数据库中验证的方式：
      // PRAGMA table_info(reading_checkins) 应返回 id 列类型为 TEXT
      
      // 这里通过验证 INSERT 使用 UUID 来间接验证
      mockDbQuery.mockResolvedValueOnce({ changes: 1 })
      
      await readingCheckinDb.checkYesterday('student-test')
      
      const params = mockDbQuery.mock.calls[0][1]
      
      // 核心验证：id 参数是字符串 UUID，不是整数
      expect(typeof params[0]).toBe('string')
      expect(typeof params[0]).not.toBe('number')
      
      // UUID 长度应为 36 字符（包含 4 个连字符）
      expect(params[0].length).toBe(36)
    })
  })
})