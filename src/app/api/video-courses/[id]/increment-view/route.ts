
import { NextResponse } from 'next/server';
import { incrementVideoCourseViewsLogic } from '@/lib/actions';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  if (!courseId) {
    return NextResponse.json({ message: 'Course ID is required' }, { status: 400 });
  }
  try {
    const result = await incrementVideoCourseViewsLogic(courseId);
    if (result.success) {
      return NextResponse.json({ message: 'View count incremented' });
    } else {
      return NextResponse.json({ message: result.message || 'Failed to increment view count' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error incrementing view count for course ${courseId}:`, error);
    return NextResponse.json({ message: 'Failed to increment view count' }, { status: 500 });
  }
}
