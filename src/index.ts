import { Context, Schema, h } from 'koishi'
import type {} from 'koishi-plugin-chatluna/services/chat'
import type { PlatformService } from 'koishi-plugin-chatluna/llm-core/platform/service'
import { ModelType } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { getMessageContent } from 'koishi-plugin-chatluna/utils/string'

export const name = 'free-moda'
export const inject = {
  required: ['database'],
  optional: ['chatluna'],
}

interface ModelConfig {
  name: string
  alias: string
  description?: string
  register?: boolean
  defaultSize?: string
}

export interface Config {
  apiKeys: string[]
  editModels: ModelConfig[]
  editMaxRetries: number
  editRetryInterval: number
  autoDetectSize: boolean
  scaleMode: 'original' | 'fit'
  maxWidth: number
  maxHeight: number
  generateModels: ModelConfig[]
  generateMaxRetries: number
  generateRetryInterval: number
  defaultSize: string
  enableAI: boolean
  aiModel?: string
  aiPromptTemplate?: string
  // 输出消息配置
  msgEditStart: string
  recallEditStart: boolean
  msgEditCreated: string
  recallEditCreated: boolean
  msgGenerateStart: string
  recallGenerateStart: boolean
  msgGenerateCreated: string
  recallGenerateCreated: boolean
  msgAiAnalyzing: string
  recallAiAnalyzing: boolean
  msgAiResult: string
  recallAiResult: boolean
  msgTaskCreated: string
  recallTaskCreated: boolean
  msgTaskWaiting: string
  enableLogs: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    apiKeys: Schema.array(String)
      .description('API Token 列表 - 访问 https://modelscope.cn/my/myaccesstoken 获取（需绑定阿里云账号）')
      .required(),
  }).description('基础配置'),

  Schema.object({
    editModels: Schema.array(Schema.object({
      name: Schema.string().required().description('模型名称'),
      alias: Schema.string().required().description('别名'),
      description: Schema.string().description('描述'),
      register: Schema.boolean().description('注册指令').default(true),
      defaultSize: Schema.string().description('默认分辨率').default(undefined),
    }))
      .role('table')
      .description('编辑模型列表')
      .default([
        { name: 'Qwen/Qwen-Image-Edit', alias: 'edit', description: '通用图片编辑模型', register: true, defaultSize: undefined },
      ]),
    editMaxRetries: Schema.number()
      .description('最大重试次数（编辑较慢，建议 120+）')
      .default(120),
    editRetryInterval: Schema.number()
      .description('查询间隔（毫秒）')
      .default(10000),
    autoDetectSize: Schema.boolean()
      .description('自动识别原图分辨率（除非手动指定 -s）')
      .default(true),
    scaleMode: Schema.union([
      Schema.const('original' as const).description('原始分辨率'),
      Schema.const('fit' as const).description('等比缩放'),
    ])
      .description('分辨率处理模式')
      .default('fit'),
    maxWidth: Schema.number()
      .description('最大宽度（等比缩放时生效）')
      .min(64)
      .max(2048)
      .default(1664),
    maxHeight: Schema.number()
      .description('最大高度（等比缩放时生效）')
      .min(64)
      .max(2048)
      .default(1664),
  }).description('图片编辑'),

  Schema.object({
    generateModels: Schema.array(Schema.object({
      name: Schema.string().required().description('模型名称'),
      alias: Schema.string().required().description('别名'),
      description: Schema.string().description('描述'),
      register: Schema.boolean().description('注册指令').default(true),
      defaultSize: Schema.string().description('默认分辨率').default(undefined),
    }))
      .role('table')
      .description('生成模型列表')
      .default([
        { name: 'Qwen/Qwen-Image', alias: 'qwen', description: '通用文生图模型', register: true, defaultSize: undefined },
        { name: 'merjic/majicbeauty-qwen1', alias: 'beauty', description: '冷淡风美人', register: true, defaultSize: undefined },
        { name: 'animationtj/Qwen_image_nude_pantyhose_lora', alias: 'pantyhose', description: '肉色连裤袜特化', register: true, defaultSize: undefined },
      ]),
    generateMaxRetries: Schema.number()
      .description('最大重试次数')
      .default(60),
    generateRetryInterval: Schema.number()
      .description('查询间隔（毫秒）')
      .default(5000),
    defaultSize: Schema.string()
      .description('默认分辨率（格式: 1024x1024）')
      .default('1024x1024'),
  }).description('图片生成'),

  Schema.object({
    enableAI: Schema.boolean()
      .description('启用 AI 提示词生成（需安装 ChatLuna）')
      .default(false),
    aiModel: Schema.dynamic('model')
      .description('AI 模型'),
    aiPromptTemplate: Schema.string()
      .role('textarea', { rows: [3, 10] })
      .description('提示词模板 - 变量: {description}, {modelList}')
      .default(`你是一个专业的图片生成提示词专家。用户会给你一个简单的描述，你需要：
1. 将描述扩展为详细的、适合图片生成的提示词（英文）
2. 根据描述内容，从以下模型中选择最合适的一个：

{modelList}

请以 JSON 格式回复：
{
  "prompt": "优化后的详细提示词（英文）",
  "model": "选择的模型别名",
  "reason": "选择该模型的理由（中文）"
}

用户描述：{description}`),
  }).description('AI 功能'),

  Schema.object({
    msgEditStart: Schema.string()
      .description('编辑开始 - 变量: {model}, {size}')
      .default('⚙️ 正在使用 {model} 编辑图片...{size}')
      .role('textarea', { rows: [2, 4] }),
    recallEditStart: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgEditCreated: Schema.string()
      .description('编辑任务已创建')
      .default('⏳ 任务已创建，预计 30-120 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    recallEditCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgGenerateStart: Schema.string()
      .description('生成开始 - 变量: {model}, {size}')
      .default('🎨 正在使用 {model} 生成图片...{size}')
      .role('textarea', { rows: [2, 4] }),
    recallGenerateStart: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgGenerateCreated: Schema.string()
      .description('生成任务已创建')
      .default('⏳ 任务已创建，预计 10-30 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    recallGenerateCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgAiAnalyzing: Schema.string()
      .description('AI 分析中')
      .default('🤖 AI 正在分析并生成提示词...')
      .role('textarea', { rows: [2, 4] }),
    recallAiAnalyzing: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgAiResult: Schema.string()
      .description('AI 结果 - 变量: {prompt}, {model}, {reason}')
      .default('✨ AI 已生成提示词！\n\n📝 提示词: {prompt}\n🎨 模型: {model}\n💡 理由: {reason}\n\n开始生成图片...')
      .role('textarea', { rows: [4, 8] }),
    recallAiResult: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgTaskCreated: Schema.string()
      .description('AI 任务已创建')
      .default('⏳ 任务已创建，预计 10-30 秒...')
      .role('textarea', { rows: [2, 4] }),
    recallTaskCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgTaskWaiting: Schema.string()
      .description('任务查询提示')
      .default('💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
  }).description('输出消息').collapse(),

  Schema.object({
    enableLogs: Schema.boolean()
      .description('启用控制台日志')
      .default(true),
  }).description('调试选项'),
])

interface UserTask {
  id: number
  taskId: string
  apiKey: string
  type: 'edit' | 'generate'
  prompt: string
  startTime: number
  endTime?: number
  status: string
  imageUrl?: string
  userId: string
}

declare module 'koishi' {
  interface Tables {
    moda_tasks: UserTask
  }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('free-moda')
  const baseUrl = 'https://api-inference.modelscope.cn/'
  
  // 消息模板变量替换
  function formatMessage(template: string, vars: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
    }
    return result
  }

  // 消息撤回辅助函数
  async function sendWithRecall(session: any, content: string, shouldRecall: boolean, previousMsgIds: string[] = []): Promise<string[]> {
    // 先撤回之前的消息
    if (previousMsgIds.length > 0) {
      for (const msgId of previousMsgIds) {
        try {
          await session.bot.deleteMessage(session.channelId, msgId)
        } catch (e) {
          // 撤回失败不影响流程
          if (config.enableLogs) logger.warn(`撤回消息失败: ${e.message}`)
        }
      }
    }
    
    // 发送新消息
    const msgIds = await session.send(content)
    
    // 如果需要撤回，返回消息ID
    if (shouldRecall) {
      return msgIds
    }
    
    return []
  }
  
  // 扩展数据库表
  ctx.model.extend('moda_tasks', {
    id: 'unsigned',
    taskId: 'string',
    apiKey: 'string',
    type: 'string',
    prompt: 'text',
    startTime: 'double',  // 使用 double 存储时间戳
    endTime: 'double',    // 使用 double 存储时间戳
    status: 'string',
    imageUrl: 'string',
    userId: 'string',
  }, {
    autoInc: true,
    primary: 'id',
  })
  
  // API Key 轮询索引
  let currentKeyIndex = 0
  
  // 获取下一个 API Key (轮询)
  function getNextApiKey(): string {
    if (!config.apiKeys || config.apiKeys.length === 0) {
      throw new Error('未配置 ModelScope API Key')
    }
    const key = config.apiKeys[currentKeyIndex]
    const keyIndex = currentKeyIndex + 1
    currentKeyIndex = (currentKeyIndex + 1) % config.apiKeys.length
    if (config.enableLogs) {
      logger.info(`使用 API Key [${keyIndex}/${config.apiKeys.length}]`)
    }
    return key
  }

  // 获取图片分辨率
  async function getImageSize(imageUrl: string): Promise<string | null> {
    try {
      if (config.enableLogs) logger.info(`正在获取图片分辨率: ${imageUrl}`)
      
      // 下载图片数据
      const imageBuffer = await ctx.http.get(imageUrl, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(imageBuffer)
      
      // 解析图片尺寸
      let width: number, height: number
      
      // PNG 格式
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        width = buffer.readUInt32BE(16)
        height = buffer.readUInt32BE(20)
      }
      // JPEG 格式
      else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xFF) break
          const marker = buffer[offset + 1]
          if (marker === 0xC0 || marker === 0xC2) {
            height = buffer.readUInt16BE(offset + 5)
            width = buffer.readUInt16BE(offset + 7)
            break
          }
          offset += 2 + buffer.readUInt16BE(offset + 2)
        }
      }
      // GIF 格式
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        width = buffer.readUInt16LE(6)
        height = buffer.readUInt16LE(8)
      }
      // WebP 格式
      else if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        // 简单的 WebP VP8 格式检测
        if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
          const code = buffer.readUInt32LE(23)
          width = (code & 0x3FFF) + 1
          height = ((code >> 16) & 0x3FFF) + 1
        }
      }
      
      if (width && height) {
        const size = `${width}x${height}`
        if (config.enableLogs) logger.success(`图片分辨率: ${size}`)
        return size
      }
      
      if (config.enableLogs) logger.warn('无法识别图片格式')
      return null
    } catch (error) {
      if (config.enableLogs) logger.error(`获取图片分辨率失败: ${error.message}`)
      return null
    }
  }

  // 计算缩放后的尺寸
  function calculateScaledSize(originalSize: string): string {
    const [width, height] = originalSize.split('x').map(Number)
    
    // 如果是原始模式，直接返回
    if (config.scaleMode === 'original') {
      if (config.enableLogs) logger.info(`使用原始分辨率: ${originalSize}`)
      return originalSize
    }
    
    // 等比缩放模式：缩放到最大边界
    const maxW = config.maxWidth
    const maxH = config.maxHeight
    
    // 计算缩放比例（取较小值以确保不超出边界）
    const scaleW = maxW / width
    const scaleH = maxH / height
    const scale = Math.min(scaleW, scaleH)
    
    // 计算新尺寸（向下取整到偶数，确保兼容性）
    const newWidth = Math.floor(width * scale / 2) * 2
    const newHeight = Math.floor(height * scale / 2) * 2
    
    const newSize = `${newWidth}x${newHeight}`
    if (config.enableLogs) {
      const action = scale > 1 ? '放大' : scale < 1 ? '缩小' : '保持'
      logger.info(`等比${action}: ${originalSize} -> ${newSize} (缩放比例: ${(scale * 100).toFixed(1)}%)`)
    }
    
    return newSize
  }

  // 创建任务，返回 taskId 和使用的 apiKey
  async function createTask(imageUrl: string, prompt: string, model: string, size?: string): Promise<{ taskId: string, apiKey: string }> {
    if (config.enableLogs) logger.info(`创建任务 - 模型: ${model}, 提示词: ${prompt}, 分辨率: ${size || '默认'}`)
    
    // 尝试所有可用的 API Key
    const maxAttempts = config.apiKeys.length
    let lastError: Error
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = getNextApiKey()
      
      try {
        const requestBody: any = { model, prompt, image_url: imageUrl }
        if (size) {
          requestBody.size = size
        }
        
        const response = await ctx.http.post(
          `${baseUrl}v1/images/generations`,
          requestBody,
          { 
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-ModelScope-Async-Mode': 'true' 
            } 
          }
        )
        
        if (config.enableLogs) logger.success(`任务创建成功: ${response.task_id}`)
        return { taskId: response.task_id, apiKey }
      } catch (error) {
        lastError = error
        const errorMsg = error.message || String(error)
        if (config.enableLogs) {
          logger.warn(`API Key [${attempt + 1}/${maxAttempts}] 失败: ${errorMsg}`)
        }
        
        // 如果是认证错误，给出提示
        if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
          if (config.enableLogs) {
            logger.warn('💡 提示：Unauthorized 错误通常是因为：\n1. Token 已过期\n2. 未绑定阿里云账号（访问 https://modelscope.cn 绑定）\n3. Token 没有权限访问该模型')
          }
        }
        
        // 如果不是最后一次尝试，继续下一个 key
        if (attempt < maxAttempts - 1) {
          continue
        }
      }
    }
    
    // 所有 key 都失败了
    logger.error('所有 API Key 都失败了')
    
    // 如果是认证错误，给用户友好的提示
    if (lastError.message?.includes('Unauthorized') || lastError.message?.includes('401')) {
      throw new Error('认证失败：请检查 Token 是否有效，并确保已绑定阿里云账号（访问 https://modelscope.cn 绑定）')
    }
    
    throw lastError
  }

  // 查询任务状态，使用创建任务时的同一个 key
  async function getStatus(taskId: string, apiKey: string) {
    return await ctx.http.get(`${baseUrl}v1/tasks/${taskId}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Task-Type': 'image_generation' 
      }
    })
  }

  // 添加用户任务
  async function addUserTask(userId: string, taskId: string, apiKey: string, type: 'edit' | 'generate', prompt: string) {
    try {
      const task = await ctx.database.create('moda_tasks', {
        taskId,
        apiKey,
        type,
        prompt,
        startTime: Date.now(),
        status: 'PENDING',
        userId,
      })
      if (config.enableLogs) logger.success(`任务记录已创建: ID=${task.id}, TaskID=${taskId}`)
      return task
    } catch (error) {
      logger.error('创建任务记录失败:', error)
      throw error
    }
  }
  
  // 更新任务状态
  async function updateTaskStatus(taskId: string, status: string, imageUrl?: string) {
    // 先获取当前任务状态
    const [currentTask] = await ctx.database.get('moda_tasks', { taskId })
    
    const update: Partial<UserTask> = { status }
    if (imageUrl) update.imageUrl = imageUrl
    
    // 只在状态首次变为完成或失败时记录结束时间
    if ((status === 'SUCCEED' || status === 'FAILED') && !currentTask?.endTime) {
      update.endTime = Date.now()
      if (config.enableLogs) {
        logger.info(`任务 ${taskId} 完成，记录结束时间`)
      }
    }
    
    await ctx.database.set('moda_tasks', { taskId }, update)
  }
  
  // 等待任务完成，使用创建任务时的同一个 key
  async function waitTask(taskId: string, apiKey: string, maxRetries: number, interval: number): Promise<string> {
    if (config.enableLogs) logger.info(`开始等待任务完成: ${taskId} (最多${maxRetries}次, 间隔${interval}ms)`)
    for (let i = 0; i < maxRetries; i++) {
      const result = await getStatus(taskId, apiKey)
      await updateTaskStatus(taskId, result.task_status)
      if (config.enableLogs) logger.info(`[${i + 1}/${maxRetries}] 任务状态: ${result.task_status}`)
      
      if (result.task_status === 'SUCCEED') {
        const imageUrl = result.output_images[0]
        if (config.enableLogs) logger.success(`任务完成: ${imageUrl}`)
        await updateTaskStatus(taskId, result.task_status, imageUrl)
        return imageUrl
      }
      if (result.task_status === 'FAILED') {
        if (config.enableLogs) logger.error('任务失败:', result)
        throw new Error('任务失败')
      }
      await new Promise(r => setTimeout(r, interval))
    }
    if (config.enableLogs) logger.error(`任务超时: ${taskId}`)
    throw new Error('任务超时')
  }

  // 帮助命令
  ctx.command('moda', '魔搭图片生成与编辑')
    .action(async () => {
      let help = '=== 魔搭图片生成与编辑 ===\n\n'
      
      // 文生图指令
      help += '[ 文生图指令 ]\n'
      for (const [index, model] of config.generateModels.entries()) {
        const mark = index === 0 ? '*' : ' '
        const cmd = model.register ? `moda.${model.alias}` : '-'
        help += `${mark} ${cmd}`
        if (model.description) {
          help += ` (${model.description})`
        }
        help += '\n'
      }
      help += '\n'
      
      // 图片编辑指令
      help += '[ 图片编辑指令 ]\n'
      for (const [index, model] of config.editModels.entries()) {
        const mark = index === 0 ? '*' : ' '
        const cmd = model.register ? `moda.${model.alias}` : '-'
        help += `${mark} ${cmd}`
        if (model.description) {
          help += ` (${model.description})`
        }
        help += '\n'
      }
      help += '\n'
      
      // 任务管理指令
      help += '[ 任务管理指令 ]\n'
      help += '  moda.tasks\n'
      help += '  moda.check <号>\n'
      help += '\n* 表示默认模型\n'
      
      return help
    })

  // 为编辑模型注册别名子指令
  for (const model of config.editModels) {
    if (!model.register) continue
    
    const cmdDesc = model.description || `使用 ${model.name} 编辑图片`
    ctx.command(`moda.${model.alias} <prompt:text>`, cmdDesc)
      .usage('引用包含图片的消息后使用此命令')
      .option('size', '-s <size:string> 指定图片分辨率 (如: 1024x1024)')
      .action(async ({ session, options }, prompt) => {
        if (!prompt) return '请提供编辑提示词'
        
        // 清理 prompt
        prompt = prompt.replace(/<img[^>]*>/g, '').trim()
        if (!prompt) return '请提供编辑提示词'
        
        // 获取图片
        let images = session.quote ? h.select(session.quote.elements, 'img') : []
        if (!images.length) {
          images = h.select(session.elements, 'img')
        }
        if (!images.length) {
          return '⚠️ 未找到图片。\n\n使用方式：引用包含图片的消息后发送命令'
        }
        
        try {
          const imageUrl = images[0].attrs.src
          
          // 确定使用的分辨率
          let size = options?.size || model.defaultSize
          
          // 如果启用了自动识别且没有手动指定分辨率，则自动获取原图分辨率
          if (config.autoDetectSize && !options?.size && !model.defaultSize) {
            const detectedSize = await getImageSize(imageUrl)
            if (detectedSize) {
              // 根据缩放模式处理分辨率
              size = calculateScaledSize(detectedSize)
              if (config.enableLogs) logger.info(`最终使用分辨率: ${size}`)
            }
          }
          
          if (config.enableLogs) logger.info(`用户 ${session.userId} 使用 ${model.alias} 编辑图片: ${prompt}, 分辨率: ${size || '默认'}`)
          
          // 使用消息撤回功能
          let toRecall: string[] = []
          
          // 进度消息：正在编辑
          const startMsg = formatMessage(config.msgEditStart, {
            model: model.alias,
            size: size ? ` (${size})` : ''
          })
          toRecall = await sendWithRecall(session, startMsg, config.recallEditStart, toRecall)
          
          const { taskId, apiKey } = await createTask(imageUrl, prompt, model.name, size)
          await addUserTask(session.userId, taskId, apiKey, 'edit', prompt)
          
          // 中间结果：任务已创建
          toRecall = await sendWithRecall(session, config.msgEditCreated, config.recallEditCreated, toRecall)
          
          const url = await waitTask(taskId, apiKey, config.editMaxRetries, config.editRetryInterval)
          
          if (config.enableLogs) logger.success(`图片编辑完成`)
          
          // 最终结果：图片（先撤回之前的消息，再发送图片）
          if (toRecall.length > 0) {
            for (const msgId of toRecall) {
              try {
                await session.bot.deleteMessage(session.channelId, msgId)
              } catch (e) {
                if (config.enableLogs) logger.warn(`撤回消息失败: ${e.message}`)
              }
            }
          }
          return h.image(url)
        } catch (e) {
          if (config.enableLogs) logger.error(`图片编辑失败: ${e.message}`)
          return `❌ 编辑失败: ${e.message}`
        }
      })
  }

  // 为生成模型注册别名子指令
  for (const model of config.generateModels) {
    if (!model.register) continue  // 跳过未启用注册的模型
    
    const cmdDesc = model.description || `使用 ${model.name} 生成图片`
    ctx.command(`moda.${model.alias} <prompt:text>`, cmdDesc)
      .option('size', '-s <size:string> 指定图片分辨率 (如: 1024x1024)')
      .action(async ({ session, options }, prompt) => {
        if (!prompt) return `请提供图片描述`
        
        const size = options?.size || model.defaultSize || config.defaultSize
        if (config.enableLogs) logger.info(`用户 ${session.userId} 使用 ${model.alias} 生成图片: ${prompt}, 分辨率: ${size}`)
        
        try {
          // 使用消息撤回功能
          let toRecall: string[] = []
          
          // 进度消息：正在生成
          const startMsg = formatMessage(config.msgGenerateStart, {
            model: model.alias,
            size: size ? ` (${size})` : ''
          })
          toRecall = await sendWithRecall(session, startMsg, config.recallGenerateStart, toRecall)
          
          const { taskId, apiKey } = await createTask('', prompt, model.name, size)
          
          logger.info(`准备创建任务记录 - UserID: ${session.userId}, TaskID: ${taskId}`)
          await addUserTask(session.userId, taskId, apiKey, 'generate', prompt)
          logger.info('任务记录创建完成')
          
          // 中间结果：任务已创建
          toRecall = await sendWithRecall(session, config.msgGenerateCreated, config.recallGenerateCreated, toRecall)
          
          const url = await waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
          
          if (config.enableLogs) logger.success(`图片生成完成，返回给用户 ${session.userId}`)
          
          // 最终结果：图片（先撤回之前的消息）
          if (toRecall.length > 0) {
            for (const msgId of toRecall) {
              try {
                await session.bot.deleteMessage(session.channelId, msgId)
              } catch (e) {
                if (config.enableLogs) logger.warn(`撤回消息失败: ${e.message}`)
              }
            }
          }
          return h.image(url)
        } catch (e) {
          if (config.enableLogs) logger.error(`图片生成失败: ${e.message}`)
          return `❌ 生成失败: ${e.message}`
        }
      })
  }
  
  // 格式化时间
  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (minutes < 60) return `${minutes}分${secs}秒`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}小时${mins}分`
  }

  // 查看任务状态
  ctx.command('moda.tasks', '查看我的任务状态')
    .alias('任务列表')
    .action(async ({ session }) => {
      const tasks = await ctx.database.get('moda_tasks', { userId: session.userId }, {
        sort: { id: 'desc' },
        limit: 10,
      })
      
      if (!tasks || tasks.length === 0) {
        return '📋 你还没有任何任务记录'
      }
      
      const messages: any[] = ['📋 你的任务列表：\n']
      
      for (const [index, task] of tasks.entries()) {
        // 计算实际耗时
        const endTime = task.endTime || Date.now()
        const elapsed = Math.round((endTime - task.startTime) / 1000)
        const typeText = task.type === 'edit' ? '图片编辑' : '图片生成'
        const statusEmoji = task.status === 'SUCCEED' ? '✅' : 
                           task.status === 'FAILED' ? '❌' : 
                           task.status === 'RUNNING' ? '⏳' : '🔄'
        
        let taskInfo = `\n${index + 1}. ${statusEmoji} ${typeText} [内部号#${task.id}]\n`
        taskInfo += `   提示词: ${task.prompt.substring(0, 30)}${task.prompt.length > 30 ? '...' : ''}\n`
        taskInfo += `   状态: ${task.status}\n`
        taskInfo += `   耗时: ${formatTime(elapsed)}${!task.endTime ? ' (进行中)' : ''}\n`
        
        messages.push(taskInfo)
        
        // 如果任务完成且有图片，显示缩略图
        if (task.status === 'SUCCEED' && task.imageUrl) {
          messages.push(h.image(task.imageUrl))
        }
      }
      
      messages.push('\n💡 使用 moda.check <内部号> 查看完整图片')
      return messages
    })
  
  // 查询特定任务
  ctx.command('moda.check <id:number>', '查询任务状态')
    .alias('查询任务')
    .usage('使用任务列表中显示的内部号查询')
    .action(async ({ session }, id) => {
      if (!id) return '请提供任务内部号，例如：moda.check 123'
      
      const [task] = await ctx.database.get('moda_tasks', { id, userId: session.userId })
      if (!task) return `未找到任务内部号 #${id}`
      
      try {
        const result = await getStatus(task.taskId, task.apiKey)
        await updateTaskStatus(task.taskId, result.task_status)
        
        // 重新获取任务以获得更新后的 endTime
        const [updatedTask] = await ctx.database.get('moda_tasks', { id, userId: session.userId })
        const endTime = updatedTask.endTime || Date.now()
        const elapsed = Math.round((endTime - task.startTime) / 1000)
        const typeText = task.type === 'edit' ? '图片编辑' : '图片生成'
        
        let response = `📊 任务详情 [内部号#${task.id}]\n`
        response += `任务 ID: ${task.taskId}\n\n`
        response += `类型: ${typeText}\n`
        response += `提示词: ${task.prompt}\n`
        response += `状态: ${result.task_status}\n`
        response += `耗时: ${formatTime(elapsed)}${!updatedTask.endTime ? ' (进行中)' : ''}\n`
        
        if (result.task_status === 'SUCCEED') {
          response += '\n✅ 任务已完成！'
          // 使用数据库中的图片或 API 返回的图片
          const imageUrl = task.imageUrl || result.output_images[0]
          return [response, h.image(imageUrl)]
        } else if (result.task_status === 'FAILED') {
          response += '\n❌ 任务失败'
        } else {
          response += '\n⏳ 任务进行中，请稍后再查询'
        }
        
        return response
      } catch (e) {
        return `查询失败: ${e.message}`
      }
    })

  // moda.ai 指令 - AI 自动生成提示词并选择模型
  if (config.enableAI) {
    // 监听 ChatLuna 加载（如果已加载）
    ctx.on('ready', () => {
      if (ctx.chatluna) {
        try {
          listenModel(ctx)
        } catch (e) {
          logger.error(`监听模型失败: ${e.message}`)
        }
      }
    })

    // 总是注册命令，在执行时检查
    ctx.command('moda.ai <description:text>', 'AI 自动生成提示词并生成图片')
      .usage('需要安装并配置 ChatLuna 插件')
      .action(async ({ session }, description) => {
        if (!description) return '请提供图片描述'
        
        // 检查 ChatLuna 是否可用
        if (!ctx.chatluna) {
          return '❌ ChatLuna 服务不可用，请安装 ChatLuna 插件'
        }

        if (!config.aiModel) {
          return '❌ 未配置 AI 模型，请在插件配置中选择一个模型'
        }
        
        try {
          // 使用消息撤回功能
          let toRecall: string[] = []
          
          // 进度消息：AI 分析中
          toRecall = await sendWithRecall(session, config.msgAiAnalyzing, config.recallAiAnalyzing, toRecall)
          
          // 解析模型名称
          const [platform, modelName] = config.aiModel.split('/')
          
          // 创建模型
          const modelRef = await ctx.chatluna.createChatModel(platform, modelName)
          
          if (config.enableLogs) {
            logger.info(`模型引用类型: ${typeof modelRef}`)
            logger.info(`模型引用: ${modelRef}`)
          }
          
          // 尝试获取实际模型
          const model = (modelRef as any).value || modelRef
          
          if (!model || typeof model.invoke !== 'function') {
            logger.error(`模型无效或没有 invoke 方法`)
            return '❌ 无法创建 AI 模型，请检查模型配置'
          }
          
          // 构建提示词
          const modelList = config.generateModels
            .map((m, i) => `${i + 1}. ${m.alias}: ${m.description || m.name}`)
            .join('\n')
          
          const systemPrompt = (config.aiPromptTemplate || '')
            .replace(/{description}/g, description)
            .replace(/{modelList}/g, modelList)
          
          // 调用 AI
          const response = await model.invoke(systemPrompt)
          
          // 获取响应内容
          const responseText = getMessageContent(response.content)
          
          if (config.enableLogs) logger.info(`AI 响应: ${responseText}`)
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            return '❌ AI 响应格式错误，请重试'
          }
          
          const result = JSON.parse(jsonMatch[0])
          const { prompt, model: selectedModelAlias, reason } = result
          
          // 查找模型
          const selectedModel = config.generateModels.find(m => m.alias === selectedModelAlias)
          if (!selectedModel) {
            return `❌ AI 选择的模型 "${selectedModelAlias}" 不存在`
          }
          
          // 中间结果：AI 生成的提示词
          const aiResultMsg = formatMessage(config.msgAiResult, {
            prompt: prompt,
            model: `${selectedModel.alias} (${selectedModel.description})`,
            reason: reason
          })
          toRecall = await sendWithRecall(session, aiResultMsg, config.recallAiResult, toRecall)
          
          // 生成图片
          const size = selectedModel.defaultSize || config.defaultSize
          const { taskId, apiKey } = await createTask('', prompt, selectedModel.name, size)
          await addUserTask(session.userId, taskId, apiKey, 'generate', prompt)
          
          // 中间结果：任务创建
          const taskMsg = `${config.msgTaskCreated}\n${config.msgTaskWaiting}`
          toRecall = await sendWithRecall(session, taskMsg, config.recallTaskCreated, toRecall)
          
          const url = await waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
          
          if (config.enableLogs) logger.success(`AI 生成图片完成`)
          
          // 最终结果：图片（先撤回之前的消息）
          if (toRecall.length > 0) {
            for (const msgId of toRecall) {
              try {
                await session.bot.deleteMessage(session.channelId, msgId)
              } catch (e) {
                if (config.enableLogs) logger.warn(`撤回消息失败: ${e.message}`)
              }
            }
          }
          return h.image(url)
        } catch (e) {
          logger.error(`AI 生成失败: ${e.message}`)
          return `❌ 生成失败: ${e.message}`
        }
      })
  }
}

// ChatLuna 模型监听函数（按照文档）
function listenModel(ctx: Context) {
  const getModelNames = (service: PlatformService) => {
    try {
      return service.getAllModels(ModelType.llm).map((m) => Schema.const(m))
    } catch {
      return []
    }
  }

  ctx.on('chatluna/model-added', (service) => {
    const models = getModelNames(service)
    if (models.length > 0) {
      ctx.schema.set('aiModel', Schema.union(models))
    }
  })

  ctx.on('chatluna/model-removed', (service) => {
    const models = getModelNames(service)
    if (models.length > 0) {
      ctx.schema.set('aiModel', Schema.union(models))
    }
  })

  // 初始化时设置模型列表
  if (ctx.chatluna?.platform) {
    const models = getModelNames(ctx.chatluna.platform)
    if (models.length > 0) {
      ctx.schema.set('aiModel', Schema.union(models))
    }
  }
}
