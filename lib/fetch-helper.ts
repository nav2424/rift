/**
 * Safe fetch helper that handles empty responses and JSON parsing errors
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await fetch(url, options)
    
    // Get status before reading body
    const status = response.status
    
    // Check content type
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')
    
    // For empty responses (no content), return null data
    if (status === 204 || response.headers.get('content-length') === '0') {
      return { data: null, error: null, status }
    }
    
    // Try to get text first to check if body is empty
    const text = await response.text()
    
    // If body is empty, return null data
    if (!text || text.trim().length === 0) {
      return { 
        data: null, 
        error: status >= 400 ? 'Empty error response' : null, 
        status 
      }
    }
    
    // Try to parse as JSON if content type suggests JSON
    if (isJson) {
      try {
        const data = JSON.parse(text) as T
        return { data, error: null, status }
      } catch (parseError) {
        return { 
          data: null, 
          error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          status 
        }
      }
    }
    
    // Try to parse as JSON if text looks like JSON (starts with { or [)
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        const data = JSON.parse(text) as T
        return { data, error: null, status }
      } catch (parseError) {
        // If parsing fails, return as text
      }
    }
    
    // Return text as data if not JSON
    return { data: text as unknown as T, error: null, status }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0
    }
  }
}

/**
 * Fetch with automatic JSON parsing and error handling
 * Throws errors for non-OK responses
 */
export async function fetchJSON<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const result = await safeFetch<T>(url, options)
  
  if (result.error) {
    throw new Error(result.error)
  }
  
  if (result.status >= 400) {
    const errorMessage = result.data && typeof result.data === 'object' && 'error' in result.data
      ? (result.data as any).error
      : `Request failed with status ${result.status}`
    throw new Error(errorMessage)
  }
  
  if (result.data === null) {
    throw new Error('Empty response body')
  }
  
  return result.data
}
