import { NavLink, useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Calendar, BookOpen, GraduationCap, Settings,
  Upload, Sparkles, FileDown, Zap, LayoutDashboard, Clock,
  ChevronLeft, ChevronRight, BookText, History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { Tooltip } from '@/components/ui/tooltip'

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
  { icon: Upload, label: '批量导入课堂记录', action: 'import', path: '/batch/import' },
  { icon: Sparkles, label: '批量生成课程计划', action: 'generate', path: '/batch/generate' },
  { icon: FileDown, label: '批量导出课程计划', action: 'print', path: '/batch/export' },
]

interface SidebarProps {}

export function Sidebar(_props: SidebarProps) {
  const navigate = useNavigate()
  const sidebarCollapsed = useAppStore(s => s.sidebarCollapsed)
  const toggleSidebar = useAppStore(s => s.toggleSidebar)
  const recentStudents = useAppStore(s => s.recentStudents)

  const renderNavItem = (item: typeof navItems[0]) => {
    const link = (
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
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {!sidebarCollapsed && item.label}
      </NavLink>
    )

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.to} content={item.label} side="right">
          {link}
        </Tooltip>
      )
    }
    return link
  }

  const renderQuickAction = (action: typeof quickActions[0]) => {
    const handleClick = () => {
      if ('path' in action && action.path) {
        navigate(action.path)
      }
    }

    const btn = (
      <button
        key={action.action}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        <action.icon className="h-4 w-4 flex-shrink-0" />
        {!sidebarCollapsed && action.label}
      </button>
    )

    if (sidebarCollapsed) {
      return (
        <Tooltip key={action.action} content={action.label} side="right">
          {btn}
        </Tooltip>
      )
    }
    return btn
  }

  return (
    <aside className={cn(
      "h-screen bg-card border-r flex flex-col transition-all duration-200",
      sidebarCollapsed ? "w-14" : "w-56"
    )}>
      {/* Logo区域 */}
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
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(renderNavItem)}

        {/* 最近访问 */}
        {recentStudents.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-1.5 px-3 mb-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <History className="w-3 h-3" />
                最近访问
              </div>
            )}
            {sidebarCollapsed && (
              <Tooltip content="最近访问" side="right">
                <div className="flex justify-center mb-1">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </Tooltip>
            )}
            {recentStudents.map(s => {
              const link = (
                <button
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors truncate",
                    sidebarCollapsed && "justify-center px-0"
                  )}
                >
                  {sidebarCollapsed ? (
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                      {s.name[0]}
                    </span>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium shrink-0">
                        {s.name[0]}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </>
                  )}
                </button>
              )

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={s.id} content={s.name} side="right">
                    {link}
                  </Tooltip>
                )
              }
              return link
            })}
          </div>
        )}
      </nav>

      {/* 快捷功能区 */}
      <div className="p-3 border-t">
        {!sidebarCollapsed && (
          <div className="text-xs text-muted-foreground mb-2 px-3">快捷操作</div>
        )}
        <div className="space-y-1">
          {quickActions.map(renderQuickAction)}
        </div>
      </div>
    </aside>
  )
}
