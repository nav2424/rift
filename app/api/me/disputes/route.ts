import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.userId;

    // Get disputes for rifts where user is buyer or seller
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          {
            EscrowTransaction: {
              buyerId: userId,
            },
          },
          {
            EscrowTransaction: {
              sellerId: userId,
            },
          },
        ],
      },
      include: {
        EscrowTransaction: {
          select: {
            id: true,
            itemTitle: true,
            status: true,
            subtotal: true,
            currency: true,
            buyer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            seller: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ disputes });
  } catch (error) {
    console.error('Get user disputes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

