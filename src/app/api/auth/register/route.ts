
import { NextResponse } from 'next/server';
import { registerUserLogic, registerUserSchema } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registerUserLogic(body);

    if (result.success) {
      return NextResponse.json({ message: result.message, userId: result.userId }, { status: 201 });
    } else {
      return NextResponse.json({ message: result.message, errors: result.errors }, { status: 400 });
    }
  } catch (error) {
    console.error('Error during user registration:', error);
    return NextResponse.json({ message: 'User registration failed due to a server error.', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

    