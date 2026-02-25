'use client'

import type { UGCContractBuilderState } from './CreateRiftForm'

interface UGCContractPreviewProps {
  state: UGCContractBuilderState
  itemTitle: string
  itemDescription: string
  creatorRole: 'BUYER' | 'SELLER'
  currentUserName: string | null
  currentUserEmail: string
  counterpartyName: string | null
  counterpartyRiftId: string | null
  totalAmount: number
  currency: string
}

export default function UGCContractPreview({
  state,
  itemTitle,
  itemDescription,
  creatorRole,
  currentUserName,
  currentUserEmail,
  counterpartyName,
  counterpartyRiftId,
  totalAmount,
  currency,
}: UGCContractPreviewProps) {
  const currencySymbol = currency === 'USD' || currency === 'CAD' ? '$' : currency
  const roleLabel = creatorRole === 'BUYER' ? 'Brand' : 'Creator'
  const otherRoleLabel = creatorRole === 'BUYER' ? 'Creator' : 'Brand'

  return (
    <div className="p-5 border border-white/10 rounded-xl bg-black/40 max-h-[650px] overflow-y-auto">
      <h3 className="text-sm font-light text-white/80 mb-4 uppercase tracking-widest">
        Contract Preview
      </h3>

      {/* Parties */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Parties
        </h4>
        <p className="text-xs text-white/80">
          <span className="font-semibold">{roleLabel}:</span>{' '}
          {currentUserName || currentUserEmail}
        </p>
        <p className="text-xs text-white/80">
          <span className="font-semibold">{otherRoleLabel}:</span>{' '}
          {counterpartyName || 'Pending selection'}{' '}
          {counterpartyRiftId ? (
            <span className="text-white/50 font-mono ml-1">({counterpartyRiftId})</span>
          ) : null}
        </p>
      </section>

      {/* Deal overview */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Deal Overview
        </h4>
        <p className="text-sm text-white font-light">{itemTitle || 'Untitled UGC agreement'}</p>
        <p className="mt-1 text-xs text-white/70 whitespace-pre-wrap">{itemDescription}</p>
      </section>

      {/* Deliverables */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Deliverables
        </h4>
        <p className="text-xs text-white/80">
          Creator will deliver <strong>{state.deliverableCount}</strong>{' '}
          {state.deliverableFormat === 'video' ? 'video' : 'photo'} asset
          {state.deliverableCount === 1 ? '' : 's'} in {state.aspectRatio} aspect ratio at{' '}
          {state.resolution || 'specified resolution'}.
        </p>
        {state.deliverableFormat === 'video' && state.durationSeconds && (
          <p className="text-xs text-white/70">
            Target duration: ~{state.durationSeconds} seconds per video.
          </p>
        )}
        <p className="text-xs text-white/70 mt-1">
          Raw files {state.rawFilesIncluded ? 'will' : 'will not'} be included as part of delivery.
        </p>
      </section>

      {/* Deadlines */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Deadlines
        </h4>
        <p className="text-xs text-white/80">
          Draft assets due by <strong>{state.draftDueDate || 'TBD'}</strong>. Final assets due by{' '}
          <strong>{state.finalDueDate || 'TBD'}</strong>.
        </p>
      </section>

      {/* Revisions */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Revisions
        </h4>
        <p className="text-xs text-white/80">
          Included revision rounds: <strong>{state.revisionCount}</strong>.
        </p>
        <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">
          {state.revisionDefinitionText}
        </p>
      </section>

      {/* Usage rights */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Usage Rights
        </h4>
        <p className="text-xs text-white/80">
          Organic use on brand channels:{' '}
          <span className="font-semibold">
            {state.organicUseAllowed ? 'Allowed' : 'Not allowed'}
          </span>
          .
        </p>
        <p className="text-xs text-white/80 mt-1">
          Paid usage / ads:{' '}
          <span className="font-semibold">
            {state.paidUsageEnabled ? 'Enabled' : 'Disabled'}
          </span>
          .
        </p>
        {state.paidUsageEnabled && (
          <ul className="mt-1 text-xs text-white/70 list-disc list-inside space-y-0.5">
            {state.paidUsageDurationDays && (
              <li>Duration: {state.paidUsageDurationDays} days.</li>
            )}
            <li>
              Territory:{' '}
              {state.paidUsageTerritory === 'Custom'
                ? state.paidUsageTerritoryCustom || 'Custom territory'
                : state.paidUsageTerritory}
              .
            </li>
            {state.paidUsagePlatforms.length > 0 && (
              <li>Platforms: {state.paidUsagePlatforms.join(', ')}.</li>
            )}
          </ul>
        )}
      </section>

      {/* Whitelisting */}
      <section className="mb-5">
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Whitelisting
        </h4>
        <p className="text-xs text-white/80">
          Whitelisting:{' '}
          <span className="font-semibold">
            {state.whitelistingEnabled ? 'Enabled' : 'Not enabled'}
          </span>
          .
        </p>
        {state.whitelistingEnabled && (
          <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">
            {state.whitelistingTermsText || 'Whitelisting terms to be defined.'}
          </p>
        )}
      </section>

      {/* Acceptance window, kill fee, commercials */}
      <section>
        <h4 className="text-xs text-white/60 font-light mb-1 uppercase tracking-widest">
          Acceptance & Commercial Terms
        </h4>
        <p className="text-xs text-white/80">
          Brand has <strong>{state.acceptanceWindowDays || 3} days</strong> from each delivery to
          approve, request revision, or dispute. If no response within this window, the milestone
          auto-approves by default (subject to dispute rules).
        </p>
        <p className="text-xs text-white/80 mt-1">
          If the brand cancels after draft delivery, a{' '}
          <strong>{state.killFeePercentAfterDraft}% kill fee</strong> on the total fee will be paid
          to the creator, with the remainder refunded to the brand.
        </p>

        <div className="mt-3 text-xs text-white/80 space-y-1">
          <p>
            Total fee:{' '}
            <strong>
              {currencySymbol}
              {totalAmount.toFixed(2)} {currency}
            </strong>
            .
          </p>
          <p className="text-white/70">Milestone split (auto-generated for this template):</p>
          <ul className="list-disc list-inside space-y-0.5 text-white/70">
            <li>
              Draft Delivery – 40% (
              {currencySymbol}
              {(totalAmount * 0.4).toFixed(2)})
            </li>
            <li>
              Final Asset Delivery – 40% (
              {currencySymbol}
              {(totalAmount * 0.4).toFixed(2)})
            </li>
            <li>
              Usage Rights Activation – 20% (
              {currencySymbol}
              {(totalAmount * 0.2).toFixed(2)})
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}

