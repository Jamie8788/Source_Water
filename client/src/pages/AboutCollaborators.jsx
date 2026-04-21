import NibiMascotImage from '../components/NibiMascotImage'

export default function AboutCollaborators() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex flex-col items-center text-center">
        <NibiMascotImage mood="openarms" size={160}/>
        <h1 className="text-3xl font-black mt-6" style={{ color: 'var(--text)' }}>Our Collaborators</h1>
        <p className="mt-3 text-base max-w-xl" style={{ color: 'var(--text-muted)' }}>
          SOURCE Water is built in partnership with communities, researchers, and institutions across the Great Lakes
          region. Full partner list and acknowledgements coming soon.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Managed by</div>
          <div className="text-base font-black" style={{ color: '#818cf8' }}>NORDIK Institute</div>
        </div>
        <div className="mt-6 px-4 py-2 rounded-full text-xs font-bold"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          Coming soon
        </div>
      </div>
    </div>
  )
}
