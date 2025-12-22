import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { logEvent } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * PATCH /api/admin/risk/users/[userId]/restrictions
 * Update user restrictions (admin override)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const {
      removeDisputesRestriction,
      unfreezeFunds,
      addCategoryBlock,
      clearCategoryBlock,
      category,
    } = body

    const supabase = createServerClient()

    // Get current restrictions
    const { data: current } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const currentBlocked = current?.categories_blocked || []
    let updates: any = {}

    // Remove disputes restriction
    if (removeDisputesRestriction) {
      updates.disputes_restricted_until = null
      
      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'restrict_disputes', // Using same type for removal tracking
        reason: `Admin removed disputes restriction`,
        meta: { adminId: auth.userId, action: 'removed' },
      })
    }

    // Unfreeze funds
    if (unfreezeFunds) {
      updates.funds_frozen = false
      updates.frozen_reason = null

      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'freeze_funds', // Using same type for unfreeze tracking
        reason: `Admin unfroze funds`,
        meta: { adminId: auth.userId, action: 'unfroze' },
      })
    }

    // Add category block
    if (addCategoryBlock && category) {
      const categoryUpper = category.toUpperCase()
      if (!currentBlocked.includes(categoryUpper)) {
        updates.categories_blocked = [...currentBlocked, categoryUpper]

        await supabase.from('enforcement_actions').insert({
          user_id: userId,
          action_type: 'restrict_category',
          reason: `Admin blocked category: ${categoryUpper}`,
          meta: { adminId: auth.userId, category: categoryUpper, action: 'added' },
        })
      }
    }

    // Clear category block
    if (clearCategoryBlock && category) {
      const categoryUpper = category.toUpperCase()
      if (currentBlocked.includes(categoryUpper)) {
        updates.categories_blocked = currentBlocked.filter((c: string) => c !== categoryUpper)

        await supabase.from('enforcement_actions').insert({
          user_id: userId,
          action_type: 'restrict_category',
          reason: `Admin unblocked category: ${categoryUpper}`,
          meta: { adminId: auth.userId, category: categoryUpper, action: 'removed' },
        })
      }
    }

    // Update restrictions
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      
      await supabase.from('user_restrictions').upsert({
        user_id: userId,
        ...updates,
      }, {
        onConflict: 'user_id',
      })

      // Log event
      await logEvent(
        null, // No specific rift
        RiftEventActorType.ADMIN,
        auth.userId,
        'ADMIN_RISK_OVERRIDE',
        {
          userId,
          updates,
        },
        undefined
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update restrictions error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

