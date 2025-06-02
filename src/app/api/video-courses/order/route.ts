
import { NextResponse } from 'next/server';
import { updateVideoCoursesOrderLogic } from '@/lib/actions';

export async function PUT(request: Request) {
  try {
    const coursesToUpdate = await request.json();
    if (!Array.isArray(coursesToUpdate) || coursesToUpdate.some(c => !c.id || typeof c.order !== 'number')) {
      return NextResponse.json({ success: false, message: 'Invalid data format for updating course order.' }, { status: 400 });
    }
    
    const result = await updateVideoCoursesOrderLogic(coursesToUpdate);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating video courses order:', error);
    return NextResponse.json({ success: false, message: 'Failed to update video courses order due to a server error.' }, { status: 500 });
  }
}

    