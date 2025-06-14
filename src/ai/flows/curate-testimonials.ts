
// 'use server'; // Removed: This will be called by an API route
/**
 * @fileOverview Curates and highlights the most impactful and recent testimonials using AI.
 *
 * - curateTestimonialsFlow - A function that handles the plant diagnosis process.
 * - CurateTestimonialsInput - The input type for the curateTestimonials function.
 * - CurateTestimonialsOutput - The return type for the curateTestimonials function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CurateTestimonialsInputSchema = z.array(
  z.object({
    id: z.string().describe('Unique identifier for the testimonial.'),
    text: z.string().describe('The text content of the testimonial.'),
    author: z.string().describe('The author of the testimonial.'),
    date: z.string().describe('The date the testimonial was submitted (ISO format).'),
  })
).describe('An array of testimonials to curate.');

export type CurateTestimonialsInput = z.infer<typeof CurateTestimonialsInputSchema>;

const CurateTestimonialsOutputSchema = z.array(
  z.object({
    id: z.string().describe('Unique identifier for the curated testimonial.'),
    reason: z.string().describe('The reason why this testimonial was selected for curation.'),
  })
).describe('An array of curated testimonial IDs with reasons for selection.');

export type CurateTestimonialsOutput = z.infer<typeof CurateTestimonialsOutputSchema>;

const curateTestimonialsPrompt = ai.definePrompt({
  name: 'curateTestimonialsPrompt',
  input: {schema: CurateTestimonialsInputSchema},
  output: {schema: CurateTestimonialsOutputSchema},
  prompt: `You are an AI assistant that curates testimonials to highlight the most impactful and recent ones.

  Given the following testimonials:
  {{#each this}}
  - ID: {{id}}
    Text: {{text}}
    Author: {{author}}
    Date: {{date}}
  {{/each}}

  Select the testimonials that are most impactful, recent, and representative of user feedback. For each selected testimonial, provide a reason for its selection.

  Return a JSON array of objects, where each object contains the 'id' of the selected testimonial and a 'reason' explaining why it was chosen.
  `,
});

export const curateTestimonialsFlow = ai.defineFlow(
  {
    name: 'curateTestimonialsFlow',
    inputSchema: CurateTestimonialsInputSchema,
    outputSchema: CurateTestimonialsOutputSchema,
  },
  async input => {
    const MAX_RETRIES = 2;
    let attempts = 0;

    while (attempts <= MAX_RETRIES) {
      try {
        const {output} = await curateTestimonialsPrompt(input);
        return output!;
      } catch (error: any) {
        attempts++;
        if (attempts > MAX_RETRIES || (error.cause && error.cause.status !== 503)) {
          console.error('AI curation failed after maximum retries or due to non-retryable error:', error);
          const fallbackReason = "Recently highlighted testimonial.";
          if (input && input.length > 0) {
            const sortedInput = [...input].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return sortedInput.slice(0, 3).map(testimonial => ({
              id: testimonial.id,
              reason: fallbackReason,
            }));
          }
          return [];
        }

        const delay = Math.pow(2, attempts -1) * 1000;
        console.log(`AI Curation: Attempt ${attempts} failed with 503. Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    console.error('AI Curation: Exited retry loop unexpectedly.');
    return [];
  }
);

    