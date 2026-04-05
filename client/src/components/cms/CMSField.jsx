import { useState, useRef, useEffect, useCallback } from 'react'
import { useCMS } from '../../context/CMSContext'
import { Check, X, Bold, Italic, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'

/**
 * CMSField — click-to-edit any text/HTML in CMS mode.
 *
 * Props:
 *   page, block, field      — content address
 *   default                 — fallback text if nothing in DB
 *   tag                     — HTML tag to render (default: span)
 *   className, style        — passed to the rendered element
 *   multiline               — show textarea instead of input
 *   rich                    — enable rich text (contentEditable + mini toolbar)
 */
export default function CMSField({
  page, block, field,
  default: defaultValue = '',
  tag: Tag = 'span',
  className = '',
  multiline = false,
  rich = false,
  style = {},
}) {
  const { cmsMode, get, save } = useCMS()
  const value = get(page, block, field, defaultValue)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  const richRef = useRef(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => {
    if (editing) {
      if (rich && richRef.current) {
        richRef.current.focus()
        // move cursor to end
        const range = document.createRange()
        range.selectNodeContents(richRef.current)
        range.collapse(false)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      } else {
        inputRef.current?.focus()
      }
    }
  }, [editing, rich])

  if (!cmsMode) {
    if (rich) {
      return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: value }}/>
    }
    return <Tag className={className} style={style}>{value}</Tag>
  }

  const startEdit = (e) => {
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
  }

  const commit = async (e) => {
    e?.stopPropagation()
    setEditing(false)
    const newVal = rich ? richRef.current?.innerHTML ?? draft : draft
    if (newVal !== value) await save(page, block, field, newVal)
  }

  const cancel = (e) => {
    e?.stopPropagation()
    setEditing(false)
    setDraft(value)
    if (rich && richRef.current) richRef.current.innerHTML = value
  }

  const execCmd = (cmd, val = null) => {
    richRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  if (editing) {
    if (rich) {
      return (
        <span style={{ display: 'block', position: 'relative' }} onClick={e => e.stopPropagation()}>
          {/* Mini rich toolbar */}
          <span style={{
            display: 'inline-flex', gap: 2, flexWrap: 'wrap',
            padding: '4px 6px', borderRadius: '6px 6px 0 0',
            background: '#1e293b', border: '1px solid #6366f1',
            borderBottom: 'none', position: 'relative', zIndex: 10,
          }}>
            {[
              { icon: <Bold size={11}/>, cmd: 'bold', title: 'Bold' },
              { icon: <Italic size={11}/>, cmd: 'italic', title: 'Italic' },
              { icon: <AlignLeft size={11}/>, cmd: 'justifyLeft', title: 'Left' },
              { icon: <AlignCenter size={11}/>, cmd: 'justifyCenter', title: 'Center' },
              { icon: <AlignRight size={11}/>, cmd: 'justifyRight', title: 'Right' },
            ].map(({ icon, cmd, title }) => (
              <button key={cmd} title={title} onMouseDown={e => { e.preventDefault(); execCmd(cmd) }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                  borderRadius: 4, padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {icon}
              </button>
            ))}
            <select onMouseDown={e => e.stopPropagation()}
              onChange={e => { richRef.current?.focus(); document.execCommand('fontSize', false, e.target.value) }}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                borderRadius: 4, padding: '1px 4px', cursor: 'pointer', fontSize: 11 }}>
              <option value="">Size</option>
              {[1,2,3,4,5,6,7].map(s => <option key={s} value={s}>S{s}</option>)}
            </select>
            <button onMouseDown={e => { e.preventDefault(); commit() }} title="Save"
              style={{ background: '#6366f1', border: 'none', color: 'white',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
              <Check size={10}/> Save
            </button>
            <button onMouseDown={e => { e.preventDefault(); cancel() }} title="Cancel"
              style={{ background: '#ef4444', border: 'none', color: 'white',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 3 }}>
              <X size={10}/> Cancel
            </button>
          </span>
          <span
            ref={richRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: value }}
            onKeyDown={e => { if (e.key === 'Escape') cancel(e) }}
            style={{
              display: 'block', minHeight: 40,
              background: 'rgba(99,102,241,0.06)',
              border: '2px solid #6366f1',
              borderRadius: '0 0 6px 6px',
              padding: '6px 10px', outline: 'none',
              fontSize: 'inherit', fontWeight: 'inherit',
              color: 'inherit', fontFamily: 'inherit',
              ...style,
            }}
          />
        </span>
      )
    }

    return (
      <span className="cms-editing-wrap" style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        {multiline ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancel(e) }}
            rows={3}
            style={{
              fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
              background: 'rgba(99,102,241,0.08)', border: '2px solid #6366f1',
              borderRadius: 6, padding: '4px 8px', outline: 'none',
              minWidth: 200, resize: 'both', fontFamily: 'inherit',
            }}
          />
        ) : (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(e); if (e.key === 'Escape') cancel(e) }}
            style={{
              fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
              background: 'rgba(99,102,241,0.08)', border: '2px solid #6366f1',
              borderRadius: 6, padding: '4px 8px', outline: 'none',
              minWidth: Math.max(120, draft.length * 9), fontFamily: 'inherit',
            }}
          />
        )}
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button onClick={commit} title="Save"
            style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 4,
              padding: '2px 8px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Check size={11}/> Save
          </button>
          <button onClick={cancel} title="Cancel"
            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4,
              padding: '2px 8px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
            <X size={11}/> Cancel
          </button>
        </span>
      </span>
    )
  }

  // CMS hover state — show dashed outline and edit icon
  return (
    <Tag
      className={`cms-field ${className}`}
      style={{
        ...style,
        outline: '1.5px dashed rgba(99,102,241,0.5)',
        outlineOffset: 3,
        borderRadius: 3,
        cursor: 'text',
        position: 'relative',
        transition: 'outline-color 0.15s, background 0.15s',
      }}
      onClick={startEdit}
      title={`Edit: ${block} › ${field}`}
      {...(rich ? { dangerouslySetInnerHTML: { __html: value } } : {})}
    >
      {!rich && value}
      <span style={{
        position: 'absolute', top: -9, right: -9,
        background: '#6366f1', color: 'white',
        borderRadius: '50%', width: 18, height: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, pointerEvents: 'none',
        boxShadow: '0 2px 6px rgba(99,102,241,0.5)',
      }}>✎</span>
    </Tag>
  )
}
