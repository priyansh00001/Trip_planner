/**
 * Shared AI provider utility with automatic fallback chain.
 * 
 * Cascade order:
 *   1. Groq llama-3.3-70b-versatile  (fastest, best quality)
 *   2. Groq llama-3.1-8b-instant     (smaller but still fast)
 *   3. Google Gemini 2.0 Flash Lite  (free tier, 1500 RPD)
 * 
 * Returns the raw text content from whichever provider succeeds,
 * or null if all providers fail.
 */

interface CallAIOptions {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /** If true, request JSON-formatted responses from all providers */
  jsonMode?: boolean
}

interface CallAIResult {
  content: string
  provider: 'groq-70b' | 'groq-8b' | 'gemini' | 'none'
}

// ─── Groq helper ────────────────────────────────────────────
async function callGroq(
  model: string,
  options: CallAIOptions,
  apiKey: string
): Promise<string | null> {
  const { prompt, systemPrompt, temperature = 0.7, maxTokens = 4000, jsonMode = true } = options

  const payload: any = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  }

  // Only add json_object format for llama models (not all models support it)
  if (jsonMode && model.includes('llama')) {
    payload.response_format = { type: 'json_object' }
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.warn(`[AI] Groq ${model} failed (${res.status}): ${errBody.substring(0, 200)}`)
    return null
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    console.warn(`[AI] Groq ${model} returned empty content`)
    return null
  }

  return content
}

// ─── Gemini helper ──────────────────────────────────────────
async function callGemini(
  options: CallAIOptions,
  apiKey: string
): Promise<string | null> {
  const { prompt, systemPrompt, temperature = 0.7, maxTokens = 4000, jsonMode = true } = options

  // Combine system prompt into the user prompt for Gemini
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n${prompt}`
    : prompt

  const body: any = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.warn(`[AI] Gemini failed (${res.status}): ${errBody.substring(0, 200)}`)
    return null
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!content) {
    console.warn('[AI] Gemini returned empty content')
    return null
  }

  return content
}

// ─── Main export: cascading AI call ─────────────────────────
export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  // Step 1: Groq 70B (best quality, fastest)
  if (groqKey) {
    try {
      const result = await callGroq('llama-3.3-70b-versatile', options, groqKey)
      if (result) {
        console.log('[AI] ✅ Groq 70B succeeded')
        return { content: result, provider: 'groq-70b' }
      }
    } catch (err: any) {
      console.warn('[AI] Groq 70B exception:', err.message)
    }

    // Step 2: Groq 8B (lighter, higher rate limit)
    try {
      const result = await callGroq('llama-3.1-8b-instant', options, groqKey)
      if (result) {
        console.log('[AI] ✅ Groq 8B succeeded (fallback)')
        return { content: result, provider: 'groq-8b' }
      }
    } catch (err: any) {
      console.warn('[AI] Groq 8B exception:', err.message)
    }
  }

  // Step 3: Gemini Flash (Google free tier — 1500 RPD)
  if (geminiKey) {
    try {
      const result = await callGemini(options, geminiKey)
      if (result) {
        console.log('[AI] ✅ Gemini Flash succeeded (fallback)')
        return { content: result, provider: 'gemini' }
      }
    } catch (err: any) {
      console.warn('[AI] Gemini exception:', err.message)
    }
  }

  // All providers failed
  console.error('[AI] ❌ ALL providers failed — no AI response available')
  return { content: '', provider: 'none' }
}

/**
 * Helper to safely parse JSON from AI response.
 * Strips markdown code fences if present.
 */
export function parseAIJson(raw: string): any | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    console.error('[AI] Failed to parse AI JSON response:', raw.substring(0, 200))
    return null
  }
}
