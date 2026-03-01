'use client'

import React from 'react'
import { format } from 'date-fns'
import GlassCard from '@/components/ui/GlassCard'
import Button from '@/components/ui/Button'
import Link from 'next/link'

interface EvidencePrintViewProps {
  packet: any
}

export default function EvidencePrintView({ packet }: EvidencePrintViewProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-4">
        {/* Print controls (hidden when printing) */}
        <div className="mb-6 print:hidden flex gap-2">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-[#1d1d1f]">
            Print
          </Button>
          <Link href={`/api/admin/evidence/${packet.packet_meta.rift_id}/json${packet.packet_meta.stripe_dispute_id ? `?disputeId=${packet.packet_meta.stripe_dispute_id}` : ''}`}>
            <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-[#1d1d1f] hover:bg-zinc-700">
              Download JSON
            </Button>
          </Link>
        </div>

        {/* Evidence Document */}
        <div className="bg-white print:bg-white text-black print:text-black">
          <header className="mb-8 border-b-2 border-gray-300 pb-4">
            <h1 className="text-3xl font-bold">Evidence Packet</h1>
            <p className="text-sm text-gray-600 mt-2">
              Generated: {format(new Date(packet.packet_meta.generated_at), 'MMM dd, yyyy HH:mm:ss')}
            </p>
            {packet.packet_meta.stripe_dispute_id && (
              <p className="text-sm text-gray-600">
                Stripe Dispute ID: {packet.packet_meta.stripe_dispute_id}
              </p>
            )}
          </header>

          {/* Transaction Summary */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Transaction Summary</h2>
            <table className="w-full border-collapse border border-gray-300">
              <tbody>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Title</td>
                  <td className="p-2">{packet.transaction_summary.rift_title}</td>
                </tr>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Category</td>
                  <td className="p-2">{packet.transaction_summary.category}</td>
                </tr>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Amount</td>
                  <td className="p-2">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: packet.transaction_summary.currency,
                    }).format(packet.transaction_summary.amount)}
                  </td>
                </tr>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Status</td>
                  <td className="p-2">{packet.transaction_summary.status}</td>
                </tr>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Created</td>
                  <td className="p-2">
                    {format(new Date(packet.transaction_summary.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                </tr>
                {packet.transaction_summary.paid_at && (
                  <tr className="border border-gray-300">
                    <td className="p-2 font-semibold bg-gray-100">Paid</td>
                    <td className="p-2">
                      {format(new Date(packet.transaction_summary.paid_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Identities */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Identities</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Buyer</h3>
                <p className="text-sm">ID: {packet.identities.buyer_id}</p>
                <p className="text-sm">Email: {packet.identities.buyer_email || 'N/A'}</p>
                <p className="text-sm">Account Age: {packet.identities.buyer_account_age_days} days</p>
                <p className="text-sm">Risk Score: {packet.identities.risk_scores.buyer_risk_score}/100</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Seller</h3>
                <p className="text-sm">ID: {packet.identities.seller_id}</p>
                <p className="text-sm">Email: {packet.identities.seller_email || 'N/A'}</p>
                <p className="text-sm">Account Age: {packet.identities.seller_account_age_days} days</p>
                <p className="text-sm">Risk Score: {packet.identities.risk_scores.seller_risk_score}/100</p>
              </div>
            </div>
          </section>

          {/* Payment Details */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Payment Details</h2>
            <table className="w-full border-collapse border border-gray-300">
              <tbody>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Payment Intent ID</td>
                  <td className="p-2 font-mono text-sm">{packet.payment_details.stripe_payment_intent_id || 'N/A'}</td>
                </tr>
                <tr className="border border-gray-300">
                  <td className="p-2 font-semibold bg-gray-100">Charge ID</td>
                  <td className="p-2 font-mono text-sm">{packet.payment_details.stripe_charge_id || 'N/A'}</td>
                </tr>
                {packet.payment_details.paid_at && (
                  <tr className="border border-gray-300">
                    <td className="p-2 font-semibold bg-gray-100">Paid At</td>
                    <td className="p-2">
                      {format(new Date(packet.payment_details.paid_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Policy Acceptances */}
          {packet.policy_acceptances && packet.policy_acceptances.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Policy Acceptances</h2>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border border-gray-300 text-left">Context</th>
                    <th className="p-2 border border-gray-300 text-left">Policy Version</th>
                    <th className="p-2 border border-gray-300 text-left">Accepted At</th>
                  </tr>
                </thead>
                <tbody>
                  {packet.policy_acceptances.map((acc: any, idx: number) => (
                    <tr key={idx} className="border border-gray-300">
                      <td className="p-2">{acc.context}</td>
                      <td className="p-2">{acc.policy_version}</td>
                      <td className="p-2">
                        {format(new Date(acc.accepted_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Delivery Proof */}
          {packet.delivery_proof && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Delivery Proof</h2>
              <div className="border border-gray-300 p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {JSON.stringify(packet.delivery_proof, null, 2)}
                </pre>
              </div>
            </section>
          )}

          {/* Chat Transcript */}
          {packet.chat_transcript && packet.chat_transcript.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Chat Transcript</h2>
              <div className="border border-gray-300 p-4 max-h-96 overflow-y-auto">
                {packet.chat_transcript.map((msg: any, idx: number) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {msg.is_system ? 'System' : `User ${msg.sender_id?.slice(-8) || 'Unknown'}`}
                      </span>
                      <span className="text-xs text-gray-600">
                        {format(new Date(msg.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                      {msg.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dispute History */}
          {packet.dispute_history && packet.dispute_history.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Platform Dispute History</h2>
              {packet.dispute_history.map((dispute: any, idx: number) => (
                <div key={idx} className="mb-4 border border-gray-300 p-4">
                  <h3 className="font-semibold mb-2">
                    Dispute {idx + 1}: {dispute.reason} ({dispute.status})
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Created: {format(new Date(dispute.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                  {dispute.resolved_at && (
                    <p className="text-sm text-gray-600 mb-2">
                      Resolved: {format(new Date(dispute.resolved_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  )}
                  <p className="text-sm">Evidence Count: {dispute.evidence_count}</p>
                </div>
              ))}
            </section>
          )}

          {/* Event Timeline */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Event Timeline</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border border-gray-300 text-left">Event Type</th>
                  <th className="p-2 border border-gray-300 text-left">Actor</th>
                  <th className="p-2 border border-gray-300 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {packet.event_timeline.map((event: any, idx: number) => (
                  <tr key={idx} className="border border-gray-300">
                    <td className="p-2">{event.event_type}</td>
                    <td className="p-2">{event.actor_type}</td>
                    <td className="p-2">
                      {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Conclusion Summary */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Conclusion Summary</h2>
            <div className="border border-gray-300 p-4 bg-gray-50">
              <p className="whitespace-pre-wrap">{packet.conclusion_summary}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

