import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OrchestratorAgent } from '@/lib/agents/orchestrator'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id as number
    if (!userId) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { message, sessionId, conversationHistory } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create chat session
    let chatSession: { id: number }
    if (sessionId) {
      chatSession = { id: sessionId }
    } else {
      chatSession = await prisma.chatSession.create({
        data: {
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        },
      })
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'user',
        content: message,
      },
    })

    // Create execution
    const execution = await prisma.execution.create({
      data: {
        userId,
        conversationId: chatSession.id.toString(),
        userPrompt: message,
        status: 'pending',
      },
    })

    // Run orchestrator
    console.log(`[CHAT] User ${userId} asked: "${message.substring(0, 80)}"`)
    const orchestrator = new OrchestratorAgent(execution.id)
    const result = await orchestrator.execute(
      userId,
      message,
      conversationHistory || []
    )
    console.log(`[CHAT] Result status: ${result.status}, response length: ${result.response.length}, sources: ${result.sources?.length || 0}`)

    // Save assistant message
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'assistant',
        content: result.response,
        sources: result.sources as any,
      },
    })

    return NextResponse.json({
      response: result.response,
      sources: result.sources,
      status: result.status,
      executionId: execution.id,
      sessionId: chatSession.id,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
