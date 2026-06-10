/**
 * Convert a string to snake_case
 * "Fast WiFi" → "fast_wifi"
 * "Air Conditioning" → "air_conditioning"
 */
export function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special characters
    .replace(/[\s-]+/g, '_')    // Replace spaces and hyphens with underscore
    .replace(/_+/g, '_')        // Remove duplicate underscores
    .replace(/^_|_$/g, '')      // Remove leading/trailing underscores
}

/**
 * Generate a unique code from a label
 * Appends a number if the code already exists
 */
export function generateUniqueCode(
  label: string, 
  existingCodes: string[]
): string {
  const baseCode = toSnakeCase(label)
  
  if (!existingCodes.includes(baseCode)) {
    return baseCode
  }
  
  // Find next available number
  let counter = 1
  let candidateCode = `${baseCode}_${counter}`
  while (existingCodes.includes(candidateCode)) {
    counter++
    candidateCode = `${baseCode}_${counter}`
  }
  
  return candidateCode
}
