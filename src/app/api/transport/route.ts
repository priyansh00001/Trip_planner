import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = searchParams.get('origin') || ''
  const destination = searchParams.get('destination') || ''

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 })
  }

  const authenticated = searchParams.get('authenticated') !== 'false'

  const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

  try {
    const res = await fetch(
      `${BACKEND}/api/transport?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&authenticated=${authenticated}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch transport data from backend' },
        { status: res.status }
      )
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Transport Proxy API Error:", error)
    return NextResponse.json({ error: error.message || 'Internal proxy error' }, { status: 500 })
  }
}
