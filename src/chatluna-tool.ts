/* eslint-disable max-len */
import { StructuredTool } from '@langchain/core/tools'
import type { ChatLunaToolRunnable } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import { Context, Session } from 'koishi'
import { z } from 'zod'
import { Config } from './config'
import { createAPI } from './api'
import { createDatabase } from './database'

export function apply(ctx: Context, config: Config, api: ReturnType<typeof createAPI>, db: ReturnType<typeof createDatabase>) {
    const logger = ctx.logger('free-moda:chatluna-tools')
    
    // 使用 ctx.plugin 创建子插件，声明对 chatluna 的依赖
    ctx.plugin({
        apply: (ctx: Context) => {
            logger.info('ChatLuna 工具注册子插件已启动')
            
            const plugin = new ChatLunaPlugin(
                ctx,
                config as unknown as ChatLunaPlugin.Config,
                'free-moda',
                false
            )

            ctx.on('ready', async () => {
                // 等待 chatluna 服务可用
                await ctx.chatluna
                logger.info('ChatLuna 服务已就绪，开始注册工具')

                if (config.registerSimpleTool) {
                    plugin.registerTool('image_generate', {
                        selector() {
                            return true
                        },
                        createTool() {
                            // @ts-ignore - Type mismatch with ChatLuna plugin system
                            return new ImageGenerateTool(ctx, config, api, db)
                        }
                    })
                    logger.success('已注册简单工具: image_generate')
                }

                if (config.registerAdvancedTool) {
                    plugin.registerTool('image_generate_advanced', {
                        selector() {
                            return true
                        },
                        createTool() {
                            // @ts-ignore - Type mismatch with ChatLuna plugin system
                            return new ImageGenerateAdvancedTool(ctx, config, api, db)
                        }
                    })
                    logger.success('已注册高级工具: image_generate_advanced')
                }
            })
            
            ctx.on('dispose', () => {
                logger.warn('ChatLuna 工具注册子插件已卸载')
            })
        },
        inject: ['chatluna'],
        name: 'free-moda:chatluna-tools'
    })
}

// 简单工具 Schema
const imageGenerateSchema = z.object({
  description: z.string().describe('User\'s natural language description of the desired image (in any language). The tool will automatically optimize the prompt and select the best model.')
})

type ImageGenerateInput = z.infer<typeof imageGenerateSchema>

// 辅助函数：从消息内容中提取文本
function getMessageContent(content: any): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text' && item.text) return item.text
    }
  }
  return String(content)
}

class ImageGenerateTool extends StructuredTool {
  name = 'image_generate'

  schema = imageGenerateSchema

  description: string

  constructor(
    private readonly ctx: Context,
    private readonly config: Config,
    private readonly api: ReturnType<typeof createAPI>,
    private readonly db: ReturnType<typeof createDatabase>
  ) {
    super({})
    this.description = config.chatLunaToolDescription
  }

  async _call(
    input: ImageGenerateInput,
    _runManager: unknown,
    runnable: ChatLunaToolRunnable
  ) {
    const session = runnable.configurable.session
    if (!session) {
      return 'Error: Session context is unavailable.'
    }

    try {
      const { description } = input

      // 检查 ChatLuna 和 AI 模型配置
      if (!this.ctx.chatluna) {
        return 'Error: ChatLuna service is not available.'
      }
      if (!this.config.aiModel) {
        return 'Error: AI model is not configured.'
      }

      // 创建 AI 模型
      const [platform, modelName] = this.config.aiModel.split('/')
      const modelRef = await this.ctx.chatluna.createChatModel(platform, modelName)
      const model = (modelRef as any).value || modelRef

      if (!model || typeof model.invoke !== 'function') {
        return 'Error: Failed to create AI model.'
      }

      // 构建模型列表
      const modelList = this.config.generateModels
        .filter(m => m.register !== false)
        .map((m, i) => {
          const parts = [`${i + 1}. alias="${m.alias}"`]
          if (m.description) parts.push(`description="${m.description}"`)
          if (m.triggerWords) parts.push(`triggerWords="${m.triggerWords}" (MUST include in prompt if selected)`)
          return parts.join(', ')
        })
        .join('\n')

      // 构建 AI 提示词
      const systemPrompt = (this.config.aiPromptTemplate || '')
        .replace(/{description}/g, description)
        .replace(/{modelList}/g, modelList)

      // 调用 AI 生成优化后的提示词和模型选择
      const response = await model.invoke(systemPrompt)
      const responseText = getMessageContent(response.content)

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return 'Error: AI response format is invalid.'
      }

      const result = JSON.parse(jsonMatch[0])
      const { prompt, model: selectedModelAlias, size: aiSize } = result

      // 查找选中的模型
      const selectedModel = this.config.generateModels.find(m => m.alias === selectedModelAlias)
      if (!selectedModel) {
        return `Error: AI selected model "${selectedModelAlias}" does not exist.`
      }

      // 确定图片尺寸
      const imageSize = aiSize || selectedModel.defaultSize || this.config.defaultSize

      // 确定负面提示词
      const negPrompt = this.config.enableNegativePrompt ? this.config.negativePrompt : undefined

      // 创建任务
      const { taskId, apiKey, requestId } = await this.api.createTask({
        imageUrl: '',
        prompt,
        model: selectedModel.name,
        size: imageSize,
        negativePrompt: negPrompt,
      })

      // 保存到数据库
      const task = await this.db.createTask({
        taskId,
        apiKey,
        type: 'generate',
        model: selectedModel.name,
        prompt,
        negativePrompt: negPrompt,
        size: imageSize,
        requestId,
      })

      // 关联用户
      await this.db.linkUserTask(session.userId, task.id)

      // 等待任务完成
      const taskResult = await this.api.waitTask(
        taskId,
        apiKey,
        this.config.generateMaxRetries,
        this.config.generateRetryInterval
      )

      // 更新数据库
      await this.db.updateTask(taskId, {
        status: 'SUCCEED',
        outputImages: JSON.stringify(taskResult.outputImages),
        resultSeed: taskResult.seed,
      })

      // 根据配置返回不同格式
      if (this.config.toolOutputMode === 'simple') {
        return taskResult.imageUrl
      } else {
        return `Successfully generated image!\nTask ID: #${task.id}\nOptimized Prompt: ${prompt}\nModel: ${selectedModel.alias} (${selectedModel.description})\nImage URL: ${taskResult.imageUrl}\nSeed: ${taskResult.seed}`
      }

    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error occurred.'
      return `Failed to generate image: ${reason}`
    }
  }
}

// 高级工具 Schema
const imageGenerateAdvancedSchema = z.object({
  prompt: z.string().describe('Detailed English prompt describing the image to generate. Include trigger words if required by the selected model.'),
  model_alias: z.string().describe('Model alias to use. REQUIRED. Choose from the model list in the tool description.'),
  size: z.string().optional().describe('Image size in format WIDTHxHEIGHT (e.g., "1024x1024"). Optional, will use model default if not specified.')
})

type ImageGenerateAdvancedInput = z.infer<typeof imageGenerateAdvancedSchema>

class ImageGenerateAdvancedTool extends StructuredTool {
  name = 'image_generate_advanced'

  schema = imageGenerateAdvancedSchema

  description: string

  constructor(
    private readonly ctx: Context,
    private readonly config: Config,
    private readonly api: ReturnType<typeof createAPI>,
    private readonly db: ReturnType<typeof createDatabase>
  ) {
    super({})
    
    // 构建模型列表
    const modelList = config.generateModels
      .filter(m => m.register !== false)
      .map((m, i) => {
        const parts = [`${i + 1}. alias="${m.alias}" (${m.name})`]
        if (m.description) parts.push(`- ${m.description}`)
        if (m.triggerWords) parts.push(`- Trigger words: "${m.triggerWords}" (MUST include in prompt)`)
        if (m.defaultSize) parts.push(`- Default size: ${m.defaultSize}`)
        return parts.join('\n   ')
      })
      .join('\n\n')
    
    // 替换变量
    this.description = config.chatLunaAdvancedToolDescription.replace(/{modelList}/g, modelList)
  }

  async _call(
    input: ImageGenerateAdvancedInput,
    _runManager: unknown,
    runnable: ChatLunaToolRunnable
  ) {
    const session = runnable.configurable.session as Session | undefined
    if (!session) {
      return 'Error: Session context is unavailable.'
    }

    try {
      const { prompt, model_alias, size } = input

      // 查找模型
      const selectedModel = this.config.generateModels.find(m => m.alias === model_alias)
      
      if (!selectedModel) {
        const availableAliases = this.config.generateModels
          .filter(m => m.register !== false)
          .map(m => m.alias)
          .join(', ')
        return `Error: Model alias "${model_alias}" not found. Available aliases: ${availableAliases}`
      }

      // 检查模型是否注册
      if (selectedModel.register === false) {
        return `Error: Model "${selectedModel.alias}" is not registered and cannot be used.`
      }

      // 检查激发词
      if (selectedModel.triggerWords) {
        const triggerWordsLower = selectedModel.triggerWords.toLowerCase()
        const promptLower = prompt.toLowerCase()
        if (!promptLower.includes(triggerWordsLower)) {
          return `Error: Model "${selectedModel.alias}" requires trigger words "${selectedModel.triggerWords}" in the prompt. Please include them and try again.`
        }
      }

      // 确定图片尺寸
      const imageSize = size || selectedModel.defaultSize || this.config.defaultSize

      // 确定负面提示词（从配置中获取）
      const negPrompt = this.config.enableNegativePrompt ? this.config.negativePrompt : undefined

      // 创建任务
      const { taskId, apiKey, requestId } = await this.api.createTask({
        imageUrl: '',
        prompt,
        model: selectedModel.name,
        size: imageSize,
        negativePrompt: negPrompt,
      })

      // 保存到数据库
      const task = await this.db.createTask({
        taskId,
        apiKey,
        type: 'generate',
        model: selectedModel.name,
        prompt,
        negativePrompt: negPrompt,
        size: imageSize,
        requestId,
      })

      // 关联用户
      await this.db.linkUserTask(session.userId, task.id)

      // 等待任务完成
      const taskResult = await this.api.waitTask(
        taskId,
        apiKey,
        this.config.generateMaxRetries,
        this.config.generateRetryInterval
      )

      // 更新数据库
      await this.db.updateTask(taskId, {
        status: 'SUCCEED',
        outputImages: JSON.stringify(taskResult.outputImages),
        resultSeed: taskResult.seed,
      })

      // 根据配置返回不同格式
      if (this.config.toolOutputMode === 'simple') {
        return taskResult.imageUrl
      } else {
        return `Successfully generated image!\nTask ID: #${task.id}\nModel: ${selectedModel.alias} (${selectedModel.description})\nImage URL: ${taskResult.imageUrl}\nSeed: ${taskResult.seed}`
      }

    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error occurred.'
      return `Failed to generate image: ${reason}`
    }
  }
}
