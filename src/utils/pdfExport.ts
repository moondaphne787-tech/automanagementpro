import type { LessonPlan, Student, TaskBlock } from '@/types'
import { TASK_TYPE_NAMES } from '@/ai/prompts'

// 格式化任务为文本
function formatTaskText(task: TaskBlock): string {
  const typeName = TASK_TYPE_NAMES[task.type] || task.type
  
  if ((task.type === 'vocab_new' || task.type === 'vocab_review') && task.wordbank_label) {
    if (task.level_from && task.level_to) {
      return `${typeName}：${task.wordbank_label} 第${task.level_from}-${task.level_to}关`
    }
    return `${typeName}：${task.wordbank_label}`
  }
  
  if (task.type === 'nine_grid' && task.wordbank_label) {
    return `${typeName}：${task.wordbank_label}`
  }
  
  if (task.content) {
    return `${typeName}：${task.content}`
  }
  
  return typeName
}

// 获取学员程度显示文本
function getLevelText(level?: string): string {
  if (level === 'weak') return '基础薄弱'
  if (level === 'medium') return '基础较好'
  if (level === 'strong') return '非常优秀'
  return '-'
}

// 创建单个学员课程计划的 HTML 内容
function createLessonPlanHTML(student: Student, plan: LessonPlan): string {
  const tasksHtml = plan.tasks.map((task, index) => {
    const taskText = formatTaskText(task)
    return `<div class="task-item">
      <span class="task-number">${index + 1}.</span>
      <span class="task-text">${taskText}</span>
    </div>`
  }).join('')
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      padding: 40px;
      background: white;
      color: #1f2937;
      width: 210mm;
      min-height: 297mm;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .info-section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 30px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .info-item {
      flex: 1;
      min-width: 120px;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }
    .task-list {
      background: #fff;
    }
    .task-item {
      padding: 8px 0;
      border-bottom: 1px dashed #eee;
      font-size: 14px;
      line-height: 1.6;
    }
    .task-item:last-child {
      border-bottom: none;
    }
    .note-box, .reason-box {
      padding: 12px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .note-box .box-title, .reason-box .box-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .note-box .box-content, .reason-box .box-content {
      font-size: 14px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    @media print {
      body {
        padding: 20mm;
      }
      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">课程计划</div>
    <div class="subtitle">EduManager Pro</div>
  </div>
  
  <div class="info-section">
    <div class="info-item">
      <div class="info-label">学员姓名</div>
      <div class="info-value">${student.name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">年级</div>
      <div class="info-value">${student.grade || '-'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">程度</div>
      <div class="info-value">${getLevelText(student.level)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">计划日期</div>
      <div class="info-value">${plan.plan_date || '-'}</div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">任务列表</div>
    <div class="task-list">
      ${tasksHtml}
    </div>
  </div>
  
  ${plan.notes ? `
    <div class="section">
      <div class="note-box">
        <div class="box-title">助教提示</div>
        <div class="box-content">${plan.notes}</div>
      </div>
    </div>
  ` : ''}
  
  ${plan.ai_reason ? `
    <div class="section">
      <div class="reason-box">
        <div class="box-title">计划说明</div>
        <div class="box-content">${plan.ai_reason}</div>
      </div>
    </div>
  ` : ''}
  
  <div class="footer">
    由 EduManager Pro 生成 | ${new Date().toLocaleDateString('zh-CN')}
  </div>
</body>
</html>
  `
}

// 创建多个学员课程计划的 HTML 内容（批量导出用）
function createMultiplePlansHTML(plans: Array<{ student: Student; plan: LessonPlan }>): string {
  const plansHtml = plans.map(({ student, plan }, index) => {
    const tasksHtml = plan.tasks.map((task, taskIndex) => {
      const taskText = formatTaskText(task)
      return `<div class="task-item">
        <span class="task-number">${taskIndex + 1}.</span>
        <span class="task-text">${taskText}</span>
      </div>`
    }).join('')
    
    return `
      <div class="plan-page ${index > 0 ? 'page-break' : ''}">
        <div class="header">
          <div class="title">课程计划</div>
          <div class="subtitle">EduManager Pro</div>
        </div>
        
        <div class="info-section">
          <div class="info-item">
            <div class="info-label">学员姓名</div>
            <div class="info-value">${student.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">年级</div>
            <div class="info-value">${student.grade || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">程度</div>
            <div class="info-value">${getLevelText(student.level)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">计划日期</div>
            <div class="info-value">${plan.plan_date || '-'}</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">任务列表</div>
          <div class="task-list">
            ${tasksHtml}
          </div>
        </div>
        
        ${plan.notes ? `
          <div class="section">
            <div class="note-box">
              <div class="box-title">助教提示</div>
              <div class="box-content">${plan.notes}</div>
            </div>
          </div>
        ` : ''}
        
        ${plan.ai_reason ? `
          <div class="section">
            <div class="reason-box">
              <div class="box-title">计划说明</div>
              <div class="box-content">${plan.ai_reason}</div>
            </div>
          </div>
        ` : ''}
        
        <div class="footer">
          由 EduManager Pro 生成 | ${new Date().toLocaleDateString('zh-CN')}
        </div>
      </div>
    `
  }).join('')
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>课程计划批量导出</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: white;
      color: #1f2937;
    }
    .plan-page {
      width: 210mm;
      min-height: 297mm;
      padding: 40px;
    }
    .page-break {
      page-break-before: always;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .info-section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 30px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .info-item {
      flex: 1;
      min-width: 120px;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }
    .task-list {
      background: #fff;
    }
    .task-item {
      padding: 8px 0;
      border-bottom: 1px dashed #eee;
      font-size: 14px;
      line-height: 1.6;
    }
    .task-item:last-child {
      border-bottom: none;
    }
    .note-box, .reason-box {
      padding: 12px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .note-box .box-title, .reason-box .box-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .note-box .box-content, .reason-box .box-content {
      font-size: 14px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  ${plansHtml}
</body>
</html>
  `
}

// 导出课程计划为 PDF（通过打印功能）
export async function exportLessonPlanPDF(
  student: Student,
  plan: LessonPlan
): Promise<void> {
  const html = createLessonPlanHTML(student, plan)
  
  // 打开打印窗口，用户可以选择"另存为PDF"
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

// 导出多个学员的课程计划为 PDF（通过打印功能）
export async function exportMultipleLessonPlansPDF(
  plans: Array<{ student: Student; plan: LessonPlan }>
): Promise<void> {
  const html = createMultiplePlansHTML(plans)
  
  // 打开打印窗口，用户可以选择"另存为PDF"
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

// 打印课程计划（打开新窗口打印）
export function printLessonPlan(student: Student, plan: LessonPlan): void {
  const html = createLessonPlanHTML(student, plan)
  
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}