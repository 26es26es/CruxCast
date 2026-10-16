import { useId, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_VIDEO_MB } from '../constants'
import { UploadIcon } from './icons'

type Props = {
  onFile: (file: File) => void
}

export function VideoDropZone({ onFile }: Props) {
  const { t } = useTranslation()
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <label
      htmlFor={inputId}
      className={`video-drop${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <UploadIcon />
      <strong>{t('video.dropTitle')}</strong>
      <span>{t('video.dropHint', { max: MAX_VIDEO_MB })}</span>
      <input
        id={inputId}
        type="file"
        accept="video/*"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </label>
  )
}
