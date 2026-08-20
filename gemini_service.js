/**
 * GEMINI API INTEGRATION SERVICE
 * Handles communication with Google Gemini API models (e.g. gemini-2.5-flash, gemini-1.5-flash)
 * Injects grounded dataset context so answers are factual, trustworthy, and actionable.
 */

class GeminiService {
  constructor() {
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
    this.model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
    this.isConfigured = !!this.apiKey;
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    if (this.apiKey) {
      localStorage.setItem('gemini_api_key', this.apiKey);
      this.isConfigured = true;
    } else {
      localStorage.removeItem('gemini_api_key');
      this.isConfigured = false;
    }
  }

  setModel(model) {
    this.model = model;
    localStorage.setItem('gemini_model', model);
  }

  async testConnection() {
    if (!this.apiKey) {
      throw new Error('Please provide a valid Gemini API key.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Respond with "CONNECTED" if you can read this.' }]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  }

  async generateAnswer(userQuestion, groundedContext) {
    if (!this.apiKey) {
      throw new Error('No Gemini API key configured.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = `
You are the Executive AI Talent Strategist advising the Head of Creator Partnerships at a top talent agency.
Your goal is to provide concise, strategic, and high-impact advice on which TikTok creators to sign, partner with, or prioritize based on a batch of 1,000 trending videos across 802 creators.

CRITICAL INSTRUCTIONS:
1. Core Metric Philosophy:
   - Views & Likes are passive consumption.
   - SHARES (virality multiplier / peer recommendation) and COMMENTS (community depth / brand loyalty) define "promising" talent.
   - Breakout Unverified/Unsigned creators are prime acquisition targets before competitor agencies sign them.
2. Rely strictly on the Grounded Dataset Context provided below. Never fabricate creators, view counts, or video IDs.
3. Be executive-friendly: concise, bullet-pointed, with specific creator handles (@handle), concrete metrics, and a "Strategic Next Step / Why Sign" recommendation.
4. Keep responses structured and scannable for a busy executive.
`;

    const promptText = `
${systemPrompt}

GROUNDED DATASET CONTEXT:
${groundedContext}

USER'S QUESTION:
"${userQuestion}"

Please deliver an executive-ready response for the Head of Creator Partnerships:
`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || 'No response generated.';
    return text;
  }
}

window.GeminiService = GeminiService;
