
import { NextResponse } from 'next/server';
import { updateUserTestimonialPermissionLogic } from '@/lib/actions';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
  }
  try {
    const { canSubmitTestimonial } = await request.json();
    if (typeof canSubmitTestimonial !== 'boolean') {
      return NextResponse.json({ success: false, message: 'canSubmitTestimonial field (boolean) is required' }, { status: 400 });
    }
    // In a real app, add admin authentication here
    const result = await updateUserTestimonialPermissionLogic(userId, canSubmitTestimonial);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error(`Error updating user ${userId} testimonial permission:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update testimonial permission due to a server error.' }, { status: 500 });
  }
}
