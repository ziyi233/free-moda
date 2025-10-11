import type { Context } from 'koishi'
import type { Config } from './config'

export function setupApiServer(ctx: Context, config: Config, api: any, db: any, logger: any) {
  if (!config.enableApiServer) return
  
  // 使用 ctx.server（Koishi HTTP 服务）
  const server = (ctx as any).server
  if (!server) {
    logger.warn('HTTP API 服务需要 server 服务，请确保已启用 Koishi HTTP 服务')
    return
  }
  
  // GET /moda/generate - 生成图片并重定向
  server.get('/moda/generate', async (koaCtx) => {
    try {
      const { prompt, model, size, negativePrompt, seed } = koaCtx.query
      
      if (!prompt) {
        koaCtx.status = 400
        koaCtx.body = { error: '缺少 prompt 参数' }
        return
      }
      
      // 查找模型配置
      const modelName = model as string || config.generateModels[0]?.name
      const modelConfig = config.generateModels.find(m => m.name === modelName || m.alias === modelName)
      
      if (!modelConfig) {
        koaCtx.status = 400
        koaCtx.body = { error: `模型不存在: ${modelName}` }
        return
      }
      
      // 确定分辨率
      const finalSize = (size as string) || modelConfig.defaultSize || config.defaultSize
      
      if (config.enableLogs) {
        logger.info(`[API] 收到生成请求: ${prompt}`)
      }
      
      // 创建任务
      const { taskId, apiKey, requestId, finalPrompt, finalNegativePrompt } = await api.createTask({
        imageUrl: '',
        prompt: prompt as string,
        model: modelConfig.name,
        modelConfig: { 
          triggerWords: modelConfig.triggerWords, 
          negativePrompt: modelConfig.negativePrompt 
        },
        size: finalSize,
        negativePrompt: negativePrompt as string,
        seed: seed ? parseInt(seed as string) : undefined,
      })
      
      // 保存到数据库
      const task = await db.createTask({
        taskId,
        apiKey,
        type: 'generate',
        model: modelConfig.name,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        size: finalSize,
        seed: seed ? parseInt(seed as string) : undefined,
        requestId,
      })
      
      if (config.enableLogs) {
        logger.info(`[API] 任务已创建: ${taskId}`)
      }
      
      // 等待任务完成
      const result = await api.waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
      
      // 更新任务状态
      await db.updateTask(taskId, {
        status: 'SUCCEED',
        outputImages: JSON.stringify(result.outputImages),
        resultSeed: result.seed,
      })
      
      if (config.enableLogs) {
        logger.success(`[API] 任务完成，重定向到图片: ${result.imageUrl}`)
      }
      
      // 重定向到图片 URL
      koaCtx.redirect(result.imageUrl)
      
    } catch (error) {
      logger.error(`[API] 生成失败: ${error.message}`)
      koaCtx.status = 500
      koaCtx.body = { error: error.message }
    }
  })
  
  // GET /moda/edit - 编辑图片并重定向
  server.get('/moda/edit', async (koaCtx) => {
    try {
      const { prompt, imageUrl, model, size } = koaCtx.query
      
      if (!prompt || !imageUrl) {
        koaCtx.status = 400
        koaCtx.body = { error: '缺少 prompt 或 imageUrl 参数' }
        return
      }
      
      // 查找模型配置
      const modelName = model as string || config.editModels[0]?.name
      const modelConfig = config.editModels.find(m => m.name === modelName || m.alias === modelName)
      
      if (!modelConfig) {
        koaCtx.status = 400
        koaCtx.body = { error: `模型不存在: ${modelName}` }
        return
      }
      
      // 确定分辨率
      const finalSize = (size as string) || modelConfig.defaultSize
      
      if (config.enableLogs) {
        logger.info(`[API] 收到编辑请求: ${prompt}`)
      }
      
      // 创建任务
      const { taskId, apiKey, requestId, finalPrompt, finalNegativePrompt } = await api.createTask({
        imageUrl: imageUrl as string,
        prompt: prompt as string,
        model: modelConfig.name,
        modelConfig: { 
          triggerWords: modelConfig.triggerWords, 
          negativePrompt: modelConfig.negativePrompt 
        },
        size: finalSize,
      })
      
      // 保存到数据库
      const task = await db.createTask({
        taskId,
        apiKey,
        type: 'edit',
        model: modelConfig.name,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        size: finalSize,
        inputImageUrl: imageUrl as string,
        requestId,
      })
      
      if (config.enableLogs) {
        logger.info(`[API] 任务已创建: ${taskId}`)
      }
      
      // 等待任务完成
      const result = await api.waitTask(taskId, apiKey, config.editMaxRetries, config.editRetryInterval)
      
      // 更新任务状态
      await db.updateTask(taskId, {
        status: 'SUCCEED',
        outputImages: JSON.stringify(result.outputImages),
        resultSeed: result.seed,
      })
      
      if (config.enableLogs) {
        logger.success(`[API] 任务完成，重定向到图片: ${result.imageUrl}`)
      }
      
      // 重定向到图片 URL
      koaCtx.redirect(result.imageUrl)
      
    } catch (error) {
      logger.error(`[API] 编辑失败: ${error.message}`)
      koaCtx.status = 500
      koaCtx.body = { error: error.message }
    }
  })
  
  // GET /moda/ai - AI 生成图片并重定向
  server.get('/moda/ai', async (koaCtx) => {
    try {
      const { prompt } = koaCtx.query
      
      if (!prompt) {
        koaCtx.status = 400
        koaCtx.body = { error: '缺少 prompt 参数' }
        return
      }
      
      // 检查是否启用 AI
      if (!config.enableAI) {
        koaCtx.status = 400
        koaCtx.body = { error: 'AI 功能未启用，请在配置中启用' }
        return
      }
      
      // 检查 ChatLuna 服务
      if (!ctx.chatluna) {
        koaCtx.status = 400
        koaCtx.body = { error: '需要安装 koishi-plugin-chatluna' }
        return
      }
      
      if (config.enableLogs) {
        logger.info(`[API] 收到 AI 生成请求: ${prompt}`)
      }
      
      // 调用 AI 生成提示词
      const [platform, modelName] = config.aiModel.split('/')
      const modelRef = await ctx.chatluna.createChatModel(platform, modelName)
      const model = (modelRef as any).value || modelRef
      
      if (!model || typeof model.invoke !== 'function') {
        koaCtx.status = 500
        koaCtx.body = { error: '无法创建 AI 模型' }
        return
      }
      
      const modelList = config.generateModels
        .filter(m => m.register !== false)
        .map((m, i) => {
          const parts = [`${i + 1}. alias="${m.alias}"`]
          if (m.description) parts.push(`description="${m.description}"`)
          if (m.triggerWords) parts.push(`triggerWords="${m.triggerWords}" (MUST include in prompt if selected)`)
          return parts.join(', ')
        })
        .join('\n')
      
      const aiPrompt = config.aiPromptTemplate
        .replace(/{description}/g, prompt as string)
        .replace(/{modelList}/g, modelList)
      
      const response = await model.invoke(aiPrompt)
      const aiResponse = typeof response === 'string' ? response : response.content
      
      if (config.enableLogs) {
        logger.info(`[API] AI 原始响应: ${aiResponse}`)
      }
      
      // 解析 AI 响应 - 支持多种格式
      let finalPrompt: string
      let modelAlias: string
      let aiSize: string | undefined
      let reason: string
      
      // 尝试解析 JSON 格式
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          finalPrompt = parsed.prompt || parsed.Prompt
          modelAlias = parsed.model || parsed.Model || config.generateModels[0]?.alias
          aiSize = parsed.size || parsed.Size
          reason = parsed.reason || parsed.Reason || '未提供'
        } else {
          throw new Error('Not JSON format')
        }
      } catch {
        // 尝试解析文本格式
        const promptMatch = aiResponse.match(/prompt:\s*(.+?)(?=\n|model:|size:|reason:|$)/is)
        const modelMatch = aiResponse.match(/model:\s*(.+?)(?=\n|prompt:|size:|reason:|$)/is)
        const sizeMatch = aiResponse.match(/size:\s*(.+?)(?=\n|prompt:|model:|reason:|$)/is)
        const reasonMatch = aiResponse.match(/reason:\s*(.+?)(?=\n|prompt:|model:|size:|$)/is)
        
        if (!promptMatch) {
          koaCtx.status = 500
          koaCtx.body = { error: 'AI 未能生成有效的提示词', aiResponse }
          return
        }
        
        finalPrompt = promptMatch[1].trim()
        modelAlias = modelMatch ? modelMatch[1].trim() : config.generateModels[0]?.alias
        aiSize = sizeMatch ? sizeMatch[1].trim() : undefined
        reason = reasonMatch ? reasonMatch[1].trim() : '未提供'
      }
      
      // 查找模型配置
      const modelConfig = config.generateModels.find(m => m.alias === modelAlias || m.name === modelAlias)
      if (!modelConfig) {
        koaCtx.status = 400
        koaCtx.body = { error: `AI 选择的模型不存在: ${modelAlias}` }
        return
      }
      
      // 确定分辨率
      const finalSize = aiSize || modelConfig.defaultSize || config.defaultSize
      
      if (config.enableLogs) {
        logger.info(`[API] AI 生成提示词: ${finalPrompt}`)
        logger.info(`[API] AI 选择模型: ${modelConfig.alias}`)
        logger.info(`[API] AI 理由: ${reason}`)
      }
      
      // 创建任务
      const { taskId, apiKey, requestId, finalPrompt: processedPrompt, finalNegativePrompt } = await api.createTask({
        imageUrl: '',
        prompt: finalPrompt,
        model: modelConfig.name,
        modelConfig: { 
          triggerWords: modelConfig.triggerWords, 
          negativePrompt: modelConfig.negativePrompt 
        },
        size: finalSize,
      })
      
      // 保存到数据库
      const task = await db.createTask({
        taskId,
        apiKey,
        type: 'generate',
        model: modelConfig.name,
        prompt: processedPrompt,
        negativePrompt: finalNegativePrompt,
        size: finalSize,
        requestId,
      })
      
      if (config.enableLogs) {
        logger.info(`[API] 任务已创建: ${taskId}`)
      }
      
      // 等待任务完成
      const result = await api.waitTask(taskId, apiKey, config.generateMaxRetries, config.generateRetryInterval)
      
      // 更新任务状态
      await db.updateTask(taskId, {
        status: 'SUCCEED',
        outputImages: JSON.stringify(result.outputImages),
        resultSeed: result.seed,
      })
      
      if (config.enableLogs) {
        logger.success(`[API] 任务完成，重定向到图片: ${result.imageUrl}`)
      }
      
      // 重定向到图片 URL
      koaCtx.redirect(result.imageUrl)
      
    } catch (error) {
      logger.error(`[API] AI 生成失败: ${error.message}`)
      koaCtx.status = 500
      koaCtx.body = { error: error.message }
    }
  })
  
  if (config.enableLogs) {
    // 获取实际的服务器地址
    let baseUrl = config.apiBaseUrl
    if (!baseUrl) {
      const serverConfig = server.config || {}
      const selfUrl = serverConfig.selfUrl
      const host = serverConfig.host || '0.0.0.0'
      const port = serverConfig.port || 5140
      
      if (selfUrl) {
        baseUrl = selfUrl.replace(/\/$/, '')
      } else {
        // 如果监听 0.0.0.0，建议使用 127.0.0.1 或实际 IP
        const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
        baseUrl = `http://${displayHost}:${port}`
      }
    }
    
    logger.success('HTTP API 服务已启动')
    logger.info(`基础 URL: ${baseUrl}`)
    logger.info(`GET ${baseUrl}/moda/generate?prompt=xxx&model=xxx&size=xxx`)
    logger.info(`GET ${baseUrl}/moda/edit?prompt=xxx&imageUrl=xxx&model=xxx&size=xxx`)
    logger.info(`GET ${baseUrl}/moda/ai?prompt=xxx (需要启用 AI 功能)`)
    
    // 显示替换后的使用说明
    const instructions = config.apiServerInstructions.replace(/{baseUrl}/g, baseUrl)
    logger.info('--- 复制以下内容给 AI 使用 ---')
    logger.info('\n' + instructions + '\n')
    logger.info('--- 使用说明结束 ---')
  }
}
