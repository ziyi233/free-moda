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
  recallEditStart: boolean
  msgEditCreated: string
  recallEditCreated: boolean
  msgGenerateStart: string
  recallGenerateStart: boolean
  msgGenerateCreated: string
  recallGenerateCreated: boolean
  msgAiAnalyzing: string
  recallAiAnalyzing: boolean
  msgAiResult: string
  recallAiResult: boolean
  msgTaskCreated: string
  recallTaskCreated: boolean
  msgTaskWaiting: string
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
    }))
      .role('table')
      .description('编辑模型列表')
      .default([
        { name: 'Qwen/Qwen-Image-Edit', alias: 'edit', description: '通用图片编辑模型', register: true, defaultSize: undefined },
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
    }))
      .role('table')
      .description('生成模型列表')
      .default([
        { name: 'Qwen/Qwen-Image', alias: 'qwen', description: '基础模型，无其他选择时选择', register: true, defaultSize: undefined },
        { name: 'merjic/majicbeauty-qwen1', alias: 'beauty', description: '清冷风美人', register: true, defaultSize: undefined },
        { name: 'violetzzzz/void_0-lowLR', alias: 'void', description: 'void_0风格，二次元相关建议用', register: true, defaultSize: undefined },
        { name: 'dominik0420/august_film_2', alias: 'film', description: '电影风格增强', register: true, defaultSize: undefined },
        { name: 'xmwd2009/qwen_image_xmwd_black_pantyhose_feet_lora', alias: 'hs', description: '黑丝特化。close-up of pantyhose feet', register: true, defaultSize: undefined },
        { name: 'firefly123123/firefly', alias: 'firefly', description: '流萤，需要激发词liuying', register: true, defaultSize: undefined },
        { name: 'whiteside123/qwenmsw2', alias: 'msw', description: '米山舞画风，二次元相关建议用', register: true, defaultSize: undefined },
        { name: 'windsing/nahida_Qwen_1', alias: 'nxd', description: '纳西妲', register: true, defaultSize: undefined },
        { name: 'zhouwenbin1994/zhigengniao', alias: 'zgn', description: '知更鸟cos', register: true, defaultSize: undefined },
        { name: 'skyrimpasser/Evernight_Honkai_Star_Rail_character_lora', alias: 'cyy', description: '长夜月', register: true, defaultSize: undefined },
        { name: 'Liudef/XB_PONY_MC_KTXY_MAX', alias: 'ktxy', description: '卡提希娅', register: true, defaultSize: undefined },
      ]),
    generateMaxRetries: Schema.number()
      .description('最大重试次数')
      .default(60),
    generateRetryInterval: Schema.number()
      .description('查询间隔（毫秒）')
      .default(5000),
    defaultSize: Schema.string()
      .description('默认分辨率（格式: 1024x1024）')
      .default('1024x1024'),
    enableNegativePrompt: Schema.boolean()
      .description('启用负向提示词')
      .default(false),
    negativePrompt: Schema.string()
      .description('负向提示词（最大 2000 字符）')
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

You are a Prompt optimizer designed to rewrite user inputs into high-quality Prompts that are more complete and expressive while preserving the original meaning.

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
"reason": "Brief reason for choosing this model (in Chinese)"
}

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

Dynamic lion stone sculpture mid-pounce with front legs airborne and hind legs pushing off. Smooth lines and defined muscles show power. Faded ancient courtyard background with trees and stone steps. Weathered surface gives antique look. Documentary photography style with fine details.Your task is to transform a simple user description into a high-quality, detailed, and expressive English prompt suitable for AI image generation, while also selecting the most appropriate model from the provided list.

Follow these rules carefully:

You are a Prompt optimizer designed to rewrite user inputs into high-quality Prompts that are more complete and expressive while preserving the original meaning.

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
"reason": "Brief reason for choosing this model (in Chinese)"
}

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
    recallEditStart: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgEditCreated: Schema.string()
      .description('编辑任务已创建')
      .default('⏳ 任务已创建，预计 30-120 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    recallEditCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgGenerateStart: Schema.string()
      .description('生成开始 - 变量: {model}, {size}')
      .default('🎨 正在使用 {model} 生成图片...{size}')
      .role('textarea', { rows: [2, 4] }),
    recallGenerateStart: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgGenerateCreated: Schema.string()
      .description('生成任务已创建')
      .default('⏳ 任务已创建，预计 10-30 秒...\n💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
    recallGenerateCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgAiAnalyzing: Schema.string()
      .description('AI 分析中')
      .default('🤖 AI 正在分析并生成提示词...')
      .role('textarea', { rows: [2, 4] }),
    recallAiAnalyzing: Schema.boolean()
      .description('↑ 自动撤回')
      .default(true),
    msgAiResult: Schema.string()
      .description('AI 结果 - 变量: {prompt}, {model}, {reason}')
      .default('✨ AI 已生成提示词！\n\n📝 提示词: {prompt}\n🎨 模型: {model}\n💡 理由: {reason}\n\n开始生成图片...')
      .role('textarea', { rows: [4, 8] }),
    recallAiResult: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgTaskCreated: Schema.string()
      .description('AI 任务已创建')
      .default('⏳ 任务已创建，预计 10-30 秒...')
      .role('textarea', { rows: [2, 4] }),
    recallTaskCreated: Schema.boolean()
      .description('↑ 自动撤回')
      .default(false),
    msgTaskWaiting: Schema.string()
      .description('任务查询提示')
      .default('💡 使用 moda.tasks 可查看任务状态')
      .role('textarea', { rows: [2, 4] }),
  }).description('进度消息配置').collapse(),

  Schema.object({
    enableLogs: Schema.boolean()
      .description('启用控制台日志')
      .default(true),
  }).description('调试选项'),
])
