import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

// 测试数据库路径
const testDbDir = path.join(__dirname, 'temp')
const testDbPath = path.join(testDbDir, 'test.db')

// 全局测试数据库实例
let testDb: Database.Database | null = null

// 创建测试数据库表
function createTestTables(db: Database.Database) {
  // 学员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_no TEXT UNIQUE,
      name TEXT NOT NULL,
      school TEXT,
      grade TEXT,
      account TEXT,
      enroll_date TEXT,
      student_type TEXT DEFAULT 'formal',
      status TEXT DEFAULT 'active',
      level TEXT DEFAULT 'medium',
      initial_score INTEGER,
      initial_vocab INTEGER,
      phonics_progress TEXT,
      phonics_completed INTEGER DEFAULT 0,
      ipa_completed INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 课时与收费表
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      total_hours REAL DEFAULT 0,
      used_hours REAL DEFAULT 0,
      warning_threshold REAL DEFAULT 3,
      last_payment_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 词库配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordbanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      total_levels INTEGER DEFAULT 60,
      nine_grid_interval INTEGER DEFAULT 10,
      category TEXT DEFAULT 'primary_exam',
      sort_order INTEGER DEFAULT 0,
      notes TEXT
    )
  `)

  // 学生词库进度表
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_wordbank_progress (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      wordbank_id TEXT NOT NULL,
      wordbank_label TEXT,
      current_level INTEGER DEFAULT 0,
      total_levels_override INTEGER,
      last_nine_grid_level INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      started_date TEXT,
      completed_date TEXT,
      source TEXT DEFAULT 'manual',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (wordbank_id) REFERENCES wordbanks(id) ON DELETE CASCADE,
      UNIQUE(student_id, wordbank_id)
    )
  `)

  // 课堂记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_date TEXT NOT NULL,
      duration_hours REAL DEFAULT 1,
      teacher_name TEXT,
      attendance TEXT DEFAULT 'present',
      tasks TEXT,
      task_completed TEXT DEFAULT 'completed',
      incomplete_reason TEXT,
      performance TEXT DEFAULT 'good',
      detail_feedback TEXT,
      highlights TEXT,
      issues TEXT,
      checkin_completed INTEGER DEFAULT 0,
      phase_id TEXT,
      plan_id TEXT,
      imported_from_excel INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 课程计划表
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      phase_id TEXT,
      plan_date TEXT,
      tasks TEXT,
      notes TEXT,
      ai_reason TEXT,
      generated_by_ai INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 考试成绩表
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_scores (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      exam_name TEXT,
      exam_type TEXT DEFAULT 'school_exam',
      score INTEGER,
      full_score INTEGER DEFAULT 100,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 学习阶段表
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_phases (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      phase_name TEXT,
      phase_type TEXT DEFAULT 'semester',
      start_date TEXT,
      end_date TEXT,
      goal TEXT,
      vocab_start INTEGER,
      vocab_end INTEGER,
      summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 体验生成交记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS trial_conversions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      trial_date TEXT,
      conversion_date TEXT,
      converted INTEGER DEFAULT 0,
      commission_note TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 助教档案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      university TEXT,
      major TEXT,
      enroll_date TEXT,
      status TEXT DEFAULT 'active',
      vocab_level TEXT,
      oral_level TEXT DEFAULT 'intermediate',
      teaching_style TEXT,
      suitable_grades TEXT,
      suitable_levels TEXT,
      training_stage TEXT DEFAULT 'probation',
      teacher_types TEXT DEFAULT '[]',
      total_teaching_hours REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 老师可用时段表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_availability (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      week_start TEXT,
      day_of_week TEXT,
      start_time TEXT,
      end_time TEXT,
      notes TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    )
  `)

  // 学生固定时段偏好表
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_schedule_preferences (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      day_of_week TEXT,
      preferred_start TEXT,
      preferred_end TEXT,
      semester TEXT,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 课表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_classes (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT,
      class_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_hours REAL DEFAULT 1,
      status TEXT DEFAULT 'scheduled',
      rescheduled_from_id TEXT,
      cancel_reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    )
  `)

  // 系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 插入默认词库配置
  const wordbanksCount = db.prepare('SELECT COUNT(*) as count FROM wordbanks').get() as { count: number }
  if (wordbanksCount.count === 0) {
    const insertWordbank = db.prepare(`
      INSERT INTO wordbanks (id, name, total_levels, nine_grid_interval, category, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const defaultWordbanks = [
      ['小学考纲', 60, 10, 'primary_exam', 1],
      ['小学进阶', 40, 10, 'primary_advanced', 2],
      ['初中考纲', 60, 20, 'junior_exam', 3],
      ['初中进阶', 40, 20, 'junior_advanced', 4],
      ['高中考纲', 60, 20, 'senior_exam', 5],
      ['高中进阶', 40, 20, 'senior_advanced', 6],
      ['大学四级', 40, 20, 'college_cet4', 7],
    ]
    
    defaultWordbanks.forEach(([name, total, interval, category, order]) => {
      insertWordbank.run(uuidv4(), name, total, interval, category, order)
    })
  }
}

// 初始化测试数据库
export function initTestDb(): Database.Database {
  // 确保目录存在
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true })
  }
  
  // 如果存在旧数据库，删除它
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
  
  // 创建新数据库
  testDb = new Database(testDbPath)
  testDb.pragma('journal_mode = WAL')
  
  // 创建表
  createTestTables(testDb)
  
  return testDb
}

// 获取测试数据库
export function getTestDb(): Database.Database {
  if (!testDb) {
    return initTestDb()
  }
  return testDb
}

// 关闭测试数据库
export function closeTestDb() {
  if (testDb) {
    testDb.close()
    testDb = null
  }
  
  // 清理测试文件
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
  
  const walPath = testDbPath + '-wal'
  const shmPath = testDbPath + '-shm'
  
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath)
  }
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath)
  }
  
  // 尝试删除临时目录
  try {
    if (fs.existsSync(testDbDir)) {
      const files = fs.readdirSync(testDbDir)
      if (files.length === 0) {
        fs.rmdirSync(testDbDir)
      }
    }
  } catch {
    // 忽略错误
  }
}

// 重置测试数据库（清空所有表数据）
export function resetTestDb() {
  const db = getTestDb()
  
  // 删除所有数据（保留词库配置）
  db.exec(`DELETE FROM scheduled_classes`)
  db.exec(`DELETE FROM student_schedule_preferences`)
  db.exec(`DELETE FROM teacher_availability`)
  db.exec(`DELETE FROM teachers`)
  db.exec(`DELETE FROM trial_conversions`)
  db.exec(`DELETE FROM learning_phases`)
  db.exec(`DELETE FROM exam_scores`)
  db.exec(`DELETE FROM lesson_plans`)
  db.exec(`DELETE FROM class_records`)
  db.exec(`DELETE FROM student_wordbank_progress`)
  db.exec(`DELETE FROM billing`)
  db.exec(`DELETE FROM students`)
  db.exec(`DELETE FROM settings`)
}

// 全局设置和清理
export function setupGlobalHooks() {
  beforeAll(() => {
    initTestDb()
  })
  
  afterAll(() => {
    closeTestDb()
  })
  
  beforeEach(() => {
    resetTestDb()
  })
}