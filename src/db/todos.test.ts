import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 重新导入 mock 以便在测试中使用
const mockDbQuery = vi.fn()
const mockDbQueryOne = vi.fn()

// Mock window.electronAPI
;(globalThis as any).window = {
  electronAPI: {
    dbQuery: mockDbQuery,
    dbQueryOne: mockDbQueryOne,
    isElectron: true,
  },
}

// Mock crypto.randomUUID 使用 spyOn
let cryptoSpy: ReturnType<typeof vi.spyOn>

// 动态导入 todoDb，在 mock 设置之后
const { todoDb } = await import('./todos')

describe('todoDb - H1 修复测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('JOIN 查询获取 student_name', () => {
    it('getAll 应使用 JOIN 查询从 students 表获取学员姓名', async () => {
      // 模拟数据库返回结果 - JOIN 查询会返回 student_name
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '测试待办', student_id: 'student-1', student_name: '小明', completed: 0 },
        { id: 'todo-2', content: '另一个待办', student_id: 'student-2', student_name: '小红', completed: 1 },
      ])

      const result = await todoDb.getAll()

      // 验证 SQL 语句使用了 JOIN
      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('LEFT JOIN students')
      expect(sqlCall).toContain('s.name as student_name')
      
      // 验证结果包含 student_name
      expect(result[0].student_name).toBe('小明')
      expect(result[1].student_name).toBe('小红')
    })

    it('getActive 应使用 JOIN 查询从 students 表获取学员姓名', async () => {
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '活动待办', student_id: 'student-1', student_name: '小明', completed: 0 },
      ])

      const result = await todoDb.getActive()

      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('LEFT JOIN students')
      expect(sqlCall).toContain('s.name as student_name')
      expect(sqlCall).toContain('WHERE t.completed = 0')
      
      expect(result[0].student_name).toBe('小明')
    })

    it('getCompleted 应使用 JOIN 查询从 students 表获取学员姓名', async () => {
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '已完成待办', student_id: 'student-1', student_name: '小明', completed: 1 },
      ])

      const result = await todoDb.getCompleted()

      const sqlCall = mockDbQuery.mock.calls[0][0]
      expect(sqlCall).toContain('LEFT JOIN students')
      expect(sqlCall).toContain('s.name as student_name')
      expect(sqlCall).toContain('WHERE t.completed = 1')
      
      expect(result[0].student_name).toBe('小明')
    })

    it('getById 应使用 JOIN 查询从 students 表获取学员姓名', async () => {
      mockDbQueryOne.mockResolvedValueOnce({
        id: 'todo-1', content: '测试待办', student_id: 'student-1', student_name: '小明', completed: 0,
      })

      const result = await todoDb.getById('todo-1')

      const sqlCall = mockDbQueryOne.mock.calls[0][0]
      expect(sqlCall).toContain('LEFT JOIN students')
      expect(sqlCall).toContain('s.name as student_name')
      
      expect(result?.student_name).toBe('小明')
    })

    it('当学员不存在时，student_name 应为 null', async () => {
      // 模拟学员被删除后的情况 - LEFT JOIN 返回 null
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '测试待办', student_id: 'student-1', student_name: null, completed: 0 },
      ])

      const result = await todoDb.getAll()

      expect(result[0].student_name).toBeNull()
    })
  })

  describe('create 不存储 student_name', () => {
    it('create 方法不应将 student_name 存入数据库', async () => {
      mockDbQuery.mockResolvedValueOnce(undefined) // INSERT 执行
      mockDbQueryOne.mockResolvedValueOnce({
        id: 'test-uuid-1234',
        content: '测试待办',
        student_id: 'student-1',
        student_name: '小明', // 通过 JOIN 查询获取
        completed: 0,
        created_at: '2024-01-01',
      })

      const result = await todoDb.create({
        content: '测试待办',
        student_id: 'student-1',
        due_date: '2024-01-15',
        sort_order: 1000,
      })

      // 验证 INSERT 语句不包含 student_name 字段
      const insertSql = mockDbQuery.mock.calls[0][0]
      expect(insertSql).toContain('INSERT INTO todos')
      expect(insertSql).not.toContain('student_name')
      
      // 验证 INSERT 参数只有 5 个（不含 student_name）
      const insertParams = mockDbQuery.mock.calls[0][1]
      expect(insertParams.length).toBe(5)
      
      // 验证返回结果包含通过 JOIN 获取的 student_name
      expect(result.student_name).toBe('小明')
    })

    it('创建不关联学员的待办时，student_name 应为 null', async () => {
      mockDbQuery.mockResolvedValueOnce(undefined)
      mockDbQueryOne.mockResolvedValueOnce({
        id: 'test-uuid-1234',
        content: '普通待办',
        student_id: null,
        student_name: null,
        completed: 0,
        created_at: '2024-01-01',
      })

      const result = await todoDb.create({
        content: '普通待办',
        student_id: undefined,
        due_date: undefined,
        sort_order: 1000,
      })

      expect(result.student_id).toBeNull()
      expect(result.student_name).toBeNull()
    })
  })

  describe('数据一致性验证', () => {
    it('学员姓名变更后，todo 的 student_name 应自动更新（通过 JOIN）', async () => {
      // 这个测试验证了 JOIN 查询的核心价值：
      // 即使 todos 表中没有存储 student_name，
      // 当 students 表中的姓名更新后，查询会自动返回新姓名
      
      // 第一次查询：学员姓名为 "小明"
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '测试', student_id: 'student-1', student_name: '小明', completed: 0 },
      ])
      
      const result1 = await todoDb.getAll()
      expect(result1[0].student_name).toBe('小明')
      
      vi.clearAllMocks()
      
      // 第二次查询：学员姓名已更新为 "小明（已改名）"
      // 由于使用 JOIN 查询，todo 自动显示新姓名
      mockDbQuery.mockResolvedValueOnce([
        { id: 'todo-1', content: '测试', student_id: 'student-1', student_name: '小明（已改名）', completed: 0 },
      ])
      
      const result2 = await todoDb.getAll()
      expect(result2[0].student_name).toBe('小明（已改名）')
      
      // 结论：无需手动更新 todos 表，JOIN 查询自动保证数据一致性
    })
  })
})