'use client'

import { ReactNode, useState } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

/**
 * Tabs component for organizing content into tabbed sections
 */
export default function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className={className}>
      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-light transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'text-[#1d1d1f] border-gray-300'
                  : 'text-[#86868b] border-transparent hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>{activeTabContent}</div>
    </div>
  )
}

