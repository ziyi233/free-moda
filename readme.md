# koishi-plugin-free-moda

[![npm](https://img.shields.io/npm/v/koishi-plugin-free-moda?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-free-moda)

使用 ModelScope（魔搭）免费 API 进行图片生成和编辑的 Koishi 插件。

## 功能特性

- 🎨 **多模型支持**：内置多个文生图和图片编辑模型，支持自定义扩展
- 🖼️ **文生图**：通用模型、美人模型、特化模型等多种选择
- ✏️ **图片编辑**：支持语义编辑、外观修改、文字处理等
- 📐 **智能分辨率**：自动识别原图分辨率，支持自定义输出尺寸
- 🤖 **AI 提示词生成**：集成 ChatLuna，AI 自动生成优化提示词并选择模型（可选）
- 🚀 **表格配置**：直观的模型管理界面，支持自定义别名和描述
- 🔄 **多 Key 轮询**：支持配置多个 API Key 自动轮询使用
- 📊 **任务管理**：查看任务历史和状态，支持分页和详细查询
- ⭐ **收藏功能**：收藏喜欢的图片，独立管理
- 🎲 **Seed 记录**：自动记录每张图片的 seed，支持重绘
- 🔁 **重绘功能**：使用相同参数重新生成，可覆盖 seed
- 🎨 **灵活输出**：完全自定义输出格式，支持模板变量

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

# 指定图片分辨率
moda.qwen -s 1664x1664 一只可爱的猫
moda.beauty -s 512x512 一个冷淡风美女

# AI 自动生成提示词并选择模型（需要启用 AI 功能）
moda.ai 一只在樱花树下的猫咪
```

### 图片编辑

```bash
# 自动识别原图分辨率（默认启用）
# 如果原图是 2048x1536，会自动等比缩放到 1664x1248（默认最大边界）
[引用图片] moda.edit 把头发变成蓝色

# 或者先发送图片，再使用命令
[发送图片]
moda.edit 添加一副眼镜

# 手动指定输出图片分辨率（覆盖自动识别）
[引用图片] moda.edit -s 1024x1024 把头发变成蓝色
```

**分辨率处理说明：**

- 默认启用自动识别原图分辨率并等比缩放到最大边界
- **缩放示例**（默认边界 1664x1664）：
  - 小图 512x512 → 放大到 1664x1664
  - 大图 2048x1536 → 缩小到 1664x1248
  - 竖图 1536x2048 → 缩小到 1248x1664
- 可在配置中切换为"原始分辨率"模式，直接使用原图尺寸

### 任务管理

```bash
# 查看任务列表（默认显示图片和 seed）
moda.tasks

# 查看第2页
moda.tasks 2

# 查看详细信息（包括分辨率、负向提示词、创建时间等）
moda.tasks -d

# 查看任务详情
moda.info 123

# 重绘图片（使用相同参数）
moda.redraw 123

# 重绘并覆盖 seed
moda.redraw 123 -s 456
```

### 收藏管理

```bash
# 收藏图片
moda.fav 123

# 取消收藏
moda.unfav 123

# 清空所有收藏（需要确认）
moda.clearfav -c

# 查看收藏列表（默认显示图片）
moda.favs

# 查看第2页
moda.favs 2

# 查看详细信息
moda.favs -d
```

## 配置说明

### 基础配置

- **apiKeys**：ModelScope API Token 列表（必填，支持多个）

### 图片生成配置

通过表格配置多个文生图模型：

| 模型名称 | 别名 | 描述 | 注册指令 | 默认分辨率 |
|---------|------|------|---------|-----------|
| Qwen/Qwen-Image | qwen | 通用文生图模型 | ✓ | - |
| merjic/majicbeauty-qwen1 | beauty | 冷淡风美人 | ✓ | - |
| animationtj/Qwen_image_nude_pantyhose_lora | pantyhose | 肉色连裤袜特化 | ✓ | - |

- **列表第一个为默认模型**（标记 *）
- **别名**：用于快捷指令（如 `moda.qwen`）
- **描述**：在帮助信息中显示
- **注册指令**：是否创建快捷指令
- **默认分辨率**：该模型的默认图片分辨率（可选，如：1024x1024）

#### 分辨率配置

- **defaultSize**：全局默认图片分辨率（默认：1024x1024）
  - 格式：宽x高（如：1024x1024）
  - 分辨率范围：
    - SD系列：[64x64, 2048x2048]
    - FLUX：[64x64, 1024x1024]
    - Qwen-Image：[64x64, 1664x1664]
  - 可在命令中使用 `-s` 参数覆盖

### 图片编辑配置

通过表格配置图片编辑模型：

| 模型名称 | 别名 | 描述 | 注册指令 | 默认分辨率 |
|---------|------|------|---------|-----------|
| Qwen/Qwen-Image-Edit | edit | 通用图片编辑模型 | ✓ | - |

- **editMaxRetries**：编辑最大重试次数（默认：120，图片编辑很慢）
- **editRetryInterval**：编辑查询间隔（默认：10000 毫秒）
- **autoDetectSize**：自动识别原图分辨率（默认：true）
  - 启用后，图片编辑时会自动读取原图分辨率
  - 优先级：手动指定 `-s` 参数 > 模型默认分辨率 > 自动识别分辨率
  - 支持格式：PNG、JPEG、GIF、WebP
- **scaleMode**：分辨率处理模式（默认：等比缩放）
  - **原始分辨率**：直接使用原图尺寸，不做任何处理
  - **等比缩放**：将原图等比缩放到最大边界内（可能放大或缩小）
    - 小图会放大到接近边界
    - 大图会缩小到边界内
    - 始终保持原图比例，不会变形
- **maxWidth**：最大宽度（默认：1664，范围：64-2048）
  - 当缩放模式为"等比缩放"时生效
- **maxHeight**：最大高度（默认：1664，范围：64-2048）
  - 当缩放模式为"等比缩放"时生效

### 性能配置

- **generateMaxRetries**：生成最大重试次数（默认：60）
- **generateRetryInterval**：生成查询间隔（默认：5000 毫秒）

### AI 功能配置

- **enableAI**：启用 AI 提示词生成（默认：false）
  - 需要安装 ChatLuna 插件
  - 启用后可使用 `moda.ai` 命令
- **aiModel**：AI 模型选择
  - 用于生成和优化提示词
  - 从 ChatLuna 已配置的模型中选择
- **aiPromptTemplate**：AI 提示词模板
  - 自定义 AI 的行为和输出格式
  - 支持变量注入：
    - `{description}`: 用户输入的描述
    - `{modelList}`: 可用模型列表（自动生成）
  - 默认模板会让 AI 生成英文提示词并选择合适的模型

### 分页配置

- **tasksPerPage**：任务列表每页显示数量（默认：5，范围：1-20）
- **favsPerPage**：收藏列表每页显示数量（默认：10，范围：1-20）

### 输出格式配置

完全自定义输出格式，支持模板变量：

**可用变量：**
- `{status}` - 状态图标（✅/❌/⏳）
- `{id}` - 任务ID
- `{type}` - 类型（图片编辑/图片生成）
- `{prompt}` - 提示词
- `{seed}` - Seed值
- `{model}` - 模型名称
- `{time}` - 耗时
- `{size}` - 分辨率
- `{negativePrompt}` - 负向提示词
- `{date}` - 创建时间
- `{favorited}` - 收藏状态

**模板配置：**
- **taskListTemplate**：任务列表模板（简洁模式）
- **taskListDetailTemplate**：任务列表详细模板（-d 参数）
- **favListTemplate**：收藏列表模板（简洁模式）
- **favListDetailTemplate**：收藏列表详细模板（-d 参数）
- **taskInfoTemplate**：任务详情模板（moda.info）
- **showImageInList**：在列表中显示图片（默认：true）
- **showImageInDetail**：在详情中显示图片（默认：true）

**示例模板：**
```
{status} 【#{id}】 {type}
📝 {prompt}
🎲 Seed: {seed}
🎨 {model} | ⏱️ {time}
```

### 调试选项

- **enableLogs**：启用控制台日志（默认：true）

## AI 功能说明

### 前置要求

1. 安装 ChatLuna 插件
2. 在 ChatLuna 中配置至少一个大语言模型（如 OpenAI、Claude 等）
3. 在本插件配置中启用 AI 功能并选择模型

### 使用方式

```bash
moda.ai 一只在樱花树下的猫咪
```

AI 会自动：

1. 将你的简单描述扩展为详细的英文提示词
2. 根据描述内容选择最合适的模型（如人物选 beauty，通用选 qwen）
3. 说明选择该模型的理由
4. 自动调用选择的模型生成图片

### 示例对话

```text
用户: moda.ai 一个穿着和服的美女
AI: ✨ AI 已生成提示词！

📝 提示词: A beautiful woman wearing traditional Japanese kimono, elegant pose, cherry blossoms in background, soft lighting, high quality, detailed
🎨 选择模型: beauty (冷淡风美人)
💡 理由: 描述中包含美女人物，beauty 模型专注于人物生成，能更好地表现人物细节和气质

开始生成图片...
```

### 自定义提示词模板

你可以在配置中自定义 AI 的提示词模板，使用变量注入来动态生成内容：

**可用变量：**

- `{description}` - 用户输入的描述
- `{modelList}` - 自动生成的模型列表

**示例模板：**

```text
你是图片生成助手。根据用户描述生成提示词。

可用模型：
{modelList}

用户描述：{description}

请返回 JSON：
{
  "prompt": "英文提示词",
  "model": "模型别名",
  "reason": "选择理由"
}
```

这样可以完全自定义 AI 的行为和输出格式！

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

## 命令列表

### 生成命令
- `moda.qwen <prompt>` - 使用通用模型生成图片
- `moda.beauty <prompt>` - 使用美人模型生成图片
- `moda.pantyhose <prompt>` - 使用连裤袜模型生成图片
- `moda.edit <prompt>` - 编辑图片（需引用图片）
- `moda.ai <description>` - AI 自动生成提示词并生成图片

### 管理命令
- `moda.tasks [page]` - 查看任务列表
- `moda.tasks -d` - 查看任务详细信息
- `moda.info <id>` - 查看任务详情
- `moda.redraw <id>` - 重绘图片
- `moda.redraw <id> -s <seed>` - 重绘并覆盖 seed

### 收藏命令
- `moda.fav <id>` - 收藏图片
- `moda.unfav <id>` - 取消收藏
- `moda.clearfav -c` - 清空所有收藏（需要确认）
- `moda.favs [page]` - 查看收藏列表
- `moda.favs -d` - 查看收藏详细信息

## 注意事项

- ⏱️ **图片生成**：通常需要 10-30 秒
- ⏳ **图片编辑**：通常需要 10 分钟以上，请耐心等待
- 🔑 **API Key**：必须绑定阿里云账号才能使用
- 📊 **多 Key**：配置多个 API Key 可提高调用成功率
- 🔄 **任务管理**：所有任务自动记录，支持分页查看
- 🎲 **Seed 记录**：每张图片的 seed 会自动保存，方便重绘
- ⭐ **收藏功能**：可以收藏喜欢的图片，独立管理

## 示例

**文生图：**

```bash
moda.qwen 一只在草地上玩耍的可爱猫咪
moda.beauty 冷淡风格的美女肖像
moda.pantyhose 穿着连裤袜的动漫女孩

# 使用自定义分辨率
moda.qwen -s 1664x1664 高清猫咪图片
moda.beauty -s 512x768 竖版美女肖像
```

**图片编辑：**

```bash
# 自动识别原图分辨率（默认启用）
[引用图片] moda.edit 把头发颜色变成蓝色
[引用图片] moda.edit 将背景改成星空
[引用图片] moda.edit 给猫咪添加一副眼镜

# 手动指定输出分辨率
[引用图片] moda.edit -s 1024x1024 把头发颜色变成蓝色
[引用图片] moda.edit -s 512x768 生成竖版图片
```

## License

MIT
