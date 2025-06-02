
import { NextResponse } from 'next/server';
import { getUserByEmailForLoginLogic } from '@/lib/actions';
import type { UserProfile } from '@/lib/types'; // Ensure UserProfile type is available

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    const user = await getUserByEmailForLoginLogic(email);

    if (!user) {
      return NextResponse.json({ success: false, message: 'Incorrect credentials.' }, { status: 401 });
    }

    const passwordMatch = password === user.passwordHash; // Direct comparison (replace with bcrypt in real app)

    if (!passwordMatch) {
      return NextResponse.json({ success: false, message: 'Incorrect credentials.' }, { status: 401 });
    }

    if (!user.isVerified) {
      return NextResponse.json({
        success: false,
        needsActivation: true,
        userId: user.id,
        email: user.email, // Send back email for resend token functionality
        message: 'Account not verified. Please enter activation token.',
      }, { status: 403 });
    }

    if (!user.isActive) {
      return NextResponse.json({ success: false, message: 'Account is inactive. Please contact support.' }, { status: 403 });
    }

    // Login successful
    const sessionUserProfile = {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl
    };

    return NextResponse.json({
      success: true,
      message: 'Login successful.',
      user: sessionUserProfile,
      isAdmin: user.role === 'admin',
    });

  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ success: false, message: 'An unexpected error occurred during login.' }, { status: 500 });
  }
}

    