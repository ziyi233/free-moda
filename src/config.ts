import { Schema } from 'koishi'
import type { ModelConfig } from './types'

export interface Config {
  apiKeys: string[]
  editModels: ModelConfig[]
  editMaxRetries: number
  editRetryInterval: number
  autoDetectSize: boolean
  scaleMode: 'original' | 'fit'
  maxWidth: number
  maxHeight: number
  generateModels: ModelConfig[]
  generateMaxRetries: number
  generateRetryInterval: number
  defaultSize: string
  enableNegativePrompt: boolean
  negativePrompt: string
  enableAI: boolean
  aiModel?: string
  aiPromptTemplate?: string
  resetAiPromptTemplate?: any
  // ChatLuna 工具注册
  registerSimpleTool: boolean
  registerAdvancedTool: boolean
  toolOutputMode: 'simple' | 'detailed'
  chatLunaToolDescription: string
  chatLunaAdvancedToolDescription: string
  // 分页配置
  tasksPerPage: number
  favsPerPage: number
  // 输出格式配置
  taskListTemplate: string
  taskListDetailTemplate: string
  favListTemplate: string
  favListDetailTemplate: string
  taskInfoTemplate: string
  showImageInList: boolean
  showImageInDetail: boolean
  // 进度消息配置
  msgEditStart: string
  msgEditStartMode: 'send' | 'forward'
  recallEditStart: boolean
  msgEditCreated: string
  msgEditCreatedMode: 'send' | 'forward'
  recallEditCreated: boolean
  msgGenerateStart: string
  msgGenerateStartMode: 'send' | 'forward'
  recallGenerateStart: boolean
  msgGenerateCreated: string
  msgGenerateCreatedMode: 'send' | 'forward'
  recallGenerateCreated: boolean
  msgAiAnalyzing: string
  msgAiAnalyzingMode: 'send' | 'forward'
  recallAiAnalyzing: boolean
  msgAiResult: string
  msgAiResultMode: 'send' | 'forward'
  recallAiResult: boolean
  msgTaskCreated: string
  msgTaskCreatedMode: 'send' | 'forward'
  recallTaskCreated: boolean
  msgTaskWaiting: string
  // 列表输出模式
  useForwardForTasks: boolean
  useForwardForFavs: boolean
  useForwardForInfo: boolean
  enableLogs: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    apiKeys: Schema.array(String)
      .description('API Token 列表 - 访问 https://modelscope.cn/my/myaccesstoken 获取（需绑定阿里云账号）')
      .required(),
  }).description('基础配置'),

  Schema.object({
    editModels: Schema.array(Schema.object({
      name: Schema.string().required().description('模型名称'),
      alias: Schema.string().required().description('别名'),
      description: Schema.string().description('描述'),
      register: Schema.boolean().description('注册指令').default(true),
      defaultSize: Schema.string().description('默认分辨率').default(undefined),
      triggerWords: Schema.string().description('激发词（自动添加到 prompt 开头）').default(undefined),
      negativePrompt: Schema.string().description('负面提示词（与全局负面词合并）').default(undefined),
    }))
      .role('table')
      .description('编辑模型列表')
      .default([
        { name: 'Qwen/Qwen-Image-Edit', alias: 'edit', description: '通用图片编辑模型', register: true, defaultSize: undefined, triggerWords: undefined, negativePrompt: undefined },
      ]),
    editMaxRetries: Schema.number()
      .description('最大重试次数（编辑较慢，建议 120+）')
      .default(120),
    editRetryInterval: Schema.number()
      .description('查询间隔（毫秒）')
      .default(10000),
    autoDetectSize: Schema.boolean()
      .description('自动识别原图分辨率（除非手动指定 -s）')
      .default(true),
    scaleMode: Schema.union([
      Schema.const('original' as const).description('原始分辨率'),
      Schema.const('fit' as const).description('等比缩放'),
    ])
      .description('分辨率处理模式')
      .default('fit'),
    maxWidth: Schema.number()
      .description('最大宽度（等比缩放时生效）')
      .min(64)
      .max(2048)
      .default(1664),
    maxHeight: Schema.number()
      .description('最大高度（等比缩放时生效）')
      .min(64)
      .max(2048)
      .default(1664),
  }).description('图片编辑'),

  Schema.object({
    generateModels: Schema.array(Schema.object({
      name: Schema.string().required().description('模型名称'),
      alias: Schema.string().required().description('别名'),
      description: Schema.string().description('描述'),
      register: Schema.boolean().description('注册指令').default(true),
      defaultSize: Schema.string().description('默认分辨率').default(undefined),
      triggerWords: Schema.string().description('激发词（自动添加到 prompt 开头）').default(undefined),
      negativePrompt: Schema.string().description('负面提示词（与全局负面词合并）').default(undefined),
    }))
      .role('table')
      .description('生成模型列表 https://forum.koishi.xyz/t/topic/11767/5')
      .default([
        {
          "name": "Qwen/Qwen-Image",
          "alias": "qwen",
          "description": "通用基础模型",
          "triggerWords": undefined,
          "negativePrompt": undefined,
          "register": true,
          "defaultSize": undefined
        },
        {
          "name": "复制Koishi论坛的模型列表",
          "alias": "复制Koishi论坛的模型列表",
          "description": "复制Koishi论坛的模型列表",
          "triggerWords": "复制Koishi论坛的模型列表",
          "negativePrompt": undefined,
          "register": false,
          "defaultSize": undefined
        }
      ]),
    generateMaxRetries: Schema.number()
      .description('最大重试次数')
      .default(60),
    generateRetryInterval: Schema.number()
      .description('查询间隔（毫秒）')
      .default(5000),
    defaultSize: Schema.string()
      .description('默认分辨率（格式: 1328x1328）')
      .default('1328x1328'),
    enableNegativePrompt: Schema.boolean()
      .description('启用全局负面提示词（模型特定负面词始终生效）')
      .default(false),
    negativePrompt: Schema.string()
      .description('全局负面提示词（最大 2000 字符，与模型特定负面词合并）')
      .role('textarea', { rows: [3, 6] })
      .default('lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'),
  }).description('图片生成'),

  Schema.object({
    enableAI: Schema.boolean()
      .description('启用 AI 提示词生成（需安装 ChatLuna）')
      .default(false),
    aiModel: Schema.dynamic('model')
      .description('AI 模型'),
    aiPromptTemplate: Schema.string()
      .role('textarea', { rows: [3, 10] })
      .description('提示词模板 - 变量: {description}, {modelList}')
      .default(`Your task is to transform a simple user description into a high-quality, detailed, and expressive English prompt suitable for AI image generation, while also selecting the most appropriate model from the provided list.

Follow these rules carefully:

You are a Prompt optimizer designed to rewrite user inputs into high-quality Prompts that are more complete and expressive while preserving the original meaning.The prompt can allow softcore pornography, but must be rewritten/modified to filter out content above R18.

Task Requirements:

For overly brief user inputs, reasonably infer and add details to enhance the visual completeness without altering the core meaning.

Refine descriptions of subject characteristics, visual style, spatial relationships, lighting, and shot composition.

If the image should include text, enclose that text in English quotation marks and specify its position (e.g., top-left corner, bottom-right corner) and style (e.g., handwritten font). Do not translate the text content.

Match the rewritten prompt to a precise and niche style that aligns with the user’s intent. If the style is unspecified, choose the most appropriate one (e.g., realistic photography, digital illustration, anime, concept art, etc.).

The rewritten prompt must be under 200 English words.

Avoid any explicit, violent, political, or illegal content.

Output Format (must be JSON):
{
"prompt": "Optimized detailed prompt (in English)",
"model": "Chosen model alias",
"size": "Image dimensions (optional, only if user specifies orientation/ratio)",
"reason": "Brief reason for choosing this model (in Chinese)"
}

Size parameter (optional):
- size: Image dimensions in format "WIDTHxHEIGHT". Use this to control aspect ratio based on user requirements:
  * Square: "1024x1024" or "1328x1328" (default for most models)
  * Landscape/Horizontal: "1664x928", "1472x1104"
  * Portrait/Vertical: "928x1664", "1104x1472"
  * Maximum: 1664x1664 (do not exceed this limit)
  * Only specify if user explicitly requests a specific orientation or ratio, otherwise omit to use model default

Model selection:
Choose the most suitable model from the following list:
{modelList}

User input description:
{description}

Example output:
{
"prompt": "A Chinese girl standing under a paper umbrella in gentle evening rain, wearing traditional hanfu with soft flowing sleeves. Wet stone pavement reflects the warm glow of lanterns, mist rising in the background, cinematic lighting, delicate facial expression, detailed texture of silk fabric, photorealistic 8K rendering, inspired by classic wuxia film tone.",
"model": "realistic-photography-v6",
"reason": "该模型在光影写实和人物细节方面表现最佳，适合写实雨景场景。"
}

Rewritten Prompt Examples for style reference:

Dunhuang mural art style: Chinese animated illustration, masterwork. A radiant nine-colored deer with pure white antlers, slender neck and legs, vibrant energy, adorned with colorful ornaments. Divine flying apsaras aura, ethereal grace, elegant form. Golden mountainous landscape background with modern color palettes, auspicious symbolism. Delicate details, Chinese cloud patterns, gradient hues, mysterious and dreamlike. Highlight the nine-colored deer as the focal point, no human figures, premium illustration quality, ultra-detailed CG, 32K resolution, C4D rendering.

Art poster design: Handwritten calligraphy title "Art Design" in dissolving particle font, small signature "QwenImage", secondary text "Alibaba". Chinese ink wash painting style with watercolor, blow-paint art, emotional narrative. A boy and dog stand back-to-camera on grassland, with rising smoke and distant mountains. Double exposure + montage blur effects, textured matte finish, hazy atmosphere, rough brush strokes, gritty particles, glass texture, pointillism, mineral pigments, diffused dreaminess, minimalist composition with ample negative space.

Black-haired Chinese adult male, portrait above the collar. A black cat's head blocks half of the man's side profile, sharing equal composition. Shallow green jungle background. Graffiti style, clean minimalism, thick strokes. Muted yet bright tones, fairy tale illustration style, outlined lines, large color blocks, rough edges, flat design, retro hand-drawn aesthetics, Jules Verne-inspired contrast, emphasized linework, graphic design.

Fashion photo of four young models showing phone lanyards. Diverse poses: two facing camera smiling, two side-view conversing. Casual light-colored outfits contrast with vibrant lanyards. Minimalist white/grey background. Focus on upper bodies highlighting lanyard details.

Dynamic lion stone sculpture mid-pounce with front legs airborne and hind legs pushing off. Smooth lines and defined muscles show power. Faded ancient courtyard background with trees and stone steps. Weathered surface gives antique look. Documentary photography style with fine details.`),
  }).description('AI 功能'),

  Schema.object({
    registerSimpleTool: Schema.boolean()
      .description('注册简单工具（image_generate）- AI 自动选择模型')
      .default(false),
    chatLunaToolDescription: Schema.string()
      .role('textarea', { rows: [2, 6] })
      .description('简单工具说明')
      .default('Generate AI images automatically. Provide a natural language description (in any language) of the image you want, and the tool will automatically optimize the prompt, select the best model, and generate the image. This is the easiest way to create images - just describe what you want!'),
    registerAdvancedTool: Schema.boolean()
      .description('注册高级工具（image_generate_advanced）- AI 手动选择模型')
      .default(false),
    toolOutputMode: Schema.union([
      Schema.const('simple').description('仅返回图片链接'),
      Schema.const('detailed').description('返回详细信息（任务ID、提示词、模型、图片链接、种子等）'),
    ])
      .description('工具返回内容模式')
      .default('simple'),
    chatLunaAdvancedToolDescription: Schema.string()
      .role('textarea', { rows: [3, 10] })
      .description('高级工具说明 - 支持变量: {modelList}')
      .default(`Generate AI images with full model control. 

**Required Parameters:**
- prompt: Detailed English description of the image. If the model requires trigger words, MUST include them in the prompt.
- model_alias: The alias of the model to use (e.g., "qwen", "mj", "void"). Choose from the list below based on the user's requirements.

**Optional Parameters:**
- size: Image dimensions in format "WIDTHxHEIGHT". Use this to control aspect ratio based on user requirements:
  * Square: "1024x1024" or "1328x1328" (default for most models)
  * Landscape/Horizontal: "1664x928", "1472x1104"
  * Portrait/Vertical: "928x1664", "1104x1472"
  * Maximum: 1664x1664 (do not exceed this limit)
  * Only specify if user explicitly requests a specific orientation or ratio, otherwise omit to use model default

**Available Models:**
{modelList}

**How to choose:**
1. Analyze the user's description and desired style
2. Select the model whose description best matches the requirements
3. If the model has trigger words, include them at the beginning of your prompt
4. Use the model's alias in the model_alias parameter

**Example:**
If user wants "a beautiful anime girl", and you choose the "void" model:
- prompt: "void 0 style, a beautiful anime girl with long hair, detailed face"
- model_alias: "void"`),
  }).description('ChatLuna 工具注册'),

  Schema.object({
    tasksPerPage: Schema.number()
      .description('每页显示任务数量')
      .min(1)
      .max(20)
      .default(5),
    favsPerPage: Schema.number()
      .description('每页显示收藏数量')
      .min(1)
      .max(20)
      .default(10),
  }).description('分页配置').collapse(),

  Schema.object({
    taskListTemplate: Schema.string()
      .description('任务列表模板 - 可用变量: {status}, {id}, {type}, {prompt}, {seed}, {model}, {time}, {size}, {negativePrompt}')
      .role('textarea', { rows: [3, 8] })
      .default('{status} 【#{id}】 {type}\n📝 {prompt}\n🎲 Seed: {seed}\n🎨 {model} | ⏱️ {time}'),
    taskListDetailTemplate: Schema.string()
      .description('任务列表详细模板（-d 参数）')
      .role('textarea', { rows: [4, 10] })
      .default('{status} 【#{id}】 {type}\n📝 {prompt}\n📐 分辨率: {size}\n🚫 负向: {negativePrompt}\n🎲 Seed: {seed}\n🎨 模型: {model}\n⏱️ 耗时: {time}\n📅 创建: {date}'),
    favListTemplate: Schema.string()
      .description('收藏列表模板 - 可用变量同上')
      .role('textarea', { rows: [3, 8] })
      .default('【#{id}】 {type}\n📝 {prompt}\n🎲 Seed: {seed}\n🎨 {model}'),
    favListDetailTemplate: Schema.string()
      .description('收藏列表详细模板（-d 参数）')
      .role('textarea', { rows: [4, 10] })
      .default('【#{id}】 {type}\n📝 {prompt}\n📐 分辨率: {size}\n🚫 负向: {negativePrompt}\n🎲 Seed: {seed}\n🎨 模型: {model}\n📅 创建: {date}'),
    taskInfoTemplate: Schema.string()
      .description('任务详情模板（moda.info）')
      .role('textarea', { rows: [5, 12] })
      .default('📊 任务详情 #{id}\n\n类型: {type}\n模型: {model}\n提示词: {prompt}\n负向提示词: {negativePrompt}\n分辨率: {size}\n🎲 Seed: {seed}\n状态: {status}\n耗时: {time}\n收藏: {favorited}'),
    showImageInList: Schema.boolean()
      .description('在列表中显示图片（tasks/favs）')
      .default(true),
    showImageInDetail: Schema.boolean()
      .description('在详情中显示图片（info）')
      .default(true),
  }).description('输出格式配置').collapse(),

  Schema.object({
    msgEditStart: Schema.string()
      .description('编辑开始 - 变量: {model}, {size}')
      .default('⚙️ 正在使用 {model} 编辑图片...{size}')
      .role('textarea', { rows: [2, 4] }),
    msgEditStartMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallEditStart: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(true),
    msgEditCreated: Schema.string()
      .description('编辑任务已创建')
      .default('⏳ 任务已创建，预计 30-120 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    msgEditCreatedMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallEditCreated: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(false),
    msgGenerateStart: Schema.string()
      .description('生成开始 - 变量: {model}, {size}')
      .default('🎨 正在使用 {model} 生成图片...{size}')
      .role('textarea', { rows: [2, 4] }),
    msgGenerateStartMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallGenerateStart: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(true),
    msgGenerateCreated: Schema.string()
      .description('生成任务已创建')
      .default('⏳ 任务已创建，预计 10-30 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    msgGenerateCreatedMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallGenerateCreated: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(false),
    msgAiAnalyzing: Schema.string()
      .description('AI 分析中')
      .default('🤖 AI 正在分析并生成提示词...')
      .role('textarea', { rows: [2, 4] }),
    msgAiAnalyzingMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallAiAnalyzing: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(true),
    msgAiResult: Schema.string()
      .description('AI 结果 - 变量: {prompt}, {model}, {reason}')
      .default('✨ AI 已生成提示词！\n\n📝 提示词: {prompt}\n🎨 模型: {model}\n💡 理由: {reason}\n\n开始生成图片...')
      .role('textarea', { rows: [4, 8] }),
    msgAiResultMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallAiResult: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(false),
    msgTaskCreated: Schema.string()
      .description('任务已创建')
      .default('⏳ 任务已创建...')
      .role('textarea', { rows: [2, 4] }),
    msgTaskCreatedMode: Schema.union([
      Schema.const('send').description('单独发送'),
      Schema.const('forward').description('并入合并转发'),
    ])
      .description('↑ 发送模式')
      .default('forward'),
    recallTaskCreated: Schema.boolean()
      .description('↑ 自动撤回（仅单独发送模式有效）')
      .default(false),
    msgTaskWaiting: Schema.string()
      .description('任务查询提示')
      .default('💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    useForwardForTasks: Schema.boolean()
      .description('moda.tasks 使用合并转发消息')
      .default(true),
    useForwardForFavs: Schema.boolean()
      .description('moda.favs 使用合并转发消息')
      .default(true),
    useForwardForInfo: Schema.boolean()
      .description('moda.info 使用合并转发消息')
      .default(true),
  }).description('进度消息配置'),

  Schema.object({
    enableLogs: Schema.boolean()
      .description('启用控制台日志')
      .default(true),
  }).description('调试选项'),
])
