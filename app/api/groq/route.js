import { NextResponse } from 'next/server';

const GROQ_ENDPOINT = 'https://api.groq.com/v1/llm/generate';

export async function POST(request) {
  const body = await request.json();
  const prompt = body?.prompt || 'Write a short cribbage scoring tip in plain English.';
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: prompt,
      }),
    });

    const data = await response.json();
    const tip =
      Array.isArray(data.output) && data.output[0]
        ? data.output[0]?.text || data.output[0]?.content?.[0]?.text || ''
        : data.output?.text || '';

    return NextResponse.json({ tip: tip || 'No tip returned from Groq.' });
  } catch (caught) {
    return NextResponse.json(
      { error: 'Groq request failed.' },
      { status: 500 }
    );
  }
}
