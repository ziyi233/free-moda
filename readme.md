# koishi-plugin-free-moda

[![npm](https://img.shields.io/npm/v/koishi-plugin-free-moda?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-free-moda)

使用 ModelScope（魔搭）免费 API 进行图片生成和编辑的 Koishi 插件。

## 功能特性

- 🎨 **多模型支持**：内置多个文生图和图片编辑模型，支持自定义扩展
- 🖼️ **文生图**：通用模型、美人模型、特化模型等多种选择
- ✏️ **图片编辑**：支持语义编辑、外观修改、文字处理等
- 🚀 **表格配置**：直观的模型管理界面，支持自定义别名和描述
- 🔄 **多 Key 轮询**：支持配置多个 API Key 自动轮询使用
- 📊 **任务管理**：查看任务历史和状态，支持任务查询

## 快速开始

### 1. 获取 API Token

1. 访问 https://modelscope.cn/my/myaccesstoken
2. 登录后点击"创建新令牌"
3. **重要**：绑定阿里云账号（必须）
4. 复制生成的 Token (格式: `ms-xxxxx`)

### 2. 配置插件

在 Koishi 插件配置中添加 API Token，其他配置保持默认即可。

### 3. 开始使用

发送 `moda` 查看帮助信息和可用模型。

## 使用方法

### 文生图

```bash
# 使用默认模型（通用）
moda.qwen 一只可爱的猫

# 使用冷淡风美人模型
moda.beauty 一个冷淡风美女

# 使用连裤袜特化模型
moda.pantyhose 穿着连裤袜的女孩
```

### 图片编辑

```bash
# 引用包含图片的消息后发送
moda.edit 把头发变成蓝色

# 或者先发送图片，再使用命令
[发送图片]
moda.edit 添加一副眼镜
```

### 任务管理

```bash
# 查看任务列表
moda.tasks

# 查询具体任务
moda.check 1
```

## 配置说明

### 基础配置

- **apiKeys**：ModelScope API Token 列表（必填，支持多个）

### 图片生成配置

通过表格配置多个文生图模型：

| 模型名称 | 别名 | 描述 | 注册指令 |
|---------|------|------|---------|
| Qwen/Qwen-Image | qwen | 通用文生图模型 | ✓ |
| merjic/majicbeauty-qwen1 | beauty | 冷淡风美人 | ✓ |
| animationtj/Qwen_image_nude_pantyhose_lora | pantyhose | 肉色连裤袜特化 | ✓ |

- **列表第一个为默认模型**（标记 *）
- **别名**：用于快捷指令（如 `moda.qwen`）
- **描述**：在帮助信息中显示
- **注册指令**：是否创建快捷指令

### 图片编辑配置

通过表格配置图片编辑模型：

| 模型名称 | 别名 | 描述 | 注册指令 |
|---------|------|------|---------|
| Qwen/Qwen-Image-Edit | edit | 通用图片编辑模型 | ✓ |

- **editMaxRetries**：编辑最大重试次数（默认：120，图片编辑很慢）
- **editRetryInterval**：编辑查询间隔（默认：10000 毫秒）

### 性能配置

- **generateMaxRetries**：生成最大重试次数（默认：60）
- **generateRetryInterval**：生成查询间隔（默认：5000 毫秒）

### 调试选项

- **enableLogs**：启用控制台日志（默认：true）

## 内置模型

### 文生图模型

1. **Qwen/Qwen-Image** (qwen)
   - 通用文生图模型
   - 适合各种场景
   - 响应速度快

2. **merjic/majicbeauty-qwen1** (beauty)
   - 冷淡风美人模型
   - 专注人物生成
   - 风格独特

3. **animationtj/Qwen_image_nude_pantyhose_lora** (pantyhose)
   - 肉色连裤袜特化
   - 细节处理优秀

### 图片编辑模型

1. **Qwen/Qwen-Image-Edit** (edit)
   - 通用图片编辑模型
   - 支持语义编辑、外观修改、文字处理

## 自定义模型

可以在配置界面的表格中添加任何 ModelScope 上的图片生成模型：

1. 在表格中添加新行
2. 填写模型名称（如 `username/model-name`）
3. 设置别名（用于快捷指令）
4. 添加描述（可选）
5. 勾选是否注册指令

## 注意事项

- ⏱️ **图片生成**：通常需要 10-30 秒
- ⏳ **图片编辑**：通常需要 10 分钟以上，请耐心等待
- 🔑 **API Key**：必须绑定阿里云账号才能使用
- 📊 **多 Key**：配置多个 API Key 可提高调用成功率
- 🔄 **任务管理**：可使用 `moda.tasks` 查看任务进度

## 示例

**文生图：**

```bash
moda.qwen 一只在草地上玩耍的可爱猫咪
moda.beauty 冷淡风格的美女肖像
moda.pantyhose 穿着连裤袜的动漫女孩
```

**图片编辑：**

```bash
[引用图片] moda.edit 把头发颜色变成蓝色
[引用图片] moda.edit 将背景改成星空
[引用图片] moda.edit 给猫咪添加一副眼镜
```

## License

MIT
