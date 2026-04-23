const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// DeepSeek API configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// In-memory token counter (for demo - use Redis in production)
const tokenStore = {};
const FREE_TIER_TOKENS = 100000;
const STARTER_TIER_TOKENS = 5000000;

// API Keys (in production, use proper auth)
const API_KEYS = {
  'free-demo': { tier: 'free', limit: FREE_TIER_TOKENS },
  'starter-demo': { tier: 'starter', limit: STARTER_TIER_TOKENS }
};

// Middleware: API Key validation
function validateApiKey(req, res, next) {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  
  const keyConfig = API_KEYS[apiKey];
  if (!keyConfig) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.keyConfig = keyConfig;
  next();
}

// Estimate token count (rough approximation)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Check rate limit
function checkRateLimit(apiKey, tokens) {
  if (!tokenStore[apiKey]) {
    tokenStore[apiKey] = { used: 0, resetTime: Date.now() + 86400000 };
  }
  
  const entry = tokenStore[apiKey];
  if (Date.now() > entry.resetTime) {
    entry.used = 0;
    entry.resetTime = Date.now() + 86400000;
  }
  
  if (entry.used + tokens > entry.limit) {
    return false;
  }
  
  entry.used += tokens;
  return true;
}

// Health check
app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'DeepToken.fit API', timestamp: new Date().toISOString() });
});

// Models list
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'deepseek-chat', object: 'model', created: 1677610602, owned_by: 'deepseek' },
      { id: 'deepseek-reasoner', object: 'model', created: 1677610602, owned_by: 'deepseek' }
    ]
  });
});

// Chat completions (OpenAI-compatible)
app.post('/v1/chat/completions', validateApiKey, async (req, res) => {
  try {
    const { messages, model = 'deepseek-chat', temperature = 0.7, max_tokens = 2048 } = req.body;
    
    // Estimate input tokens
    const inputText = messages.map(m => m.content).join('');
    const inputTokens = estimateTokens(inputText);
    
    // Check rate limit
    if (!checkRateLimit(req.headers['authorization']?.replace('Bearer ', ''), inputTokens)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please upgrade your plan.' });
    }
    
    // Call DeepSeek API
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'DeepSeek API not configured' });
    }
    
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat',
      messages,
      temperature,
      max_tokens
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const outputTokens = estimateTokens(response.data.choices?.[0]?.message?.content || '');
    
    // Return OpenAI-compatible response
    res.json({
      id: `deeptoken-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.data.model,
      choices: response.data.choices,
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      }
    });
    
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Usage stats
app.get('/v1/usage', validateApiKey, (req, res) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  const entry = tokenStore[apiKey] || { used: 0, resetTime: Date.now() + 86400000 };
  const limit = req.keyConfig.limit;
  
  res.json({
    used: entry.used,
    limit,
    remaining: Math.max(0, limit - entry.used),
    resetTime: new Date(entry.resetTime).toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DeepToken.fit API running on port ${PORT}`);
});