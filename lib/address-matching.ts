/**
 * Fuzzy Address Matching for Better Address Validation
 * Uses string similarity and normalization for address comparison
 */

/**
 * Calculate similarity between two strings using Sorensen-Dice coefficient
 * Returns a value between 0 (completely different) and 1 (identical)
 * This is a simple replacement for the deprecated string-similarity package
 */
function compareTwoStrings(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (str1.length < 2 || str2.length < 2) return 0.0

  // Create bigrams (pairs of adjacent characters)
  const pairs1 = new Map<string, number>()
  const pairs2 = new Map<string, number>()

  for (let i = 0; i < str1.length - 1; i++) {
    const pair = str1.substring(i, i + 2).toLowerCase()
    pairs1.set(pair, (pairs1.get(pair) || 0) + 1)
  }

  for (let i = 0; i < str2.length - 1; i++) {
    const pair = str2.substring(i, i + 2).toLowerCase()
    pairs2.set(pair, (pairs2.get(pair) || 0) + 1)
  }

  // Calculate intersection and union
  let intersection = 0
  const allPairs = new Set([...pairs1.keys(), ...pairs2.keys()])

  for (const pair of allPairs) {
    const count1 = pairs1.get(pair) || 0
    const count2 = pairs2.get(pair) || 0
    intersection += Math.min(count1, count2)
  }

  const totalPairs = pairs1.size + pairs2.size
  if (totalPairs === 0) return 0.0

  // Sorensen-Dice coefficient: 2 * intersection / (size1 + size2)
  return (2 * intersection) / totalPairs
}

/**
 * Find the best match from a list of strings
 */
function findBestMatch(target: string, candidates: string[]): {
  bestMatch: { target: string; rating: number; index: number }
  ratings: Array<{ target: string; rating: number; index: number }>
} {
  const ratings = candidates.map((candidate, index) => ({
    target: candidate,
    rating: compareTwoStrings(target, candidate),
    index,
  }))

  // Sort by rating (highest first)
  ratings.sort((a, b) => b.rating - a.rating)

  return {
    bestMatch: ratings[0],
    ratings,
  }
}

/**
 * Normalize address string for comparison
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    // Remove common punctuation
    .replace(/[.,;:]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common suffixes abbreviations
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|wy|circle|cir|court|ct)\b/gi, '')
    // Remove unit/apartment indicators
    .replace(/\b(apt|apartment|unit|suite|ste|#)\s*\w*/gi, '')
    // Remove PO Box
    .replace(/\bp\.?o\.?\s*box\s*\d+/gi, '')
    .trim()
}

/**
 * Extract address components (simplified)
 */
function extractAddressComponents(address: string): {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
} {
  const normalized = address.toLowerCase().trim()
  
  // Extract ZIP code (5 or 5+4 format)
  const zipMatch = normalized.match(/\b\d{5}(-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[0] : undefined
  
  // Extract state (2-letter abbreviation or full name)
  const stateAbbr = normalized.match(/\b([a-z]{2})\b(?=\s*\d{5})/)
  const state = stateAbbr ? stateAbbr[1].toUpperCase() : undefined
  
  // Remove ZIP and state for street extraction
  let streetPart = normalized
    .replace(/\b\d{5}(-\d{4})?\b/, '')
    .replace(/\b[a-z]{2}\b(?=\s*\d{5})/, '')
    .trim()
  
  // Simple split by comma (common address format)
  const parts = streetPart.split(',').map(p => p.trim())
  
  return {
    street: parts[0] || undefined,
    city: parts[1] || undefined,
    state,
    zip,
  }
}

/**
 * Calculate address similarity score (0-1)
 */
export function calculateAddressSimilarity(address1: string, address2: string): number {
  const norm1 = normalizeAddress(address1)
  const norm2 = normalizeAddress(address2)
  
  // Exact match after normalization
  if (norm1 === norm2) {
    return 1.0
  }
  
  // Extract components
  const comp1 = extractAddressComponents(address1)
  const comp2 = extractAddressComponents(address2)
  
  // Component-wise comparison
  const componentScores: number[] = []
  
  // Street similarity (weight: 40%)
  if (comp1.street && comp2.street) {
    const streetSim = compareTwoStrings(
      normalizeAddress(comp1.street),
      normalizeAddress(comp2.street)
    )
    componentScores.push(streetSim * 0.4)
  }
  
  // City similarity (weight: 20%)
  if (comp1.city && comp2.city) {
    const citySim = compareTwoStrings(
      normalizeAddress(comp1.city),
      normalizeAddress(comp2.city)
    )
    componentScores.push(citySim * 0.2)
  }
  
  // State match (weight: 15%)
  if (comp1.state && comp2.state) {
    if (comp1.state === comp2.state) {
      componentScores.push(0.15)
    } else {
      componentScores.push(0)
    }
  }
  
  // ZIP match (weight: 25%)
  if (comp1.zip && comp2.zip) {
    // Exact ZIP match
    if (comp1.zip === comp2.zip) {
      componentScores.push(0.25)
    } else {
      // Same 5-digit prefix
      if (comp1.zip.substring(0, 5) === comp2.zip.substring(0, 5)) {
        componentScores.push(0.2)
      } else {
        componentScores.push(0)
      }
    }
  }
  
  // Overall string similarity (as fallback)
  const overallSim = compareTwoStrings(norm1, norm2)
  
  // Weighted combination
  const componentScore = componentScores.reduce((a, b) => a + b, 0)
  const remainingWeight = 1 - componentScores.reduce((a, b) => a + (b > 0.1 ? 0.15 : 0), 0)
  
  return Math.max(componentScore, overallSim * remainingWeight)
}

/**
 * Match address against a list of addresses
 */
export function findBestAddressMatch(
  targetAddress: string,
  candidateAddresses: string[],
  threshold: number = 0.7
): {
  bestMatch?: {
    address: string
    similarity: number
    index: number
  }
  allMatches: Array<{
    address: string
    similarity: number
    index: number
  }>
} {
  const matches = candidateAddresses.map((addr, index) => ({
    address: addr,
    similarity: calculateAddressSimilarity(targetAddress, addr),
    index,
  }))
  
  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity)
  
  const bestMatch = matches[0] && matches[0].similarity >= threshold
    ? matches[0]
    : undefined
  
  return {
    bestMatch,
    allMatches: matches,
  }
}

/**
 * Validate if two addresses match (with fuzzy matching)
 */
export function addressesMatch(
  address1: string,
  address2: string,
  threshold: number = 0.75
): {
  match: boolean
  similarity: number
  issues?: string[]
} {
  const similarity = calculateAddressSimilarity(address1, address2)
  const match = similarity >= threshold
  
  const issues: string[] = []
  
  if (!match) {
    const comp1 = extractAddressComponents(address1)
    const comp2 = extractAddressComponents(address2)
    
    // Check specific mismatches
    if (comp1.zip && comp2.zip && comp1.zip !== comp2.zip) {
      issues.push(`ZIP code mismatch: ${comp1.zip} vs ${comp2.zip}`)
    }
    
    if (comp1.state && comp2.state && comp1.state !== comp2.state) {
      issues.push(`State mismatch: ${comp1.state} vs ${comp2.state}`)
    }
    
    if (comp1.city && comp2.city) {
      const citySim = compareTwoStrings(
        normalizeAddress(comp1.city),
        normalizeAddress(comp2.city)
      )
      if (citySim < 0.8) {
        issues.push(`City mismatch: ${comp1.city} vs ${comp2.city}`)
      }
    }
    
    if (similarity < 0.5) {
      issues.push('Addresses are significantly different')
    }
  }
  
  return {
    match,
    similarity,
    issues: issues.length > 0 ? issues : undefined,
  }
}

