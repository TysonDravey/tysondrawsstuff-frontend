import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, entry } = body;

    // Verify the request is from Strapi (optional security check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.REVALIDATE_SECRET}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    console.log('Revalidation triggered for:', model, entry?.slug || entry?.id);

    // Revalidate different paths based on the model that changed
    switch (model) {
      case 'product':
        // Revalidate all product-related pages
        revalidatePath('/shop');
        revalidatePath('/');
        if (entry?.slug) {
          revalidatePath(`/shop/${entry.slug}`);
        }
        if (entry?.category?.slug) {
          revalidatePath(`/category/${entry.category.slug}`);
        }
        break;

      case 'category':
        // Revalidate category pages and shop
        revalidatePath('/shop');
        revalidatePath('/');
        if (entry?.slug) {
          revalidatePath(`/category/${entry.slug}`);
        }
        break;

      default:
        // Revalidate all pages for unknown models
        revalidatePath('/');
        revalidatePath('/shop');
        revalidatePath('/about');
        break;
    }

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      model,
      entry: entry?.slug || entry?.id
    });

  } catch (err) {
    console.error('Revalidation error:', err);
    return NextResponse.json(
      { message: 'Error revalidating', error: err },
      { status: 500 }
    );
  }
}

// Allow GET requests for testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');
  const secret = searchParams.get('secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  return NextResponse.json({ message: 'Missing path parameter' }, { status: 400 });
}