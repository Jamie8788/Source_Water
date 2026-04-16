/**
 * NibiMascotVideo — MP4-based Nibi for /ask-water page
 * Plays mood-appropriate animations from pre-recorded videos
 */
import { useEffect, useRef } from 'react'

// Map moods to MP4 files
const MOOD_TO_VIDEO = {
  idle: 'Water_Mascot_Shy-to-Love.mp4',           // neutral/default
  wave: 'Water_Mascot_Waving.mp4',                // listening
  thinking: 'Water_Mascot_Curiosity.mp4',         // thinking
  happy: 'Water_Mascot_Talking_Assistant.mp4',    // speaking
  blush: 'Water_Mascot_Shy-to-Love.mp4',          // error
}

export default function NibiMascotVideo({ mood = 'idle', size = 320 }) {
  const videoRef = useRef(null)

  // Get video path for current mood
  const videoFile = MOOD_TO_VIDEO[mood] || MOOD_TO_VIDEO.idle
  const videoPath = `/mascot-animations/${videoFile}`

  // Switch video when mood changes
  useEffect(() => {
    if (!videoRef.current) return
    const video = videoRef.current

    // Always update on mood change (or initial mount)
    video.src = videoPath
    video.load()
    video.play().catch(() => {
      // Autoplay failed, video will play on next user interaction
    })
  }, [mood, videoPath])

  return (
    <div
      style={{
        width: size,
        height: size * 1.35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(99,102,241,.08)',
      }}
    >
      <video
        ref={videoRef}
        src={videoPath}
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 1,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    </div>
  )
}
