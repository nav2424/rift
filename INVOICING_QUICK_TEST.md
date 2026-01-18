# Invoicing System - Quick Testing Guide

## Setup Steps

### 1. Apply Database Migration

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Open `supabase/migrations/008_create_invoices.sql`
5. Copy the entire contents
6. Paste into SQL Editor
7. Click **Run** (Cmd/Ctrl + Enter)
8. Verify success - should see "Success. No rows returned"

**Option B: Via Command Line**
```bash
# If you have psql installed and DATABASE_URL set
psql "$DATABASE_URL" -f supabase/migrations/008_create_invoices.sql
```

### 2. Create Storage Bucket for PDFs

In Supabase Dashboard → **Storage**:
1. Click **New bucket**
2. Name: `invoices`
3. Public bucket: ✅ (checked)
4. Click **Create bucket**

Or via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true);
```

### 3. Verify Setup

Check that tables were created:
- Go to **Table Editor** in Supabase Dashboard
- You should see `invoices` and `invoice_items` tables

## Testing the API

### Prerequisites
- You need a Service-based Rift (itemType = 'SERVICES')
- You need to be logged in as the seller of that Rift
- Your session cookie (for API testing)

### Test Flow

#### 1. Create Invoice (Draft)
```bash
# Replace {riftId} with an actual service Rift ID
# Replace {sessionToken} with your NextAuth session token
curl -X POST http://localhost:3001/api/rifts/{riftId}/invoice \
  -H "Cookie: next-auth.session-token={sessionToken}" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "id": "...",
  "rift_id": "...",
  "invoice_number": "RIFT-2025-000001",
  "status": "draft",
  "subtotal": 100.00,
  "total": 100.00,
  "invoice_items": [...]
}
```

#### 2. Update Invoice
```bash
curl -X PATCH http://localhost:3001/api/invoices/{invoiceId} \
  -H "Cookie: next-auth.session-token={sessionToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_name": "John Doe",
    "due_date": "2025-02-15",
    "notes": "Payment due within 30 days",
    "tax": 10.00,
    "items": [
      {
        "name": "Web Design Service",
        "description": "Complete website redesign",
        "quantity": 1,
        "unit_price": 1000.00
      }
    ]
  }'
```

#### 3. Generate PDF
```bash
curl -X POST http://localhost:3001/api/invoices/{invoiceId}/pdf \
  -H "Cookie: next-auth.session-token={sessionToken}"
```

Expected response:
```json
{
  "pdf_url": "https://..."
}
```

#### 4. Send Invoice Email
```bash
curl -X POST http://localhost:3001/api/invoices/{invoiceId}/send \
  -H "Cookie: next-auth.session-token={sessionToken}"
```

Expected response:
```json
{
  "success": true,
  "message": "Invoice sent successfully"
}
```

Check the buyer's email inbox for the invoice email.

### Using Browser Dev Tools

1. Open your app (http://localhost:3001)
2. Log in as a seller
3. Navigate to a Service-based Rift
4. Open Browser DevTools → Network tab
5. Try the API calls from the console:

```javascript
// Get a service Rift ID first
const rifts = await fetch('/api/rifts/list').then(r => r.json());
const serviceRift = rifts.find(r => r.itemType === 'SERVICES');
console.log('Service Rift ID:', serviceRift?.id);

// Create invoice
const invoice = await fetch(`/api/rifts/${serviceRift.id}/invoice`, {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json());
console.log('Invoice created:', invoice);
```

## Common Issues

### Issue: "Invoice not found"
- Check that the Rift exists and is a SERVICE type
- Verify you're logged in as the seller
- Check the Rift ID is correct

### Issue: "Failed to generate PDF"
- Verify the `invoices` storage bucket exists in Supabase
- Check Supabase storage permissions
- Check console logs for detailed error

### Issue: "Failed to send email"
- Verify SMTP is configured (check `.env.local`)
- Check email logs in console
- Email might be in spam folder

### Issue: RLS Policy Errors
- RLS policies use `auth.uid()` which requires Supabase Auth
- Since you're using NextAuth, API-level auth handles access
- If you see RLS errors, you may need to temporarily disable RLS:
```sql
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
```

## Next Steps After Testing

Once basic functionality is confirmed:

1. ✅ Test invoice creation
2. ✅ Test invoice updates
3. ✅ Test PDF generation
4. ✅ Test email sending
5. ❌ Implement UI (Invoice tab in Rift detail page)
6. ❌ Implement public invoice view (token system)
7. ❌ Implement payment integration (Stripe)
8. ❌ Implement overdue status logic

## Quick Verification Checklist

- [ ] Migration applied successfully
- [ ] `invoices` and `invoice_items` tables exist
- [ ] `invoices` storage bucket created
- [ ] Can create invoice via API
- [ ] Can update invoice via API
- [ ] PDF generates successfully
- [ ] Email sends successfully
- [ ] Invoice status updates correctly
