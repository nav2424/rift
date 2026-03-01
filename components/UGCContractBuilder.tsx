'use client'

import type { UGCContractBuilderState } from './CreateRiftForm'

interface UGCContractBuilderProps {
  state: UGCContractBuilderState
  onChange: (next: UGCContractBuilderState) => void
  totalAmount: number
  currency: string
}

export default function UGCContractBuilder({
  state,
  onChange,
  totalAmount,
  currency,
}: UGCContractBuilderProps) {
  const currencySymbol = currency === 'USD' || currency === 'CAD' ? '$' : currency

  const update = (patch: Partial<UGCContractBuilderState>) => {
    onChange({ ...state, ...patch })
  }

  const updateNested = <K extends keyof UGCContractBuilderState, V extends keyof UGCContractBuilderState[K]>(
    key: K,
    innerKey: V,
    value: any
  ) => {
    const current = state[key] as any
    onChange({
      ...state,
      [key]: {
        ...current,
        [innerKey]: value,
      },
    })
  }

  const draftAmount = (totalAmount * 0.4).toFixed(2)
  const finalAmount = (totalAmount * 0.4).toFixed(2)
  const rightsAmount = (totalAmount * 0.2).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Deliverables */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Deliverables</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Number of assets</label>
            <input
              type="number"
              min={1}
              value={state.deliverableCount}
              onChange={(e) => update({ deliverableCount: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Format</label>
            <select
              value={state.deliverableFormat}
              onChange={(e) => update({ deliverableFormat: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="video">Video</option>
              <option value="photo">Photo</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Aspect ratio</label>
            <select
              value={state.aspectRatio}
              onChange={(e) => update({ aspectRatio: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="9:16">9:16 (vertical)</option>
              <option value="1:1">1:1 (square)</option>
              <option value="16:9">16:9 (horizontal)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Resolution</label>
            <input
              type="text"
              value={state.resolution}
              onChange={(e) => update({ resolution: e.target.value })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="e.g., 1080x1920"
            />
          </div>
        </div>
        {state.deliverableFormat === 'video' && (
          <div className="mt-4">
            <label className="block text-xs text-gray-600 mb-1">Duration (seconds)</label>
            <input
              type="number"
              min={1}
              value={state.durationSeconds ?? ''}
              onChange={(e) => update({ durationSeconds: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          <input
            id="ugc-raw-files"
            type="checkbox"
            checked={state.rawFilesIncluded}
            onChange={(e) => update({ rawFilesIncluded: e.target.checked })}
            className="w-4 h-4 rounded border border-gray-300 bg-gray-50 text-blue-500 focus:ring-2 focus:ring-blue-500/40"
          />
          <label htmlFor="ugc-raw-files" className="text-xs text-gray-600">
            Raw files (project files, unedited footage) included
          </label>
        </div>
      </div>

      {/* Deadlines */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Deadlines</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Draft due date</label>
            <input
              type="date"
              value={state.draftDueDate}
              onChange={(e) => update({ draftDueDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Final due date</label>
            <input
              type="date"
              value={state.finalDueDate}
              onChange={(e) => update({ finalDueDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
        </div>
      </div>

      {/* Revisions */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Revisions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Revision rounds</label>
            <input
              type="number"
              min={0}
              value={state.revisionCount}
              onChange={(e) => update({ revisionCount: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Definition of a revision</label>
            <textarea
              value={state.revisionDefinitionText}
              onChange={(e) => update({ revisionDefinitionText: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Usage rights */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Usage rights</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="ugc-organic"
              type="checkbox"
              checked={state.organicUseAllowed}
              onChange={(e) => update({ organicUseAllowed: e.target.checked })}
              className="w-4 h-4 rounded border border-gray-300 bg-gray-50 text-blue-500 focus:ring-2 focus:ring-blue-500/40"
            />
            <label htmlFor="ugc-organic" className="text-xs text-gray-600">
              Organic use allowed on brand channels
            </label>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-xs text-gray-600">Paid usage / ads</p>
              <p className="text-[11px] text-[#86868b]">
                Allow brand to run paid ads using the content.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={state.paidUsageEnabled}
                onChange={(e) => update({ paidUsageEnabled: e.target.checked })}
                className="w-4 h-4 rounded border border-gray-300 bg-gray-50 text-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>

          {state.paidUsageEnabled && (
            <div className="mt-3 space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Duration</label>
                  <select
                    value={state.paidUsageDurationDays ?? 30}
                    onChange={(e) =>
                      update({ paidUsageDurationDays: parseInt(e.target.value, 10) as any })
                    }
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>365 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Territory</label>
                  <select
                    value={state.paidUsageTerritory}
                    onChange={(e) => update({ paidUsageTerritory: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="Global">Global</option>
                    <option value="Canada">Canada</option>
                    <option value="USA">USA</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Platforms</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['Meta', 'TikTok', 'YouTube', 'Other'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const exists = state.paidUsagePlatforms.includes(p)
                          const next = exists
                            ? state.paidUsagePlatforms.filter((x) => x !== p)
                            : [...state.paidUsagePlatforms, p]
                          update({ paidUsagePlatforms: next })
                        }}
                        className={`px-2 py-1 rounded-full text-[11px] border ${
                          state.paidUsagePlatforms.includes(p)
                            ? 'bg-blue-500/30 border-blue-400 text-blue-100'
                            : 'bg-gray-50 border-gray-300 text-[#86868b]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {state.paidUsageTerritory === 'Custom' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Custom territory</label>
                  <input
                    type="text"
                    value={state.paidUsageTerritoryCustom ?? ''}
                    onChange={(e) => update({ paidUsageTerritoryCustom: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="e.g., North America, EU only"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Whitelisting */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Whitelisting</h3>
        <div className="flex items-center gap-2 mb-3">
          <input
            id="ugc-whitelisting"
            type="checkbox"
            checked={state.whitelistingEnabled}
            onChange={(e) => update({ whitelistingEnabled: e.target.checked })}
            className="w-4 h-4 rounded border border-gray-300 bg-gray-50 text-blue-500 focus:ring-2 focus:ring-blue-500/40"
          />
          <label htmlFor="ugc-whitelisting" className="text-xs text-gray-600">
            Allow brand to run ads from creator’s handle (whitelisting)
          </label>
        </div>
        {state.whitelistingEnabled && (
          <textarea
            value={state.whitelistingTermsText}
            onChange={(e) => update({ whitelistingTermsText: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            placeholder="Describe whitelisting terms: duration, spend caps, approval process..."
          />
        )}
      </div>

      {/* Acceptance window + kill fee + commercials */}
      <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
        <h3 className="text-sm font-light text-[#1d1d1f] mb-3">Acceptance window & kill fee</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Acceptance window (days)</label>
            <input
              type="number"
              min={1}
              value={state.acceptanceWindowDays}
              onChange={(e) =>
                update({ acceptanceWindowDays: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Kill fee after draft (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={state.killFeePercentAfterDraft}
              onChange={(e) =>
                update({ killFeePercentAfterDraft: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-gray-200 pt-4 space-y-2">
          <p className="text-xs text-[#86868b] font-light uppercase tracking-widest">
            Milestone Split Preview
          </p>
          <div className="space-y-1 text-xs text-gray-700">
            <div className="flex items-center justify-between">
              <span>Draft Delivery (40%)</span>
              <span>
                {currencySymbol}
                {draftAmount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Final Asset Delivery (40%)</span>
              <span>
                {currencySymbol}
                {finalAmount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Usage Rights Activation (20%)</span>
              <span>
                {currencySymbol}
                {rightsAmount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

