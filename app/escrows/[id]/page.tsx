import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import EscrowStatusBadge from '@/components/EscrowStatusBadge'
import Timeline from '@/components/Timeline'
import ShipmentProofForm from '@/components/ShipmentProofForm'
import DeliveryProofForm from '@/components/DeliveryProofForm'
import DisputeForm from '@/components/DisputeForm'
import EscrowActions from '@/components/EscrowActions'
import MessagingPanel from '@/components/MessagingPanel'
import Card from '@/components/ui/Card'

export default async function EscrowDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  const userId = session.user.id
  const userRole = session.user.role

  const { id } = await params
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id },
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      shipmentProofs: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      timelineEvents: {
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      disputes: {
        include: {
          raisedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!escrow) {
    notFound()
  }

  // Check access: user must be buyer, seller, or admin
  const isBuyer = escrow.buyerId === userId
  const isSeller = escrow.sellerId === userId
  const isAdmin = userRole === 'ADMIN'

  if (!isBuyer && !isSeller && !isAdmin) {
    notFound()
  }

  const currentUserRole = isAdmin ? 'ADMIN' : isBuyer ? 'BUYER' : 'SELLER'

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} 
      />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight">{escrow.itemTitle}</h1>
          <div className="flex items-center gap-4">
            <EscrowStatusBadge status={escrow.status} />
            <span className="text-white/60 font-light">
              {escrow.amount} {escrow.currency}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-xl font-light text-white mb-6">Details</h2>
            <div className="space-y-4">
              <div>
                <span className="text-white/50 text-sm font-light">Item Type:</span>
                <p className="text-white/90 mt-1 font-light">
                  {escrow.itemType === 'PHYSICAL' ? 'Physical Item' :
                   escrow.itemType === 'TICKETS' ? 'Event Tickets' :
                   escrow.itemType === 'DIGITAL' ? 'Digital Product' :
                   'Service'}
                </p>
              </div>
              <div>
                <span className="text-white/50 text-sm font-light">Description:</span>
                <p className="text-white/90 mt-1 font-light">{escrow.itemDescription}</p>
              </div>
              <div>
                <span className="text-white/50 text-sm font-light">Buyer:</span>
                <p className="text-white/90 mt-1 font-light">
                  {escrow.buyer.name || escrow.buyer.email}
                </p>
              </div>
              <div>
                <span className="text-white/50 text-sm font-light">Seller:</span>
                <p className="text-white/90 mt-1 font-light">
                  {escrow.seller.name || escrow.seller.email}
                </p>
              </div>
              
              {/* Type-specific fields */}
              {escrow.itemType === 'PHYSICAL' && escrow.shippingAddress && (
                <div>
                  <span className="text-white/50 text-sm font-light">Shipping Address:</span>
                  <p className="text-white/90 mt-1 font-light">{escrow.shippingAddress}</p>
                </div>
              )}
              
              {escrow.itemType === 'TICKETS' && (
                <>
                  {escrow.eventDate && (
                    <div>
                      <span className="text-white/50 text-sm font-light">Event Date:</span>
                      <p className="text-white/90 mt-1 font-light">{escrow.eventDate}</p>
                    </div>
                  )}
                  {escrow.venue && (
                    <div>
                      <span className="text-white/50 text-sm font-light">Venue:</span>
                      <p className="text-white/90 mt-1 font-light">{escrow.venue}</p>
                    </div>
                  )}
                  {escrow.transferMethod && (
                    <div>
                      <span className="text-white/50 text-sm font-light">Transfer Method:</span>
                      <p className="text-white/90 mt-1 font-light">{escrow.transferMethod}</p>
                    </div>
                  )}
                </>
              )}
              
              {escrow.itemType === 'DIGITAL' && (
                <>
                  {escrow.downloadLink && (
                    <div>
                      <span className="text-white/50 text-sm font-light">Download Link:</span>
                      <a
                        href={escrow.downloadLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-white mt-1 font-light block transition-colors"
                      >
                        {escrow.downloadLink} →
                      </a>
                    </div>
                  )}
                  {escrow.licenseKey && (
                    <div>
                      <span className="text-white/50 text-sm font-light">License Key:</span>
                      <p className="text-white/90 mt-1 font-mono text-sm font-light">{escrow.licenseKey}</p>
                    </div>
                  )}
                </>
              )}
              
              {escrow.itemType === 'SERVICES' && escrow.serviceDate && (
                <div>
                  <span className="text-white/50 text-sm font-light">Service Date / Timeline:</span>
                  <p className="text-white/90 mt-1 font-light">{escrow.serviceDate}</p>
                </div>
              )}
              
              {escrow.notes && (
                <div>
                  <span className="text-white/50 text-sm font-light">Notes:</span>
                  <p className="text-white/90 mt-1 font-light">{escrow.notes}</p>
                </div>
              )}
              {escrow.paymentReference && (
                <div>
                  <span className="text-white/50 text-sm font-light">Payment Reference:</span>
                  <p className="text-white/90 mt-1 font-mono text-sm font-light">
                    {escrow.paymentReference}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Shipment Proofs - Only for physical items */}
          {escrow.itemType === 'PHYSICAL' && escrow.shipmentProofs.length > 0 && (
            <Card>
              <h2 className="text-xl font-light text-white mb-6">Shipment Proofs</h2>
              <div className="space-y-4">
                {escrow.shipmentProofs.map((proof: typeof escrow.shipmentProofs[0]) => (
                  <div key={proof.id} className="glass-light border border-white/10 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        {proof.trackingNumber && (
                          <p className="text-white/90 font-light">
                            <span className="text-white/50">Tracking:</span>{' '}
                            {proof.trackingNumber}
                          </p>
                        )}
                        {proof.shippingCarrier && (
                          <p className="text-white/90 mt-1 font-light">
                            <span className="text-white/50">Carrier:</span>{' '}
                            {proof.shippingCarrier}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-white/40 font-light">
                        {new Date(proof.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {proof.filePath && (
                      <a
                        href={proof.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-white text-sm font-light transition-colors"
                      >
                        View File →
                      </a>
                    )}
                    {proof.notes && (
                      <p className="text-white/60 text-sm mt-2 font-light">{proof.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Disputes */}
          {escrow.disputes.length > 0 && (
            <Card>
              <h2 className="text-xl font-light text-white mb-6">Disputes</h2>
              <div className="space-y-4">
                {escrow.disputes.map((dispute: typeof escrow.disputes[0]) => (
                  <div key={dispute.id} className="glass-light border border-white/20 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white/90 font-light">
                          Raised by: {dispute.raisedBy.name || dispute.raisedBy.email}
                        </p>
                        <p className="text-white/70 mt-1 font-light">{dispute.reason}</p>
                      </div>
                      <span className="text-xs text-white/40 font-light">
                        {new Date(dispute.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {dispute.adminNote && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-sm text-white/50 font-light">Admin Note:</p>
                        <p className="text-white/90 mt-1 font-light">{dispute.adminNote}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Messaging Panel */}
          <MessagingPanel transactionId={escrow.id} />

          {/* Timeline */}
          <Card>
            <Timeline events={escrow.timelineEvents} />
          </Card>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <EscrowActions
            escrow={escrow}
            currentUserRole={currentUserRole}
            userId={userId}
          />

          {/* Seller: Upload Proof Form - Only for physical items */}
          {isSeller && escrow.status === 'AWAITING_SHIPMENT' && escrow.itemType === 'PHYSICAL' && (
            <Card>
              <h2 className="text-xl font-light text-white mb-6">Upload Shipment Proof</h2>
              <ShipmentProofForm escrowId={escrow.id} />
            </Card>
          )}
          
          {/* For non-physical items, require proof upload */}
          {isSeller && escrow.status === 'AWAITING_SHIPMENT' && escrow.itemType !== 'PHYSICAL' && (
            <Card>
              <h2 className="text-xl font-light text-white mb-6">
                {escrow.itemType === 'TICKETS' ? 'Transfer Tickets' :
                 escrow.itemType === 'DIGITAL' ? 'Deliver Digital Product' :
                 'Complete Service'}
              </h2>
              <p className="text-white/60 text-sm font-light mb-4">
                {escrow.itemType === 'TICKETS' ? 'Transfer the tickets to the buyer and upload proof of transfer.' :
                 escrow.itemType === 'DIGITAL' ? 'Ensure the download link and license key are accessible, then upload proof of delivery.' :
                 'Complete the service as agreed, then upload proof of completion.'}
              </p>
              <DeliveryProofForm 
                escrowId={escrow.id} 
                itemType={escrow.itemType as 'DIGITAL' | 'TICKETS' | 'SERVICES'}
              />
            </Card>
          )}

          {/* Buyer: Dispute Form */}
          {isBuyer && (escrow.status === 'IN_TRANSIT' || escrow.status === 'DELIVERED_PENDING_RELEASE') && (
            <Card>
              <h2 className="text-xl font-light text-white mb-6">Raise Dispute</h2>
              <DisputeForm escrowId={escrow.id} />
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

