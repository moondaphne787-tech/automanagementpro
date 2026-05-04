/**
 * 数据库迁移执行模块
 * 
 * 功能：
 * - 版本管理：记录每个迁移版本的执行状态
 * - 自动迁移：应用启动时自动执行未应用的迁移
 * - 数据安全：每个迁移在事务中执行，失败时回滚
 * - 向后兼容：新版本可以读取旧版本数据
 */

import Database from 'better-sqlite3'
import { Migration, MigrationRecord } from './types'

/**
 * 所有迁移定义列表
 * 每次数据库结构变更时，在此处添加新的迁移
 * 
 * 注意：
 * 1. 版本号必须连续递增
 * 2. 已发布的迁移不可修改（只能添加新迁移修复）
 * 3. 每个迁移应该是幂等的（可重复执行不产生副作用）
 */
export const migrations: Migration[] = [
  // ===== 版本 1: 初始化迁移系统 =====
  {
    version: 1,
    description: '初始化迁移系统，创建 schema_migrations 表',
    up: (db: Database.Database) => {
      // schema_migrations 表已经在 runMigrations 中创建
      // 此迁移仅作为版本起点，确保新安装的用户也有迁移记录
      console.log('Migration v1: Migration system initialized')
    }
  },
  
  // ===== 版本 2: 确保 settings 表有 updated_at 字段 =====
  {
    version: 2,
    description: '确保 settings 表有 updated_at 字段',
    up: (db: Database.Database) => {
      const info = db.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>
      const columns = info.map(col => col.name)
      
      if (!columns.includes('updated_at')) {
        db.exec(`ALTER TABLE settings ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v2: Added updated_at column to settings table')
      }
    }
  },
  
  // ===== 版本 3: 添加数据库元信息表 =====
  {
    version: 3,
    description: '添加数据库元信息表 db_metadata',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS db_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // 插入数据库创建时间和版本信息
      const metaExists = db.prepare("SELECT value FROM db_metadata WHERE key = 'db_created_at'").get() as { value: string } | undefined
      if (!metaExists) {
        db.prepare("INSERT INTO db_metadata (key, value) VALUES ('db_created_at', datetime('now'))").run()
      }
      
      console.log('Migration v3: Added db_metadata table')
    }
  },
  
  // ===== 版本 4: 为 lesson_plans 表添加索引优化查询性能 =====
  {
    version: 4,
    description: '为 lesson_plans 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      // 检查索引是否已存在
      const indexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_lesson_plans_student_date'
      `).get()
      
      if (!indexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_student_date 
          ON lesson_plans(student_id, plan_date DESC)
        `)
        console.log('Migration v4: Added index on lesson_plans(student_id, plan_date)')
      }
    }
  },
  
  // ===== 版本 5: 为 class_records 表添加索引优化查询性能 =====
  {
    version: 5,
    description: '为 class_records 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      const indexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_class_records_student_date'
      `).get()
      
      if (!indexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_class_records_student_date 
          ON class_records(student_id, class_date DESC)
        `)
        console.log('Migration v5: Added index on class_records(student_id, class_date)')
      }
    }
  },
  
  // ===== 版本 6: 为 scheduled_classes 表添加索引 =====
  {
    version: 6,
    description: '为 scheduled_classes 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      const indexes = [
        'idx_scheduled_classes_date',
        'idx_scheduled_classes_teacher',
        'idx_scheduled_classes_student'
      ]
      
      indexes.forEach(indexName => {
        const exists = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type = 'index' AND name = ?
        `).get(indexName)
        
        if (!exists) {
          let column = indexName.replace('idx_scheduled_classes_', '')
          if (column === 'date') column = 'class_date'
          if (column === 'teacher') column = 'teacher_id'
          if (column === 'student') column = 'student_id'
          db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON scheduled_classes(${column})`)
        }
      })
      
      console.log('Migration v6: Added indexes on scheduled_classes table')
    }
  },
  
  // ===== 版本 7: 添加备份记录表 =====
  {
    version: 7,
    description: '添加备份记录表 backup_history',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS backup_history (
          id TEXT PRIMARY KEY,
          backup_path TEXT NOT NULL,
          backup_type TEXT DEFAULT 'manual',
          file_size INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('Migration v7: Added backup_history table')
    }
  },
  
  // ===== 版本 8: 更新课时预警默认值为10 =====
  {
    version: 8,
    description: '更新所有学员的课时预警默认值为10',
    up: (db: Database.Database) => {
      // 将所有现有学员的课时预警更新为10
      db.exec(`UPDATE billing SET warning_threshold = 10 WHERE warning_threshold = 3`)
      console.log('Migration v8: Updated warning_threshold to 10 for all students')
    }
  },
  
  // ===== 版本 9: 整合所有 ALTER TABLE ADD COLUMN 到迁移系统 =====
  // 此迁移将 createTables() 中的 ALTER TABLE 逻辑统一迁移到迁移系统
  // 解决 createTables() 与迁移系统重复且可能冲突的问题
  {
    version: 9,
    description: '整合所有表结构变更到迁移系统，移除 createTables 中的 ALTER TABLE 逻辑',
    up: (db: Database.Database) => {
      // ===== billing 表：添加缺失的列 =====
      const billingInfo = db.prepare('PRAGMA table_info(billing)').all() as Array<{ name: string }>
      const billingColumns = billingInfo.map(col => col.name)
      
      if (!billingColumns.includes('last_payment_date')) {
        db.exec(`ALTER TABLE billing ADD COLUMN last_payment_date TEXT`)
        console.log('Migration v9: Added last_payment_date column to billing table')
      }
      if (!billingColumns.includes('created_at')) {
        db.exec(`ALTER TABLE billing ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v9: Added created_at column to billing table')
      }
      if (!billingColumns.includes('updated_at')) {
        db.exec(`ALTER TABLE billing ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v9: Added updated_at column to billing table')
      }
      // 为现有记录设置默认值
      db.exec(`UPDATE billing SET created_at = datetime('now') WHERE created_at IS NULL`)
      db.exec(`UPDATE billing SET updated_at = datetime('now') WHERE updated_at IS NULL`)
      
      // ===== student_wordbank_progress 表：添加缺失的列 =====
      const progressInfo = db.prepare('PRAGMA table_info(student_wordbank_progress)').all() as Array<{ name: string }>
      const progressColumns = progressInfo.map(col => col.name)
      
      if (!progressColumns.includes('created_at')) {
        db.exec(`ALTER TABLE student_wordbank_progress ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v9: Added created_at column to student_wordbank_progress table')
      }
      if (!progressColumns.includes('updated_at')) {
        db.exec(`ALTER TABLE student_wordbank_progress ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v9: Added updated_at column to student_wordbank_progress table')
      }
      
      // ===== class_records 表：添加缺失的列 =====
      const classRecordsInfo = db.prepare('PRAGMA table_info(class_records)').all() as Array<{ name: string }>
      const classRecordsColumns = classRecordsInfo.map(col => col.name)
      
      if (!classRecordsColumns.includes('plan_id')) {
        db.exec(`ALTER TABLE class_records ADD COLUMN plan_id TEXT`)
        console.log('Migration v9: Added plan_id column to class_records table')
      }
      
      // ===== teachers 表：添加缺失的列 =====
      const teachersInfo = db.prepare('PRAGMA table_info(teachers)').all() as Array<{ name: string }>
      const teachersColumns = teachersInfo.map(col => col.name)
      
      if (!teachersColumns.includes('training_stage')) {
        db.exec(`ALTER TABLE teachers ADD COLUMN training_stage TEXT DEFAULT 'probation'`)
        console.log('Migration v9: Added training_stage column to teachers table')
      }
      if (!teachersColumns.includes('teacher_types')) {
        db.exec(`ALTER TABLE teachers ADD COLUMN teacher_types TEXT DEFAULT '[]'`)
        console.log('Migration v9: Added teacher_types column to teachers table')
      }
      if (!teachersColumns.includes('total_teaching_hours')) {
        db.exec(`ALTER TABLE teachers ADD COLUMN total_teaching_hours REAL DEFAULT 0`)
        console.log('Migration v9: Added total_teaching_hours column to teachers table')
      }
      // 为现有记录设置默认值
      db.exec(`UPDATE teachers SET training_stage = 'probation' WHERE training_stage IS NULL`)
      db.exec(`UPDATE teachers SET teacher_types = '[]' WHERE teacher_types IS NULL`)
      db.exec(`UPDATE teachers SET total_teaching_hours = 0 WHERE total_teaching_hours IS NULL`)
      
      console.log('Migration v9: All table structure changes consolidated into migration system')
    }
  },
  
  // ===== 版本 10: 补充关键业务查询索引 =====
  // 根据代码审查报告，添加缺失的高频查询索引
  {
    version: 10,
    description: '补充关键业务查询索引：学员姓名、课堂日期、排课状态等',
    up: (db: Database.Database) => {
      // 1. 学员姓名索引（Home页搜索功能）
      const studentsNameIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_students_name'
      `).get()
      
      if (!studentsNameIndexExists) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)`)
        console.log('Migration v10: Added index on students(name)')
      }
      
      // 2. 课堂记录按日期索引（Dashboard加载时按日期范围查询）
      // 注意：v5已有idx_class_records_student_date，这里补充纯日期索引
      const classRecordsDateIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_class_records_date'
      `).get()
      
      if (!classRecordsDateIndexExists) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_class_records_date ON class_records(class_date)`)
        console.log('Migration v10: Added index on class_records(class_date)')
      }
      
      // 3. 已排课程按日期和状态组合索引
      const scheduledClassesDateStatusIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_scheduled_classes_date_status'
      `).get()
      
      if (!scheduledClassesDateStatusIndexExists) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_classes_date_status ON scheduled_classes(class_date, status)`)
        console.log('Migration v10: Added index on scheduled_classes(class_date, status)')
      }
      
      // 4. 过期计划查询索引（确保有合适的组合索引）
      // 注意：v4已有idx_lesson_plans_student_date，这里补充纯plan_date索引用于过期查询
      const lessonPlansDateIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_lesson_plans_date'
      `).get()
      
      if (!lessonPlansDateIndexExists) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_lesson_plans_date ON lesson_plans(plan_date)`)
        console.log('Migration v10: Added index on lesson_plans(plan_date)')
      }
      
      console.log('Migration v10: All critical query indexes added successfully')
    }
  },
  
  // ===== 版本 11: 添加 billing.remaining_hours 生成列 =====
  // 解决问题 3：remaining_hours 作为计算列存在隐患
  // 添加 SQLite 生成列确保 remaining_hours 永远与 total_hours - used_hours 同步
  {
    version: 11,
    description: '为 billing 表添加 remaining_hours 生成列，确保数据一致性',
    up: (db: Database.Database) => {
      // 注意：PRAGMA table_info() 不返回生成列，所以需要检查表定义 SQL
      const tableDef = db.prepare(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'billing'`
      ).get() as { sql: string } | undefined
      
      // 检查表定义中是否已包含 remaining_hours 生成列
      if (tableDef?.sql && tableDef.sql.includes('remaining_hours')) {
        console.log('Migration v11: remaining_hours generated column already exists, skipping')
        return
      }
      
      // SQLite 生成列语法：GENERATED ALWAYS AS (expr) VIRTUAL
      // VIRTUAL 表示该列不存储在磁盘上，每次查询时计算
      db.exec(`ALTER TABLE billing ADD COLUMN remaining_hours REAL GENERATED ALWAYS AS (total_hours - used_hours) VIRTUAL`)
      console.log('Migration v11: Added remaining_hours generated column to billing table')
    }
  },
  
  // ===== 版本 12: 为 students 表添加阅读训练进度字段 =====
  {
    version: 12,
    description: '为 students 表添加 reading_progress 字段，存储阅读训练进度',
    up: (db: Database.Database) => {
      const info = db.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>
      const columns = info.map(col => col.name)
      
      if (!columns.includes('reading_progress')) {
        db.exec(`ALTER TABLE students ADD COLUMN reading_progress TEXT`)
        console.log('Migration v12: Added reading_progress column to students table')
      }
    }
  },
  
  // ===== 版本 13: 移除 todos 表的 student_name 冗余字段 =====
  // 解决数据不一致问题：学员姓名变更后，todos.student_name 不会同步更新
  // 修复方案：移除冗余字段，改为 JOIN 查询从 students 表获取最新姓名
  {
    version: 13,
    description: '移除 todos 表的 student_name 冗余字段，通过 JOIN 查询获取最新学员姓名',
    up: (db: Database.Database) => {
      // 检查 todos 表是否有 student_name 字段
      const info = db.prepare('PRAGMA table_info(todos)').all() as Array<{ name: string }>
      const columns = info.map(col => col.name)
      
      if (!columns.includes('student_name')) {
        console.log('Migration v13: student_name column not found, skipping')
        return
      }
      
      // SQLite 不支持 DROP COLUMN，需要重建表
      // 步骤：
      // 1. 创建新表（不含 student_name）
      // 2. 复制数据
      // 3. 删除旧表
      // 4. 重命名新表
      
      db.exec(`
        -- 1. 创建临时表（不含 student_name 字段）
        CREATE TABLE IF NOT EXISTS todos_new (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          student_id TEXT,
          due_date TEXT,
          completed INTEGER DEFAULT 0,
          completed_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          sort_order INTEGER DEFAULT 0,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
        )
      `)
      
      // 2. 复制数据（排除 student_name）
      db.exec(`
        INSERT INTO todos_new (id, content, student_id, due_date, completed, completed_at, created_at, sort_order)
        SELECT id, content, student_id, due_date, completed, completed_at, created_at, sort_order
        FROM todos
      `)
      
      // 3. 删除旧表
      db.exec(`DROP TABLE todos`)
      
      // 4. 重命名新表
      db.exec(`ALTER TABLE todos_new RENAME TO todos`)
      
      console.log('Migration v13: Removed student_name column from todos table')
    }
  },
  
  // ===== 版本 14: 为 student_schedule_preferences 表添加唯一约束 =====
  // 解决问题：同一学员+星期+时段可重复插入，导致数据不一致
  // 修复方案：先去重（保留id最小的记录），再添加唯一约束
  {
    version: 14,
    description: '为 student_schedule_preferences 表添加唯一约束，防止重复偏好记录',
    up: (db: Database.Database) => {
      // 步骤 1: 检查是否已存在唯一索引（避免重复创建）
      const existingUniqueIndex = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_student_schedule_preferences_unique'
      `).get()
      
      if (existingUniqueIndex) {
        console.log('Migration v14: Unique index already exists, skipping')
        return
      }
      
      // 步骤 2: 查找并删除重复记录（保留 id 最小的记录）
      // 查询重复记录
      const duplicates = db.prepare(`
        SELECT student_id, day_of_week, preferred_start, preferred_end, COUNT(*) as cnt
        FROM student_schedule_preferences
        GROUP BY student_id, day_of_week, preferred_start, preferred_end
        HAVING COUNT(*) > 1
      `).all() as Array<{
        student_id: string
        day_of_week: string
        preferred_start: string
        preferred_end: string
        cnt: number
      }>
      
      if (duplicates.length > 0) {
        console.log(`Migration v14: Found ${duplicates.length} groups of duplicate preferences`)
        
        // 对每组重复记录，删除除了 id 最小以外的所有记录
        for (const dup of duplicates) {
          const result = db.prepare(`
            DELETE FROM student_schedule_preferences 
            WHERE student_id = ? 
              AND day_of_week = ? 
              AND preferred_start = ? 
              AND preferred_end = ?
              AND id NOT IN (
                SELECT MIN(id) 
                FROM student_schedule_preferences 
                WHERE student_id = ? 
                  AND day_of_week = ? 
                  AND preferred_start = ? 
                  AND preferred_end = ?
              )
          `).run(
            dup.student_id, dup.day_of_week, dup.preferred_start, dup.preferred_end,
            dup.student_id, dup.day_of_week, dup.preferred_start, dup.preferred_end
          )
          
          if (result.changes > 0) {
            console.log(`Migration v14: Removed ${result.changes} duplicate preference(s) for student ${dup.student_id}`)
          }
        }
      }
      
      // 步骤 3: 创建唯一索引
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_student_schedule_preferences_unique 
        ON student_schedule_preferences(student_id, day_of_week, preferred_start, preferred_end)
      `)
      
      console.log('Migration v14: Added unique constraint on student_schedule_preferences(student_id, day_of_week, preferred_start, preferred_end)')
    }
  },
  
  // ===== 版本 15: 添加朗读打卡表 =====
  {
    version: 15,
    description: '添加朗读打卡表 reading_checkins',
    up: (db: Database.Database) => {
      // 创建朗读打卡表
      db.exec(`
        CREATE TABLE IF NOT EXISTS reading_checkins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          checked_date TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          UNIQUE(student_id, checked_date)
        )
      `)
      
      // 创建索引
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reading_checkins_student_id ON reading_checkins(student_id)
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reading_checkins_date ON reading_checkins(checked_date)
      `)
      
      console.log('Migration v15: Added reading_checkins table with indexes')
    }
  },
  
  // ===== 版本 16: 统一 reading_checkins 表主键为 UUID TEXT =====
  // 解决问题：reading_checkins 使用 INTEGER PRIMARY KEY，与其他表的 UUID TEXT 主键不一致
  {
    version: 16,
    description: '统一 reading_checkins 表主键为 UUID TEXT，保持与其他表一致',
    up: (db: Database.Database) => {
      // 步骤 1: 检查是否需要迁移（检查 id 列类型）
      const tableDef = db.prepare(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reading_checkins'`
      ).get() as { sql: string } | undefined
      
      // 如果表定义中包含 INTEGER PRIMARY KEY AUTOINCREMENT，需要迁移
      if (tableDef?.sql && tableDef.sql.includes('INTEGER PRIMARY KEY AUTOINCREMENT')) {
        console.log('Migration v16: Migrating reading_checkins to use UUID primary key...')
        
        // 步骤 2: 创建新表（使用 TEXT PRIMARY KEY）
        db.exec(`
          CREATE TABLE IF NOT EXISTS reading_checkins_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            checked_date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            UNIQUE(student_id, checked_date)
          )
        `)
        
        // 步骤 3: 迁移现有数据，为每条记录生成 UUID
        // 使用 SQLite 内置的 hex() 和 randomblob() 生成类 UUID
        db.exec(`
          INSERT INTO reading_checkins_new (id, student_id, checked_date, created_at)
          SELECT 
            lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
            student_id, 
            checked_date, 
            created_at 
          FROM reading_checkins
        `)
        
        // 步骤 4: 删除旧表
        db.exec(`DROP TABLE reading_checkins`)
        
        // 步骤 5: 重命名新表
        db.exec(`ALTER TABLE reading_checkins_new RENAME TO reading_checkins`)
        
        // 步骤 6: 重建索引
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_reading_checkins_student_id ON reading_checkins(student_id)
        `)
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_reading_checkins_date ON reading_checkins(checked_date)
        `)
        
        console.log('Migration v16: Successfully migrated reading_checkins to UUID primary key')
      } else {
        console.log('Migration v16: reading_checkins already using UUID primary key, skipping')
      }
    }
  },
  
  // ===== 版本 17: 补充数据库索引优化（6.1/6.2/6.3） =====
  // 6.1 reading_checkins 表添加显式命名的复合唯一索引
  // 6.2 lesson_plans 表 plan_date 索引（v10 已添加 idx_lesson_plans_date，此处确认 student_id+plan_date 组合索引）
  // 6.3 class_records 表 plan_id 索引，优化 LEFT JOIN 关联查询
  {
    version: 17,
    description: '补充索引优化：reading_checkins 复合唯一索引、class_records plan_id 索引',
    up: (db: Database.Database) => {
      // 6.1: reading_checkins 表 - 显式命名的复合唯一索引
      // 表定义中已有 UNIQUE(student_id, checked_date) 约束，
      // 但显式命名索引便于管理和排查，IF NOT EXISTS 保证幂等
      const checkinIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_reading_checkins_student_date'
      `).get()
      
      if (!checkinIndexExists) {
        db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_checkins_student_date 
          ON reading_checkins(student_id, checked_date)
        `)
        console.log('Migration v17: Added unique index idx_reading_checkins_student_date on reading_checkins(student_id, checked_date)')
      }
      
      // 6.2: lesson_plans 表 - plan_date 索引
      // v10 已添加 idx_lesson_plans_date ON lesson_plans(plan_date)
      // v4 已添加 idx_lesson_plans_student_date ON lesson_plans(student_id, plan_date DESC)
      // 此处确认索引存在，如缺失则补建
      const planDateIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_lesson_plans_date'
      `).get()
      
      if (!planDateIndexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_date ON lesson_plans(plan_date)
        `)
        console.log('Migration v17: Added index idx_lesson_plans_date on lesson_plans(plan_date)')
      }
      
      const planStudentDateIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_lesson_plans_student_date'
      `).get()
      
      if (!planStudentDateIndexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_student_date 
          ON lesson_plans(student_id, plan_date DESC)
        `)
        console.log('Migration v17: Added index idx_lesson_plans_student_date on lesson_plans(student_id, plan_date)')
      }
      
      // 6.3: class_records 表 - plan_id 索引
      // getWithPlan() 使用 LEFT JOIN lesson_plans ON cr.plan_id = lp.id
      // getExpiredPlans() 使用 NOT EXISTS (SELECT 1 FROM class_records WHERE plan_id = lp.id)
      // 缺少 plan_id 索引会导致全表扫描
      const planIdIndexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_class_records_plan_id'
      `).get()
      
      if (!planIdIndexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_class_records_plan_id ON class_records(plan_id)
        `)
        console.log('Migration v17: Added index idx_class_records_plan_id on class_records(plan_id)')
      }
      
      console.log('Migration v17: Database index optimization completed (6.1/6.2/6.3)')
    }
  },
  
  // ===== 后续迁移在此添加 =====

  // ===== 版本 18: 添加词汇量测试记录表 =====
  {
    version: 18,
    description: '添加词汇量测试记录表 vocab_tests',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS vocab_tests (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          test_date TEXT NOT NULL,
          vocab_count INTEGER NOT NULL,
          test_source TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_vocab_tests_student_date
        ON vocab_tests(student_id, test_date DESC)
      `)

      console.log('Migration v18: Added vocab_tests table with index')
    }
  },

  // ===== 版本 19: 补齐缺失的外键索引 =====
  {
    version: 19,
    description: '补齐 8 个缺失的外键索引，显著提升查询性能',
    up: (db: Database.Database) => {
      // billing.student_id — 首页学员列表 LEFT JOIN 必经之路
      db.exec(`CREATE INDEX IF NOT EXISTS idx_billing_student_id ON billing(student_id)`)

      // student_wordbank_progress.student_id — 学员详情词库进度
      db.exec(`CREATE INDEX IF NOT EXISTS idx_student_wordbank_progress_student_id ON student_wordbank_progress(student_id)`)

      // exam_scores.student_id — 成长档案加载
      db.exec(`CREATE INDEX IF NOT EXISTS idx_exam_scores_student_id ON exam_scores(student_id)`)

      // learning_phases.student_id — 学习阶段查询
      db.exec(`CREATE INDEX IF NOT EXISTS idx_learning_phases_student_id ON learning_phases(student_id)`)

      // trial_conversions.student_id — 体验生转化查询
      db.exec(`CREATE INDEX IF NOT EXISTS idx_trial_conversions_student_id ON trial_conversions(student_id)`)

      // vocab_tests.student_id — 词汇量记录查询（v18 只建了复合索引，补单列索引）
      db.exec(`CREATE INDEX IF NOT EXISTS idx_vocab_tests_student_id ON vocab_tests(student_id)`)

      // students.status — 按状态筛选学员（高频过滤条件）
      db.exec(`CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)`)

      // teachers.status — 活跃助教查询
      db.exec(`CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status)`)

      console.log('Migration v19: Added 8 missing foreign key indexes')
    }
  },

  // ===== 版本 20: 删除 lesson_plan 时自动清理 class_records.plan_id 悬挂引用 =====
  {
    version: 20,
    description: '重建 class_records 表，为 plan_id 添加 ON DELETE SET NULL 外键约束',
    up: (db: Database.Database) => {
      // 1. 获取旧表结构确认 plan_id 列存在
      const info = db.prepare('PRAGMA table_info(class_records)').all() as Array<{ name: string }>
      const columns = info.map(col => col.name)
      if (!columns.includes('plan_id')) {
        console.log('Migration v20: plan_id column not found, skipping')
        return
      }

      // 2. 清理所有悬挂外键引用（必须在复制数据之前）
      // plan_id 指向不存在的 lesson_plans
      db.exec(`
        UPDATE class_records SET plan_id = NULL
        WHERE plan_id IS NOT NULL
          AND plan_id NOT IN (SELECT id FROM lesson_plans)
      `)
      // student_id 指向不存在的 students（极端情况）
      db.exec(`
        DELETE FROM class_records
        WHERE student_id NOT IN (SELECT id FROM students)
      `)
      console.log('Migration v20: Cleaned all dangling foreign key references')

      // 3. 关闭外键检查（SQLite 要求在事务外设置，但 better-sqlite3 的 pragma 可以在此调用）
      // 注意：如果在事务内无法关闭，我们依赖步骤2的清理来避免外键错误
      try { db.pragma('foreign_keys = OFF') } catch { /* 忽略，在事务内可能无法设置 */ }

      // 4. 创建带正确外键约束的新表
      db.exec(`
        CREATE TABLE IF NOT EXISTS class_records_new (
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 5. 复制数据
      db.exec(`
        INSERT INTO class_records_new
          (id, student_id, class_date, duration_hours, teacher_name, attendance,
           tasks, task_completed, incomplete_reason, performance, detail_feedback,
           highlights, issues, checkin_completed, phase_id, plan_id,
           imported_from_excel, created_at)
        SELECT
          id, student_id, class_date, duration_hours, teacher_name, attendance,
          tasks, task_completed, incomplete_reason, performance, detail_feedback,
          highlights, issues, checkin_completed, phase_id, plan_id,
          imported_from_excel, created_at
        FROM class_records
      `)

      // 6. 删除旧表
      db.exec(`DROP TABLE class_records`)

      // 7. 重命名新表
      db.exec(`ALTER TABLE class_records_new RENAME TO class_records`)

      // 8. 重建索引
      db.exec(`CREATE INDEX IF NOT EXISTS idx_class_records_student_date ON class_records(student_id, class_date DESC)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_class_records_date ON class_records(class_date)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_class_records_plan_id ON class_records(plan_id)`)

      // 9. 恢复外键检查
      try { db.pragma('foreign_keys = ON') } catch {}

      console.log('Migration v20: Rebuilt class_records table, cleaned dangling references')
    }
  },

  // ===== 版本 21: 学习规划功能 =====
  // 新增 student_plans、student_milestones 表
  // class_records 补充 plan_status_json 字段（必须在 v20 重建表之后）
  // students 补充 learning_target 字段
  {
    version: 21,
    description: '学习规划功能：新增 student_plans/student_milestones 表，class_records 加 plan_status_json，students 加 learning_target',
    up: (db: Database.Database) => {
      // 1. 新增 student_plans 表（学员大纲，一对一）
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_plans (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id  TEXT NOT NULL UNIQUE,
          summary     TEXT,
          phonics_plan  TEXT,
          textbook_plan TEXT,
          reading_plan  TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `)
      console.log('Migration v21: Created student_plans table')

      // 2. 新增 student_milestones 表（里程碑，一对多）
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_milestones (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id       TEXT NOT NULL,
          label            TEXT NOT NULL,
          target_wordbank  TEXT,
          target_level     INTEGER,
          target_date      TEXT,
          note             TEXT,
          is_completed     INTEGER NOT NULL DEFAULT 0,
          completed_date   TEXT,
          sort_order       INTEGER NOT NULL DEFAULT 0,
          created_at       TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_milestones_student
          ON student_milestones(student_id, sort_order)
      `)
      console.log('Migration v21: Created student_milestones table')

      // 3. class_records 补充 plan_status_json 字段
      const crInfo = db.prepare('PRAGMA table_info(class_records)').all() as Array<{ name: string }>
      if (!crInfo.map(c => c.name).includes('plan_status_json')) {
        db.exec(`ALTER TABLE class_records ADD COLUMN plan_status_json TEXT`)
        console.log('Migration v21: Added plan_status_json to class_records')
      }

      // 4. students 补充 learning_target 字段
      const stInfo = db.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>
      if (!stInfo.map(c => c.name).includes('learning_target')) {
        db.exec(`ALTER TABLE students ADD COLUMN learning_target TEXT`)
        console.log('Migration v21: Added learning_target to students')
      }

      console.log('Migration v21: Learning plan feature schema complete')
    }
  },

  // ===== 版本 22: lesson_plans 表加 plan_status_json 字段 =====
  {
    version: 22,
    description: 'lesson_plans 表加 plan_status_json 字段，将 AI 进度评估从 class_records 迁移到 lesson_plans',
    up: (db: Database.Database) => {
      const info = db.prepare('PRAGMA table_info(lesson_plans)').all() as Array<{ name: string }>
      if (!info.map(c => c.name).includes('plan_status_json')) {
        db.exec(`ALTER TABLE lesson_plans ADD COLUMN plan_status_json TEXT`)
        console.log('Migration v22: Added plan_status_json to lesson_plans')
      }
    }
  },

  // ===== 版本 23: 成长档案备注表 =====
  {
    version: 23,
    description: '添加成长档案备注表 student_growth_notes',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_growth_notes (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          note_date TEXT NOT NULL,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_growth_notes_student_date
          ON student_growth_notes(student_id, note_date DESC)
      `)
      console.log('Migration v23: Added student_growth_notes table')
    }
  },
]

/**
 * 运行数据库迁移
 * @param db 数据库实例
 * @returns 返回已应用的迁移版本列表
 */
export function runMigrations(db: Database.Database): number[] {
  console.log('Starting database migrations...')
  
  // 1. 创建迁移版本记录表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `)
  
  // 2. 获取当前已应用的最高版本
  const result = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null }
  const currentVersion = result?.v ?? 0
  
  console.log(`Current database version: ${currentVersion}`)
  console.log(`Target version: ${migrations[migrations.length - 1]?.version ?? 0}`)
  
  // 3. 获取已应用的版本列表
  const appliedVersions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>
  const appliedSet = new Set(appliedVersions.map(v => v.version))
  
  // 4. 按顺序执行未应用的迁移
  const appliedInThisRun: number[] = []
  
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      try {
        // 在事务中执行迁移
        const runMigration = db.transaction(() => {
          // 执行迁移逻辑
          migration.up(db)
          
          // 记录迁移版本
          db.prepare(`
            INSERT INTO schema_migrations (version, description) 
            VALUES (?, ?)
          `).run(migration.version, migration.description)
        })
        
        runMigration()
        
        appliedInThisRun.push(migration.version)
        console.log(`✓ Applied migration v${migration.version}: ${migration.description}`)
      } catch (error) {
        console.error(`✗ Failed to apply migration v${migration.version}:`, error)
        throw new Error(`Migration v${migration.version} failed: ${(error as Error).message}`)
      }
    }
  }
  
  if (appliedInThisRun.length === 0) {
    console.log('Database is up to date, no migrations applied.')
  } else {
    console.log(`Applied ${appliedInThisRun.length} migration(s): v${appliedInThisRun.join(', v')}`)
  }
  
  return appliedInThisRun
}

/**
 * 获取当前数据库版本
 * @param db 数据库实例
 * @returns 当前版本号，如果没有迁移记录则返回0
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const result = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null }
    return result?.v ?? 0
  } catch {
    return 0
  }
}

/**
 * 获取所有已应用的迁移记录
 * @param db 数据库实例
 * @returns 迁移记录列表
 */
export function getMigrationHistory(db: Database.Database): MigrationRecord[] {
  try {
    return db.prepare('SELECT version, applied_at, description FROM schema_migrations ORDER BY version').all() as MigrationRecord[]
  } catch {
    return []
  }
}

/**
 * 检查是否需要迁移
 * @param db 数据库实例
 * @returns 是否有待应用的迁移
 */
export function hasPendingMigrations(db: Database.Database): boolean {
  const currentVersion = getCurrentVersion(db)
  const latestVersion = migrations[migrations.length - 1]?.version ?? 0
  return currentVersion < latestVersion
}