import { useLocation, useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const ROUTE_LABELS: Record<string, string> = {
  '/': '工作台',
  '/students': '学员管理',
  '/students/new': '新增学员',
  '/trial': '体验生',
  '/trial/conversions': '转化记录',
  '/schedule': '排课',
  '/preferences': '时段偏好',
  '/reading-checkin': '朗读打卡',
  '/teachers': '助教',
  '/settings': '设置',
'/batch/generate': '批量生成课程计划',
  '/batch/import': '批量导入课堂记录',
  '/batch/export': '批量导出课程计划',
}

export function Breadcrumb() {
  const location = useLocation()
  const currentStudent = useAppStore(s => s.currentStudent)
  const path = location.pathname

  // 首页不显示面包屑
  if (path === '/') return null

  const crumbs: Array<{ label: string; to?: string }> = []

  // 学员详情页
  if (path.match(/^\/students\/(?!new).+/)) {
    crumbs.push({ label: '学员管理', to: '/students' })
    crumbs.push({ label: currentStudent?.name || '学员详情' })
  }
  // 助教详情页
  else if (path.match(/^\/teachers\/.+/)) {
    crumbs.push({ label: '助教', to: '/teachers' })
    crumbs.push({ label: '助教详情' })
  }
  // 体验生转化
  else if (path === '/trial/conversions') {
    crumbs.push({ label: '体验生', to: '/trial' })
    crumbs.push({ label: '转化记录' })
  }
  // 新增学员
  else if (path === '/students/new') {
    crumbs.push({ label: '学员管理', to: '/students' })
    crumbs.push({ label: '新增学员' })
  }
  // 其他一级页面
  else {
    const label = ROUTE_LABELS[path]
    if (label) {
      crumbs.push({ label })
    }
  }

  if (crumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1 px-6 py-2 text-xs text-muted-foreground border-b bg-muted/20">
      <Link to="/" className="hover:text-foreground transition-colors">工作台</Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-foreground transition-colors">{crumb.label}</Link>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
