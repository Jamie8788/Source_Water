import NibiMascotImage from '../components/NibiMascotImage'

export default function AboutStoryline() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex flex-col items-center text-center">
        <NibiMascotImage mood="blush" size={160}/>
        <h1 className="text-3xl font-black mt-6" style={{ color: 'var(--text)' }}>Our Storyline</h1>
        <p className="mt-3 text-base max-w-xl" style={{ color: 'var(--text-muted)' }}>
          The story of SOURCE Water is coming soon. We're writing it up — check back shortly for our journey,
          mission, and the communities we serve.
        </p>
        <div className="mt-6 px-4 py-2 rounded-full text-xs font-bold"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          Coming soon
        </div>
      </div>
    </div>
  )
}
