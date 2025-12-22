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
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] }, { status: 200 })
    }

    // Search by name, email, or Rift user ID (partial match for name/email, exact for Rift ID)
    const searchLower = query.toLowerCase()
    
    const users = await prisma.user.findMany({
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

    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error('Search users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

