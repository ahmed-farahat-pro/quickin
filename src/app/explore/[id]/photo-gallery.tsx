'use client'

// Clickable listing photos + a full-screen lightbox slideshow.
// The hero + thumbnail strip mirror the boutique look of the detail page;
// tapping any photo opens the lightbox at that index. Keyboard (arrows /
// escape) and touch-swipe navigation are supported.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

function GalleryImg({
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      src={src || FALLBACK_IMG}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = FALLBACK_IMG
      }}
    />
  )
}

export default function PhotoGallery({
  images,
  title,
}: {
  images: { url: string }[]
  title: string
}) {
  const t = useTranslations('listingPage')

  const urls = images.length ? images.map((i) => i.url) : [FALLBACK_IMG]
  const total = urls.length

  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const openAt = useCallback((i: number) => {
    setIndex(i)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const next = useCallback(
    () => setIndex((i) => (i + 1) % total),
    [total],
  )
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + total) % total),
    [total],
  )

  // Keyboard navigation + body-scroll lock while the lightbox is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close, next, prev])

  const hero = urls[0]
  const thumbs = urls.slice(1)

  const arrowBtn: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 52,
    height: 52,
    borderRadius: 999,
    border: 'none',
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontSize: 26,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  }

  return (
    <>
      {/* Hero */}
      <div
        onClick={() => openAt(0)}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 24,
          overflow: 'hidden',
          background: COLORS.tan,
          boxShadow: '0 10px 36px rgba(42,34,32,0.12)',
          cursor: 'pointer',
        }}
      >
        <GalleryImg
          src={hero}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openAt(0)
          }}
          style={{
            position: 'absolute',
            bottom: 14,
            insetInlineEnd: 14,
            border: 'none',
            background: 'rgba(255,255,255,0.92)',
            color: COLORS.ink,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            padding: '9px 16px',
            borderRadius: 999,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(42,34,32,0.18)',
          }}
        >
          {t('gallery.viewPhotos')}
        </button>
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            padding: '16px 2px 4px',
          }}
        >
          {thumbs.map((url, i) => (
            <GalleryImg
              key={`${url}-${i}`}
              src={url}
              alt={t('photoAlt', { title, index: i + 2 })}
              loading="lazy"
              onClick={() => openAt(i + 1)}
              style={{
                width: 132,
                height: 96,
                flex: '0 0 auto',
                objectFit: 'cover',
                borderRadius: 14,
                background: COLORS.tan,
                boxShadow: '0 3px 12px rgba(42,34,32,0.10)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {open && (
        <div
          onClick={close}
          onTouchStart={(e) => {
            touchStartX.current = e.changedTouches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current
            touchStartX.current = null
            if (start == null) return
            const dx = (e.changedTouches[0]?.clientX ?? start) - start
            if (Math.abs(dx) < 40) return
            if (dx < 0) next()
            else prev()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Counter */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              fontFamily: 'inherit',
            }}
          >
            {t('gallery.counter', { current: index + 1, total })}
          </div>

          {/* Close */}
          <button
            type="button"
            aria-label={t('gallery.close')}
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            style={{
              position: 'absolute',
              top: 14,
              insetInlineEnd: 16,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(255,255,255,0.14)',
              color: '#fff',
              fontSize: 26,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &times;
          </button>

          {/* Prev */}
          {total > 1 && (
            <button
              type="button"
              aria-label={t('gallery.prev')}
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              style={{ ...arrowBtn, insetInlineStart: 16 }}
            >
              &#8249;
            </button>
          )}

          {/* Current image — stopPropagation so clicking it doesn't close. */}
          <GalleryImg
            src={urls[index]}
            alt={t('photoAlt', { title, index: index + 1 })}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          />

          {/* Next */}
          {total > 1 && (
            <button
              type="button"
              aria-label={t('gallery.next')}
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              style={{ ...arrowBtn, insetInlineEnd: 16 }}
            >
              &#8250;
            </button>
          )}
        </div>
      )}
    </>
  )
}
