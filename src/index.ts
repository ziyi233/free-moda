import { Context, Schema, h } from 'koishi'

export const name = 'free-moda'
export const inject = ['database']

export interface Config {
  apiKeys: string[]
  editModel: string
  editMaxRetries: number
  editRetryInterval: number
  generateModel: string
  generateMaxRetries: number
  generateRetryInterval: number
  enableLogs: boolean
}

export const Config: Schema<Config> = Schema.object({
  apiKeys: Schema.array(String)
    .description('ModelScope API Token 列表\n\n获取方式：访问 https://modelscope.cn/my/myaccesstoken\n\n注意要绑定阿里云账号')
    .required(),
  editModel: Schema.string()
    .description('图片编辑模型')
    .default('Qwen/Qwen-Image-Edit'),
  editMaxRetries: Schema.number()
    .description('编辑最大重试次数 (编辑很慢，建议 120+)')
    .default(120),
  editRetryInterval: Schema.number()
    .description('编辑查询间隔(毫秒)')
    .default(10000),
  generateModel: Schema.string()
    .description('图片生成模型')
    .default('Qwen/Qwen-Image'),
  generateMaxRetries: Schema.number()
    .description('生成最大重试次数')
    .default(60),
  generateRetryInterval: Schema.number()
    .description('生成查询间隔(毫秒)')
    .default(5000),
  enableLogs: Schema.boolean()
    .description('启用控制台日志')
    .default(true),
})

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

  // 创建任务，返回 taskId 和使用的 apiKey
  async function createTask(imageUrl: string, prompt: string, model: string): Promise<{ taskId: string, apiKey: string }> {
    if (config.enableLogs) logger.info(`创建任务 - 模型: ${model}, 提示词: ${prompt}`)
    
    // 尝试所有可用的 API Key
    const maxAttempts = config.apiKeys.length
    let lastError: Error
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = getNextApiKey()
      
      try {
        const response = await ctx.http.post(
          `${baseUrl}v1/images/generations`,
          { model, prompt, image_url: imageUrl },
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

  ctx.command('moda.edit <prompt:text>', '编辑图片')
    .alias('图片编辑')
    .usage('引用包含图片的消息后使用此命令')
    .example('[引用消息] moda.edit 把头发变成蓝色')
    .action(async ({ session }, prompt) => {
      if (!prompt) return '请提供编辑提示词，例如：把头发变成蓝色'
      
      // 清理 prompt，移除图片标签
      prompt = prompt.replace(/<img[^>]*>/g, '').trim()
      if (!prompt) return '请提供编辑提示词'
      
      if (config.enableLogs) logger.info(`用户 ${session.userId} 请求编辑图片: ${prompt}`)
      
      // 优先从引用消息中获取图片
      let images = session.quote ? h.select(session.quote.elements, 'img') : []
      
      // 如果没有引用，尝试从当前消息获取
      if (!images.length) {
        images = h.select(session.elements, 'img')
      }
      
      if (!images.length) {
        if (config.enableLogs) logger.warn(`用户 ${session.userId} 未提供图片`)
        return '⚠️ 未找到图片。\n\n使用方式：引用包含图片的消息后发送：moda.edit 你的提示词'
      }
      
      try {
        const imageUrl = images[0].attrs.src
        if (config.enableLogs) logger.info(`图片 URL: ${imageUrl.substring(0, 50)}...`)
        
        await session.send('⚙️ 正在调用魔搭 API 编辑图片...')
        const { taskId, apiKey } = await createTask(imageUrl, prompt, config.editModel)
        
        logger.info(`准备创建任务记录 - UserID: ${session.userId}, TaskID: ${taskId}`)
        // 记录用户任务
        await addUserTask(session.userId, taskId, apiKey, 'edit', prompt)
        logger.info('任务记录创建完成')
        
        await session.send(`⏳ 任务已创建\n⚠️ 图片编辑通常需要 10分钟往上，请耐心等待...\n💡 使用 moda.tasks 可查看任务状态`)
        const url = await waitTask(taskId, apiKey, config.editMaxRetries, config.editRetryInterval)
        
        if (config.enableLogs) logger.success(`图片编辑完成，返回给用户 ${session.userId}`)
        return h.image(url)
      } catch (e) {
        if (config.enableLogs) logger.error(`图片编辑失败: ${e.message}`)
        return `❌ 处理失败: ${e.message}`
      }
    })

  ctx.command('moda.gen <prompt:text>', '生成图片')
    .alias('生成图片')
    .usage('根据文字描述生成图片')
    .example('moda.gen 一只可爱的紫色猫咪')
    .action(async ({ session }, prompt) => {
      if (!prompt) return '请提供图片描述，例如：一只可爱的猫咪'
      
      if (config.enableLogs) logger.info(`用户 ${session.userId} 请求生成图片: ${prompt}`)
      
      try {
        await session.send('🎨 正在生成图片...')
        const { taskId, apiKey } = await createTask('', prompt, config.generateModel)
        
        logger.info(`准备创建任务记录 - UserID: ${session.userId}, TaskID: ${taskId}`)
        // 记录用户任务
        await addUserTask(session.userId, taskId, apiKey, 'generate', prompt)
        logger.info('任务记录创建完成')
        
        await session.send(`⏳ 任务已创建，预计 10-30 秒...\n💡 使用 moda.tasks 可查看任务状态`)
        const url = await waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
        
        if (config.enableLogs) logger.success(`图片生成完成，返回给用户 ${session.userId}`)
        return h.image(url)
      } catch (e) {
        if (config.enableLogs) logger.error(`图片生成失败: ${e.message}`)
        return `❌ 生成失败: ${e.message}`
      }
    })
  
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
}
