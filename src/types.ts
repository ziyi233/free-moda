export interface ModelConfig {
  name: string
  alias: string
  description?: string
  register?: boolean
  defaultSize?: string
  defaultsteps?: number
  defaultguidance?: number
  triggerWords?: string       // 激发词（自动添加到 prompt 开头）
  negativePrompt?: string     // 模型特定的负面提示词（与全局负面词合并）
}

// 任务表（纯粹的任务记录）
export interface ModaTask {
  id: number
  taskId: string          // ModelScope任务ID
  apiKey: string
  type: 'edit' | 'generate'
  
  // 请求参数
  model: string
  prompt: string
  negativePrompt?: string
  size?: string
  seed?: number
  steps?: number
  guidance?: number
  inputImageUrl?: string
  
  // 响应结果
  status: string
  requestId?: string
  outputImages?: string   // JSON数组
  resultSeed?: number
  
  // 时间
  createdAt: number
  completedAt?: number
}

// 用户任务关联表
export interface ModaUserTask {
  id: number
  userId: string
  taskId: number          // 关联 moda_tasks.id
  createdAt: number
}

// 收藏表
export interface ModaFavorite {
  id: number
  userId: string
  taskId: number          // 关联 moda_tasks.id
  note?: string
  tags?: string           // JSON数组
  favoritedAt: number
}

declare module 'koishi' {
  interface Tables {
    moda_tasks: ModaTask
    moda_user_tasks: ModaUserTask
    moda_favorites: ModaFavorite
  }
}
