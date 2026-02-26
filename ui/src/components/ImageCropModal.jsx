import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Cropper from 'react-easy-crop'

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

async function getCroppedBlob(imageSrc, pixelCrop, outType = 'image/jpeg', quality = 0.9) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), outType, quality)
  })
}

export default function ImageCropModal({
  open,
  onOpenChange,
  file,
  aspect = 1,
  title = 'Recortar imagen',
  onDone,
}) {
  const [src, setSrc] = React.useState(null)
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null)

  React.useEffect(() => {
    if (!file) { setSrc(null); return }
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function handleDone() {
    if (!src || !croppedAreaPixels) return
    // We return a JPEG blob; backend converts/compresses to WEBP
    const blob = await getCroppedBlob(src, croppedAreaPixels, 'image/jpeg', 0.92)
    onDone?.(blob)
    onOpenChange?.(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="feego-overlay fixed inset-0" />
        <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-black">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="feego-btn feego-btn-ghost px-3 py-2 rounded-xl">Cerrar</button>
            </Dialog.Close>
          </div>

          <div className="mt-3 feego-muted text-sm">Aspect ratio: {aspect === 1 ? '1:1' : aspect === 16/9 ? '16:9' : aspect === 9/16 ? '9:16' : aspect}</div>

          <div className="mt-4 relative w-full h-[60vh] rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--feego-border)' }}>
            {src ? (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="text-sm feego-muted">Zoom</div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <button onClick={handleDone} className="feego-btn feego-btn-primary px-4 py-2 rounded-xl">Usar</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
