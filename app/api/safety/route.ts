import { NextResponse } from "next/server";

/**
 * POST /api/safety
 * Team 5: Stateless. Client sends text/blocks. Backend returns risk flags.
 * Server stores nothing.
 *
 * Body: { fullText?: string, blocks?: Array<{ text: string; confidence?: number }> }
 *
 * TODO: Implement risk classification (scams, eviction notices, urgent docs).
 */
import { promises as fs } from "fs";

const openRouterApiToken = process.env.OPEN_ROUTER_API_TOKEN;

export async function POST(request: Request) {
  const prompt = await fs.readFile(process.cwd() + '/app/api/safety/system-prompt.md','utf-8')
  try {
    
    const body = await request.json();
    const fullText = body?.fullText as string | undefined;
    // const blocks = body?.blocks as Array<{ text: string; confidence?: number }> | undefined;
    // const textToAnalyze = fullText ?? blocks?.map((b) => b.text).join("\n") ?? "";

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        max_tokens:  200,
        messages: [
            {
                role:'system',
                content: prompt
            },    
            {
                role: 'user',
                content: fullText,
            },
        ],
        "reasoning": {
            "effort": "high",
            "exclude": true
        }
      }),
    })
    const data = await res.json();
    const flags = JSON.parse(data.choices[0].message.content);
    flags.detectedAt = Date.now();     

    return NextResponse.json({ flags });
    
  } catch {
    return NextResponse.json(
      { error: "Safety check failed" },
      { status: 500 }
    );
  }
}
