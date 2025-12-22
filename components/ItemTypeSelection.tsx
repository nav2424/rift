'use client'

import { useState } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

export type ItemType = 'TICKETS' | 'DIGITAL' | 'SERVICES'

interface ItemTypeSelectionProps {
  onSelect: (type: ItemType) => void
  role: 'BUYER' | 'SELLER'
}

const itemTypes = [
  {
    type: 'TICKETS' as ItemType,
    title: 'Event Tickets',
    description: 'Concert tickets, sports events, shows',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
      </svg>
    ),
    features: ['Event date & venue', 'Transfer method', 'Digital delivery']
  },
  {
    type: 'DIGITAL' as ItemType,
    title: 'Digital Product',
    description: 'Software, licenses, digital downloads',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    features: ['Download link', 'License key', 'Instant delivery']
  },
  {
    type: 'SERVICES' as ItemType,
    title: 'Service',
    description: 'Consulting, freelance work, services',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    features: ['Service date', 'Milestone tracking', 'Completion proof']
  }
]

export default function ItemTypeSelection({ onSelect, role }: ItemTypeSelectionProps) {
  const [selectedType, setSelectedType] = useState<ItemType | null>(null)
  const isBuying = role === 'BUYER'
  const actionVerb = isBuying ? 'buying' : 'selling'

  return (
    <div className="space-y-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-light text-white mb-4">What are you {actionVerb}?</h2>
        <p className="text-lg text-white/60 font-light max-w-xl mx-auto">Select the type of item to customize the rift process</p>
      </div>

      <div className="space-y-6">
        {/* First two items in a 2-column grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {itemTypes.slice(0, 2).map((item) => (
            <button
              key={item.type}
              onClick={() => setSelectedType(item.type)}
              className={`text-left transition-all duration-300 group ${
                selectedType === item.type
                  ? 'scale-[1.02]'
                  : 'hover:scale-[1.01]'
              }`}
            >
              <GlassCard
                variant="glass"
                hover
                className={`p-8 cursor-pointer border-2 transition-all h-full ${
                  selectedType === item.type
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    selectedType === item.type
                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-blue-400'
                      : 'bg-white/5 border border-white/10 text-white/60 group-hover:bg-white/10 group-hover:text-white/80'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-light text-white mb-3">{item.title}</h3>
                    <p className="text-white/70 text-sm font-light mb-6 leading-relaxed">{item.description}</p>
                    <ul className="space-y-2.5">
                      {item.features.map((feature, idx) => (
                        <li key={idx} className="text-white/60 text-sm font-light flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            selectedType === item.type ? 'bg-blue-400' : 'bg-white/40'
                          }`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedType === item.type && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-2 border-blue-400/50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </GlassCard>
            </button>
          ))}
        </div>

        {/* Third item (Service) centered below */}
        {itemTypes[2] && (
          <div className="flex justify-center">
            <div className="w-full md:w-1/2">
              <button
                onClick={() => setSelectedType(itemTypes[2].type)}
                className={`text-left transition-all duration-300 group w-full ${
                  selectedType === itemTypes[2].type
                    ? 'scale-[1.02]'
                    : 'hover:scale-[1.01]'
                }`}
              >
                <GlassCard
                  variant="glass"
                  hover
                  className={`p-8 cursor-pointer border-2 transition-all h-full ${
                    selectedType === itemTypes[2].type
                      ? 'border-white/30 bg-white/5'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      selectedType === itemTypes[2].type
                        ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border border-white/10 text-white/60 group-hover:bg-white/10 group-hover:text-white/80'
                    }`}>
                      {itemTypes[2].icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-light text-white mb-3">{itemTypes[2].title}</h3>
                      <p className="text-white/70 text-sm font-light mb-6 leading-relaxed">{itemTypes[2].description}</p>
                      <ul className="space-y-2.5">
                        {itemTypes[2].features.map((feature, idx) => (
                          <li key={idx} className="text-white/60 text-sm font-light flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              selectedType === itemTypes[2].type ? 'bg-blue-400' : 'bg-white/40'
                            }`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {selectedType === itemTypes[2].type && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-2 border-blue-400/50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedType && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => onSelect(selectedType)}
            className="min-w-[260px] px-12 py-4 group relative overflow-hidden backdrop-blur-xl bg-white/[0.06] border border-white/20 hover:border-white/30 hover:bg-white/10 transition-all duration-300 shadow-lg shadow-black/20 rounded-lg text-white font-light text-base focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-[0.98]"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <span className="flex items-center justify-center gap-3 relative z-10">
              <span>Continue</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
          </button>
        </div>
      )}
    </div>
  )
}

