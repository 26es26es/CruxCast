import { MAX_VIDEO_MB } from './constants'

/** Returns an error code for files we'd reject anyway, so we skip the upload. */
export function checkVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/')) return 'not_a_video'
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) return 'video_too_large'
  return null
}
