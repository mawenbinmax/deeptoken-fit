# DeepToken.fit - Backend API

Node.js + Express backend for AI Token Relay Station.

## Quick Start

```bash
npm install
npm start
```

## API Endpoints

- `GET /v1/health` - Health check
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (OpenAI-compatible)
- `GET /v1/usage` - Check API usage

## Environment Variables

- `DEEPSEEK_API_KEY` - Your DeepSeek API key
- `PORT` - Server port (default: 3000)

## Deploy

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Fork this repo
2. Connect to Railway
3. Add `DEEPSEEK_API_KEY` env variable
4. Deploy!

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables