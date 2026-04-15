import { Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ResultDisplayProps {
  result: { success: number; failed: number; errors: string[] } | null
  onContinue: () => void
  onClose: () => void
}

export function ResultDisplay({ result, onContinue, onClose }: ResultDisplayProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {result && result.success > 0 ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">录入完成</h3>
                  <p className="text-muted-foreground mt-1">
                    成功创建 <span className="text-green-600 font-medium">{result.success}</span> 条课堂记录
                  </p>
                  {result.failed > 0 && (
                    <p className="text-sm text-red-500 mt-1">
                      {result.failed} 条记录创建失败
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">录入失败</h3>
                  <p className="text-muted-foreground mt-1">
                    {result?.errors.join(', ') || '没有可创建的记录'}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onContinue} className="flex-1">
          继续录入
        </Button>
        <Button onClick={onClose} className="flex-1">
          完成
        </Button>
      </div>
    </div>
  )
}
