// The compact camera toolbar over the engine 3D view: Room (the opening
// corner shot), Overview (the whole room from outside, near walls hidden),
// Walls 1-4 (front-on elevations), Top (bird's eye) and Photo
// (a PNG of the current view at twice the on-screen size), plus one button per
// room inside the room (a pantry: its doorway, looking in). Plain buttons, so
// Tab / Enter / Space work; the active view is aria-pressed.
import React, { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { spaceLabels } from './interior.js'

const btn = 'min-w-[2.25rem] h-9 px-2.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1'
const on = 'bg-blue-700 text-white'
const off = 'bg-white text-gray-800 hover:bg-gray-100'

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function CameraToolbar({ t, active, onView, onPhoto, roomType = 'kitchen', spaces = [] }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const photo = async () => {
    if (busy || !onPhoto) return
    setBusy(true)
    setStatus('')
    try {
      const blob = await onPhoto()
      if (!blob) throw new Error('no image')
      const day = new Date().toISOString().slice(0, 10)
      download(blob, `${roomType}-3d-${day}.png`)
      setStatus(t('designer.view3d.photoSaved'))
    } catch (err) {
      console.error('[CameraToolbar] photo failed', err)
      setStatus(t('designer.view3d.photoFailed'))
    } finally {
      setBusy(false)
    }
  }

  const view = (name, label, extra = {}) => (
    <button
      type="button"
      key={name}
      onClick={() => onView(name)}
      aria-pressed={active === name}
      className={`${btn} ${active === name ? on : off}`}
      {...extra}
    >
      {label}
    </button>
  )

  return (
    <div
      role="group"
      aria-label={t('designer.view3d.toolbar')}
      className="flex flex-wrap items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow-md border border-gray-200 p-1 pointer-events-auto"
    >
      {view('room', t('designer.view3d.room'))}
      {view('overview', t('designer.view3d.overview'), { title: t('designer.view3d.overviewHint') })}
      <span className="w-px h-6 bg-gray-300 mx-0.5" aria-hidden="true" />
      <div role="group" aria-label={t('designer.view3d.walls')} className="flex items-center gap-1">
        <span className="hidden sm:inline text-xs text-gray-700 px-1" aria-hidden="true">{t('designer.view3d.walls')}</span>
        {[1, 2, 3, 4].map((n) => view(`wall${n}`, String(n), {
          'aria-label': t('designer.view3d.wall', { n }),
          title: t('designer.view3d.wall', { n }),
        }))}
      </div>
      <span className="w-px h-6 bg-gray-300 mx-0.5" aria-hidden="true" />
      {view('top', t('designer.view3d.top'))}
      {spaces.length ? <span className="w-px h-6 bg-gray-300 mx-0.5" aria-hidden="true" /> : null}
      {spaceLabels(spaces, t('designer.view3d.pantry')).map((label, i) => view(`space:${spaces[i].id}`, label, {
        title: t('designer.view3d.pantryHint', { name: label }),
      }))}
      <span className="w-px h-6 bg-gray-300 mx-0.5" aria-hidden="true" />
      <button
        type="button"
        onClick={photo}
        disabled={busy}
        aria-busy={busy}
        title={t('designer.view3d.photoHint')}
        className={`${btn} ${off} flex items-center gap-1.5 disabled:opacity-60`}
      >
        {busy
          ? <Loader2 aria-hidden="true" size={16} className="animate-spin" />
          : <Camera aria-hidden="true" size={16} />}
        {t('designer.view3d.photo')}
      </button>
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
