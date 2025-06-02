
import { NextResponse } from 'next/server';
import { submitTestimonialLogic, getTestimonialsLogic, testimonialSubmitSchema } from '@/lib/actions';
import type { Testimonial } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as Testimonial['status'] | undefined;
  const userId = searchParams.get('userId') || undefined;

  try {
    const testimonials = await getTestimonialsLogic(status, userId);
    return NextResponse.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return NextResponse.json({ message: 'Failed to fetch testimonials', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitTestimonialLogic(body);

    if (result.success) {
      return NextResponse.json({ message: result.message, testimonial: result.testimonial }, { status: 201 });
    } else {
      return NextResponse.json({ message: result.message, errors: result.errors }, { status: 400 });
    }
  } catch (error) {
    console.error('Error submitting testimonial:', error);
    return NextResponse.json({ message: 'Failed to submit testimonial', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

    