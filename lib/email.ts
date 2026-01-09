/**
 * Email notification system
 */

import nodemailer from 'nodemailer'
import { BalanceAlert } from './stripe-balance-monitor'

/**
 * Get the base URL for the application
 * Always prioritizes production domain (joinrift.co) over Vercel URLs
 * 
 * NOTE: NEXT_PUBLIC_APP_URL is client-side only in Next.js.
 * For server-side code (API routes, email functions), use APP_URL instead.
 * 
 * IMPORTANT: Set APP_URL (not NEXT_PUBLIC_APP_URL) in Vercel settings
 * to your production domain (e.g., https://joinrift.co)
 */
function getBaseUrl(): string {
  // Priority 1: APP_URL (server-side variable) - this is what we need for API routes
  // NEXT_PUBLIC_APP_URL is only available client-side, so don't rely on it here
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  
  // Debug logging in production to see what we're getting
  if (process.env.NODE_ENV === 'production') {
    console.log('🔍 getBaseUrl() - APP_URL:', process.env.APP_URL)
    console.log('🔍 getBaseUrl() - NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
    console.log('🔍 getBaseUrl() - NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
  }
  
  if (appUrl) {
    const cleanUrl = appUrl.trim().replace(/\/$/, '') // Remove trailing slash
    // NEVER use Vercel URLs, even if APP_URL is set to one
    if (cleanUrl && !cleanUrl.includes('.vercel.app')) {
      console.log('✅ getBaseUrl() - Using APP_URL:', cleanUrl)
      return cleanUrl
    } else if (cleanUrl && cleanUrl.includes('.vercel.app')) {
      console.warn('⚠️  getBaseUrl() - APP_URL is set to Vercel URL, ignoring and using joinrift.co instead')
    }
  }

  // Priority 2: In production, always use joinrift.co (never Vercel URLs)
  if (process.env.NODE_ENV === 'production') {
    // NEVER use NEXTAUTH_URL if it contains vercel.app
    const nextAuthUrl = process.env.NEXTAUTH_URL
    if (nextAuthUrl && !nextAuthUrl.includes('.vercel.app') && !nextAuthUrl.includes('localhost') && nextAuthUrl.includes('joinrift.co')) {
      const cleanAuthUrl = nextAuthUrl.trim().replace(/\/$/, '')
      console.log('✅ getBaseUrl() - Using NEXTAUTH_URL (non-Vercel):', cleanAuthUrl)
      return cleanAuthUrl
    }
    
    // Default production domain - always use this in production as fallback
    console.log('✅ getBaseUrl() - Using default production domain: https://joinrift.co')
    return 'https://joinrift.co'
  }

  // Development: Use localhost
  return 'http://localhost:3000'
}

// Create transporter function (creates new transporter each time to pick up env changes)
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587')
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD

  // Only log in development, and never log passwords
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Creating SMTP transporter:', { host, port, secure, User: user ? `${user.substring(0, 3)}***` : 'NOT SET' })
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
  auth: {
      user,
      pass: password,
  },
})
}

/**
 * Send email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  // In development without SMTP configured, just log
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log('📧 Email would be sent:', { to, subject })
    console.log('⚠️ SMTP not configured. Set SMTP_USER and SMTP_PASSWORD in .env.local to send emails.')
    return false // Return false so caller knows email wasn't sent
  }

  try {
    // Create transporter each time to ensure we use latest env vars
    const transporter = createTransporter()
    
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    })
    console.log('✅ Email sent successfully:', { to, messageId: result.messageId })
    return true
  } catch (error: any) {
         // Log error safely (don't expose credentials)
         console.error('❌ Email send error:', {
           code: error.code,
           message: error.message ? error.message.substring(0, 100) : 'Unknown error',
           // Never log error.response as it may contain credentials
         })
    return false
  }
}

/**
 * Send rift created notification
 */
export async function sendEscrowCreatedEmail(
  buyerEmail: string,
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string
) {
  const buyerHtml = `
    <h2>Rift Created</h2>
    <p>You've created a rift for <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please proceed to make payment to complete the transaction.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  const sellerHtml = `
    <h2>New Rift Transaction</h2>
    <p>You have a new rift transaction for <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please wait for the buyer to complete payment.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await Promise.all([
    sendEmail(buyerEmail, 'Rift Created - Rift', buyerHtml),
    sendEmail(sellerEmail, 'New Rift - Rift', sellerHtml),
  ])
}

/**
 * Send payment received notification
 */
export async function sendPaymentReceivedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string
) {
  const html = `
    <h2>Payment Received</h2>
    <p>Payment has been received for your rift: <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please proceed to ship the item and upload proof of shipment.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(sellerEmail, 'Payment Received - Rift', html)
}

/**
 * Send shipment proof uploaded notification
 */
export async function sendShipmentProofEmail(
  buyerEmail: string,
  escrowId: string,
  itemTitle: string
) {
  const html = `
    <h2>Shipment Proof Uploaded</h2>
    <p>The seller has uploaded proof of shipment for: <strong>${itemTitle}</strong>.</p>
    <p>Please track your shipment and confirm receipt when it arrives.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(buyerEmail, 'Shipment Proof Uploaded - Rift', html)
}

/**
 * Send item received notification
 */
export async function sendItemReceivedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string
) {
  const html = `
    <h2>Item Received</h2>
    <p>The buyer has confirmed receipt of: <strong>${itemTitle}</strong>.</p>
    <p>Funds are now pending release. The buyer will release funds shortly.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(sellerEmail, 'Item Received - Rift', html)
}

/**
 * Send funds released notification
 */
export async function sendFundsReleasedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string,
  platformFee?: number
) {
  // Calculate total fee (8%) from the amount seller receives
  // sellerReceives = originalAmount * 0.92, so originalAmount = sellerReceives / 0.92
  // totalFee = originalAmount * 0.08
  const originalAmount = amount / 0.92
  const totalFee = originalAmount * 0.08
  
  const feeBreakdown = platformFee 
    ? `<p><strong>Total Fee (8%):</strong> ${currency} ${totalFee.toFixed(2)} (includes platform fee: ${currency} ${platformFee.toFixed(2)} and payment processing)</p>`
    : ''
  
  const html = `
    <h2>Funds Released</h2>
    <p>Funds have been released for your rift: <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount You Receive:</strong> ${currency} ${amount.toFixed(2)}</p>
    ${feeBreakdown}
    <p>The funds should appear in your account within 1-2 business days.</p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(sellerEmail, 'Funds Released - Rift', html)
}

/**
 * Send dispute raised notification with comprehensive information
 */
export async function sendDisputeRaisedEmail(
  buyerEmail: string,
  sellerEmail: string,
  adminEmail: string,
  escrowId: string,
  itemTitle: string,
  reason: string,
  disputeDetails?: {
    disputeType?: string
    disputeId?: string
    riftNumber?: number | null
    subtotal?: number
    currency?: string
    itemDescription?: string
    itemType?: string
    shippingAddress?: string | null
    buyerName?: string | null
    sellerName?: string | null
    buyerEmail?: string
    sellerEmail?: string
    createdAt?: Date | string
    summary?: string | null
  }
) {
  const baseUrl = getBaseUrl()
  const riftUrl = `${baseUrl}/rifts/${escrowId}`
  
  // Format dispute type for display
  const disputeTypeLabel = disputeDetails?.disputeType 
    ? disputeDetails.disputeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : 'Not specified'
  
  // Format amounts
  const currency = disputeDetails?.currency || 'CAD'
  const amount = disputeDetails?.subtotal ? `${currency} ${disputeDetails.subtotal.toFixed(2)}` : 'N/A'
  
  // Format dates
  const createdAt = disputeDetails?.createdAt
    ? new Date(disputeDetails.createdAt).toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })
    : new Date().toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })

  // Build detailed information section
  const detailsHtml = `
    <div style="background: #f9fafb; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #111827;">Dispute Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 180px;">Dispute Type:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeTypeLabel}</td>
        </tr>
        ${disputeDetails?.disputeId ? `
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Dispute ID:</td>
          <td style="padding: 8px 0; color: #111827; font-family: monospace; font-size: 14px;">${disputeDetails.disputeId}</td>
        </tr>
        ` : ''}
        ${disputeDetails?.riftNumber ? `
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Rift Number:</td>
          <td style="padding: 8px 0; color: #111827;">#${disputeDetails.riftNumber}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Transaction Amount:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${amount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Item Type:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeDetails?.itemType || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Raised On:</td>
          <td style="padding: 8px 0; color: #111827;">${createdAt}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #f9fafb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #111827;">Transaction Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 180px;">Item Title:</td>
          <td style="padding: 8px 0; color: #111827;">${itemTitle}</td>
        </tr>
        ${disputeDetails?.itemDescription ? `
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Description:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeDetails.itemDescription.substring(0, 200)}${disputeDetails.itemDescription.length > 200 ? '...' : ''}</td>
        </tr>
        ` : ''}
        ${disputeDetails?.shippingAddress ? `
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Shipping Address:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeDetails.shippingAddress}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="background: #f9fafb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #111827;">Party Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 180px;">Buyer:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeDetails?.buyerName || disputeDetails?.buyerEmail || 'N/A'} ${disputeDetails?.buyerEmail ? `(${disputeDetails.buyerEmail})` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Seller:</td>
          <td style="padding: 8px 0; color: #111827;">${disputeDetails?.sellerName || disputeDetails?.sellerEmail || 'N/A'} ${disputeDetails?.sellerEmail ? `(${disputeDetails.sellerEmail})` : ''}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #991b1b;">Dispute Reason</h3>
      <p style="color: #111827; margin: 0; white-space: pre-wrap;">${reason}</p>
      ${disputeDetails?.summary ? `
      <h4 style="margin-top: 16px; margin-bottom: 8px; color: #991b1b;">Additional Details:</h4>
      <p style="color: #111827; margin: 0; white-space: pre-wrap;">${disputeDetails.summary}</p>
      ` : ''}
    </div>
  `

  const buyerSellerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111827; margin-bottom: 20px;">Dispute Raised</h2>
      <p style="color: #374151; line-height: 1.6;">A dispute has been raised for the following transaction:</p>
      
      ${detailsHtml}
      
      <p style="color: #374151; line-height: 1.6; margin-top: 24px;">
        An admin will review and resolve this dispute shortly. You will be notified once a resolution has been reached.
      </p>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${riftUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Rift Details</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        If you have any questions or additional information to provide, please contact support.
      </p>
    </div>
  `

  const adminHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626; margin-bottom: 20px;">⚠️ New Dispute Requires Attention</h2>
      <p style="color: #374151; line-height: 1.6; font-weight: 600;">A dispute has been raised and requires your review:</p>
      
      ${detailsHtml}
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${baseUrl}/admin/disputes" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 12px;">Review Dispute</a>
        <a href="${riftUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Rift</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Please review the dispute and take appropriate action as soon as possible.
      </p>
    </div>
  `

  await Promise.all([
    sendEmail(buyerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(sellerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(adminEmail, '⚠️ New Dispute Requires Review - Rift', adminHtml),
  ])
}

/**
 * Send proof submitted notification to admin
 */
export async function sendProofSubmittedEmail(
  adminEmail: string,
  escrowId: string,
  itemTitle: string,
  sellerName: string | null,
  sellerEmail: string,
  proofType: string,
  riftNumber: number | null
) {
  const adminHtml = `
    <h2>New Proof Submission Requires Review</h2>
    <p>A proof of delivery has been submitted for rift: <strong>${itemTitle}</strong>.</p>
    <p><strong>Rift #:</strong> ${riftNumber || 'N/A'}</p>
    <p><strong>Seller:</strong> ${sellerName || sellerEmail}</p>
    <p><strong>Proof Type:</strong> ${proofType.replace(/_/g, ' ')}</p>
    <p>Please review the proof and approve or reject it.</p>
    <p><a href="${getBaseUrl()}/admin/proofs">Review Proofs</a></p>
    <p><a href="${getBaseUrl()}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(adminEmail, 'New Proof Submission - Rift', adminHtml)
}

/**
 * Send dispute resolved notification
 */
export async function sendDisputeResolvedEmail(
  buyerEmail: string,
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  resolution: 'buyer' | 'seller' | 'rejected',
  note?: string
) {
  const baseUrl = getBaseUrl()
  const riftUrl = `${baseUrl}/rifts/${escrowId}`
  
  const resolutionText = resolution === 'buyer' 
    ? 'resolved in favor of the buyer (refund processed)'
    : resolution === 'seller'
    ? 'resolved in favor of the seller (funds released)'
    : 'rejected as invalid'
  
  const resolutionColor = resolution === 'buyer' 
    ? '#3b82f6' // Blue for buyer
    : resolution === 'seller'
    ? '#10b981' // Green for seller
    : '#ef4444' // Red for rejected
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-bottom: 20px;">Dispute Resolution Update</h2>
      <p style="color: #374151; line-height: 1.6;">Your dispute for <strong>${itemTitle}</strong> has been ${resolutionText}.</p>
      
      ${note ? `
      <div style="margin: 20px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid ${resolutionColor};">
        <p style="margin: 0; color: #374151;"><strong>Admin Note:</strong> ${note}</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${riftUrl}" style="display: inline-block; background: ${resolutionColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Rift Details</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        If you have any questions, please contact support.
      </p>
    </div>
  `
  
  await Promise.all([
    sendEmail(buyerEmail, 'Dispute Resolved - Rift', html),
    sendEmail(sellerEmail, 'Dispute Resolved - Rift', html),
  ])
}

/**
 * Send dispute info requested notification
 */
export async function sendDisputeInfoRequestedEmail(
  userEmail: string,
  escrowId: string,
  itemTitle: string,
  message: string
) {
  const baseUrl = getBaseUrl()
  const riftUrl = `${baseUrl}/rifts/${escrowId}`
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-bottom: 20px;">Additional Information Requested</h2>
      <p style="color: #374151; line-height: 1.6;">Our team has requested additional information regarding your dispute for <strong>${itemTitle}</strong>.</p>
      
      <div style="margin: 20px 0; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #374151;"><strong>Request:</strong> ${message}</p>
      </div>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${riftUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Rift & Respond</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Please provide the requested information as soon as possible to help us resolve your dispute.
      </p>
    </div>
  `
  
  await sendEmail(userEmail, 'Additional Information Requested - Rift', html)
}

/**
 * Send rift status update notification
 */
export async function sendRiftStatusUpdateEmail(
  buyerEmail: string,
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  status: string,
  message?: string
) {
  const baseUrl = getBaseUrl()
  const riftUrl = `${baseUrl}/rifts/${escrowId}`
  
  const statusLabels: Record<string, string> = {
    'RELEASED': 'Funds Released',
    'REFUNDED': 'Refund Processed',
    'DISPUTED': 'Dispute Opened',
    'RESOLVED': 'Dispute Resolved',
    'PROOF_SUBMITTED': 'Proof Submitted',
    'UNDER_REVIEW': 'Under Review',
    'FUNDED': 'Payment Received',
  }
  
  const statusLabel = statusLabels[status] || status.replace(/_/g, ' ')
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-bottom: 20px;">Rift Status Update</h2>
      <p style="color: #374151; line-height: 1.6;">Your rift for <strong>${itemTitle}</strong> has been updated.</p>
      
      <div style="margin: 20px 0; padding: 16px; background: #f3f4f6; border-radius: 8px;">
        <p style="margin: 0; color: #374151;"><strong>Status:</strong> ${statusLabel}</p>
        ${message ? `<p style="margin: 8px 0 0 0; color: #374151;">${message}</p>` : ''}
      </div>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${riftUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Rift Details</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        You can view all updates in your rift dashboard.
      </p>
    </div>
  `
  
  await Promise.all([
    sendEmail(buyerEmail, `Rift Status Update: ${statusLabel} - Rift`, html),
    sendEmail(sellerEmail, `Rift Status Update: ${statusLabel} - Rift`, html),
  ])
}

/**
 * Send Stripe Connect account status change notification
 */
export async function sendStripeStatusChangeEmail(
  userEmail: string,
  userName: string | null,
  status: 'approved' | 'pending' | 'restricted' | 'rejected' | 'under_review',
  statusMessage: string,
  requirements?: string[]
) {
  const statusColors: Record<string, string> = {
    approved: 'green',
    rejected: 'red',
    under_review: 'blue',
    restricted: 'yellow',
    pending: 'yellow',
  }

  const statusLabels: Record<string, string> = {
    approved: 'Approved',
    rejected: 'Rejected',
    under_review: 'Under Review',
    restricted: 'Restricted',
    pending: 'Pending',
  }

  const color = statusColors[status] || 'yellow'
  const label = statusLabels[status] || 'Pending'

  let actionHtml = ''
  if (status === 'approved') {
    actionHtml = `
      <p style="color: #10b981; font-weight: bold;">✓ Your Stripe account has been approved!</p>
      <p>You can now receive payouts from your Rift transactions.</p>
      <p><a href="${getBaseUrl()}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Wallet</a></p>
    `
  } else if (status === 'rejected') {
    actionHtml = `
      <p style="color: #ef4444; font-weight: bold;">✗ Your Stripe account was rejected</p>
      <p>Please update your account information to resolve the issue.</p>
      <p><a href="${getBaseUrl()}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Update Account</a></p>
    `
  } else if (status === 'restricted' && requirements && requirements.length > 0) {
    actionHtml = `
      <p style="color: #f59e0b; font-weight: bold;">⚠ Additional information required</p>
      <p>The following information is needed to enable payouts:</p>
      <ul>
        ${requirements.map(req => `<li>${req.replace(/_/g, ' ')}</li>`).join('')}
      </ul>
      <p><a href="${getBaseUrl()}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Complete Setup</a></p>
    `
  } else {
    actionHtml = `
      <p>${statusMessage}</p>
      <p><a href="${getBaseUrl()}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Check Status</a></p>
    `
  }

  const html = `
    <h2>Stripe Account Status Update</h2>
    <p>Hello ${userName || 'there'},</p>
    <p>Your Stripe Connect account status has been updated:</p>
    <div style="padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'blue' ? '#3b82f6' : '#f59e0b'}; font-weight: bold;">${label}</span></p>
      <p style="margin: 8px 0 0 0;"><strong>Message:</strong> ${statusMessage}</p>
    </div>
    ${actionHtml}
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">You can check your account status anytime in your <a href="${getBaseUrl()}/wallet">wallet</a>.</p>
  `

  await sendEmail(
    userEmail,
    `Stripe Account ${label} - Rift`,
    html
  )
}

/**
 * Send balance alert email to admins
 */
export async function sendBalanceAlertEmail(
  alerts: BalanceAlert[],
  balances: Array<{ currency: string; available: number; pending: number }>
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER

  if (!adminEmail) {
    console.warn('No admin email configured for balance alerts')
    return
  }

  const criticalAlerts = alerts.filter(a => a.alert === 'critical')
  const warningAlerts = alerts.filter(a => a.alert === 'warning')

  const alertRows = alerts.map(alert => `
    <tr style="background-color: ${alert.alert === 'critical' ? '#fee2e2' : alert.alert === 'warning' ? '#fef3c7' : '#dbeafe'};">
      <td style="padding: 8px; border: 1px solid #ddd;">${alert.currency}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${alert.available.toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${alert.threshold.toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${alert.percentage.toFixed(1)}%</td>
      <td style="padding: 8px; border: 1px solid #ddd;">
        <span style="color: ${alert.alert === 'critical' ? '#dc2626' : alert.alert === 'warning' ? '#d97706' : '#2563eb'}; font-weight: bold;">
          ${alert.alert.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('')

  const balanceRows = balances.map(balance => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${balance.currency}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${balance.available.toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${balance.pending.toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${criticalAlerts.length > 0 ? '#dc2626' : '#d97706'};">
        ${criticalAlerts.length > 0 ? '🚨 CRITICAL' : '⚠️ WARNING'}: Stripe Balance Alert
      </h2>
      
      ${criticalAlerts.length > 0 ? `
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #dc2626;">
            ${criticalAlerts.length} critical balance alert(s) detected!
          </p>
          <p style="margin: 8px 0 0 0;">
            Immediate action required to prevent transfer failures.
          </p>
        </div>
      ` : ''}

      <h3 style="margin-top: 24px;">Balance Alerts</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Currency</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Available</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Threshold</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">% of Threshold</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Alert Level</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>

      <h3 style="margin-top: 24px;">Current Balances</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Currency</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Available</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Pending</th>
          </tr>
        </thead>
        <tbody>
          ${balanceRows}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>Action Required:</strong> Add funds to your Stripe account to ensure transfers can be processed.
          Visit <a href="https://dashboard.stripe.com/balance/overview">Stripe Dashboard</a> to add funds.
        </p>
      </div>

      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
        This is an automated alert from the Rift balance monitoring system.
      </p>
    </div>
  `

  await sendEmail(
    adminEmail,
    `${criticalAlerts.length > 0 ? '🚨 CRITICAL' : '⚠️ WARNING'}: Stripe Balance Alert - Rift`,
    html
  )
}

