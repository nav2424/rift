'use client'

import { useState, useEffect } from 'react'
import { createClientClient } from '@/lib/supabase'

interface DeliveryStatusProps {
  riftId: string
  itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
  status: string
}

export default function DeliveryStatus({ riftId, itemType, status }: DeliveryStatusProps) {
  const [deliveryData, setDeliveryData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDeliveryData = async () => {
      try {
        if (itemType === 'DIGITAL') {
          const response = await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
            method: 'POST',
          })
          if (response.ok) {
            const data = await response.json()
            setDeliveryData({ type: 'digital', ...data.delivery })
          }
        } else if (itemType === 'TICKETS') {
          const supabase = createClientClient()
          if (supabase) {
            const { data } = await supabase
              .from('ticket_transfers')
              .select('*')
              .eq('rift_id', riftId)
              .single()
            
            if (data) {
              setDeliveryData({ type: 'ticket', ...data })
            }
          }
        } else if (itemType === 'SERVICES') {
          // Check for marked delivered event
          const response = await fetch(`/api/rifts/${riftId}`)
          if (response.ok) {
            const rift = await response.json()
            // Services status is shown via status field
            setDeliveryData({ type: 'service', status: rift.status })
          }
        }
      } catch (error) {
        console.error('Load delivery data error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDeliveryData()
  }, [riftId, itemType])

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="text-white/60 font-light text-sm">Loading delivery status...</div>
      </div>
    )
  }

  if (!deliveryData) {
    return null
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <h3 className="text-sm font-medium text-white/90 uppercase tracking-wide">
        Delivery Status
      </h3>

      {deliveryData.type === 'digital' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">File</span>
            <span className="text-white/90 text-sm font-medium">{deliveryData.fileName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Size</span>
            <span className="text-white/70 text-sm">
              {deliveryData.sizeBytes < 1024
                ? `${deliveryData.sizeBytes} B`
                : deliveryData.sizeBytes < 1024 * 1024
                ? `${(deliveryData.sizeBytes / 1024).toFixed(2)} KB`
                : `${(deliveryData.sizeBytes / (1024 * 1024)).toFixed(2)} MB`}
            </span>
          </div>
          {status === 'DELIVERED_PENDING_RELEASE' && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-green-400/80 text-xs">✓ Delivery uploaded</span>
            </div>
          )}
        </div>
      )}

      {deliveryData.type === 'ticket' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Provider</span>
            <span className="text-white/90 text-sm font-medium capitalize">
              {deliveryData.provider}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Transfer Email</span>
            <span className="text-white/70 text-sm">{deliveryData.transfer_to_email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Status</span>
            <span
              className={`text-sm font-medium ${
                deliveryData.status === 'buyer_confirmed'
                  ? 'text-green-400'
                  : deliveryData.status === 'seller_sent'
                  ? 'text-blue-400'
                  : 'text-yellow-400'
              }`}
            >
              {deliveryData.status === 'buyer_confirmed'
                ? 'Confirmed'
                : deliveryData.status === 'seller_sent'
                ? 'Transfer Sent'
                : 'Pending'}
            </span>
          </div>
          {deliveryData.seller_claimed_sent_at && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-blue-400/80 text-xs">
                ✓ Seller marked as sent{' '}
                {new Date(deliveryData.seller_claimed_sent_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {deliveryData.buyer_confirmed_received_at && (
            <div className="pt-1">
              <span className="text-green-400/80 text-xs">
                ✓ Buyer confirmed receipt{' '}
                {new Date(deliveryData.buyer_confirmed_received_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {deliveryData.type === 'service' && (
        <div className="space-y-2">
          {status === 'DELIVERED_PENDING_RELEASE' ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400/80 text-xs">✓ Service marked as delivered</span>
            </div>
          ) : (
            <div className="text-white/60 text-sm">Awaiting delivery confirmation</div>
          )}
        </div>
      )}
    </div>
  )
}

