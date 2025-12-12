'use client'

import { useState } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

export type ItemType = 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES'

interface ItemTypeSelectionProps {
  onSelect: (type: ItemType) => void
}

const itemTypes = [
  {
    type: 'PHYSICAL' as ItemType,
    title: 'Physical Item',
    description: 'Products that require shipping and delivery',
    icon: '📦',
    features: ['Shipping address required', 'Tracking number', 'Shipment proof']
  },
  {
    type: 'TICKETS' as ItemType,
    title: 'Event Tickets',
    description: 'Concert tickets, sports events, shows',
    icon: '🎫',
    features: ['Event date & venue', 'Transfer method', 'Digital delivery']
  },
  {
    type: 'DIGITAL' as ItemType,
    title: 'Digital Product',
    description: 'Software, licenses, digital downloads',
    icon: '💾',
    features: ['Download link', 'License key', 'Instant delivery']
  },
  {
    type: 'SERVICES' as ItemType,
    title: 'Service',
    description: 'Consulting, freelance work, services',
    icon: '🔧',
    features: ['Service date', 'Milestone tracking', 'Completion proof']
  }
]

export default function ItemTypeSelection({ onSelect }: ItemTypeSelectionProps) {
  const [selectedType, setSelectedType] = useState<ItemType | null>(null)

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-light text-white mb-3">What are you selling?</h2>
        <p className="text-white/60 font-light">Select the type of item to customize the escrow process</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {itemTypes.map((item) => (
          <button
            key={item.type}
            onClick={() => setSelectedType(item.type)}
            className={`text-left transition-all duration-300 ${
              selectedType === item.type
                ? 'scale-105'
                : 'hover:scale-[1.02]'
            }`}
          >
            <GlassCard
              className={`cursor-pointer border-2 transition-all ${
                selectedType === item.type
                  ? 'border-white/40 bg-white/5'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{item.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-light text-white mb-2">{item.title}</h3>
                  <p className="text-white/60 text-sm font-light mb-4">{item.description}</p>
                  <ul className="space-y-1">
                    {item.features.map((feature, idx) => (
                      <li key={idx} className="text-white/50 text-xs font-light flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/40" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                {selectedType === item.type && (
                  <div className="w-5 h-5 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </GlassCard>
          </button>
        ))}
      </div>

      {selectedType && (
        <div className="flex justify-center pt-4">
          <PremiumButton
            onClick={() => onSelect(selectedType)}
            size="lg"
            className="min-w-[200px]"
          >
            Continue
          </PremiumButton>
        </div>
      )}
    </div>
  )
}

