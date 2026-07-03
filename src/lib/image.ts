'use client'

// Client-side image helpers for uploading listing/ID photos as base64 data URLs
// (the local stack stores images inline — no blob service). We downscale + JPEG-
// compress in a <canvas> so a 12MP phone photo doesn't become a multi-MB DB row.

/** Convert a File to a compressed JPEG data URL. HEIC/HEIF is converted first. */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.72
): Promise<string> {
  let src = file
  // iPhones often hand us HEIC — convert to JPEG so <img>/canvas can read it.
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    try {
      const heic2any = (await import('heic2any')).default as (opts: {
        blob: Blob
        toType?: string
        quality?: number
      }) => Promise<Blob | Blob[]>
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality })
      const blob = Array.isArray(out) ? out[0] : out
      src = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
    } catch {
      /* fall through — some browsers can decode HEIC natively */
    }
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(src)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode failed'))
    el.src = dataUrl
  })

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl // canvas unavailable — fall back to the raw data URL
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}
