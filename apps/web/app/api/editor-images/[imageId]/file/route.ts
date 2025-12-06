import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_VERSION = 'v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const imageId = params.imageId;
    
    // Get token from query parameter (passed by frontend)
    // The frontend will append ?token=... to the URL
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token') || 
                  request.headers.get('authorization')?.replace('Bearer ', '') ||
                  null;

    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Proxy request to backend with authentication
    const backendUrl = `${API_URL}/api/${API_VERSION}/editor/images/${imageId}/file`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store', // Don't cache images
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: 'Failed to fetch image' } },
        { status: response.status }
      );
    }

    // Get the image data and content type
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to serve image' } },
      { status: 500 }
    );
  }
}

