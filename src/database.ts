import type { Context } from 'koishi'
import type { ModaTask, ModaUserTask, ModaFavorite } from './types'

export function createDatabase(ctx: Context, logger: any) {
  // 创建任务记录
  async function createTask(data: Partial<ModaTask>): Promise<ModaTask> {
    try {
      const task = await ctx.database.create('moda_tasks', {
        ...data,
        createdAt: Date.now(),
        status: 'PENDING',
      })
      logger.success(`任务记录已创建: ID=${task.id}, TaskID=${data.taskId}`)
      return task
    } catch (error) {
      logger.error('创建任务记录失败:', error)
      throw error
    }
  }

  // 关联用户和任务
  async function linkUserTask(userId: string, taskId: number): Promise<ModaUserTask> {
    return await ctx.database.create('moda_user_tasks', {
      userId,
      taskId,
      createdAt: Date.now(),
    })
  }

  // 更新任务状态
  async function updateTask(taskId: string, update: Partial<ModaTask>) {
    const [currentTask] = await ctx.database.get('moda_tasks', { taskId })
    
    // 只在状态首次变为完成或失败时记录完成时间
    if ((update.status === 'SUCCEED' || update.status === 'FAILED') && !currentTask?.completedAt) {
      update.completedAt = Date.now()
    }
    
    await ctx.database.set('moda_tasks', { taskId }, update)
  }

  // 根据ID获取任务（带用户验证）
  async function getTaskById(id: number, userId: string): Promise<ModaTask | null> {
    // 先查用户是否有权限
    const [userTask] = await ctx.database.get('moda_user_tasks', { taskId: id, userId })
    if (!userTask) return null
    
    const [task] = await ctx.database.get('moda_tasks', { id })
    return task || null
  }

  // 根据ID获取任务（不检查权限）
  async function getTaskByIdNoAuth(id: number): Promise<ModaTask | null> {
    const [task] = await ctx.database.get('moda_tasks', { id })
    return task || null
  }

  // 获取用户的所有任务
  async function getUserTasks(userId: string, limit = 10, offset = 0): Promise<ModaTask[]> {
    // 先获取用户的任务ID列表
    const userTasks = await ctx.database
      .select('moda_user_tasks')
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()
    
    if (userTasks.length === 0) return []
    
    const taskIds = userTasks.map(ut => ut.taskId)
    return await ctx.database.get('moda_tasks', { id: taskIds })
  }

  // 添加收藏
  async function addFavorite(userId: string, taskId: number, note?: string): Promise<ModaFavorite> {
    // 检查是否已收藏
    const [existing] = await ctx.database.get('moda_favorites', { userId, taskId })
    if (existing) {
      throw new Error('已经收藏过了')
    }
    
    return await ctx.database.create('moda_favorites', {
      userId,
      taskId,
      note,
      favoritedAt: Date.now(),
    })
  }

  // 取消收藏
  async function removeFavorite(userId: string, taskId: number) {
    await ctx.database.remove('moda_favorites', { userId, taskId })
  }

  // 清空所有收藏
  async function clearAllFavorites(userId: string): Promise<number> {
    const result = await ctx.database.remove('moda_favorites', { userId })
    return result.removed || 0
  }

  // 获取用户的收藏
  async function getUserFavorites(userId: string, limit = 20, offset = 0): Promise<ModaTask[]> {
    // 先获取收藏的任务ID列表
    const favorites = await ctx.database
      .select('moda_favorites')
      .where({ userId })
      .orderBy('favoritedAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()
    
    if (favorites.length === 0) return []
    
    const taskIds = favorites.map(f => f.taskId)
    return await ctx.database.get('moda_tasks', { id: taskIds })
  }

  // 检查是否已收藏
  async function isFavorited(userId: string, taskId: number): Promise<boolean> {
    const [favorite] = await ctx.database.get('moda_favorites', { userId, taskId })
    return !!favorite
  }

  return {
    createTask,
    linkUserTask,
    updateTask,
    getTaskById,
    getTaskByIdNoAuth,
    getUserTasks,
    addFavorite,
    removeFavorite,
    clearAllFavorites,
    getUserFavorites,
    isFavorited,
  }
}
