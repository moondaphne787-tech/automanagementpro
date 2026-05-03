import type { CardLayout } from '@/components/Drawers/PrintPlans/buildLayoutCards'

export function generateLayoutHTML(cards: CardLayout[], showAssistantTips: boolean): string {
  const pages = new Map<number, CardLayout[]>()
  cards.forEach(c => {
    if (!pages.has(c.page)) pages.set(c.page, [])
    pages.get(c.page)!.push(c)
  })

  const pagesHtml = Array.from(pages.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, pageCards]) => {
      const cardsHtml = pageCards.map(card => {
        const tasksHtml = card.tasks.map((t, i) =>
          `<div style="display:flex;gap:3px;font-size:14px;line-height:1.5;margin-bottom:3px"><span style="min-width:16px;font-weight:500">${i + 1}.</span><span>${t.label}${t.content ? `：${t.content}` : ''}</span></div>`
        ).join('')
        const notesHtml = showAssistantTips && card.notes
          ? `<div style="font-size:9px;color:#666;margin-top:4px;padding-top:4px;border-top:1px dashed #ddd">提示：${card.notes}</div>`
          : ''
        return `<div style="position:absolute;left:${card.x}%;top:${card.y}%;width:${card.width}%;height:${card.height}%;border:2px solid #333;border-radius:6px;padding:10px 12px;overflow:hidden;box-sizing:border-box;background:white">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">${card.studentName} ${card.grade}</span>
            <span style="font-size:16px;color:#666">Period ______: ${card.planDate}</span>
          </div>
          ${tasksHtml}${notesHtml}
        </div>`
      }).join('')

      return `<div class="page" style="position:relative">${cardsHtml}</div>`
    }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>课程计划打印</title><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:4mm}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:white}.page{width:210mm;height:297mm;position:relative;page-break-after:always}.page:last-child{page-break-after:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pagesHtml}</body></html>`
}
