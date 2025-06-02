
import { NextResponse } from 'next/server';
import { getAnnouncementsLogic, createAnnouncementLogic, announcementSchema } from '@/lib/actions';
import type { Announcement } from '@/lib/types';

// GET /api/admin/announcements - Fetches all announcements for admin panel
export async function GET(request: Request) {
  try {
    // Admin might want to see all announcements, regardless of active status or expiry
    const announcements: Announcement[] = await getAnnouncementsLogic(); // No filters
    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    return NextResponse.json({ message: 'Failed to fetch announcements', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST /api/admin/announcements - Creates a new announcement
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Convert expiryDate string to Date object if necessary
    if (body.expiryDate && typeof body.expiryDate === 'string') {
      body.expiryDate = new Date(body.expiryDate);
    }

    const result = await createAnnouncementLogic(body);

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ success: false, message: 'Failed to create announcement due to a server error.', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

    