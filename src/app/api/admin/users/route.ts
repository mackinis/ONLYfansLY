
import { NextResponse } from 'next/server';
import { getAllUsersLogic } from '@/lib/actions';
import type { UserProfile } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // In a real app, add admin authentication here
    const users: UserProfile[] = await getAllUsersLogic();
    const nonAdminUsers = users.filter(user => user.role !== 'admin');
    return NextResponse.json(nonAdminUsers);
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    return NextResponse.json({ message: 'Failed to fetch users', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
