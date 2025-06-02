
import { NextResponse } from 'next/server';
import { verifyUserActivationTokenLogic } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const { userId, token } = await request.json();
    if (!userId || !token) {
      return NextResponse.json({ success: false, message: 'User ID and token are required.' }, { status: 400 });
    }
    const result = await verifyUserActivationTokenLogic(userId, token);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Error verifying activation token:', error);
    return NextResponse.json({ success: false, message: 'Server error during token verification.' }, { status: 500 });
  }
}

    