import { NextRequest, NextResponse } from "next/server"

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/meta-llama/Llama-2-7b-chat-hf"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, messages, maxTokens = 512 } = body

    if (!token) {
      return NextResponse.json(
        { error: "Missing Hugging Face token" },
        { status: 400 }
      )
    }

    // Format messages for Llama 2
    const prompt = formatLlama2Chat(messages)

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      return NextResponse.json(
        { error: `HF API Error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    let generatedText = ""
    if (Array.isArray(result) && result[0]?.generated_text) {
      generatedText = result[0].generated_text.trim()
    } else if (result.generated_text) {
      generatedText = result.generated_text.trim()
    } else {
      return NextResponse.json(
        { error: "Unexpected response format" },
        { status: 500 }
      )
    }

    return NextResponse.json({ generated_text: generatedText })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

function formatLlama2Chat(messages: { role: string; content: string }[]): string {
  const systemMessage = messages.find(m => m.role === "system")
  const chatMessages = messages.filter(m => m.role !== "system")
  
  let prompt = "<s>"
  
  if (systemMessage) {
    prompt += `[INST] <<SYS>>\n${systemMessage.content}\n<</SYS>>\n\n`
  } else {
    prompt += `[INST] `
  }
  
  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i]
    
    if (msg.role === "user") {
      if (i > 0) {
        prompt += `<s>[INST] ${msg.content} [/INST]`
      } else {
        prompt += `${msg.content} [/INST]`
      }
    } else if (msg.role === "assistant") {
      prompt += ` ${msg.content} </s>`
    }
  }
  
  return prompt
}
