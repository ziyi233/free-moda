import type { Context } from 'koishi'
import type { Config } from './config'
import type { ModaTask } from './types'

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

  return {
    formatMessage,
    sendWithRecall,
    formatTime,
    formatTask,
  }
}
