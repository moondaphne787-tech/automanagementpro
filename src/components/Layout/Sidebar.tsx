import { NavLink } from 'react-router-dom'
import { 
  Users, 
  UserPlus, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Settings,
  Upload,
  Sparkles,
  FileDown,
  Zap,
  LayoutDashboard,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '工作台' },
  { to: '/students', icon: Users, label: '学员管理' },
  { to: '/trial', icon: UserPlus, label: '体验生' },
  { to: '/schedule', icon: Calendar, label: '排课' },
  { to: '/preferences', icon: Clock, label: '时段偏好' },
  { to: '/reading-checkin', icon: BookText, label: '朗读打卡' },
  { to: '/teachers', icon: GraduationCap, label: '助教' },
  { to: '/phases', icon: BookOpen, label: '学习阶段' },
  { to: '/settings', icon: Settings, label: '设置' },
]

const quickActions = [
  { icon: Zap, label: '快速录入今日课堂', action: 'quickRecord' },
  { icon: Upload, label: '批量导入课堂记录', action: 'import' },
  { icon: Sparkles, label: '批量生成课程计划', action: 'generate' },
  { icon: FileDown, label: '批量导出课程计划', action: 'print' },
]

interface SidebarProps {
  onQuickAction?: (action: string) => void
}

export function Sidebar({ onQuickAction }: SidebarProps) {
  const sidebarCollapsed = useAppStore(s => s.sidebarCollapsed)
  const toggleSidebar = useAppStore(s => s.toggleSidebar)
  
  return (
    <aside className={cn(
      "h-screen bg-card border-r flex flex-col transition-all duration-200",
      sidebarCollapsed ? "w-14" : "w-56"
    )}>
      {/* Logo区域 - 添加左边距避开macOS窗口控制按钮 */}
      <div className={cn(
        "h-16 flex items-center px-4 border-b",
        sidebarCollapsed ? "justify-center" : ""
      )} style={!sidebarCollapsed ? { paddingLeft: '80px' } : {}}>
        {sidebarCollapsed ? (
          <h1 className="text-lg font-semibold text-primary">E</h1>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-primary">EduManager</h1>
            <span className="ml-2 text-xs text-muted-foreground">Pro</span>
          </>
        )}
      </div>
      
      {/* 折叠按钮 */}
      <button
        onClick={toggleSidebar}
        className="absolute top-4 right-0 translate-x-1/2 z-10 w-6 h-6 bg-card border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
        title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
      
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
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                sidebarCollapsed && "justify-center px-0"
              )
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!sidebarCollapsed && item.label}
          </NavLink>
        ))}
      </nav>
      
      {/* 快捷功能区 */}
      <div className="p-3 border-t">
        {!sidebarCollapsed && (
          <div className="text-xs text-muted-foreground mb-2 px-3">快捷操作</div>
        )}
        <div className="space-y-1">
          {quickActions.map((action) => (
            <button
              key={action.action}
              onClick={() => onQuickAction?.(action.action)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                sidebarCollapsed && "justify-center px-0"
              )}
              title={sidebarCollapsed ? action.label : undefined}
            >
              <action.icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && action.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
