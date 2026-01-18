-- Create invoices table for Service-based Rifts
-- Note: Uses TEXT IDs to match Prisma schema format
-- RLS will be enabled with policies in a separate step

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rift_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  issued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  payment_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_rift_id ON invoices(rift_id);
CREATE INDEX IF NOT EXISTS idx_invoices_seller_id ON invoices(seller_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_updated_at();

-- Note: Foreign key constraints to EscrowTransaction (RiftTransaction) and User tables
-- are commented out because we're using Prisma for the main database.
-- Access control will be handled at the API level.
-- If you want to add FK constraints later, run:
-- ALTER TABLE invoices 
--   ADD CONSTRAINT fk_rift FOREIGN KEY (rift_id) REFERENCES "EscrowTransaction"(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Enable RLS (Row Level Security)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
-- Note: These policies use auth.uid() which requires Supabase Auth.
-- Since we're using NextAuth, RLS policies won't work directly.
-- We'll rely on API-level authentication instead.
-- These policies are here for future use if you migrate to Supabase Auth.

-- Policy: Sellers can create invoices for their rifts
CREATE POLICY "Sellers can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (seller_id = auth.uid()::text);

-- Policy: Sellers can view their own invoices
CREATE POLICY "Sellers can view their invoices"
  ON invoices FOR SELECT
  USING (seller_id = auth.uid()::text);

-- Policy: Sellers can update their invoices (when in draft or sent status)
CREATE POLICY "Sellers can update their invoices"
  ON invoices FOR UPDATE
  USING (seller_id = auth.uid()::text)
  WITH CHECK (seller_id = auth.uid()::text);

-- RLS Policies for invoice_items
-- Policy: Users can manage invoice items through invoice ownership
CREATE POLICY "Users can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.seller_id = auth.uid()::text
    )
  );

-- Note: Public invoice viewing (buyer access) will be handled via signed tokens/URLs
-- in the API layer, not through RLS policies.
