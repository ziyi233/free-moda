import type { Context } from 'koishi'
import type { Config } from './config'

export function createAPI(ctx: Context, config: Config, logger: any) {
  const baseUrl = 'https://api-inference.modelscope.cn/'
  
  // API Key 轮询索引
  let currentKeyIndex = 0
  
  // 获取下一个 API Key (轮询)
  function getNextApiKey(): string {
    const key = config.apiKeys[currentKeyIndex]
    currentKeyIndex = (currentKeyIndex + 1) % config.apiKeys.length
    return key
  }

  // 创建任务
  async function createTask(params: {
    imageUrl: string
    prompt: string
    model: string
    modelConfig?: { triggerWords?: string, negativePrompt?: string }  // 模型配置
    size?: string
    negativePrompt?: string
    seed?: number
    steps?: number
    guidance?: number
  }): Promise<{ taskId: string, apiKey: string, requestId?: string, finalPrompt: string, finalNegativePrompt?: string }> {
    let { imageUrl, prompt, model, modelConfig, size, negativePrompt, seed, steps, guidance } = params
    
    // 1. 处理激发词 - 自动添加到 prompt 开头
    if (modelConfig?.triggerWords) {
      const triggerWords = modelConfig.triggerWords.trim()
      // 检查是否已包含激发词（不区分大小写）
      if (!prompt.toLowerCase().includes(triggerWords.toLowerCase())) {
        prompt = `${triggerWords}, ${prompt}`
        if (config.enableLogs) {
          logger.info(`✨ 自动添加激发词: ${triggerWords}`)
        }
      }
    }
    
    // 2. 处理负面提示词 - 合并全局和模型特定的负面词
    const negativePromptParts: string[] = []
    
    // 添加全局负面词（受开关控制）
    if (config.enableNegativePrompt && config.negativePrompt) {
      negativePromptParts.push(config.negativePrompt.trim())
    }
    
    // 添加模型特定负面词（始终生效，不受全局开关控制）
    if (modelConfig?.negativePrompt) {
      negativePromptParts.push(modelConfig.negativePrompt.trim())
    }
    
    // 如果有传入的负面词参数，也加入（用于 redraw 等场景）
    if (negativePrompt) {
      negativePromptParts.push(negativePrompt.trim())
    }
    
    // 合并并去重
    const finalNegativePrompt = negativePromptParts.length > 0 
      ? [...new Set(negativePromptParts.join(', ').split(',').map(s => s.trim()))].join(', ')
      : undefined
    
    if (config.enableLogs) {
      logger.info(`创建任务 - 模型: ${model}`)
      logger.info(`📝 最终提示词: ${prompt}`)
      if (finalNegativePrompt) {
        logger.info(`🚫 负面提示词: ${finalNegativePrompt}`)
      }
    }
    
    // 尝试所有可用的 API Key
    const maxAttempts = config.apiKeys.length
    let lastError: Error
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = getNextApiKey()
      
      try {
        const requestBody: any = { model, prompt, image_url: imageUrl }
        if (size) requestBody.size = size
        if (finalNegativePrompt) requestBody.negative_prompt = finalNegativePrompt
        if (seed !== undefined) requestBody.seed = seed
        if (steps) requestBody.steps = steps
        if (guidance) requestBody.guidance = guidance
        
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
        
        if (config.enableLogs) {
          logger.success(`任务创建成功: ${response.task_id}`)
          logger.info(`响应内容: ${JSON.stringify(response)}`)
        }
        
        return { 
          taskId: response.task_id, 
          apiKey,
          requestId: response.request_id,
          finalPrompt: prompt,
          finalNegativePrompt
        }
      } catch (error) {
        lastError = error
        const errorMsg = error.message || String(error)
        if (config.enableLogs) {
          logger.warn(`API Key [${attempt + 1}/${maxAttempts}] 失败: ${errorMsg}`)
        }
        
        if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
          if (config.enableLogs) {
            logger.warn('💡 提示：Unauthorized 错误通常是因为：\n1. Token 已过期\n2. 未绑定阿里云账号\n3. Token 没有权限')
          }
        }
        
        if (attempt < maxAttempts - 1) continue
      }
    }
    
    if (lastError.message?.includes('Unauthorized') || lastError.message?.includes('401')) {
      throw new Error('认证失败：请检查 Token 是否有效，并确保已绑定阿里云账号')
    }
    
    throw lastError
  }

  // 查询任务状态
  async function getTaskStatus(taskId: string, apiKey: string) {
    return await ctx.http.get(`${baseUrl}v1/tasks/${taskId}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Task-Type': 'image_generation' 
      }
    })
  }

  // 等待任务完成
  async function waitTask(taskId: string, apiKey: string, maxRetries: number, interval: number): Promise<{
    imageUrl: string
    seed?: number
    outputImages?: string[]
  }> {
    if (config.enableLogs) logger.info(`开始等待任务完成: ${taskId}`)
    
    for (let i = 0; i < maxRetries; i++) {
      const result = await getTaskStatus(taskId, apiKey)
      
      if (result.task_status === 'SUCCEED') {
        if (config.enableLogs) {
          logger.success(`任务完成: ${taskId}`)
          logger.info(`完整响应: ${JSON.stringify(result)}`)
        }
        
        // seed 在 input 字段中
        const seed = result.input?.seed || result.seed
        
        return {
          imageUrl: result.output_images[0],
          seed: seed,
          outputImages: result.output_images
        }
      } else if (result.task_status === 'FAILED') {
        throw new Error('任务失败')
      }
      
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error('任务超时')
  }

  return {
    createTask,
    getTaskStatus,
    waitTask,
  }
}
