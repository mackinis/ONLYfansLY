
import { NextResponse } from 'next/server';
import { curateTestimonialsFlow, CurateTestimonialsInput, CurateTestimonialsOutput } from '@/ai/flows/curate-testimonials';

export async function POST(request: Request) {
  try {
    const input: CurateTestimonialsInput = await request.json();
    
    // Basic validation: ensure input is an array
    if (!Array.isArray(input)) {
      return NextResponse.json({ message: 'Invalid input: Expected an array of testimonials.' }, { status: 400 });
    }

    const curatedOutput: CurateTestimonialsOutput = await curateTestimonialsFlow(input);
    return NextResponse.json(curatedOutput);
  } catch (error) {
    console.error('Error in AI curation API route:', error);
    let errorMessage = 'Failed to curate testimonials via AI.';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Check for specific Genkit error structure if available (example)
    // if (error && typeof error === 'object' && 'details' in error) {
    //    errorMessage = (error as any).details;
    // }
    // if (error && typeof error === 'object' && 'status' in error) {
    //    statusCode = (error as any).status || 500;
    // }


    return NextResponse.json({ message: errorMessage, error: String(error) }, { status: statusCode });
  }
}

    