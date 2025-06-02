
import { NextResponse } from 'next/server';
import { getDashboardStatsLogic } from '@/lib/actions';
import type { DashboardStats } from '@/lib/types';

export async function GET() {
  try {
    // In a real app, you'd authenticate the admin here
    const stats: DashboardStats = await getDashboardStatsLogic();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ message: 'Failed to fetch dashboard stats', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
