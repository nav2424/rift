import { sendEmail } from './email'

function getBaseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'production' ? 'https://joinrift.co' : 'http://localhost:3000')
}

export async function sendCampaignAssignmentEmail(
  creatorEmail: string,
  campaignNumber: number,
  productName: string,
  deadline: Date,
  payoutAmount: number | null,
  currency: string
) {
  const html = `
    <h2>New UGC Assignment</h2>
    <p>You've been assigned to a new campaign through Rift.</p>
    <p><strong>Campaign:</strong> #${campaignNumber}</p>
    <p><strong>Product category:</strong> ${productName}</p>
    <p><strong>Deadline:</strong> ${deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    ${payoutAmount != null ? `<p><strong>Rate:</strong> ${payoutAmount.toFixed(2)} ${currency}</p>` : ''}
    <p>Brand details are withheld — view your sanitized brief and upload your video in the portal.</p>
    <p><a href="${getBaseUrl()}/creator/assignments">View assignment</a></p>
  `
  await sendEmail(creatorEmail, `New assignment — Campaign #${campaignNumber}`, html)
}

export async function sendCampaignRevisionEmail(
  creatorEmail: string,
  campaignNumber: number,
  revisionNotes: string
) {
  const html = `
    <h2>Revision Requested</h2>
    <p>Your video for campaign <strong>#${campaignNumber}</strong> needs revisions.</p>
    <p><strong>Notes from Rift:</strong></p>
    <p>${revisionNotes.replace(/\n/g, '<br>')}</p>
    <p><a href="${getBaseUrl()}/creator/assignments">Upload revised video</a></p>
  `
  await sendEmail(creatorEmail, `Revision requested — Campaign #${campaignNumber}`, html)
}

export async function sendCampaignDeliveredEmail(
  brandEmail: string,
  campaignNumber: number,
  productName: string,
  videoCount: number
) {
  const html = `
    <h2>Campaign Delivered</h2>
    <p>Your UGC campaign <strong>#${campaignNumber}</strong> (${productName}) is ready.</p>
    <p><strong>${videoCount}</strong> approved video${videoCount === 1 ? '' : 's'} ${videoCount === 1 ? 'is' : 'are'} available in your brand portal.</p>
    <p><a href="${getBaseUrl()}/brand/campaigns">Download videos</a></p>
  `
  await sendEmail(brandEmail, `Campaign delivered — #${campaignNumber}`, html)
}
