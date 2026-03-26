import type { AIConfig } from '@/types'

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT_MS = 60000 // 60 秒

// 自定义超时错误
export class AITimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI 请求超时（${timeoutMs / 1000}秒）`)
    this.name = 'AITimeoutError'
  }
}

// 创建 AbortController 与超时定时器
function createTimeoutController(timeoutMs: number): {
  controller: AbortController
  timeoutId: ReturnType<typeof setTimeout>
  clear: () => void
} {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return {
    controller,
    timeoutId,
    clear: () => clearTimeout(timeoutId)
  }
}

// 创建 AI 客户端配置
export function createAIConfig(config: Partial<AIConfig> = {}): AIConfig {
  return {
    api_url: config.api_url || 'https://api.deepseek.com/v1',
    api_key: config.api_key || '',
    model: config.model || 'deepseek-chat',
    temperature: config.temperature ?? 0.7,
    max_tokens: config.max_tokens || 2048
  }
}

// 发送 AI 请求（非流式）
export async function sendAIRequest(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const { controller, clear } = createTimeoutController(timeoutMs)

  try {
    const response = await fetch(`${config.api_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: config.temperature,
        max_tokens: config.max_tokens
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AITimeoutError(timeoutMs)
    }
    throw error
  } finally {
    clear()
  }
}

// 发送 AI 请求（流式）
export async function* sendAIRequestStream(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): AsyncGenerator<string, void, unknown> {
  const { controller, clear } = createTimeoutController(timeoutMs)

  try {
    const response = await fetch(`${config.api_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        stream: true
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API 请求失败: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AITimeoutError(timeoutMs)
    }
    throw error
  } finally {
    clear()
  }
}

// 测试 AI 连接
export async function testAIConnection(
  config: AIConfig,
  timeoutMs: number = 10000 // 测试连接默认 10 秒超时
): Promise<{ success: boolean; message: string }> {
  if (!config.api_key) {
    return { success: false, message: '请输入 API Key' }
  }

  const { controller, clear } = createTimeoutController(timeoutMs)

  try {
    const response = await fetch(`${config.api_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      }),
      signal: controller.signal
    })

    if (response.ok) {
      return { success: true, message: '连接成功！API 配置正确。' }
    } else {
      const error = await response.json().catch(() => ({}))
      return { success: false, message: `连接失败：${error.error?.message || response.statusText}` }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, message: `连接超时（${timeoutMs / 1000}秒）` }
    }
    return { success: false, message: `连接失败：${(error as Error).message}` }
  } finally {
    clear()
  }
}