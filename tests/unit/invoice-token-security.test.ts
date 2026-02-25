import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_INVOICE_TOKEN_SECRET = process.env.INVOICE_TOKEN_SECRET

describe('invoice-token security hardening', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }

    if (ORIGINAL_INVOICE_TOKEN_SECRET === undefined) {
      delete process.env.INVOICE_TOKEN_SECRET
    } else {
      process.env.INVOICE_TOKEN_SECRET = ORIGINAL_INVOICE_TOKEN_SECRET
    }
  })

  it('requires INVOICE_TOKEN_SECRET in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.INVOICE_TOKEN_SECRET

    const invoiceToken = await import('@/lib/invoice-token')
    expect(() => invoiceToken.generateInvoiceToken('inv_prod')).toThrow(
      'INVOICE_TOKEN_SECRET is required in production'
    )
  })

  it('uses configured INVOICE_TOKEN_SECRET when present', async () => {
    process.env.NODE_ENV = 'production'
    process.env.INVOICE_TOKEN_SECRET = 'unit-test-invoice-secret'

    const invoiceToken = await import('@/lib/invoice-token')
    const token = invoiceToken.generateInvoiceToken('inv_cfg')
    const verified = invoiceToken.verifyInvoiceToken(token)

    expect(verified).toBe('inv_cfg')
  })

  it('uses a non-production ephemeral secret when not configured', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.INVOICE_TOKEN_SECRET
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const invoiceToken = await import('@/lib/invoice-token')
    const token = invoiceToken.generateInvoiceToken('inv_dev')
    const verified = invoiceToken.verifyInvoiceToken(token)

    expect(verified).toBe('inv_dev')
    expect(warnSpy).toHaveBeenCalledWith(
      'INVOICE_TOKEN_SECRET is not set; using ephemeral non-production secret'
    )

    warnSpy.mockRestore()
  })
})
