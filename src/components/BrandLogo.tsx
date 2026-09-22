import Image from 'next/image';

/**
 * Approved FixTray artwork.
 * Wordmark files were delivered as JPEG bytes; they live under public/brand as .jpg
 * so the nosniff header still lets browsers render them.
 * Crop boxes trim the source canvas padding so the artwork fills the header
 * without changing the logo itself.
 */
const WORDMARK_SRC = '/brand/fixtray-wordmark-approved.jpg';
const MARK_SRC = '/brand/fixtray-ft-transparent.png';

const WORDMARK_CROP = { imgW: 1280, imgH: 720, x: 168, y: 194, w: 1066, h: 334 };
const MARK_CROP = { img: 2048, x: 236, y: 680, w: 1568, h: 688 };

const WORDMARK_WIDTH = {
  header: 'min(40vw, 176px)',
  nav: '132px',
  shell: 'min(36vw, 124px)',
  footer: '150px',
} as const;

type WordmarkVariant = keyof typeof WORDMARK_WIDTH;

function cropStyle(imgW: number, x: number, y: number, w: number, h: number) {
  return {
    position: 'absolute' as const,
    width: `${(imgW / w) * 100}%`,
    height: 'auto' as const,
    maxWidth: 'none',
    left: `${(-x / w) * 100}%`,
    top: `${(-y / h) * 100}%`,
  };
}

export function BrandWordmark({
  variant = 'header',
  priority = false,
  className,
}: {
  variant?: WordmarkVariant;
  priority?: boolean;
  className?: string;
}) {
  const { imgW, imgH, x, y, w, h } = WORDMARK_CROP;
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        width: WORDMARK_WIDTH[variant],
        aspectRatio: `${w} / ${h}`,
        overflow: 'hidden',
        background: '#fff',
        borderRadius: 6,
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      <Image
        src={WORDMARK_SRC}
        alt="FixTray — The people you need, found."
        width={imgW}
        height={imgH}
        priority={priority}
        sizes={variant === 'header' ? '(max-width: 640px) 40vw, 176px' : '160px'}
        style={cropStyle(imgW, x, y, w, h)}
      />
    </span>
  );
}

/** Square-slot FT mark (transparent). Favicon and PWA icons use the opaque white files. */
export function BrandMark({
  width = 36,
  priority = false,
  className,
}: {
  width?: number;
  priority?: boolean;
  className?: string;
}) {
  const { img, x, y, w, h } = MARK_CROP;
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        width,
        aspectRatio: `${w} / ${h}`,
        overflow: 'hidden',
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      <Image
        src={MARK_SRC}
        alt="FixTray"
        width={img}
        height={img}
        priority={priority}
        sizes={`${width}px`}
        style={cropStyle(img, x, y, w, h)}
      />
    </span>
  );
}
