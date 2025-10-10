import { Context, h, Schema } from 'koishi'
import type {} from 'koishi-plugin-chatluna/services/chat'
import type { PlatformService } from 'koishi-plugin-chatluna/llm-core/platform/service'
import { ModelType } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { getMessageContent } from 'koishi-plugin-chatluna/utils/string'

// 导入模块
import { Config } from './config'
import './types'  // 导入类型声明（扩展 Tables）
import { createUtils } from './utils'
import { createAPI } from './api'
import { createDatabase } from './database'
import * as chatLunaTool from './chatluna-tool'

export const name = 'free-moda'
export const inject = {
  required: ['database'],
  optional: ['chatluna'],
}

export { Config }

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('free-moda')
  
  // 初始化模块
  const utils = createUtils(ctx, config, logger)
  const api = createAPI(ctx, config, logger)
  const db = createDatabase(ctx, logger)
  
  // 注册 ChatLuna 工具
  if (config.registerSimpleTool || config.registerAdvancedTool) {
    chatLunaTool.apply(ctx, config, api, db)
  }
  
  // 扩展数据库表
  // 任务表
  ctx.model.extend('moda_tasks', {
    id: 'unsigned',
    taskId: 'string',
    apiKey: 'string',
    type: 'string',
    // 请求参数
    model: 'string',
    prompt: 'text',
    negativePrompt: 'text',
    size: 'string',
    seed: 'unsigned',
    steps: 'unsigned',
    guidance: 'double',
    inputImageUrl: 'text',
    // 响应结果
    status: 'string',
    requestId: 'string',
    outputImages: 'text',
    resultSeed: 'unsigned',
    // 时间
    createdAt: 'double',
    completedAt: 'double',
  }, {
    autoInc: true,
    primary: 'id',
  })

  // 用户任务关联表
  ctx.model.extend('moda_user_tasks', {
    id: 'unsigned',
    userId: 'string',
    taskId: 'unsigned',
    createdAt: 'double',
  }, {
    autoInc: true,
    primary: 'id',
  })

  // 收藏表
  ctx.model.extend('moda_favorites', {
    id: 'unsigned',
    userId: 'string',
    taskId: 'unsigned',
    note: 'text',
    tags: 'text',
    favoritedAt: 'double',
  }, {
    autoInc: true,
    primary: 'id',
  })

  // 工具函数
  const { formatMessage, sendWithRecall, formatTime, formatTask, createMessageCollector } = utils

  // 图片尺寸相关
  async function getImageSize(url: string): Promise<string | null> {
    try {
      const response = await ctx.http.get(url, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(response)
      
      // 简单的 PNG/JPEG 尺寸检测
      if (buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG
        const width = buffer.readUInt32BE(16)
        const height = buffer.readUInt32BE(20)
        return `${width}x${height}`
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) { // JPEG
        let offset = 2
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xFF) break
          const marker = buffer[offset + 1]
          if (marker === 0xC0 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5)
            const width = buffer.readUInt16BE(offset + 7)
            return `${width}x${height}`
          }
          offset += 2 + buffer.readUInt16BE(offset + 2)
        }
      }
      return null
    } catch (e) {
      if (config.enableLogs) logger.warn(`获取图片尺寸失败: ${e.message}`)
      return null
    }
  }

  function calculateScaledSize(originalSize: string): string {
    const [width, height] = originalSize.split('x').map(Number)
    
    if (config.scaleMode === 'original') {
      return originalSize
    }
    
    const maxW = config.maxWidth
    const maxH = config.maxHeight
    const scaleW = maxW / width
    const scaleH = maxH / height
    const scale = Math.min(scaleW, scaleH)
    
    const newWidth = Math.floor(width * scale / 2) * 2
    const newHeight = Math.floor(height * scale / 2) * 2
    
    return `${newWidth}x${newHeight}`
  }

  // 注册主命令
  ctx.command('moda', 'ModelScope 图片生成和编辑')

  // 注册编辑模型命令
  for (const model of config.editModels) {
    if (!model.register) continue
    
    const cmdDesc = model.description || `使用 ${model.name} 编辑图片`
    ctx.command(`moda.${model.alias} <prompt:text>`, cmdDesc)
      .option('size', '-s <size:string> 指定图片分辨率')
      .action(async ({ session, options }, prompt) => {
        if (!prompt) return '请提供编辑指令'
        
        let images = session.quote ? h.select(session.quote.elements, 'img') : []
        if (!images.length) images = h.select(session.elements, 'img')
        if (!images.length) return '⚠️ 未找到图片'
        
        try {
          const imageUrl = images[0].attrs.src
          let size = options?.size || model.defaultSize
          
          if (config.autoDetectSize && !options?.size && !model.defaultSize) {
            const detectedSize = await getImageSize(imageUrl)
            if (detectedSize) size = calculateScaledSize(detectedSize)
          }
          
          const collector = createMessageCollector(session)
          
          // 编辑开始
          const startMsg = formatMessage(config.msgEditStart, {
            model: model.alias,
            size: size ? ` (${size})` : ''
          })
          await collector.add(startMsg, config.msgEditStartMode, config.recallEditStart)
          
          const { taskId, apiKey, requestId } = await api.createTask({
            imageUrl,
            prompt,
            model: model.name,
            size,
          })
          
          const task = await db.createTask({
            taskId,
            apiKey,
            type: 'edit',
            model: model.name,
            prompt,
            size,
            inputImageUrl: imageUrl,
            requestId,
          })
          await db.linkUserTask(session.userId, task.id)
          
          // 编辑任务已创建
          await collector.add(config.msgEditCreated, config.msgEditCreatedMode, config.recallEditCreated)
          
          // 立即发送合并转发消息（如果有）
          await collector.finish()
          
          const result = await api.waitTask(taskId, apiKey, config.editMaxRetries, config.editRetryInterval)
          
          await db.updateTask(taskId, {
            status: 'SUCCEED',
            outputImages: JSON.stringify(result.outputImages),
            resultSeed: result.seed,
          })
          
          // 获取任务ID用于显示
          const [dbTask] = await ctx.database.get('moda_tasks', { taskId })
          return `【#${dbTask.id}】\n` + h.image(result.imageUrl)
        } catch (e) {
          logger.error(`编辑失败: ${e.message}`)
          return `❌ 编辑失败: ${e.message}`
        }
      })
  }

  // 注册生成模型命令
  for (const model of config.generateModels) {
    if (!model.register) continue
    
    const cmdDesc = model.description || `使用 ${model.name} 生成图片`
    ctx.command(`moda.${model.alias} <prompt:text>`, cmdDesc)
      .option('size', '-s <size:string> 指定图片分辨率')
      .action(async ({ session, options }, prompt) => {
        if (!prompt) return '请提供图片描述'
        
        const size = options?.size || model.defaultSize || config.defaultSize
        
        try {
          const collector = createMessageCollector(session)
          
          // 生成开始
          const startMsg = formatMessage(config.msgGenerateStart, {
            model: model.alias,
            size: size ? ` (${size})` : ''
          })
          await collector.add(startMsg, config.msgGenerateStartMode, config.recallGenerateStart)
          
          const negPrompt = config.enableNegativePrompt ? config.negativePrompt : undefined
          const { taskId, apiKey, requestId } = await api.createTask({
            imageUrl: '',
            prompt,
            model: model.name,
            size,
            negativePrompt: negPrompt,
          })
          
          const task = await db.createTask({
            taskId,
            apiKey,
            type: 'generate',
            model: model.name,
            prompt,
            negativePrompt: negPrompt,
            size,
            requestId,
          })
          await db.linkUserTask(session.userId, task.id)
          
          // 生成任务已创建
          await collector.add(config.msgGenerateCreated, config.msgGenerateCreatedMode, config.recallGenerateCreated)
          
          // 立即发送合并转发消息（如果有）
          await collector.finish()
          
          const result = await api.waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
          
          await db.updateTask(taskId, {
            status: 'SUCCEED',
            outputImages: JSON.stringify(result.outputImages),
            resultSeed: result.seed,
          })
          
          // 获取任务ID用于显示
          const [dbTask2] = await ctx.database.get('moda_tasks', { taskId })
          return `【#${dbTask2.id}】\n` + h.image(result.imageUrl)
        } catch (e) {
          logger.error(`生成失败: ${e.message}`)
          return `❌ 生成失败: ${e.message}`
        }
      })
  }

  // 任务查询命令
  ctx.command('moda.tasks [page:number]', '查看我的任务')
    .option('detail', '-d 显示更多详细信息')
    .action(async ({ session, options }, page = 1) => {
      const perPage = config.tasksPerPage
      const offset = (page - 1) * perPage
      
      // 获取任务（多获取一个用于判断是否有下一页）
      const tasks = await db.getUserTasks(session.userId, perPage + 1, offset)
      if (tasks.length === 0) return '📭 暂无任务记录'
      
      // 分页处理
      const hasMore = tasks.length > perPage
      const displayTasks = tasks.slice(0, perPage)
      
      const template = options?.detail ? config.taskListDetailTemplate : config.taskListTemplate
      
      // 如果使用合并转发
      if (config.useForwardForTasks) {
        const forwardMessages: string[] = []
        
        for (const task of displayTasks) {
          let msg = formatTask(task, template)
          if (config.showImageInList && task.status === 'SUCCEED' && task.outputImages) {
            const images = JSON.parse(task.outputImages)
            msg += '\n' + h.image(images[0])
          }
          forwardMessages.push(msg)
        }
        
        // 添加分页提示
        let footer = `📋 最近的任务（第 ${page} 页）`
        if (hasMore) {
          footer += `\n📄 使用 moda.tasks ${page + 1} 查看下一页`
        }
        if (!options?.detail) {
          footer += '\n💡 使用 moda.tasks -d 查看更多详细信息'
        }
        forwardMessages.unshift(footer)
        
        // 构建合并转发
        const forwardNodes = `<message forward>${forwardMessages.map((msg) => 
          `<message><author id="${session.selfId}" nickname="${session.bot.user?.name || 'Bot'}"/>${msg}</message>`
        ).join('')}</message>`
        
        return forwardNodes
      }
      
      // 普通消息模式
      const messages: any[] = [`📋 最近的任务（第 ${page} 页）：\n`]
      
      for (const task of displayTasks) {
        const info = '\n' + formatTask(task, template)
        messages.push(info)
        
        if (config.showImageInList && task.status === 'SUCCEED' && task.outputImages) {
          const images = JSON.parse(task.outputImages)
          messages.push(h.image(images[0]))
        }
      }
      
      // 分页提示
      let footer = ''
      if (hasMore) {
        footer += `\n📄 使用 moda.tasks ${page + 1} 查看下一页`
      }
      if (!options?.detail) {
        footer += '\n💡 使用 moda.tasks -d 查看更多详细信息'
      }
      if (footer) messages.push(footer)
      
      return messages
    })

  // 任务详情命令
  ctx.command('moda.info <id:number>', '查看任务详情')
    .action(async ({ session }, id) => {
      if (!id) return '请提供任务ID'
      
      const taskInfo = await db.getTaskById(id, session.userId)
      if (!taskInfo) return '❌ 任务不存在或无权访问'
      
      const isFav = await db.isFavorited(session.userId, id)
      const response = formatTask(taskInfo, config.taskInfoTemplate, isFav)
      
      // 如果使用合并转发
      if (config.useForwardForInfo) {
        const forwardMessages: any[] = [response]
        
        if (config.showImageInDetail && taskInfo.status === 'SUCCEED' && taskInfo.outputImages) {
          const images = JSON.parse(taskInfo.outputImages)
          forwardMessages.push(String(h.image(images[0])))
        }
        
        // 构建合并转发
        const forwardNodes = `<message forward>${forwardMessages.map((msg) => 
          `<message><author id="${session.selfId}" nickname="${session.bot.user?.name || 'Bot'}"/>${msg}</message>`
        ).join('')}</message>`
        
        return forwardNodes
      }
      
      // 普通消息模式
      if (config.showImageInDetail && taskInfo.status === 'SUCCEED' && taskInfo.outputImages) {
        const images = JSON.parse(taskInfo.outputImages)
        return [response, h.image(images[0])]
      }
      
      return response
    })

  // 收藏命令
  ctx.command('moda.fav <id:number>', '收藏图片')
    .action(async ({ session }, id) => {
      if (!id) return '请提供任务ID'
      
      try {
        await db.addFavorite(session.userId, id)
        return `⭐ 已收藏 #${id}`
      } catch (e) {
        if (e.message.includes('已经收藏')) {
          return '⚠️ 已经收藏过了'
        }
        return `❌ 收藏失败: ${e.message}`
      }
    })

  // 取消收藏命令
  ctx.command('moda.unfav <id:number>', '取消收藏')
    .action(async ({ session }, id) => {
      if (!id) return '请提供任务ID'
      
      const isFav = await db.isFavorited(session.userId, id)
      if (!isFav) {
        return '⚠️ 该任务未收藏'
      }
      
      await db.removeFavorite(session.userId, id)
      return `已取消收藏 #${id}`
    })

  // 清空收藏命令
  ctx.command('moda.clearfav', '清空所有收藏')
    .option('confirm', '-c 确认清空（必须）')
    .action(async ({ session, options }) => {
      if (!options?.confirm) {
        return '⚠️ 此操作将清空所有收藏，无法恢复！\n请使用 moda.clearfav -c 确认执行'
      }
      
      const count = await db.clearAllFavorites(session.userId)
      
      if (count === 0) {
        return '📭 没有收藏需要清空'
      }
      
      return `✅ 已清空 ${count} 个收藏`
    })

  // 重绘命令
  ctx.command('moda.redraw <id:number>', '使用相同参数重新生成')
    .option('seed', '-s <seed:number> 覆盖原 seed')
    .action(async ({ session, options }, id) => {
      if (!id) return '请提供任务ID'
      
      const originalTask = await db.getTaskByIdNoAuth(id)
      if (!originalTask) return '❌ 任务不存在'
      
      try {
        const collector = createMessageCollector(session)
        
        // 开始消息
        const startMsg = formatMessage(
          originalTask.type === 'edit' ? config.msgEditStart : config.msgGenerateStart,
          {
            model: originalTask.model,
            size: originalTask.size ? ` (${originalTask.size})` : ''
          }
        )
        const startMode = originalTask.type === 'edit' ? config.msgEditStartMode : config.msgGenerateStartMode
        const startRecall = originalTask.type === 'edit' ? config.recallEditStart : config.recallGenerateStart
        await collector.add(startMsg, startMode, startRecall)
        
        // 构建请求参数，只包含有效值
        const requestParams: any = {
          imageUrl: originalTask.inputImageUrl || '',
          prompt: originalTask.prompt,
          model: originalTask.model,
        }
        
        // 只添加非空且非0的参数
        if (originalTask.size) requestParams.size = originalTask.size
        if (originalTask.negativePrompt) requestParams.negativePrompt = originalTask.negativePrompt
        
        // seed 处理：优先使用命令行参数，否则使用原任务的 resultSeed（API 返回的实际 seed）
        const useSeed = options?.seed !== undefined ? options.seed : originalTask.resultSeed
        if (useSeed && useSeed > 0) requestParams.seed = useSeed
        
        if (originalTask.steps && originalTask.steps > 0) requestParams.steps = originalTask.steps
        if (originalTask.guidance && originalTask.guidance > 0) requestParams.guidance = originalTask.guidance
        
        const { taskId, apiKey, requestId } = await api.createTask(requestParams)
        
        const task = await db.createTask({
          taskId,
          apiKey,
          type: originalTask.type,
          model: originalTask.model,
          prompt: originalTask.prompt,
          negativePrompt: originalTask.negativePrompt,
          size: originalTask.size,
          seed: useSeed,
          steps: originalTask.steps,
          guidance: originalTask.guidance,
          inputImageUrl: originalTask.inputImageUrl,
          requestId,
        })
        await db.linkUserTask(session.userId, task.id)
        
        // 任务已创建消息
        const createdMsg = originalTask.type === 'edit' ? config.msgEditCreated : config.msgGenerateCreated
        const createdMode = originalTask.type === 'edit' ? config.msgEditCreatedMode : config.msgGenerateCreatedMode
        const createdRecall = originalTask.type === 'edit' ? config.recallEditCreated : config.recallGenerateCreated
        await collector.add(createdMsg, createdMode, createdRecall)
        
        // 立即发送合并转发消息（如果有）
        await collector.finish()
        
        const maxRetries = originalTask.type === 'edit' ? config.editMaxRetries : config.generateMaxRetries
        const interval = originalTask.type === 'edit' ? config.editRetryInterval : config.generateRetryInterval
        const result = await api.waitTask(taskId, apiKey, maxRetries, interval)
        
        await db.updateTask(taskId, {
          status: 'SUCCEED',
          outputImages: JSON.stringify(result.outputImages),
          resultSeed: result.seed,
        })
        
        const [dbTask] = await ctx.database.get('moda_tasks', { taskId })
        return `【#${dbTask.id}】（重绘自 #${id}）\n` + h.image(result.imageUrl)
      } catch (e) {
        logger.error(`重绘失败: ${e.message}`)
        return `❌ 重绘失败: ${e.message}`
      }
    })

  // 查看收藏命令
  ctx.command('moda.favs [page:number]', '查看我的收藏')
    .option('detail', '-d 显示更多详细信息')
    .action(async ({ session, options }, page = 1) => {
      const perPage = config.favsPerPage
      const offset = (page - 1) * perPage
      
      // 获取收藏（多获取一个用于判断是否有下一页）
      const favorites = await db.getUserFavorites(session.userId, perPage + 1, offset)
      if (favorites.length === 0) return '📭 暂无收藏'
      
      // 分页处理
      const hasMore = favorites.length > perPage
      const displayFavs = favorites.slice(0, perPage)
      
      const template = options?.detail ? config.favListDetailTemplate : config.favListTemplate
      
      // 如果使用合并转发
      if (config.useForwardForFavs) {
        const forwardMessages: string[] = []
        
        for (const task of displayFavs) {
          let msg = formatTask(task, template)
          if (config.showImageInList && task.status === 'SUCCEED' && task.outputImages) {
            const images = JSON.parse(task.outputImages)
            msg += '\n' + h.image(images[0])
          }
          forwardMessages.push(msg)
        }
        
        // 添加分页提示
        let footer = `⭐ 我的收藏（第 ${page} 页）`
        if (hasMore) {
          footer += `\n📄 使用 moda.favs ${page + 1} 查看下一页`
        }
        if (!options?.detail) {
          footer += '\n💡 使用 moda.favs -d 查看更多详细信息'
        }
        forwardMessages.unshift(footer)
        
        // 构建合并转发
        const forwardNodes = `<message forward>${forwardMessages.map((msg) => 
          `<message><author id="${session.selfId}" nickname="${session.bot.user?.name || 'Bot'}"/>${msg}</message>`
        ).join('')}</message>`
        
        return forwardNodes
      }
      
      // 普通消息模式
      const messages: any[] = [`⭐ 我的收藏（第 ${page} 页）：\n`]
      
      for (const task of displayFavs) {
        const info = '\n' + formatTask(task, template)
        messages.push(info)
        
        if (config.showImageInList && task.status === 'SUCCEED' && task.outputImages) {
          const images = JSON.parse(task.outputImages)
          messages.push(h.image(images[0]))
        }
      }
      
      // 分页提示
      let footer = ''
      if (hasMore) {
        footer += `\n📄 使用 moda.favs ${page + 1} 查看下一页`
      }
      if (!options?.detail) {
        footer += '\n💡 使用 moda.favs -d 查看更多详细信息'
      }
      if (footer) messages.push(footer)
      
      return messages
    })

  // AI 命令（如果启用）
  if (config.enableAI) {
    // 监听 ChatLuna 模型
    ctx.on('ready', () => {
      if (ctx.chatluna) {
        try {
          listenModel(ctx, config, logger)
        } catch (e) {
          logger.error(`监听模型失败: ${e.message}`)
        }
      }
    })

    ctx.command('moda.ai <description:text>', 'AI 自动生成提示词并生成图片')
      .usage('需要安装并配置 ChatLuna 插件')
      .action(async ({ session }, description) => {
        if (!description) return '请提供图片描述'
        if (!ctx.chatluna) return '❌ ChatLuna 服务不可用'
        if (!config.aiModel) return '❌ 未配置 AI 模型'
        
        try {
          const collector = createMessageCollector(session)
          
          // AI 分析中
          await collector.add(config.msgAiAnalyzing, config.msgAiAnalyzingMode, config.recallAiAnalyzing)
          
          const [platform, modelName] = config.aiModel.split('/')
          const modelRef = await ctx.chatluna.createChatModel(platform, modelName)
          const model = (modelRef as any).value || modelRef
          
          if (!model || typeof model.invoke !== 'function') {
            return '❌ 无法创建 AI 模型'
          }
          
          const modelList = config.generateModels
            .filter(m => m.register !== false)  // 只包含已注册的模型
            .map((m, i) => {
              const parts = [`${i + 1}. alias="${m.alias}"`]
              if (m.description) parts.push(`description="${m.description}"`)
              if (m.triggerWords) parts.push(`triggerWords="${m.triggerWords}" (MUST include in prompt if selected)`)
              return parts.join(', ')
            })
            .join('\n')
          
          const systemPrompt = (config.aiPromptTemplate || '')
            .replace(/{description}/g, description)
            .replace(/{modelList}/g, modelList)
          
          const response = await model.invoke(systemPrompt)
          const responseText = getMessageContent(response.content)
          
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (!jsonMatch) return '❌ AI 响应格式错误'
          
          const result = JSON.parse(jsonMatch[0])
          const { prompt, model: selectedModelAlias, size: aiSize, reason } = result
          
          const selectedModel = config.generateModels.find(m => m.alias === selectedModelAlias)
          if (!selectedModel) return `❌ AI 选择的模型 "${selectedModelAlias}" 不存在`
          
          // AI 结果
          const aiResultMsg = formatMessage(config.msgAiResult, {
            prompt: prompt,
            model: `${selectedModel.alias} (${selectedModel.description})`,
            reason: reason
          })
          await collector.add(aiResultMsg, config.msgAiResultMode, config.recallAiResult)
          
          // 优先使用 AI 指定的 size，其次是模型默认，最后是全局默认
          const size = aiSize || selectedModel.defaultSize || config.defaultSize
          const negPrompt = config.enableNegativePrompt ? config.negativePrompt : undefined
          const { taskId, apiKey, requestId } = await api.createTask({
            imageUrl: '',
            prompt,
            model: selectedModel.name,
            size,
            negativePrompt: negPrompt,
          })
          
          const task = await db.createTask({
            taskId,
            apiKey,
            type: 'generate',
            model: selectedModel.name,
            prompt,
            negativePrompt: negPrompt,
            size,
            requestId,
          })
          await db.linkUserTask(session.userId, task.id)
          
          // 任务已创建
          const taskMsg = `${config.msgTaskCreated}\n${config.msgTaskWaiting}`
          await collector.add(taskMsg, config.msgTaskCreatedMode, config.recallTaskCreated)
          
          // 立即发送合并转发消息（如果有）
          await collector.finish()
          
          const taskResult = await api.waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
          
          await db.updateTask(taskId, {
            status: 'SUCCEED',
            outputImages: JSON.stringify(taskResult.outputImages),
            resultSeed: taskResult.seed,
          })
          
          const [dbTask3] = await ctx.database.get('moda_tasks', { taskId })
          return `【#${dbTask3.id}】\n` + h.image(taskResult.imageUrl)
        } catch (e) {
          logger.error(`AI 生成失败: ${e.message}`)
          return `❌ 生成失败: ${e.message}`
        }
      })
  }
}

// ChatLuna 模型监听
function listenModel(ctx: Context, config: any, logger: any) {
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

  if (ctx.chatluna?.platform) {
    const models = getModelNames(ctx.chatluna.platform)
    if (models.length > 0) {
      ctx.schema.set('aiModel', Schema.union(models))
    }
  }
}
