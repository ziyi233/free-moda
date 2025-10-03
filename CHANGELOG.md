# 更新日志

## [0.0.1] - 2025-10-03

### ✨ 新增功能

- **图片编辑功能** (`moda.edit`)
  - 支持语义编辑（风格转换、IP 创作、视角变换）
  - 支持外观编辑（添加/删除元素、修改颜色、更换背景）
  - 支持文字编辑（中英文文字的增删改）
  - 支持引用消息中的图片
  - 自动处理本地图片上传

- **图片生成功能** (`moda.generate`)
  - 基于文字描述生成图片
  - 支持各种风格和场景
  - 异步任务处理，实时进度反馈

- **模型列表查询** (`moda.models`)
  - 查看 ModelScope 上所有可用的图片生成模型
  - 显示当前配置的模型
  - 支持过滤图片相关模型

### ⚙️ 配置选项

- **多 API Key 轮询**
  - 支持配置多个 ModelScope API Token
  - 自动轮询使用，提高可用性

- **自定义模型**
  - 可配置图片编辑模型（默认：Qwen/Qwen-Image-Edit）
  - 可配置图片生成模型（默认：Qwen/Qwen-Image）

- **图床配置**
  - 支持配置 ImgBB API Key
  - 自动上传本地图片到图床

- **高级配置**
  - 可调整任务查询重试次数（10-120）
  - 可调整查询间隔（1-10 秒）
  - 可设置任务超时时间（1-10 分钟）

- **调试选项**
  - 可启用详细日志输出
  - 便于排查问题

### 🎯 技术特性

- **零外部依赖**
  - 仅使用 Koishi 内置的 HTTP 服务
  - 不引入额外的 npm 包

- **完善的日志系统**
  - 记录所有关键操作
  - 支持详细调试模式
  - 便于问题追踪

- **友好的用户体验**
  - 实时进度反馈
  - 清晰的错误提示
  - 支持中文别名

### 📝 命令列表

| 命令 | 别名 | 说明 |
|------|------|------|
| `moda.edit <提示词>` | `图片编辑` | 编辑图片 |
| `moda.generate <描述>` | `生成图片` | 生成图片 |
| `moda.models` | `模型列表` | 查看可用模型 |

### 🐛 已知问题

- 免费 API 有调用频率限制
- 图片生成需要 10-30 秒等待时间
- 本地图片需要配置图床 API Key

### 📚 文档

- [README](./readme.md) - 项目说明
- [快速开始](./QUICKSTART.md) - 5 分钟上手指南
- [开发指南](./DEVELOPMENT.md) - 开发文档
- [使用示例](./example/usage.md) - 详细使用示例
- [配置示例](./example/config.yml) - 配置文件示例

### 🙏 致谢

- [ModelScope](https://modelscope.cn/) - 提供免费的 AI 模型 API
- [Qwen-Image](https://modelscope.cn/models/Qwen/Qwen-Image) - 强大的图片生成模型
- [Qwen-Image-Edit](https://modelscope.cn/models/Qwen/Qwen-Image-Edit) - 强大的图片编辑模型
- [Koishi](https://koishi.chat/) - 优秀的聊天机器人框架
- [ImgBB](https://imgbb.com/) - 免费图床服务
