import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, User, GraduationCap, LayoutDashboard, Calendar, Settings,
  BookText, Clock, UserPlus, Zap, Upload, Sparkles, FileDown,
  Sun, Moon, Plus
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'command' | 'student' | 'page'
  label: string
  sublabel?: string
  path?: string
  action?: () => void
  icon: React.ReactNode
}

const PAGE_RESULTS: SearchResult[] = [
  { id: 'p-dashboard', type: 'page', label: '工作台', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'p-students', type: 'page', label: '学员管理', path: '/students', icon: <User className="w-4 h-4" /> },
  { id: 'p-trial', type: 'page', label: '体验生', path: '/trial', icon: <UserPlus className="w-4 h-4" /> },
  { id: 'p-schedule', type: 'page', label: '排课', path: '/schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'p-preferences', type: 'page', label: '时段偏好', path: '/preferences', icon: <Clock className="w-4 h-4" /> },
  { id: 'p-reading', type: 'page', label: '朗读打卡', path: '/reading-checkin', icon: <BookText className="w-4 h-4" /> },
  { id: 'p-teachers', type: 'page', label: '助教', path: '/teachers', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'p-settings', type: 'page', label: '设置', path: '/settings', icon: <Settings className="w-4 h-4" /> },
]

interface GlobalSearchProps {}

export function GlobalSearch(_props: GlobalSearchProps) {
  const navigate = useNavigate()
  const students = useAppStore(s => s.students)
  const theme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 命令列表（依赖 onAction 和 store）
  // 命令列表
  const COMMAND_RESULTS: SearchResult[] = useMemo(() => [
    { id: 'cmd-import', type: 'command', label: '批量导入课堂记录', sublabel: '从 Excel 导入', icon: <Upload className="w-4 h-4" />, path: '/batch/import' },
    { id: 'cmd-generate', type: 'command', label: '批量生成课程计划', sublabel: 'AI 自动生成', icon: <Sparkles className="w-4 h-4" />, path: '/batch/generate' },
    { id: 'cmd-print', type: 'command', label: '批量导出课程计划', sublabel: '导出为 PDF', icon: <FileDown className="w-4 h-4" />, path: '/batch/export' },
    { id: 'cmd-new-student', type: 'command', label: '新增学员', sublabel: '添加新学员', icon: <Plus className="w-4 h-4" />, path: '/students/new' },
    { id: 'cmd-theme', type: 'command', label: theme === 'light' ? '切换到深色模式' : '切换到浅色模式', sublabel: '外观设置', icon: theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />, action: () => setTheme(theme === 'light' ? 'dark' : 'light') },
  ], [theme])

  // 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // 搜索结果
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()

    // 无搜索词：显示命令 + 部分页面
    if (!q) return [...COMMAND_RESULTS, ...PAGE_RESULTS.slice(0, 4)]

    const matched: SearchResult[] = []

    // 搜索命令
    COMMAND_RESULTS
      .filter(c => c.label.toLowerCase().includes(q) || c.sublabel?.toLowerCase().includes(q))
      .forEach(c => matched.push(c))

    // 搜索学员
    students
      .filter(s => s.name.toLowerCase().includes(q) || s.student_no?.toLowerCase().includes(q) || s.grade?.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(s => {
        matched.push({
          id: `s-${s.id}`, type: 'student', label: s.name,
          sublabel: [s.grade, s.student_no].filter(Boolean).join(' · '),
          path: `/students/${s.id}`, icon: <User className="w-4 h-4" />
        })
      })

    // 搜索页面
    PAGE_RESULTS
      .filter(p => p.label.toLowerCase().includes(q))
      .forEach(p => matched.push(p))

    return matched.slice(0, 12)
  }, [query, students, COMMAND_RESULTS])

  useEffect(() => setSelectedIndex(0), [results])

  const executeResult = (result: SearchResult) => {
    if (result.action) {
      result.action()
    } else if (result.path) {
      navigate(result.path)
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      executeResult(results[selectedIndex])
    }
  }

  if (!open) return null

  const TYPE_LABELS: Record<string, string> = { command: '快捷操作', student: '学员', page: '页面' }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  let flatIndex = 0

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[520px] bg-background border rounded-xl shadow-2xl z-[101] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索或输入命令..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">未找到匹配结果</div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {TYPE_LABELS[type] || type}
                </div>
                {items.map(item => {
                  const idx = flatIndex++
                  return (
                    <button
                      key={item.id}
                      onClick={() => executeResult(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                        idx === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}
                    >
                      <span className="text-muted-foreground">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground ml-auto">{item.sublabel}</span>
                      )}
                  </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="bg-muted px-1 rounded">↑↓</kbd> 导航</span>
          <span><kbd className="bg-muted px-1 rounded">Enter</kbd> 执行</span>
          <span><kbd className="bg-muted px-1 rounded">Esc</kbd> 关闭</span>
        </div>
      </div>
    </>
  )
}
