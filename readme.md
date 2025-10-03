# koishi-plugin-free-moda

[![npm](https://img.shields.io/npm/v/koishi-plugin-free-moda?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-free-moda)

使用 ModelScope（魔搭）免费 API 进行图片生成和编辑的 Koishi 插件。

## 功能特性

- 🎨 **图片编辑**：基于 Qwen-Image-Edit 模型，支持对图片进行语义和外观编辑
- 🖼️ **图片生成**：基于 Qwen-Image 模型，根据文字描述生成图片
- 🚀 **零外部依赖**：仅使用 Koishi 内置的 HTTP 服务
- 🔄 **自动图床上传**：自动处理本地图片上传
- 🔧 **自定义模型**：支持配置任意 ModelScope 上的图片生成模型
- 📊 **多 Key 轮询**：支持配置多个 API Key 自动轮询使用

## 配置项

### 基础配置

- **apiKey**：ModelScope API Token（必填）
  - 📝 获取方式：
    1. 访问 https://modelscope.cn/my/myaccesstoken
    2. 登录后点击"创建新令牌"
    3. 复制生成的 Token (格式: `ms-xxxxx`)

### 图床配置（可选）

- **imgbbApiKey**：ImgBB API Key
  - 📝 获取方式：
    1. 访问 https://api.imgbb.com/
    2. 注册并登录账号
    3. 在控制台获取 API Key
    4. 免费账户每月 5000 次上传
  - 💡 不配置则只能处理网络图片，建议引用消息使用 QQ 图床

### 模型配置

- **editModel**：图片编辑模型（默认：`Qwen/Qwen-Image-Edit`）
- **generateModel**：图片生成模型（默认：`Qwen/Qwen-Image`）

### 性能配置

- **editMaxRetries**：编辑最大重试次数（默认：120，编辑很慢）
- **editRetryInterval**：编辑查询间隔（默认：10000 毫秒）
- **generateMaxRetries**：生成最大重试次数（默认：60）
- **generateRetryInterval**：生成查询间隔（默认：5000 毫秒）

### 调试选项

- **enableLogs**：启用控制台日志（默认：true）

## 使用方法

### 图片编辑

```bash
# 方式1：先发送图片，再使用命令
[发送图片]
moda.edit 把头发变成蓝色

# 方式2：引用包含图片的消息
[引用消息] moda.edit 把猫的颜色变成紫色

# 使用别名
图片编辑 添加一个红色的帽子
```

### 图片生成

```bash
moda.generate 一只可爱的紫色猫咪

# 使用别名
生成图片 夕阳下的城市天际线
```

## 支持的编辑类型

- **语义编辑**：IP 创作、物体旋转、风格转换等
- **外观编辑**：添加/删除元素、修改颜色、更换背景/服装等
- **文字编辑**：支持中英文文字的添加、删除和修改

## 注意事项

- 图片生成需要一定时间（通常 10-30 秒），请耐心等待
- 免费 API 有调用频率限制，请合理使用
- 图片编辑功能需要提供可公网访问的图片 URL
- 本地图片会自动上传到 ImgBB 图床

## 示例

**图片编辑示例：**

- "把图片中 q 版人物头发颜色变成蓝发"
- "将背景改成星空"
- "给猫咪添加一副眼镜"
- "把文字'Hello'改成'你好'"

**图片生成示例：**

- "一只在草地上玩耍的可爱猫咪"
- "赛博朋克风格的城市夜景"
- "水墨画风格的山水画"

## License

MIT
