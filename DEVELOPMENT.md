# 开发指南

## 项目结构

```
free-moda/
├── src/
│   └── index.ts          # 主要插件代码
├── example/
│   └── usage.md          # 使用示例
├── lib/                  # 编译输出目录（自动生成）
├── package.json          # 包配置
├── tsconfig.json         # TypeScript 配置
└── readme.md             # 项目说明
```

## 技术栈

- **Koishi**: 聊天机器人框架
- **TypeScript**: 开发语言
- **ModelScope API**: 图片生成和编辑服务
- **ImgBB API**: 图片托管服务

## 核心功能实现

### 1. 图片上传 (`uploadImageToImgbb`)

将本地图片或 base64 图片上传到 ImgBB 图床，获取公网可访问的 URL。

```typescript
async function uploadImageToImgbb(imageBuffer: ArrayBuffer): Promise<string>
```

### 2. 创建编辑任务 (`createImageEditTask`)

调用 ModelScope API 创建图片编辑任务。

```typescript
async function createImageEditTask(imageUrl: string, prompt: string): Promise<string>
```

### 3. 查询任务状态 (`getTaskStatus`)

轮询查询任务执行状态。

```typescript
async function getTaskStatus(taskId: string): Promise<TaskResult>
```

### 4. 等待任务完成 (`waitForTaskCompletion`)

持续查询直到任务完成或超时（最多 5 分钟）。

```typescript
async function waitForTaskCompletion(taskId: string, maxAttempts = 60): Promise<string>
```

## 命令实现

### moda.edit - 图片编辑

- 从引用消息或当前消息中提取图片
- 支持本地图片自动上传
- 异步处理，实时反馈进度

### moda.generate - 图片生成

- 纯文本生成图片
- 使用 Qwen-Image 模型
- 支持各种风格和场景

## 零外部依赖设计

插件完全使用 Koishi 内置功能：

- `ctx.http`: HTTP 请求（替代 axios/fetch）
- `h.select`: 元素选择（提取图片）
- `h.image`: 图片消息构建
- `ctx.logger`: 日志记录
- `ctx.command`: 命令注册

## 构建和测试

### 本地开发

1. 确保已安装 Koishi 开发环境
2. 在 Koishi 项目中链接此插件：
   ```bash
   # 在 Koishi 根目录
   cd external/free-moda
   ```

3. 编译 TypeScript：
   ```bash
   # 如果有 yakumo 或其他构建工具
   yarn build
   ```

4. 在 Koishi 控制台启用插件并配置

### 测试流程

1. **配置测试**
   - 填入有效的 ModelScope API Token
   - 测试插件是否正常加载

2. **图片生成测试**
   ```
   moda.generate 一只可爱的猫
   ```
   预期：返回生成的猫咪图片

3. **图片编辑测试**
   - 发送一张图片
   - 执行：`moda.edit 把颜色变成蓝色`
   - 预期：返回编辑后的图片

4. **错误处理测试**
   - 测试无效的 API Token
   - 测试不安全的提示词
   - 测试网络错误情况

## API 限制和注意事项

### ModelScope API

- **免费额度**: 有每日调用次数限制
- **速率限制**: 建议添加防抖或队列机制
- **内容审核**: 提示词需符合内容安全规范
- **超时时间**: 单个任务最长等待 5 分钟

### ImgBB API

- **免费额度**: 公共 key 有限制
- **图片大小**: 建议不超过 32MB
- **存储时间**: 免费账户图片永久存储

## 未来改进方向

### 功能增强

- [ ] 支持批量图片处理
- [ ] 添加图片质量/尺寸参数
- [ ] 支持更多 ModelScope 模型
- [ ] 添加图片历史记录
- [ ] 实现图片编辑预览

### 性能优化

- [ ] 添加请求队列管理
- [ ] 实现结果缓存机制
- [ ] 优化大图片处理
- [ ] 添加进度条显示

### 用户体验

- [ ] 添加更详细的错误提示
- [ ] 支持中断长时间任务
- [ ] 添加使用统计和配额显示
- [ ] 提供预设提示词模板

## 故障排查

### 插件无法加载

- 检查 TypeScript 编译是否成功
- 检查 `package.json` 配置是否正确
- 查看 Koishi 日志中的错误信息

### API 调用失败

- 验证 API Token 是否有效
- 检查网络连接
- 查看 ModelScope 服务状态
- 检查是否超出配额限制

### 图片上传失败

- 检查图片格式和大小
- 验证 ImgBB API Key
- 尝试更换图床服务

## 贡献指南

欢迎提交 Issue 和 Pull Request！

在提交 PR 前请确保：
- 代码通过 TypeScript 编译
- 遵循现有代码风格
- 添加必要的注释
- 更新相关文档

## 许可证

MIT License
