
// Simulate a file object
type MockFile = {
  name: string
}

type Photo = {
  file: MockFile
  category: string
}

// Configuration
const NUM_PHOTOS = 5
const UPLOAD_DELAY_MS = 200 // Simulate 200ms per upload

// Mock Data
const photos: Photo[] = Array.from({ length: NUM_PHOTOS }, (_, i) => ({
  file: { name: `photo-${i}.jpg` },
  category: 'living-room'
}))

// Mock Supabase Upload function (returns a promise that resolves after delay)
const mockUpload = async (fileName: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { path: fileName }, error: null })
    }, UPLOAD_DELAY_MS)
  })
}

const mockGetPublicUrl = (fileName: string) => {
  return { data: { publicUrl: `https://example.com/${fileName}` } }
}

async function runSequentialBenchmark() {
  console.log('--- Starting Sequential Benchmark ---')
  const start = performance.now()

  for (const [index, photo] of photos.entries()) {
    const fileExt = photo.file.name.split('.').pop()
    const fileName = `user-id/${Date.now()}-${index}.${fileExt}`

    // mimic: await supabase.storage.from('listings').upload(...)
    await mockUpload(fileName)

    // mimic: supabase.storage.from('listings').getPublicUrl(...)
    const { data: { publicUrl } } = mockGetPublicUrl(fileName)
  }

  const end = performance.now()
  const duration = end - start
  console.log(`Sequential Uploads took: ${duration.toFixed(2)}ms`)
  return duration
}

async function runParallelBenchmark() {
  console.log('\n--- Starting Parallel Benchmark ---')
  const start = performance.now()

  const uploadPromises = photos.map(async (photo, index) => {
    const fileExt = photo.file.name.split('.').pop()
    const fileName = `user-id/${Date.now()}-${index}.${fileExt}`

    await mockUpload(fileName)

    const { data: { publicUrl } } = mockGetPublicUrl(fileName)

    return {
      url: publicUrl,
      category: photo.category,
      order: index,
      caption: null
    }
  })

  await Promise.all(uploadPromises)

  const end = performance.now()
  const duration = end - start
  console.log(`Parallel Uploads took: ${duration.toFixed(2)}ms`)
  return duration
}

async function main() {
  console.log(`Simulating upload of ${NUM_PHOTOS} photos with ${UPLOAD_DELAY_MS}ms delay each.\n`)

  const seqTime = await runSequentialBenchmark()
  const parTime = await runParallelBenchmark()

  console.log('\n--- Results ---')
  console.log(`Improvement: ${(seqTime - parTime).toFixed(2)}ms faster`)
  console.log(`Speedup: ${(seqTime / parTime).toFixed(2)}x`)
}

main().catch(console.error)
