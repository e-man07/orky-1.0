export interface TextChunk {
  content: string
  chunkIndex: number
  chunkSize: number
  precedingContext: string | null
  followingContext: string | null
}

const CHUNK_SIZE = 500
const OVERLAP = 50

export function chunkText(text: string): TextChunk[] {
  if (!text || text.trim().length === 0) return []

  const cleanText = text.replace(/\s+/g, ' ').trim()

  if (cleanText.length <= CHUNK_SIZE) {
    return [
      {
        content: cleanText,
        chunkIndex: 0,
        chunkSize: cleanText.length,
        precedingContext: null,
        followingContext: null,
      },
    ]
  }

  const chunks: TextChunk[] = []
  let start = 0
  let chunkIndex = 0

  while (start < cleanText.length) {
    let end = Math.min(start + CHUNK_SIZE, cleanText.length)

    // Try to break at sentence boundary in the last 100 chars
    if (end < cleanText.length) {
      const searchStart = Math.max(end - 100, start)
      const window = cleanText.substring(searchStart, end)

      // Look for sentence boundaries (., !, ?, newline)
      const lastBreak = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('.\n'),
        window.lastIndexOf('! '),
        window.lastIndexOf('? '),
        window.lastIndexOf('\n')
      )

      if (lastBreak > 0) {
        end = searchStart + lastBreak + 1
      }
    }

    const content = cleanText.substring(start, end).trim()

    if (content.length > 0) {
      // Get preceding context
      const precStart = Math.max(0, start - OVERLAP)
      const precedingContext =
        start > 0 ? cleanText.substring(precStart, start).trim() : null

      // Get following context
      const folEnd = Math.min(cleanText.length, end + OVERLAP)
      const followingContext =
        end < cleanText.length
          ? cleanText.substring(end, folEnd).trim()
          : null

      chunks.push({
        content,
        chunkIndex,
        chunkSize: content.length,
        precedingContext,
        followingContext,
      })

      chunkIndex++
    }

    // Move start forward, accounting for overlap
    start = end
  }

  return chunks
}
