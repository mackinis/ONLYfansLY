
import { NextResponse } from 'next/server';
import { getVideoCoursesLogic, createVideoCourseLogic, videoCourseSchema } from '@/lib/actions';
import type { Video } from '@/lib/types';

export async function GET() {
  try {
    const courses: Video[] = await getVideoCoursesLogic();
    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching video courses:', error);
    return NextResponse.json({ message: 'Failed to fetch video courses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createVideoCourseLogic(body);

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Error creating video course:', error);
    return NextResponse.json({ success: false, message: 'Failed to create video course due to a server error.' }, { status: 500 });
  }
}

    