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

    // Search by email or name (username)
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
              {
                email: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 10, // Limit results
      orderBy: {
        email: 'asc',
      },
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

