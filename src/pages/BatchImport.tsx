import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportRecordsDrawer } from '@/components/Drawers/ImportRecordsDrawer'

export function BatchImport() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 border-b bg-card flex items-center gap-4 px-6 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Upload className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">批量导入课堂记录</h1>
      </header>
      <ImportRecordsDrawer open={true} onClose={() => navigate(-1)} fullPage />
    </div>
  )
}
