import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GeneratePlansDrawer } from '@/components/Drawers/GeneratePlansDrawer'

export function BatchGenerate() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 border-b bg-card flex items-center gap-4 px-6 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">批量生成课程计划</h1>
      </header>
      <GeneratePlansDrawer open={true} onClose={() => navigate(-1)} fullPage />
    </div>
  )
}
