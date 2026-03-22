import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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

// 创建课程计划的 HTML 内容
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
      border-bottom: 2px solid #6366f1;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #6366f1;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #9ca3af;
    }
    .info-section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 12px;
    }
    .info-item {
      flex: 1;
      min-width: 150px;
    }
    .info-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 15px;
      padding-left: 12px;
      border-left: 4px solid #6366f1;
    }
    .task-list {
      background: #ffffff;
      border-radius: 8px;
    }
    .task-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    .task-number {
      font-weight: 600;
      color: #6366f1;
      margin-right: 8px;
      min-width: 24px;
    }
    .task-text {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
    }
    .note-box {
      padding: 16px;
      background: #fef3c7;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }
    .note-box .box-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .note-box .box-content {
      color: #78350f;
      font-size: 14px;
      line-height: 1.6;
    }
    .reason-box {
      padding: 16px;
      background: #dbeafe;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .reason-box .box-title {
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .reason-box .box-content {
      color: #1e3a8a;
      font-size: 14px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
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
      <div class="info-value">${
        student.level === 'weak' ? '基础薄弱' : 
        student.level === 'medium' ? '基础较好' : '非常优秀'
      }</div>
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

// 导出课程计划为 PDF（使用 html2canvas 支持中文）
export async function exportLessonPlanPDF(
  student: Student,
  plan: LessonPlan
): Promise<void> {
  // 创建临时容器
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '210mm'
  container.innerHTML = createLessonPlanHTML(student, plan)
  document.body.appendChild(container)
  
  try {
    // 使用 html2canvas 截图
    const canvas = await html2canvas(container, {
      scale: 2, // 高清
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    
    // 创建 PDF
    const imgWidth = 210 // A4 宽度 mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pageHeight = 297 // A4 高度 mm
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    const imgData = canvas.toDataURL('image/png')
    
    // 如果内容超过一页，分页处理
    if (imgHeight > pageHeight) {
      let position = 0
      let remainingHeight = imgHeight
      
      while (remainingHeight > 0) {
        if (position > 0) {
          doc.addPage()
        }
        
        const heightOnPage = Math.min(remainingHeight, pageHeight)
        doc.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight)
        
        position += pageHeight
        remainingHeight -= pageHeight
      }
    } else {
      doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    }
    
    // 保存文件
    const fileName = `课程计划_${student.name}_${plan.plan_date || new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  } finally {
    // 清理临时容器
    document.body.removeChild(container)
  }
}

// 导出多个学员的课程计划为 PDF（合并文件）
export async function exportMultipleLessonPlansPDF(
  plans: Array<{ student: Student; plan: LessonPlan }>
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  
  const pageWidth = 210
  const pageHeight = 297
  
  for (let i = 0; i < plans.length; i++) {
    const { student, plan } = plans[i]
    
    // 创建临时容器
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '210mm'
    container.innerHTML = createLessonPlanHTML(student, plan)
    document.body.appendChild(container)
    
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // 新学员从新页开始
      if (i > 0) {
        doc.addPage()
      }
      
      const imgData = canvas.toDataURL('image/png')
      
      // 分页处理
      if (imgHeight > pageHeight) {
        let position = 0
        let remainingHeight = imgHeight
        let isFirstPage = true
        
        while (remainingHeight > 0) {
          if (!isFirstPage) {
            doc.addPage()
          }
          
          doc.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight)
          
          position += pageHeight
          remainingHeight -= pageHeight
          isFirstPage = false
        }
      } else {
        doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      }
    } finally {
      document.body.removeChild(container)
    }
  }
  
  // 保存
  const fileName = `课程计划_批量导出_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
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