import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get('q')?.trim()
    const exactRiftIdOnly = searchParams.get('exactRiftId') === 'true'

    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ users: [] }, { status: 200 })
    }

    // For Rift User ID searches, normalize to uppercase (Rift IDs are stored as RIFT######)
    const query = exactRiftIdOnly ? rawQuery.toUpperCase() : rawQuery

    let users

    if (exactRiftIdOnly) {
      // For rift creation: only exact Rift User ID match
      // Require that the query matches the Rift User ID exactly
      // Rift IDs are stored in uppercase format (RIFT111111), so we normalize the query to uppercase
      // Note: We don't filter by signupCompleted here because having a Rift User ID
      // means the user is in the system and can be found for rift creation
      users = await prisma.user.findMany({
        where: {
          AND: [
            {
              id: {
                not: session.user.id, // Exclude current user
              },
            },
            {
              riftUserId: {
                equals: query, // Exact match (query is normalized to uppercase)
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          riftUserId: true,
          email: true,
        },
        take: 1, // Only one result expected for exact match
      })
    } else {
      // For general search: Search by name, email, or Rift user ID (partial match for name/email, exact for Rift ID)
      const searchLower = query.toLowerCase()
      
      users = await prisma.user.findMany({
        where: {
          AND: [
            {
              id: {
                not: session.user.id, // Exclude current user
              },
            },
            {
              OR: [
                // Search by name (case-insensitive partial match)
                {
                  name: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                // Search by email (case-insensitive partial match)
                {
                  email: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                // Search by Rift user ID (exact match, case-sensitive)
                {
                  riftUserId: {
                    equals: query,
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          riftUserId: true,
          email: true,
        },
        take: 10, // Limit results to 10
        orderBy: [
          // Prioritize exact matches
          {
            name: {
              sort: 'asc',
              nulls: 'last',
            },
          },
        ],
      })
    }

    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error('Search users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

