
import { NextResponse } from 'next/server';
import { updateAnnouncementLogic, deleteAnnouncementLogic, announcementSchema } from '@/lib/actions';
import { z } from 'zod';

// PUT /api/admin/announcements/[id] - Updates an existing announcement
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = params.id;
  if (!announcementId) {
    return NextResponse.json({ success: false, message: 'Announcement ID is required' }, { status: 400 });
  }
  try {
    const body = await request.json();
    
    // Convert expiryDate string to Date object if necessary for validation logic
    // The logic function itself might also handle this, but good to be consistent
    let updateData = { ...body };
    if (updateData.expiryDate && typeof updateData.expiryDate === 'string') {
        updateData.expiryDate = new Date(updateData.expiryDate);
    }
    
    const result = await updateAnnouncementLogic(announcementId, updateData);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error(`Error updating announcement ${announcementId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to update announcement due to a server error.' }, { status: 500 });
  }
}

// DELETE /api/admin/announcements/[id] - Deletes an announcement
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = params.id;
  if (!announcementId) {
    return NextResponse.json({ success: false, message: 'Announcement ID is required' }, { status: 400 });
  }
  try {
    const result = await deleteAnnouncementLogic(announcementId);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      // If deleteLogic returns specific error status, use it, otherwise 500
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error(`Error deleting announcement ${announcementId}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to delete announcement due to a server error.' }, { status: 500 });
  }
}

    