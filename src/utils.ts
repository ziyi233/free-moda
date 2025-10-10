import type { Context, Session } from 'koishi'
import type { Config } from './config'
import type { ModaTask } from './types'

// 消息收集器类 - 用于收集合并转发消息
export class MessageCollector {
  private messages: Array<{ content: string, mode: 'send' | 'forward' }> = []
  private sentMsgIds: string[] = []
  
  constructor(
    private session: Session,
    private config: Config,
    private logger: any
  ) {}
  
  // 添加消息
  async add(content: string, mode: 'send' | 'forward', shouldRecall: boolean) {
    if (mode === 'send') {
      // 单独发送模式 - 立即发送
      const msgIds = await this.session.send(content)
      if (shouldRecall) {
        this.sentMsgIds.push(...msgIds)
      }
    } else {
      // 合并转发模式 - 收集消息
      this.messages.push({ content, mode })
    }
  }
  
  // 发送收集的合并转发消息
  async sendForward() {
    if (this.messages.length === 0) return
    
    try {
      // 构建合并转发消息节点
      const forwardNodes = `<message forward>${this.messages.map((msg) => 
        `<message><author id="${this.session.selfId}" nickname="${this.session.bot.user?.name || 'Bot'}"/>${msg.content}</message>`
      ).join('')}</message>`
      
      // 发送合并转发
      await this.session.send(forwardNodes)
      
      this.messages = []
    } catch (e) {
      if (this.config.enableLogs) {
        this.logger.warn(`发送合并转发消息失败: ${e.message}，降级为普通消息`)
      }
      // 失败时降级为普通消息
      for (const msg of this.messages) {
        await this.session.send(msg.content)
      }
      this.messages = []
    }
  }
  
  // 撤回之前发送的消息
  async recallAll() {
    for (const msgId of this.sentMsgIds) {
      try {
        await this.session.bot.deleteMessage(this.session.channelId, msgId)
      } catch (e) {
        if (this.config.enableLogs) {
          this.logger.warn(`撤回消息失败: ${e.message}`)
        }
      }
    }
    this.sentMsgIds = []
  }
  
  // 完成并清理（发送合并转发消息，撤回需要撤回的消息）
  async finish() {
    await this.sendForward()
    await this.recallAll()
  }
}

export function createUtils(ctx: Context, config: Config, logger: any) {
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

  // 格式化时间
  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}分${secs}秒`
  }

  // 格式化任务信息（使用模板）
  function formatTask(task: ModaTask, template: string, isFavorited?: boolean): string {
    const elapsed = task.completedAt 
      ? Math.round((task.completedAt - task.createdAt) / 1000)
      : Math.round((Date.now() - task.createdAt) / 1000)
    
    const typeText = task.type === 'edit' ? '图片编辑' : '图片生成'
    const statusEmoji = task.status === 'SUCCEED' ? '✅' : task.status === 'FAILED' ? '❌' : '⏳'
    const createdDate = new Date(task.createdAt).toLocaleString('zh-CN')
    
    // 处理可能为空的字段
    const vars: Record<string, string> = {
      status: statusEmoji,
      id: String(task.id),
      type: typeText,
      prompt: task.prompt || '',
      seed: task.resultSeed ? String(task.resultSeed) : '无',
      model: task.model || '',
      time: formatTime(elapsed),
      size: task.size || '未指定',
      negativePrompt: task.negativePrompt ? task.negativePrompt.substring(0, 50) + (task.negativePrompt.length > 50 ? '...' : '') : '无',
      date: createdDate,
      favorited: isFavorited !== undefined ? (isFavorited ? '⭐ 已收藏' : '未收藏') : '',
    }
    
    return formatMessage(template, vars)
  }

  // 创建消息收集器
  function createMessageCollector(session: Session) {
    return new MessageCollector(session, config, logger)
  }

  return {
    formatMessage,
    sendWithRecall,
    formatTime,
    formatTask,
    createMessageCollector,
  }
}
