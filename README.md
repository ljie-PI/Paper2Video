# Paper2Video Atelier

![UI Screenshot](./docs/ScreenShot_Paper2Video.png)

Transform academic papers into clear video explainers with AI-powered narration, automated slide generation, and professional video production.

[查看中文版](./README_CN.md)

## Features

- **PDF Analysis**: Extract structured content from research papers using [MinerU](https://mineru.net/) cloud API
- **Slide Generation**: AI-powered content summarization and slide layout design
- **Multi-language Support**: Generate slides and narration in English or Chinese
- **Voice Cloning**: Custom TTS with voice sample cloning capabilities
- **Video Production**: Automated video generation from slides with synchronized narration
- **Real-time Progress**: Track pipeline stages from parsing to final video rendering

## Prerequisites

### 1. MinerU API Key

This project uses [MinerU](https://mineru.net/) for PDF parsing. Sign up at https://mineru.net/ to get an API key, then set `MINERU_API_KEY` in your `.env.local`.

### 2. System Fonts for PDF Rendering

The slide rendering requires system fonts. For proper Chinese text rendering:

```bash
# Install Chinese fonts (Noto CJK)
sudo apt-get install fonts-noto-cjk

# You can also install additional fonts as needed
sudo apt-get install fonts-noto-color-emoji
```

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd Paper2Video
```

2. Install dependencies using Bun:

```bash
# Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash

# Make Bun available in the current shell
export PATH="$HOME/.bun/bin:$PATH"

# Install project dependencies
bun install
```

3. Configure environment variables:

```bash
cp .env.example .env.local
# Edit .env.local and configure your API keys and settings if you plan to run the full pipeline
```

## Validation

For a fresh machine or CI run, install the Playwright browser once:

```bash
bun run test:e2e:install
```

Then run the full repository validation in one command:

```bash
bun run validate
```

`bun run validate` covers `lint`, `test`, `test:e2e`, and `build` in sequence. Copying `.env.example` to `.env.local` is enough for this validation flow; real API keys are only needed when you run the actual PDF / LLM / TTS pipeline. The same command is used by `.github/workflows/validate.yml` in CI.

## Usage

### Development Mode

Start the development server:

```bash
bun run dev
```

The application will be available at http://localhost:3000

### Production Build

Build for production:

```bash
bun run build
bun run start
```

## Configuration

### Environment Variables

See `.env.example` for available configuration options:

- `MINERU_API_KEY`: MinerU API key for PDF parsing
- `LLM_API_KEY`: API key for LLM (for content generation)
- Additional TTS and video processing settings

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License.

## Acknowledgments

- [MinerU](https://mineru.net/) for PDF parsing
- [Next.js](https://nextjs.org/) for the web framework
- [Reveal.js](https://revealjs.com/) for slide presentation
- [Puppeteer](https://pptr.dev/) for PDF generation
