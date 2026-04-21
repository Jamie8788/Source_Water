import NibiMascotImage from './NibiMascotImage'

export default function ComingSoon({ title, message, really = false }) {
  const label = really ? 'Coming REALLY soon' : 'Coming soon'
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex flex-col items-center text-center">
        <NibiMascotImage mood="blush" size={180}/>
        <h1 className="text-3xl font-black mt-6" style={{ color: 'var(--text)' }}>{title}</h1>
        {message && (
          <p className="mt-3 text-base max-w-xl" style={{ color: 'var(--text-muted)' }}>
            {message}
          </p>
        )}
        <div className="mt-6 px-5 py-2 rounded-full text-sm font-bold"
          style={{
            background: really ? 'rgba(244,114,182,0.15)' : 'rgba(99,102,241,0.12)',
            color: really ? '#f472b6' : '#818cf8',
            border: `1px solid ${really ? 'rgba(244,114,182,0.4)' : 'rgba(99,102,241,0.3)'}`,
          }}>
          {label}
        </div>
      </div>
    </div>
  )
}
