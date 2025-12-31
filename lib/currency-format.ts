/**
 * Currency formatting utilities
 * Ensures all currency amounts are displayed with 2 decimal places
 */

/**
 * Format a currency amount with 2 decimal places
 * @param amount - The amount to format
 * @param currency - Currency code (default: 'CAD')
 * @param showSymbol - Whether to show currency symbol (default: true)
 * @returns Formatted string like "$5.00" or "5.00 CAD"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'CAD',
  showSymbol: boolean = true
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return showSymbol ? `$0.00` : `0.00 ${currency}`
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  const formatted = numAmount.toFixed(2)

  if (showSymbol) {
    const currencySymbols: Record<string, string> = {
      USD: '$',
      CAD: '$',
      EUR: '€',
      GBP: '£',
      AUD: '$',
      JPY: '¥',
      CNY: '¥',
      INR: '₹',
      BRL: 'R$',
      MXN: '$',
      ZAR: 'R',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      PLN: 'zł',
      CHF: 'CHF',
      HKD: 'HK$',
      SGD: 'S$',
      NZD: '$',
      TRY: '₺',
      RUB: '₽',
      KRW: '₩',
      THB: '฿',
      IDR: 'Rp',
      MYR: 'RM',
      PHP: '₱',
      VND: '₫',
      ARS: '$',
      CLP: '$',
      COP: '$',
      PEN: 'S/',
      RON: 'lei',
    }

    const symbol = currencySymbols[currency] || currency
    return `${symbol}${formatted}`
  }

  return `${formatted} ${currency}`
}

/**
 * Format currency amount without symbol (just number with 2 decimals)
 * @param amount - The amount to format
 * @returns Formatted string like "5.00"
 */
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00'
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return numAmount.toFixed(2)
}

/**
 * Format currency with Intl.NumberFormat (for more complex formatting)
 * @param amount - The amount to format
 * @param currency - Currency code
 * @returns Formatted string using Intl API
 */
export function formatCurrencyIntl(
  amount: number | string | null | undefined,
  currency: string = 'CAD'
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0)
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount)
}

