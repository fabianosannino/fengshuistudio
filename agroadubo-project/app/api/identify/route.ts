import { NextRequest, NextResponse } from 'next/server'
import { PLANT_DATABASE } from '../../lib/data'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'sk-your-key-here') {
      return NextResponse.json(
        { error: 'Identificacao por IA nao disponivel. Selecione a planta manualmente.', code: 'NO_API_KEY' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'Nenhuma imagem fornecida', code: 'NO_IMAGE' },
        { status: 400 }
      )
    }

    const imageUrl = image.startsWith('data:')
      ? image
      : `data:image/jpeg;base64,${image}`

    const plantNames = PLANT_DATABASE.map(p => `${p.id}: ${p.nome} (${p.nomeCientifico})`).join(', ')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Voce e um especialista em identificacao de plantas brasileiras.
O usuario vai enviar uma foto de uma planta. Analise a imagem e identifique a planta.

Plantas no nosso banco de dados: ${plantNames}

Responda SEMPRE em JSON valido com esta estrutura:
{
  "identified": true/false,
  "plantId": "id_da_planta_ou_null",
  "plantName": "nome da planta identificada",
  "confidence": 0.0 a 1.0,
  "description": "breve descricao do que voce ve na imagem",
  "suggestion": "se nao corresponder a nenhuma planta do banco, sugira a mais proxima ou null"
}

Os IDs validos sao: ${PLANT_DATABASE.map(p => p.id).join(', ')}

Se a imagem nao contem uma planta, retorne identified: false com description explicando o que ve.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low',
                },
              },
              {
                type: 'text',
                text: 'Identifique esta planta.',
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API error:', response.status, errorData)
      const detail = errorData?.error?.message || errorData?.error?.code || `HTTP ${response.status}`
      let userMessage = 'Erro ao comunicar com o servico de IA'
      if (response.status === 401) {
        userMessage = 'Chave da API OpenAI invalida ou expirada'
      } else if (response.status === 429) {
        userMessage = 'Limite de uso da API OpenAI atingido. Tente novamente em alguns minutos'
      } else if (response.status === 402 || detail.includes('quota') || detail.includes('billing')) {
        userMessage = 'Sem creditos na conta OpenAI. Verifique seu plano em platform.openai.com'
      }
      return NextResponse.json(
        { error: `${userMessage} (${detail})`, code: 'AI_ERROR' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    let result
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    } catch {
      return NextResponse.json(
        { error: 'Resposta invalida da IA', code: 'PARSE_ERROR' },
        { status: 500 }
      )
    }

    // Validate plantId against our database
    if (result.plantId) {
      const matchedPlant = PLANT_DATABASE.find(p => p.id === result.plantId)
      if (!matchedPlant) {
        result.plantId = null
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Identify route error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
