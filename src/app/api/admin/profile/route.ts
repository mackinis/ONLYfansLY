
import { NextResponse } from 'next/server';
import { getAdminProfileLogic, updateAdminProfileLogic } from '@/lib/actions';
import type { UserProfile } from '@/lib/types';
import { z } from 'zod';

// Zod schema for validating the update payload, similar to adminProfileUpdateSchema in actions.ts
// but defined here for API route specific validation if needed.
const adminProfileUpdateAPISchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").optional(),
  surname: z.string().min(2, "Surname must be at least 2 characters.").optional(),
  avatarUrl: z.string().url({ message: "Avatar URL must be a valid URL." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  dni: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  // adminId: z.string(), // Expecting adminId in the body if API is generic
});


export async function GET() {
  try {
    const adminProfile: UserProfile | null = await getAdminProfileLogic();

    if (adminProfile) {
      const { passwordHash, activationToken, activationTokenExpires, ...safeProfile } = adminProfile;
      return NextResponse.json(safeProfile);
    } else {
      return NextResponse.json({ message: 'Admin profile not found.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return NextResponse.json({ message: 'Failed to fetch admin profile', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    // The client-side form sends adminId in the body now.
    // Alternatively, this API could fetch the adminId itself if it was a fixed identifier or single admin system.
    const { adminId, ...updateData } = body; 

    if (!adminId) {
        return NextResponse.json({ success: false, message: 'Admin ID is required for update.' }, { status: 400 });
    }

    const validation = adminProfileUpdateAPISchema.safeParse(updateData);
    if (!validation.success) {
        return NextResponse.json({ success: false, message: 'Invalid admin profile data.', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const result = await updateAdminProfileLogic(adminId, validation.data);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating admin profile via API:', error);
    return NextResponse.json({ success: false, message: 'Failed to update admin profile due to a server error.', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
