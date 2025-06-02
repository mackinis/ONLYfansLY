
import { NextResponse } from 'next/server';
import { updateUserActiveStatusLogic } from '@/lib/actions';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
  }
  try {
    const { isActive } = await request.json();
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, message: 'isActive field (boolean) is required' }, { status: 400 });
    }
    // In a real app, add admin authentication here
    const result = await updateUserActiveStatusLogic(userId, isActive);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error(`Error updating user ${userId} status:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update user status due to a server error.' }, { status: 500 });
  }
}
