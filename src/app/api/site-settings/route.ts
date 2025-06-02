
import { NextResponse } from 'next/server';
import { getSiteSettingsLogic, updateSiteSettingsLogic, siteSettingsInternalSchema } from '@/lib/actions';
import type { SiteSettings } from '@/lib/types';

export async function GET() {
  try {
    const settings = await getSiteSettingsLogic();
    // Ensure what we're about to send is serializable and not undefined/null unexpectedly
    if (!settings) {
        console.error('Error: getSiteSettingsLogic returned null/undefined unexpectedly for GET /api/site-settings.');
        return NextResponse.json({ message: 'Failed to fetch site settings: Logic returned no data.' }, { status: 500 });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Critical error in GET /api/site-settings:', error);
    
    let errorMessage = 'Failed to fetch site settings due to an internal server error.';
    let errorDetails: any = { rawError: String(error) }; // Basic error string

    if (error instanceof Error) {
      errorMessage = error.message;
      // Be cautious about sending the full stack in production
      errorDetails = { name: error.name, message: error.message /*, stack: error.stack */ };
    }
    
    return NextResponse.json({ 
        message: 'Failed to fetch site settings', 
        error: errorMessage, 
        details: errorDetails 
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // Validate body against a partial schema or the full schema if all fields are expected
    // For simplicity, we'll rely on updateSiteSettingsLogic's internal validation for now.
    const result = await updateSiteSettingsLogic(body as Partial<SiteSettings>);
    if (result.success) {
      return NextResponse.json({ message: result.message, updatedSettings: result.updatedSettings });
    } else {
      return NextResponse.json({ message: result.message || 'Failed to update site settings', errors: result.errors }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating site settings via API:', error);
    let errorMessage = 'Failed to update site settings due to a server error.';
    let errorDetails: any = { rawError: String(error) };
     if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { name: error.name, message: error.message };
    }
    return NextResponse.json({ 
        success: false, 
        message: errorMessage, 
        error: errorDetails 
    }, { status: 500 });
  }
}

    