# Paper2Video

![UI 界面截图](./docs/ScreenShot_Paper2Video_CN.png)

把论文变成清晰的讲解视频，具备 AI 驱动的旁白、自动幻灯片生成和专业视频制作功能。

[View in English](./README.md)

## 功能特点

- **PDF 分析**：使用 MinerU API 从研究论文中提取结构化内容
- **幻灯片生成**：AI 驱动的内容摘要和幻灯片布局设计
- **多语言支持**：生成英文或中文的幻灯片和旁白
- **声音克隆**：自定义 TTS 及声音样本克隆功能
- **视频制作**：从幻灯片自动生成视频，旁白同步
- **实时进度**：从解析到最终视频渲染的全程追踪

## 运行要求

- Bun 运行时
- 幻灯片渲染所需系统字体（例如中文可安装 `fonts-noto-cjk`）
- MinerU API Key

## 安装

```bash
git clone <仓库地址>
cd Paper2Video
bun install
cp .env.example .env
```

在 `.env` 中配置 MinerU：

- `MINERU_API_KEY`：MinerU 密钥（真实解析必填）
- `MINERU_API_URL`：MinerU API 主机（默认 `https://mineru.net`）
- `MINERU_UPLOAD_PATH`：单文件上传接口路径
- `MINERU_STATUS_PATH_TEMPLATE`：任务状态接口模板（包含 `{taskId}`）
- `MINERU_RESULT_PATH_TEMPLATE`：任务结果接口模板（包含 `{taskId}`）

## 使用

```bash
bun run dev
```

访问地址：
- **Next.js UI**: http://localhost:3000

## 生产构建

```bash
bun run build
bun run start
```

## 许可证

MIT
