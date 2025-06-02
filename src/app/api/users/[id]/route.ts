
import { NextResponse } from 'next/server';
import { deleteUserByIdLogic, getUserProfileByIdLogic, updateUserEditableProfileLogic, userEditableProfileSchema } from '@/lib/actions';
import type { UserProfile } from '@/lib/types';

// GET a specific user's profile (can be used by admin if needed for an edit form later)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }
  try {
    const userProfile: UserProfile | null = await getUserProfileByIdLogic(userId);
    if (userProfile) {
      const { passwordHash, activationToken, activationTokenExpires, ...safeProfile } = userProfile;
      return NextResponse.json(safeProfile);
    } else {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error fetching user profile ${userId} via API:`, error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to fetch user profile' }, { status: 500 });
  }
}


// DELETE a user
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
  }
  try {
    // In a real app, add admin authentication here
    // Also, consider what happens to user's content (testimonials, courses etc.)
    const result = await deleteUserByIdLogic(userId);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error(`Error deleting user ${userId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to delete user due to a server error.' }, { status: 500 });
  }
}

// PUT to update a user's profile (admin or user themselves)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
  }
  try {
    const body = await request.json();
    // Here, you'd check if the logged-in user is an admin OR if the userId matches the logged-in user's ID.
    // For simplicity, assuming an admin is making this call or it's the user editing their own profile.
    // The `updateUserEditableProfileLogic` function handles Zod validation.
    const result = await updateUserEditableProfileLogic(userId, body);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error(`Error updating user profile ${userId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update user profile due to a server error.' }, { status: 500 });
  }
}

