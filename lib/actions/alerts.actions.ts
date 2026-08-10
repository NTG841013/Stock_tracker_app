'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert } from '@/database/models/alert.model';
import { auth } from '../better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const addAlert = async (
  symbol: string,
  company: string,
  alertName: string,
  alertType: 'upper' | 'lower',
  threshold: number
) => {
  try {
    await connectToDatabase();

    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) redirect('/sign-in');

    const alert = new Alert({
      userId: session.user.id,
      symbol: symbol.toUpperCase(),
      company: company.trim(),
      alertName: alertName.trim(),
      alertType,
      threshold,
    });

    await alert.save();
    revalidatePath('/watchlist');

    return { success: true };
  } catch (error) {
    console.error('Error adding alert:', error);
    return { success: false, error: 'Failed to add alert' };
  }
};
