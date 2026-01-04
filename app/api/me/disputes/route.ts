import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.userId;

    // Get all rifts where the user is buyer or seller
    const userRifts = await prisma.riftTransaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      select: {
        id: true,
      },
    });

    const riftIds = userRifts.map(rift => rift.id);

    // Fetch disputes from Supabase where:
    // 1. User opened the dispute (opened_by = userId)
    // 2. OR the dispute is for a rift where user is buyer or seller
    const supabase = createServerClient();
    
    let query = supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter: disputes opened by user OR disputes for rifts where user is involved
    if (riftIds.length > 0) {
      query = query.or(`opened_by.eq.${userId},rift_id.in.(${riftIds.join(',')})`);
    } else {
      // If user has no rifts, only show disputes they opened
      query = query.eq('opened_by', userId);
    }

    const { data: disputes, error: disputesError } = await query;

    if (disputesError) {
      console.error('Get disputes error:', disputesError);
      return NextResponse.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      );
    }

    // Enrich disputes with rift and user information
    const enrichedDisputes = await Promise.all(
      (disputes || []).map(async (dispute) => {
        // Get rift information
        const rift = await prisma.riftTransaction.findUnique({
          where: { id: dispute.rift_id },
          include: {
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
        });

        // Get user who opened the dispute
        let raisedBy = null;
        if (dispute.opened_by) {
          const user = await prisma.user.findUnique({
            where: { id: dispute.opened_by },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });
          raisedBy = user;
        }

        return {
          id: dispute.id,
          status: dispute.status,
          reason: dispute.reason || '',
          category: dispute.category_snapshot || '',
          createdAt: dispute.created_at,
          rift: rift ? {
            id: rift.id,
            itemTitle: rift.itemTitle,
            status: rift.status,
            amount: rift.amount,
            currency: rift.currency,
            buyer: rift.buyer,
            seller: rift.seller,
          } : null,
          raisedBy: raisedBy || {
            id: dispute.opened_by || '',
            name: null,
            email: '',
          },
        };
      })
    );

    // Filter out disputes where rift is null (shouldn't happen, but safety check)
    const validDisputes = enrichedDisputes.filter(d => d.rift !== null);

    return NextResponse.json({ Dispute: validDisputes });
  } catch (error) {
    console.error('Get user disputes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

