import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initDatabase } from './db'
import { useAppStore } from './store/appStore'

console.log('main.tsx starting...')
console.log('window:', typeof window)
console.log('document.getElementById("root"):', document.getElementById('root'))

// 错误边界组件
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#fef2f2',
          color: '#333',
          fontFamily: 'system-ui, sans-serif',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#dc2626' }}>
              应用出错了
            </h1>
            <pre style={{ 
              backgroundColor: '#fee2e2', 
              padding: '16px', 
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// 先用原生JS测试渲染
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

console.log('Setting initial HTML...')
rootElement.innerHTML = `
  <div style="padding: 20px; font-family: system-ui; background: #f0f0f0;">
    <h1 style="color: #333;">正在初始化...</h1>
    <p style="color: #666;">请稍候</p>
  </div>
`
console.log('Initial HTML set, rootElement.innerHTML length:', rootElement.innerHTML.length)

// 初始化数据库后渲染应用
initDatabase()
  .then(async () => {
    console.log('Database initialized successfully, rendering app...')
    
    // 加载学期配置到 store
    try {
      await useAppStore.getState().loadSemesterConfig()
      console.log('Semester config loaded')
    } catch (err) {
      console.error('Failed to load semester config:', err)
    }
    
    try {
      const root = ReactDOM.createRoot(rootElement)
      console.log('Root created')
      
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>,
      )
      console.log('App rendered, rootElement.innerHTML length:', rootElement.innerHTML.length)
    } catch (err) {
      console.error('Render error:', err)
      rootElement.innerHTML = `<div style="padding: 20px; color: red;">Render Error: ${err}</div>`
    }
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error)
    const rootElement = document.getElementById('root')
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          color: '#333',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>数据库初始化失败</h1>
            <p style={{ color: '#666' }}>{error.message}</p>
            <pre style={{ marginTop: '10px', fontSize: '12px', color: '#999', textAlign: 'left' }}>{error.stack}</pre>
          </div>
        </div>
      )
    }
  })
