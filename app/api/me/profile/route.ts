import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone } = body;

    const updateData: {
      name?: string | null;
      phone?: string | null;
    } = {};

    if (name !== undefined) {
      updateData.name = name || null;
    }

    if (phone !== undefined) {
      if (phone) {
        // Validate and format phone number
        const { formatPhoneNumber, validatePhoneNumber } = await import('@/lib/sms')
        const validation = validatePhoneNumber(phone)
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error || 'Invalid phone number format' },
            { status: 400 }
          )
        }
        const { formatted: formattedPhone, error: formatError } = formatPhoneNumber(phone)
        if (formatError || !formattedPhone) {
          return NextResponse.json(
            { error: formatError || 'Failed to format phone number' },
            { status: 400 }
          )
        }
        
        // Check if phone number is already in use by another user
        const existingUserByPhone = await prisma.user.findFirst({
          where: {
            phone: formattedPhone,
            id: { not: auth.userId }, // Exclude current user
          },
        })

        if (existingUserByPhone) {
          return NextResponse.json(
            { error: 'This phone number is already associated with another account' },
            { status: 400 }
          )
        }
        
        updateData.phone = formattedPhone
      } else {
        updateData.phone = null
      }
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

