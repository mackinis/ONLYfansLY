
import { NextResponse } from 'next/server';
import { updateUserOwnTestimonialLogic, deleteTestimonialByIdLogic, getTestimonialsLogic } from '@/lib/actions';
import type { UpdateUserOwnTestimonialData, Testimonial } from '@/lib/types';

// GET a specific testimonial by ID (optional, if needed elsewhere)
export async function GET(
  request: Request,
  { params }: { params: { testimonialId: string } }
) {
  const testimonialId = params.testimonialId;
  if (!testimonialId) {
    return NextResponse.json({ message: 'Testimonial ID is required' }, { status: 400 });
  }

  try {
    // Assuming getTestimonialsLogic can fetch a single testimonial by ID if modified,
    // or we could add a getTestimonialByIdLogic function.
    // For now, let's assume getTestimonialsLogic is not designed for single fetch like this.
    // This endpoint might not be strictly necessary if details are passed to modals client-side.
    // However, if a direct fetch of one testimonial is needed:
    const testimonials = await getTestimonialsLogic(undefined, undefined); // Fetch all
    const testimonial = testimonials.find(t => t.id === testimonialId);

    if (testimonial) {
      return NextResponse.json(testimonial);
    } else {
      return NextResponse.json({ message: 'Testimonial not found' }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error fetching testimonial ${testimonialId}:`, error);
    return NextResponse.json({ message: 'Failed to fetch testimonial', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}


export async function PUT(
  request: Request,
  { params }: { params: { testimonialId: string } }
) {
  const testimonialId = params.testimonialId;
  if (!testimonialId) {
    return NextResponse.json({ message: 'Testimonial ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // The userId is now expected in the body for authorization check within updateUserOwnTestimonialLogic
    const { userId, text, photoUrlsInput, videoUrlsInput } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required for authorization.' }, { status: 401 });
    }
    
    const updateData: UpdateUserOwnTestimonialData = {
      text,
      photoUrlsInput,
      videoUrlsInput,
    };

    const result = await updateUserOwnTestimonialLogic(testimonialId, userId, updateData);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, message: result.message, errors: result.errors }, { status: result.message?.includes("authorized") || result.message?.includes("expired") ? 403 : 400 });
    }
  } catch (error) {
    console.error(`Error updating testimonial ${testimonialId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update testimonial due to a server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { testimonialId: string } }
) {
  const testimonialId = params.testimonialId;
  if (!testimonialId) {
    return NextResponse.json({ message: 'Testimonial ID is required' }, { status: 400 });
  }

  try {
    // Note: Ensure deleteTestimonialByIdLogic is secure and only callable by admins if direct.
    // For user-initiated deletion, more checks would be needed.
    // For now, assuming this is called from admin context or similar.
    const result = await deleteTestimonialByIdLogic(testimonialId);
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error deleting testimonial ${testimonialId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to delete testimonial due to a server error.' }, { status: 500 });
  }
}
