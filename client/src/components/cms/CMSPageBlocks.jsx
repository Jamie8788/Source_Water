/**
 * CMSPageBlocks — Renders admin-inserted content blocks on any page.
 * All users see the blocks. In CMS mode, admin can edit/delete each block.
 * Block types: heading, text, image, button, divider, spacer
 */
import { useState } from 'react'
import { useCMS } from '../../context/CMSContext'
import { Trash2, Edit3, Check, X } from 'lucide-react'

// ── Block edit forms ────────────────────────────────────────────────────────
function EditForm({ block, onSave, onCancel }) {
  const [c, setC] = useState({ ...block.content })

  const field = (key, label, type = 'text', extra = {}) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'rgba(196,181,253,0.8)' }}>
      {label}
      {type === 'textarea' ? (
        <textarea
          value={c[key] || ''}
          onChange={e => setC(p => ({ ...p, [key]: e.target.value }))}
          rows={4}
          style={{ resize: 'vertical', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' }}
        />
      ) : type === 'select' ? (
        <select
          value={c[key] || extra.default || ''}
          onChange={e => setC(p => ({ ...p, [key]: e.target.value }))}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontSize: 12 }}
        >
          {extra.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={c[key] ?? ''}
          onChange={e => setC(p => ({ ...p, [key]: e.target.value }))}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontSize: 12 }}
        />
      )}
    </label>
  )

  const fields = {
    heading: () => (
      <>
        {field('text', 'Text')}
        {field('level', 'Level (1–6)', 'select', { default: '2', options: [1,2,3,4,5,6].map(n => ({ value: String(n), label: `H${n}` })) })}
        {field('color', 'Color (CSS)', 'text')}
      </>
    ),
    text: () => field('html', 'HTML content (supports <strong>, <em>, <a href="">, etc.)', 'textarea'),
    image: () => (
      <>
        {field('src', 'Image URL')}
        {field('alt', 'Alt text')}
        {field('width', 'Width (e.g. 100%, 400px)')}
        {field('borderRadius', 'Border radius (e.g. 8px)')}
      </>
    ),
    button: () => (
      <>
        {field('text', 'Button label')}
        {field('href', 'Link URL')}
        {field('align', 'Alignment', 'select', { default: 'left', options: ['left','center','right'].map(v => ({ value: v, label: v })) })}
        {field('bg', 'Background color (CSS)')}
        {field('color', 'Text color (CSS)')}
      </>
    ),
    divider: () => field('color', 'Line color (CSS, e.g. #6366f1)'),
    spacer: () => field('height', 'Height (e.g. 32px, 64px)'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(fields[block.block_type] || (() => null))()}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Cancel
        </button>
        <button onClick={() => onSave(c)} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', color: '#c4b5fd', fontSize: 11, fontWeight: 700 }}>
          Save
        </button>
      </div>
    </div>
  )
}

// ── Block renderer ──────────────────────────────────────────────────────────
function Block({ block, cmsMode, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const { block_type, content } = block

  const handleSave = async (newContent) => {
    await onUpdate(block.id, newContent)
    setEditing(false)
  }

  const rendered = (() => {
    switch (block_type) {
      case 'heading': {
        const Tag = `h${Math.min(6, Math.max(1, parseInt(content.level) || 2))}`
        return <Tag style={{ color: content.color || 'var(--text)', margin: '0 0 8px', fontWeight: 700 }}>{content.text || 'Heading'}</Tag>
      }
      case 'text':
        return <div style={{ color: 'var(--text)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: content.html || '' }} />
      case 'image':
        return content.src ? (
          <img src={content.src} alt={content.alt || ''} style={{ width: content.width || '100%', borderRadius: content.borderRadius || 8, display: 'block' }} />
        ) : (
          cmsMode ? (
            <div style={{ border: '2px dashed rgba(99,102,241,0.3)', borderRadius: 8, padding: '24px', textAlign: 'center', color: 'rgba(99,102,241,0.5)', fontSize: 13 }}>
              No image URL set — click Edit to add one
            </div>
          ) : null
        )
      case 'button':
        return (
          <div style={{ textAlign: content.align || 'left' }}>
            <a
              href={content.href || '#'}
              style={{
                display: 'inline-block',
                padding: '10px 28px',
                background: content.bg || 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: content.color || '#fff',
                borderRadius: 8,
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: 14,
                transition: 'opacity 0.15s',
              }}
              onClick={e => { if (content.href === '#' || !content.href) e.preventDefault() }}
            >
              {content.text || 'Button'}
            </a>
          </div>
        )
      case 'divider':
        return <hr style={{ border: 'none', borderTop: `1px solid ${content.color || 'var(--border)'}`, margin: '4px 0' }} />
      case 'spacer':
        return <div style={{ height: content.height || '32px' }} />
      default:
        return null
    }
  })()

  if (rendered === null && !cmsMode) return null

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 16,
        outline: cmsMode ? '1px dashed rgba(99,102,241,0.25)' : 'none',
        borderRadius: 6,
        padding: cmsMode ? 4 : 0,
      }}
      data-cms-block={block.id}
    >
      {/* CMS controls */}
      {cmsMode && !editing && (
        <div style={{ position: 'absolute', top: -8, right: 0, display: 'flex', gap: 4, zIndex: 10 }}>
          <button
            onClick={() => setEditing(true)}
            data-cms-ui="true"
            title="Edit block"
            style={{ background: 'rgba(99,102,241,0.8)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 7px', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <Edit3 size={9}/> Edit
          </button>
          <button
            onClick={() => onDelete(block.id)}
            data-cms-ui="true"
            title="Delete block"
            style={{ background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 7px', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <Trash2 size={9}/>
          </button>
        </div>
      )}

      {/* Edit form overlay */}
      {editing && (
        <div
          data-cms-ui="true"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
            background: 'rgba(15,10,40,0.97)', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 8, padding: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Edit {block_type}
          </div>
          <EditForm block={block} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      )}

      {rendered || (cmsMode && <div style={{ padding: '8px 4px', color: 'rgba(99,102,241,0.4)', fontSize: 11 }}>[empty block]</div>)}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CMSPageBlocks() {
  const { pageBlocks, cmsMode, deletePageBlock, updatePageBlock } = useCMS()
  if (pageBlocks.length === 0 && !cmsMode) return null

  return (
    <div style={{ marginTop: pageBlocks.length > 0 ? 16 : 0 }} data-no-cms>
      {pageBlocks.map(block => (
        <Block
          key={block.id}
          block={block}
          cmsMode={cmsMode}
          onDelete={deletePageBlock}
          onUpdate={updatePageBlock}
        />
      ))}
    </div>
  )
}
