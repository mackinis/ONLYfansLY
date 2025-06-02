
import { NextResponse } from 'next/server';
import { getAnnouncementsLogic } from '@/lib/actions';
import type { Announcement } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';
  const nonExpiredOnly = searchParams.get('nonExpiredOnly') === 'true';

  try {
    const announcements: Announcement[] = await getAnnouncementsLogic({ activeOnly, nonExpiredOnly });
    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ message: 'Failed to fetch announcements' }, { status: 500 });
  }
}
