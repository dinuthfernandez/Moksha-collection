import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2, GalleryHorizontal } from 'lucide-react'
import {
  deleteBanner,
  getAdminBanners,
  reorderBanners,
  setBannerActive,
  updateBannerSettings,
  uploadBanner,
  type AdminBanners,
} from '../../api/banners'
import './AdminBanners.css'

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })

export default function AdminBanners() {
  const [data, setData] = useState<AdminBanners | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAdminBanners().then(setData).catch((e: Error) => setError(e.message))
  }, [])

  const run = async (action: () => Promise<AdminBanners>, done = '') => {
    setBusy(true)
    setError('')
    try {
      setData(await action())
      setStatus(done)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setBusy(true)
    setError('')
    let uploaded = 0
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image`)
        continue
      }
      try {
        setStatus(`Uploading ${uploaded + 1} of ${files.length}…`)
        setData(await uploadBanner(await readAsDataUrl(file)))
        uploaded += 1
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`)
      }
    }
    setStatus(uploaded ? `${uploaded} image${uploaded > 1 ? 's' : ''} added` : '')
    setBusy(false)
  }

  const move = (index: number, delta: number) => {
    if (!data) return
    const ids = data.banners.map((b) => b.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    run(() => reorderBanners(ids))
  }

  const remove = (id: string) => {
    if (window.confirm('Delete this banner image?')) run(() => deleteBanner(id), 'Image deleted')
  }

  return (
    <div className="admin-banners">
      <h1><GalleryHorizontal size={22} /> Home banner</h1>
      <p className="admin-banners-lead">
        A blank (text-free) image slideshow shown on the home page between the first and second sections.
        Images change automatically every few seconds in the order below.
      </p>

      {error && <p className="admin-banners-error" role="alert">{error}</p>}

      {data && (
        <>
          <section className="admin-banners-card admin-banners-switch">
            <div>
              <strong>Show banner on website</strong>
              <span>{data.section_enabled ? 'Visible to customers' : 'Hidden from customers'}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.section_enabled}
              className={'admin-banners-toggle' + (data.section_enabled ? ' is-on' : '')}
              disabled={busy}
              onClick={() => run(() => updateBannerSettings(!data.section_enabled, data.interval_seconds), 'Saved')}
            >
              <span />
            </button>
          </section>

          <section className="admin-banners-card admin-banners-switch">
            <div>
              <strong>Seconds per image</strong>
              <span>How long each image stays on screen</span>
            </div>
            <select
              value={data.interval_seconds}
              disabled={busy}
              onChange={(e) => run(() => updateBannerSettings(data.section_enabled, Number(e.target.value)), 'Saved')}
            >
              {[3, 4, 5, 6, 8, 10].map((s) => <option key={s} value={s}>{s}s</option>)}
            </select>
          </section>

          <section className="admin-banners-card admin-banners-guide">
            <strong>Image size to upload</strong>
            <ul>
              <li><b>1920 × 1080 px</b> (16:9 landscape), JPG / PNG / WebP, up to 12 MB — it is auto-compressed.</li>
              <li>Tablet and desktop show the full 16:9 image. Phones show a 4:3 crop, so keep important
                content inside the <b>centre 70%</b> of the width.</li>
              <li>Use images without text near the edges and use the same size for all images.</li>
            </ul>
          </section>

          <div className="admin-banners-actions">
            <button type="button" className="admin-banners-add" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} /> Add images
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            {status && <span className="admin-banners-status">{status}</span>}
          </div>

          {data.banners.length === 0 ? (
            <p className="admin-banners-empty">No banner images yet. Add some to show the slideshow.</p>
          ) : (
            <ul className="admin-banners-list">
              {data.banners.map((banner, i) => (
                <li key={banner.id} className={'admin-banners-item' + (banner.is_active ? '' : ' is-off')}>
                  <img src={banner.image_url} alt={`Banner ${i + 1}`} loading="lazy" />
                  <div className="admin-banners-item-bar">
                    <span className="admin-banners-pos">#{i + 1}</span>
                    <label className="admin-banners-show">
                      <input
                        type="checkbox"
                        checked={banner.is_active}
                        disabled={busy}
                        onChange={(e) => run(() => setBannerActive(banner.id, e.target.checked))}
                      />
                      Show
                    </label>
                    <span className="admin-banners-spacer" />
                    <button type="button" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" aria-label="Move down" disabled={busy || i === data.banners.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown size={16} />
                    </button>
                    <button type="button" aria-label="Delete" className="danger" disabled={busy} onClick={() => remove(banner.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
