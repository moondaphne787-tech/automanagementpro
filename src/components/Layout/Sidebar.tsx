import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Users, 
  UserPlus, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Settings,
  Upload,
  Sparkles,
  FileDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: Users, label: '学员档案' },
  { to: '/trial', icon: UserPlus, label: '体验生' },
  { to: '/schedule', icon: Calendar, label: '排课' },
  { to: '/teachers', icon: GraduationCap, label: '助教' },
  { to: '/phases', icon: BookOpen, label: '学习阶段' },
  { to: '/settings', icon: Settings, label: '设置' },
]

const quickActions = [
  { icon: Upload, label: '批量导入课堂记录', action: 'import' },
  { icon: Sparkles, label: '批量生成课程计划', action: 'generate' },
  { icon: FileDown, label: '批量导出课程计划', action: 'print' },
]

interface SidebarProps {
  onQuickAction?: (action: string) => void
}

export function Sidebar({ onQuickAction }: SidebarProps) {
  return (
    <aside className="w-56 h-screen bg-card border-r flex flex-col">
      {/* Logo区域 - 添加左边距避开macOS窗口控制按钮 */}
      <div className="h-16 flex items-center px-4 border-b" style={{ paddingLeft: '80px' }}>
        <h1 className="text-lg font-semibold text-primary">EduManager</h1>
        <span className="ml-2 text-xs text-muted-foreground">Pro</span>
      </div>
      
      {/* 导航区 */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      {/* 快捷功能区 */}
      <div className="p-3 border-t">
        <div className="text-xs text-muted-foreground mb-2 px-3">快捷操作</div>
        <div className="space-y-1">
          {quickActions.map((action) => (
            <button
              key={action.action}
              onClick={() => onQuickAction?.(action.action)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}