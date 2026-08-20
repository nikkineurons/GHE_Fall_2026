/**
 * MODEL-AGNOSTIC LLM SERVICE
 * Unified client supporting Google Gemini, OpenAI, Anthropic Claude, 
 * OpenRouter, Groq, and Custom Local Endpoints (Ollama, vLLM, LM Studio).
 * All queries are strictly grounded in provided_materials/2026datathon_interview_data.csv.
 */

class LLMService {
  constructor() {
    this.provider = localStorage.getItem('llm_provider') || 'gemini';
    this.apiKey = localStorage.getItem('llm_api_key') || '';
    this.model = localStorage.getItem('llm_model') || 'gemini-2.5-flash';
    this.baseUrl = localStorage.getItem('llm_base_url') || '';
    
    // Default endpoint fallbacks
    this.defaultBaseUrls = {
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      custom: 'http://localhost:11434/v1'
    };
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  setProvider(provider) {
    this.provider = provider;
    localStorage.setItem('llm_provider', provider);
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem('llm_api_key', this.apiKey);
  }

  setModel(model) {
    this.model = model.trim();
    localStorage.setItem('llm_model', this.model);
  }

  setBaseUrl(url) {
    this.baseUrl = url.trim();
    localStorage.setItem('llm_base_url', this.baseUrl);
  }

  async testConnection() {
    if (!this.isConfigured && this.provider !== 'custom') {
      throw new Error('API Key is required to test connection.');
    }
    const testPrompt = "Ping test: confirm connection.";
    return await this.generateAnswer(testPrompt, "System Test Mode");
  }

  async generateAnswer(userQuery, groundedContext) {
    if (!this.isConfigured && this.provider !== 'custom') {
      throw new Error('LLM provider is not configured with an API key.');
    }

    const systemInstruction = `You are a direct data analysis assistant for TikTok creator partnerships.
Answer the user's question directly with concise bullet points and structured markdown tables.
STRICT RULES:
1. NEVER output memo headers (e.g. "MEMORANDUM", "TO:", "FROM:", "DATE:", "SUBJECT:"), greetings, or conversational preambles.
2. Start directly with the answer, summary, or table.
3. Your answers MUST be strictly grounded in the verified dataset: provided_materials/2026datathon_interview_data.csv (1,000 video records across 802 unique creators).
4. Always reference exact metrics (Shares, Comments, Views, Verification Status, and video_id) from the dataset.
5. DO NOT invent or hallucinate metrics, creators, or video IDs.`;

    switch (this.provider) {
      case 'gemini':
        return await this.callGemini(systemInstruction, userQuery, groundedContext);
      case 'openai':
      case 'openrouter':
      case 'custom':
        return await this.callOpenAICompatible(systemInstruction, userQuery, groundedContext);
      case 'anthropic':
        return await this.callAnthropic(systemInstruction, userQuery, groundedContext);
      default:
        return await this.callGemini(systemInstruction, userQuery, groundedContext);
    }
  }

  // 1. Google Gemini Provider
  async callGemini(systemInstruction, userQuery, groundedContext) {
    const modelName = this.model || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const promptText = `SOURCE DATASET CONTEXT (from provided_materials/2026datathon_interview_data.csv):\n${groundedContext}\n\nUSER QUESTION: ${userQuery}\n\nProvide a direct, structured response with markdown tables. Do not include any memorandum header or conversational filler.`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      }
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error (${res.status})`);
    }

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean any accidental memo header residue
    text = text.replace(/^(MEMORANDUM|MEMO)[\s\S]*?(SUBJECT:[^\n]*\n+)/i, '');
    return text.trim() || 'No response generated from Gemini.';
  }

  // 2. OpenAI / OpenRouter / Custom Local (Ollama, vLLM, LM Studio) Provider
  async callOpenAICompatible(systemInstruction, userQuery, groundedContext) {
    let baseUrl = this.baseUrl || this.defaultBaseUrls[this.provider] || 'https://api.openai.com/v1';
    baseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const modelName = this.model || (this.provider === 'openai' ? 'gpt-4o-mini' : 'llama3');

    const messages = [
      { role: 'system', content: `${systemInstruction}\n\nDATASET CONTEXT:\n${groundedContext}` },
      { role: 'user', content: userQuery }
    ];

    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model: modelName,
      messages: messages,
      temperature: 0.2,
      max_tokens: 2048
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `${this.provider.toUpperCase()} API error (${res.status})`);
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = text.replace(/^(MEMORANDUM|MEMO)[\s\S]*?(SUBJECT:[^\n]*\n+)/i, '');
    return text.trim() || 'No response generated from LLM provider.';
  }

  // 3. Anthropic Claude Provider
  async callAnthropic(systemInstruction, userQuery, groundedContext) {
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const modelName = this.model || 'claude-3-5-sonnet-20241022';

    const payload = {
      model: modelName,
      max_tokens: 2048,
      system: `${systemInstruction}\n\nDATASET CONTEXT:\n${groundedContext}`,
      messages: [{ role: 'user', content: userQuery }],
      temperature: 0.2
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error (${res.status})`);
    }

    const data = await res.json();
    let text = data.content?.[0]?.text || '';
    text = text.replace(/^(MEMORANDUM|MEMO)[\s\S]*?(SUBJECT:[^\n]*\n+)/i, '');
    return text.trim() || 'No response generated from Claude.';
  }
}

window.LLMService = LLMService;
