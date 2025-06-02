
import { NextResponse } from 'next/server';
import { updateVideoCourseLogic, deleteVideoCourseLogic, videoCourseSchema } from '@/lib/actions';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  if (!courseId) {
    return NextResponse.json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const result = await updateVideoCourseLogic(courseId, body);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error(`Error updating video course ${courseId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update video course due to a server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  if (!courseId) {
    return NextResponse.json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }
  try {
    const result = await deleteVideoCourseLogic(courseId);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error(`Error deleting video course ${courseId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to delete video course due to a server error.' }, { status: 500 });
  }
}

    