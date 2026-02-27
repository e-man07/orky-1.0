import {
  GoogleGenerativeAI,
  TaskType,
  type FunctionDeclarationsTool,
  type GenerateContentResult,
} from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

export const embeddingModel = genAI.getGenerativeModel({
  model: 'gemini-embedding-001',
})

export const chatModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
})

// Retry wrapper for Gemini 429 rate limits
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const status = error?.status || error?.httpStatusCode
      if (status === 429 && attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 5000 // 5s, 10s, 15s
        console.log(`[GEMINI] Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

export async function generateEmbedding(
  text: string,
  taskType: 'retrieval_document' | 'retrieval_query' = 'retrieval_document'
): Promise<number[]> {
  const tt =
    taskType === 'retrieval_document'
      ? TaskType.RETRIEVAL_DOCUMENT
      : TaskType.RETRIEVAL_QUERY

  return withRetry(async () => {
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: tt,
    })
    return result.embedding.values
  })
}

export async function generateChatResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: 'user' | 'model'; content: string }[] = []
): Promise<string> {
  return withRetry(async () => {
    const chat = chatModel.startChat({
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      history: conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    })

    const result = await chat.sendMessage(userMessage)
    return result.response.text()
  })
}

export async function checkQueryAccess(
  query: string,
  userTitle: string
): Promise<{ allowed: boolean; reason?: string }> {
  return withRetry(async () => {
    const designationLabel = userTitle || 'employee'
    const prompt = `You are an access control checker. A user is asking a question. Determine if the query is asking about a specific designation band that DOES NOT match their profile.

User profile:
- Designation/Title: ${designationLabel}

Designation bands:
- Band A (Senior Leadership): Director, Senior Director, Vice President, CXO
- Band B (Mid-Level Management): Manager, Senior Manager, Lead Architect, Program Manager
- Band C (Individual Contributors): Engineer, Analyst, Associate, Executive

User query: "${query}"

Rules:
- If the query explicitly asks about a DIFFERENT designation band (e.g. user is an Analyst but asks about "Director benefits" or "VP reimbursement limits"), respond: DENIED|You don't have access to that designation band's information. Your designation is ${designationLabel}.
- If the query is general (e.g. "what is the mobile reimbursement policy?") or matches the user's designation band, respond: ALLOWED
- If unclear, respond: ALLOWED

Respond with ONLY "ALLOWED" or "DENIED|reason". Nothing else.`

    const result = await chatModel.generateContent(prompt)
    const response = result.response.text().trim()

    if (response.startsWith('DENIED')) {
      const reason = response.split('|')[1] || "You don't have access to that information."
      return { allowed: false, reason }
    }
    return { allowed: true }
  })
}

export async function summarizeArticle(
  title: string,
  body: string
): Promise<string> {
  return withRetry(async () => {
    const prompt = `You are an enterprise knowledge base article processor. Given a raw article (often with HTML markup), produce a clean, well-structured summary that preserves ALL important information.

Think step by step:
1. First, strip all HTML tags and formatting noise
2. Identify every factual detail, number, policy rule, eligibility criteria, deadline, limit, exception, and condition
3. Organize the information logically with clear sections and hierarchy
4. Preserve all specific values (amounts, dates, percentages, band/tier details, designation-specific rules)
5. Keep role/designation-specific distinctions clear (e.g., different limits for different bands)

Title: ${title}

Raw Article:
${body.substring(0, 10000)}

Rules:
- Do NOT lose any factual information — every number, rule, condition, eligibility, and exception must be retained
- Use clean markdown formatting (headers, bullet points, sub-bullets)
- Remove HTML tags, redundant whitespace, and formatting artifacts
- Keep the language professional and concise but complete
- Structure with clear sections matching the original article structure
- If the article has designation/role/band-specific info, keep each band's details clearly separated

Respond with ONLY the processed article content. No preamble.`

    const result = await chatModel.generateContent(prompt)
    return result.response.text().trim()
  })
}

export async function generateWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: FunctionDeclarationsTool[],
  modelName = 'gemini-2.0-flash',
): Promise<GenerateContentResult> {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      tools,
    })
    return model.generateContent(userMessage)
  })
}

export async function generateWithToolsChat(
  systemPrompt: string,
  messages: { role: 'user' | 'model' | 'function'; parts: any[] }[],
  tools: FunctionDeclarationsTool[],
  modelName = 'gemini-2.0-flash',
): Promise<GenerateContentResult> {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      tools,
    })

    const chat = model.startChat({
      history: messages.slice(0, -1),
    })

    const lastMessage = messages[messages.length - 1]
    return chat.sendMessage(lastMessage.parts)
  })
}

export async function classifyIntent(
  userMessage: string
): Promise<'kb_query' | 'conversational' | 'workflow'> {
  return withRetry(async () => {
    const prompt = `You are an intent classifier. Classify the following user message into exactly one category:

1. "kb_query" - The user is asking a question that can be answered from a knowledge base (policies, procedures, FAQs, how-to guides, holiday calendars, leave policies, hardware procurement, performance reviews, etc.)
2. "conversational" - The user is making small talk, greetings, or asking something that doesn't require knowledge base lookup
3. "workflow" - The user wants to trigger an action/workflow (create ticket, request approval, etc.)

User message: "${userMessage}"

Respond with ONLY the category name, nothing else.`

    const result = await chatModel.generateContent(prompt)
    const response = result.response.text().trim().toLowerCase()

    if (response.includes('kb_query')) return 'kb_query'
    if (response.includes('workflow')) return 'workflow'
    return 'conversational'
  })
}
