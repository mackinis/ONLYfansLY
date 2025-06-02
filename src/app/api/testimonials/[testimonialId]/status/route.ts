
import { NextResponse } from 'next/server';
import { updateTestimonialStatusLogic } from '@/lib/actions'; // Assuming this logic function exists
import type { Testimonial } from '@/lib/types';

// PUT /api/testimonials/[testimonialId]/status
// This is a new route specifically for updating status, often used by admin.
export async function PUT(
  request: Request,
  { params }: { params: { testimonialId: string } }
) {
  const testimonialId = params.testimonialId;
  if (!testimonialId) {
    return NextResponse.json({ message: 'Testimonial ID is required' }, { status: 400 });
  }

  try {
    const { status } = await request.json() as { status: Testimonial['status'] };

    if (!status || !['pending', 'approved', 'denied'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided.' }, { status: 400 });
    }

    // In a real app, add admin authentication/authorization here
    const updatedTestimonial = await updateTestimonialStatusLogic(testimonialId, status);

    if (updatedTestimonial) {
      return NextResponse.json({ success: true, message: `Testimonial status updated to ${status}.`, testimonial: updatedTestimonial });
    } else {
      return NextResponse.json({ success: false, message: 'Failed to update testimonial status or testimonial not found.' }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error updating status for testimonial ${testimonialId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update testimonial status due to a server error.' }, { status: 500 });
  }
}
    