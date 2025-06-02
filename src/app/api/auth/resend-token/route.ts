
import { NextResponse } from 'next/server';
import { resendActivationTokenLogic } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required.' }, { status: 400 });
    }
    const result = await resendActivationTokenLogic(email);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Error resending activation token:', error);
    return NextResponse.json({ success: false, message: 'Server error while resending token.' }, { status: 500 });
  }
}

    