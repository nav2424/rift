/**
 * Email notification system
 */

import nodemailer from 'nodemailer'

// Create transporter (using Gmail as default, but can be configured)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

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
    console.error('❌ Email send error:', error)
    // Log more details about the error
    if (error.code) {
      console.error('Error code:', error.code)
    }
    if (error.response) {
      console.error('SMTP response:', error.response)
    }
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
  `

  const sellerHtml = `
    <h2>New Rift Transaction</h2>
    <p>You have a new rift transaction for <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please wait for the buyer to complete payment.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(sellerEmail, 'Funds Released - Rift', html)
}

/**
 * Send dispute raised notification
 */
export async function sendDisputeRaisedEmail(
  buyerEmail: string,
  sellerEmail: string,
  adminEmail: string,
  escrowId: string,
  itemTitle: string,
  reason: string
) {
  const buyerSellerHtml = `
    <h2>Dispute Raised</h2>
    <p>A dispute has been raised for rift: <strong>${itemTitle}</strong>.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>An admin will review and resolve the dispute shortly.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
  `

  const adminHtml = `
    <h2>New Dispute Requires Attention</h2>
    <p>A dispute has been raised for rift: <strong>${itemTitle}</strong>.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please review and resolve the dispute.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin">Admin Dashboard</a></p>
  `

  await Promise.all([
    sendEmail(buyerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(sellerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(adminEmail, 'New Dispute - Rift', adminHtml),
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
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/proofs">Review Proofs</a></p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rifts/${escrowId}">View Rift</a></p>
  `

  await sendEmail(adminEmail, 'New Proof Submission - Rift', adminHtml)
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
      <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Wallet</a></p>
    `
  } else if (status === 'rejected') {
    actionHtml = `
      <p style="color: #ef4444; font-weight: bold;">✗ Your Stripe account was rejected</p>
      <p>Please update your account information to resolve the issue.</p>
      <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Update Account</a></p>
    `
  } else if (status === 'restricted' && requirements && requirements.length > 0) {
    actionHtml = `
      <p style="color: #f59e0b; font-weight: bold;">⚠ Additional information required</p>
      <p>The following information is needed to enable payouts:</p>
      <ul>
        ${requirements.map(req => `<li>${req.replace(/_/g, ' ')}</li>`).join('')}
      </ul>
      <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Complete Setup</a></p>
    `
  } else {
    actionHtml = `
      <p>${statusMessage}</p>
      <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/wallet" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Check Status</a></p>
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
    <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">You can check your account status anytime in your <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/wallet">wallet</a>.</p>
  `

  await sendEmail(
    userEmail,
    `Stripe Account ${label} - Rift`,
    html
  )
}

