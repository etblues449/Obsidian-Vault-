import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../_auth'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

export async function POST(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Clear, actionable error instead of a generic 500 the UI swallows.
      return Response.json(
        { ok: false, error: 'ANTHROPIC_API_KEY is not set in this environment. Add it in the Vercel project settings (Environment Variables) and redeploy.' },
        { status: 500 },
      )
    }

    const { message } = await request.json()
    if (!message?.trim()) {
      return Response.json({ ok: false, error: 'Empty message' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: {
        type: 'adaptive',
      },
      output_config: {
        effort: 'high',
      },
      system: `You are JARVIS, a conversational personal assistant who talks like a friend, not a robot. You engage naturally, ask follow-up questions, offer ideas and thoughts, and do your own research/reasoning to help the user think through things.

You are warm, casual, curious, and genuinely helpful. When someone tells you something, respond naturally - ask why, offer perspective, suggest ideas. Be a thinking partner.

Keep responses concise but meaningful. If you catch an action intent (alarm, timer, reminder), confirm it briefly.`,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const text = textContent && textContent.type === 'text' ? textContent.text : ''

    return Response.json({
      ok: true,
      reply: text,
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    return Response.json(
      {
        ok: false,
        error: error.message || 'Chat failed',
      },
      { status: 500 },
    )
  }
}
