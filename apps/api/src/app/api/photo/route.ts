import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref');
  const maxWidthPx = searchParams.get('maxWidthPx') ?? '800';

  if (!ref) {
    return NextResponse.json({ error: 'ref parameter is required' }, { status: 400 });
  }

  // Validate that ref looks like a Google Places photo reference
  if (!ref.startsWith('places/')) {
    return NextResponse.json({ error: 'Invalid photo reference' }, { status: 400 });
  }

  const googleUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxWidthPx}&key=${process.env.GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(googleUrl, { redirect: 'follow' });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch photo' },
      { status: response.status },
    );
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=2592000, s-maxage=2592000',
    },
  });
}
