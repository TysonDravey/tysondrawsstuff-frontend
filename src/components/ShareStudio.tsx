'use client';

// Phone tool behind /share/: product → 1080×1350 image (Instagram's 4:5) + caption → share sheet.
// Instagram ignores text passed through the share sheet, so sharing also copies the caption;
// paste it into the post. Product tags are added in Instagram ("Add product details").
import { useEffect, useMemo, useState } from 'react';

export interface ShareItem {
  slug: string;
  title: string;
  url: string;
  category: string;
  original: boolean;
  sold: boolean;
  price: number;
  story: string | null;
  details: string[];
  show: { title: string; location: string | null; until: string; price: number | null } | null;
  posterPrice: number | null;
  images: Array<{ src: string; width: number; height: number }>;
}

type Backdrop = 'dark' | 'light' | 'fill';
const BACKDROPS: Record<Exclude<Backdrop, 'fill'>, string> = { dark: '#0E0B0A', light: '#F5F1EA' };
const W = 1080;
const H = 1350;
const DEFAULT_TAGS = '#tysondrawsstuff #originalart #painting #artforsale #canadianartist';
const TAGS_KEY = 'tds-share-hashtags';

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function caption(item: ShareItem, tags: string): string {
  const lines: string[] = [item.title];
  if (item.story) lines.push('', item.story);
  if (item.details.length) lines.push('', item.details.join(' · '));
  lines.push('');
  if (item.show && !item.sold) {
    const where = item.show.location ? `${item.show.title}, ${item.show.location}` : item.show.title;
    lines.push(`On the wall at ${where} until ${item.show.until}.`);
    lines.push(`${money(item.show.price ?? item.price)} CAD. Buy it there, or message me to reserve it.`);
  } else if (item.sold) {
    lines.push(item.original ? 'The original has sold.' : 'Sold out.');
  } else if (item.original) {
    lines.push(`Original, one of a kind. ${money(item.price)} CAD.`);
  } else {
    lines.push(`${money(item.price)} CAD.`);
  }
  if (item.posterPrice) lines.push(`Poster prints ${money(item.posterPrice)}.`);
  if (!item.sold || item.posterPrice) lines.push('Free shipping in Canada. Tap the tag or the link in bio.');
  if (tags.trim()) lines.push('', tags.trim());
  return lines.join('\n');
}

// Cloudinary: ask for a 1600px JPEG instead of the full original.
function sourceUrl(src: string): string {
  return src.includes('res.cloudinary.com') && src.includes('/upload/')
    ? src.replace('/upload/', '/upload/f_jpg,q_90,w_1600,c_limit/')
    : src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = sourceUrl(src);
  });
}

async function renderPost(src: string, backdrop: Backdrop): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (backdrop === 'fill') {
    // Crop to fill the frame
    const s = Math.max(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  } else {
    // Whole piece, centred with a margin
    ctx.fillStyle = BACKDROPS[backdrop];
    ctx.fillRect(0, 0, W, H);
    const pad = 70;
    const s = Math.min((W - pad * 2) / iw, (H - pad * 2) / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/jpeg', 0.92),
  );
}

function readTags(): string {
  try {
    return localStorage.getItem(TAGS_KEY) ?? DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

export default function ShareStudio({ items }: { items: ShareItem[] }) {
  const [filter, setFilter] = useState<'available' | 'all'>('available');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ShareItem | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      i => (filter === 'all' || !i.sold || i.posterPrice) && (!q || i.title.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  if (selected) return <Composer item={selected} onBack={() => setSelected(null)} />;

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-6 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl mb-1">Post studio</h1>
      <p className="text-soft text-sm mb-5">Pick a piece to make an Instagram/Facebook post.</p>
      <div className="flex gap-2 mb-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search"
          className="flex-1 min-w-0 rounded border border-border bg-card px-3 py-2 text-base"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as 'available' | 'all')}
          className="rounded border border-border bg-card px-2 py-2 text-base"
        >
          <option value="available">For sale</option>
          <option value="all">Everything</option>
        </select>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map(item => (
          <li key={item.slug}>
            <button onClick={() => setSelected(item)} className="w-full text-left group">
              <div className="aspect-[4/5] bg-card rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.images[0].src} alt="" loading="lazy" className="w-full h-full object-contain" />
              </div>
              <p className="mt-1.5 text-sm font-semibold leading-tight group-hover:text-primary">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.sold ? 'Sold' : item.show ? `At ${item.show.title}` : money(item.price)}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-soft">Nothing matches.</p>}
    </main>
  );
}

function Composer({ item, onBack }: { item: ShareItem; onBack: () => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [backdrop, setBackdrop] = useState<Backdrop>('dark');
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  // Hashtags are remembered on this phone
  useEffect(() => setTags(readTags()), []);
  useEffect(() => setText(caption(item, tags)), [item, tags]);

  // Render the image ahead of time: iOS only opens the share sheet straight from a tap.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFile(null);
    renderPost(item.images[imageIndex].src, backdrop)
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
        setFile(new File([blob], `${item.slug}.jpg`, { type: 'image/jpeg' }));
      })
      .catch(e => !cancelled && setStatus(String(e.message ?? e)));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item, imageIndex, backdrop]);

  const saveTags = (v: string) => {
    setTags(v);
    try {
      localStorage.setItem(TAGS_KEY, v);
    } catch {}
  };

  const copy = (value: string, done: string) => {
    navigator.clipboard?.writeText(value).then(
      () => setStatus(done),
      () => setStatus('Copy failed: select the text and copy it by hand.'),
    );
  };

  const share = async () => {
    if (!file) return;
    // Copy first, in the same tap, so the caption is ready to paste in Instagram.
    copy(text, 'Caption copied. Paste it into the post.');
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('Sharing failed. Use Save image instead.');
      }
    } else {
      setStatus("This browser can't share images. Use Save image instead.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-4 max-w-xl mx-auto pb-16">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary mb-3">
        ← All pieces
      </button>
      <h1 className="font-display text-2xl mb-3">{item.title}</h1>

      <div className="aspect-[4/5] w-full rounded overflow-hidden bg-card mb-3 flex items-center justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Post preview" className="w-full h-full" />
        ) : (
          <span className="text-muted-foreground text-sm">Making the image…</span>
        )}
      </div>

      {item.images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-3">
          {item.images.map((img, i) => (
            <button
              key={img.src}
              onClick={() => setImageIndex(i)}
              className={`shrink-0 w-16 h-20 rounded overflow-hidden border-2 ${i === imageIndex ? 'border-primary' : 'border-transparent'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-5 text-sm">
        {(['dark', 'light', 'fill'] as Backdrop[]).map(b => (
          <button
            key={b}
            onClick={() => setBackdrop(b)}
            className={`flex-1 rounded border px-3 py-2 ${b === backdrop ? 'border-primary text-primary' : 'border-border'}`}
          >
            {b === 'dark' ? 'Dark' : b === 'light' ? 'Light' : 'Fill (crop)'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-5">
        <button
          onClick={share}
          disabled={!file}
          className="bg-primary text-primary-foreground font-bold px-6 py-3.5 rounded disabled:opacity-50"
        >
          Share image + copy caption
        </button>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <button onClick={() => copy(text, 'Caption copied.')} className="border border-line-strong rounded px-2 py-2.5">
            Copy caption
          </button>
          <a
            href={preview ?? undefined}
            download={`${item.slug}.jpg`}
            className={`border border-line-strong rounded px-2 py-2.5 text-center ${preview ? '' : 'pointer-events-none opacity-50'}`}
          >
            Save image
          </a>
          <button onClick={() => copy(item.url, 'Link copied.')} className="border border-line-strong rounded px-2 py-2.5">
            Copy link
          </button>
        </div>
        {status && <p className="text-sm text-[#CFE3B4]" role="status">{status}</p>}
      </div>

      <label className="block text-xs font-bold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">Caption</label>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={12}
        className="w-full rounded border border-border bg-card px-3 py-2 text-base leading-snug mb-4"
      />

      <label className="block text-xs font-bold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
        Hashtags (remembered on this phone)
      </label>
      <textarea
        value={tags}
        onChange={e => saveTags(e.target.value)}
        rows={2}
        className="w-full rounded border border-border bg-card px-3 py-2 text-base mb-4"
      />

      <p className="text-sm text-soft">
        In Instagram: pick the image, paste the caption, then <strong>Add product details</strong> and search for
        “{item.title}” to tag it.
      </p>
    </main>
  );
}
