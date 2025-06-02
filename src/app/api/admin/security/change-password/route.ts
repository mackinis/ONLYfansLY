
import { NextResponse } from 'next/server';
import { updateAdminPasswordLogic } from '@/lib/actions'; // We'll still use the logic function
import { z } from 'zod';

const passwordChangeAPISchema = z.object({
  adminId: z.string().min(1, { message: "Admin ID is required." }),
  newPassword: z.string().min(8, { message: "New password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // This error will be on confirmPassword if they don't match
});


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = passwordChangeAPISchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid data provided.", 
        errors: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { adminId, newPassword, confirmPassword } = validationResult.data;
    
    // The updateAdminPasswordLogic internally uses a Zod schema that also checks
    // if newPassword and confirmPassword match. We pass them both.
    const result = await updateAdminPasswordLogic(adminId, { newPassword, confirmPassword });

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      // Pass along errors from the logic function if they exist
      return NextResponse.json({ success: false, message: result.message, errors: result.errors }, { status: 400 });
    }
  } catch (error) {
    console.error('Error changing admin password via API:', error);
    return NextResponse.json({ success: false, message: 'Failed to change password due to a server error.' }, { status: 500 });
  }
}
