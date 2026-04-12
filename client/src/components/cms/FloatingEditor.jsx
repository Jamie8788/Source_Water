/**
 * FloatingEditor — Full WYSIWYG CMS element editor (MS Word-style).
 * Uses TipTap for rich text: bold, italic, underline, strikethrough,
 * font family, font size, text color, highlight, alignment, lists, undo/redo.
 * Also edits: font weight, background color, padding.
 * Draggable. Saves HTML+styles to Supabase cms_overrides.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontFamily } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { useCMS } from '../../context/CMSContext'
import {
  X, GripHorizontal, Save, RotateCcw, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Highlighter, Minus, Plus,
} from 'lucide-react'

const FONTS = ['Default', 'Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Impact']
const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48, 56, 64, 72]

// Inject TipTap editor styles
const EDITOR_STYLES = `
.cms-wysiwyg .ProseMirror {
  outline: none;
  min-height: 80px;
  max-height: 220px;
  overflow-y: auto;
  padding: 8px 10px;
  color: #e0e7ff;
  font-size: 14px;
  line-height: 1.6;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 8px;
  word-break: break-word;
}
.cms-wysiwyg .ProseMirror p { margin: 0 0 4px; }
.cms-wysiwyg .ProseMirror ul { padding-left: 20px; list-style: disc; }
.cms-wysiwyg .ProseMirror ol { padding-left: 20px; list-style: decimal; }
.cms-wysiwyg .ProseMirror:focus { border-color: rgba(99,102,241,0.7); }
`

if (!document.getElementById('cms-wysiwyg-styles')) {
  const s = document.createElement('style')
  s.id = 'cms-wysiwyg-styles'
  s.textContent = EDITOR_STYLES
  document.head.appendChild(s)
}

function ToolBtn({ active, onClick, title, children, danger }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick?.() }}
      title={title}
      style={{
        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 5, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.5)' : danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
        color: active ? '#c4b5fd' : danger ? '#fca5a5' : 'rgba(255,255,255,0.7)',
        transition: 'all 0.1s', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
}

export default function FloatingEditor() {
  const { selectedEl, setSelectedEl, saveOverride, deleteOverride, overrides } = useCMS()

  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState('Default')
  const [bgColor, setBgColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('text') // 'text' | 'style'

  const panelRef = useRef(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 })
  const [pos, setPos] = useState({ left: null, top: null })

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
    ],
    content: '',
    editorProps: { attributes: { class: 'cms-wysiwyg' } },
  })

  // Load element content when selected
  useEffect(() => {
    if (!selectedEl || !editor) return
    const existing = overrides[selectedEl.key]

    // Load HTML content
    const html = existing?.html ?? selectedEl.element?.innerHTML ?? selectedEl.currentText ?? ''
    editor.commands.setContent(html || selectedEl.currentText || '')

    setFontSize(existing?.styles?.fontSize ? parseInt(existing.styles.fontSize) : (selectedEl.currentStyles?.fontSize ?? 16))
    setFontFamily(existing?.styles?.fontFamily || 'Default')
    setBgColor(existing?.styles?.backgroundColor ?? selectedEl.currentStyles?.bgColor ?? '')
    setSaved(false)
    setTab('text')

    // Position panel
    if (selectedEl.rect) {
      const panelW = 400, panelH = 520
      let left = selectedEl.rect.right + 14
      let top = selectedEl.rect.top
      if (left + panelW > window.innerWidth - 12) left = Math.max(12, selectedEl.rect.left - panelW - 14)
      if (top + panelH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - panelH - 12)
      setPos({ left, top })
    }
  }, [selectedEl?.key, editor])

  // Drag
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top }
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return
      setPos({ left: dragState.current.origLeft + e.clientX - dragState.current.startX, top: dragState.current.origTop + e.clientY - dragState.current.startY })
    }
    const onUp = () => { dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const handleSave = async () => {
    if (!selectedEl || !editor) return
    setSaving(true)
    const rawHtml = editor.getHTML()
    // Strip outer <p> wrapper for single-paragraph content.
    // TipTap always wraps in <p> but sidebar links, buttons, spans are inline —
    // injecting <p> inside <a> creates invalid HTML and breaks layout.
    const pCount = (rawHtml.match(/<p[> ]/g) || []).length
    const html = pCount === 1
      ? rawHtml.replace(/^<p>/, '').replace(/<\/p>$/, '')
      : rawHtml
    const styles = {}
    if (fontSize) styles.fontSize = `${fontSize}px`
    if (fontFamily && fontFamily !== 'Default') styles.fontFamily = fontFamily
    if (bgColor) styles.backgroundColor = bgColor
    await saveOverride(selectedEl.key, null, styles, html)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    if (!selectedEl) return
    await deleteOverride(selectedEl.key)
    setSelectedEl(null)
  }

  const handleClose = () => {
    if (selectedEl?.element) { selectedEl.element.style.outline = ''; selectedEl.element.style.outlineOffset = '' }
    setSelectedEl(null)
  }

  if (!selectedEl || !editor) return null

  const s = {
    panel: { position: 'fixed', left: pos.left ?? 'calc(100vw - 420px)', top: pos.top ?? 80, width: 400, zIndex: 99999, background: 'linear-gradient(160deg,#1e1b4b 0%,#1a1a2e 100%)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', overflow: 'hidden', fontFamily: 'system-ui,sans-serif', userSelect: 'none' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', cursor: 'grab', gap: 8 },
    body: { padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
    label: { fontSize: 10, fontWeight: 700, color: 'rgba(199,210,254,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' },
    input: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 7, color: '#e0e7ff', fontSize: 12, padding: '5px 8px', outline: 'none', boxSizing: 'border-box' },
    toolbar: { display: 'flex', flexWrap: 'wrap', gap: 3, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, alignItems: 'center' },
  }

  return (
    <div ref={panelRef} style={s.panel} data-cms-ui="true">
      {/* Header */}
      <div style={s.header} onMouseDown={onMouseDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={13} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Edit Element</span>
          <span style={{ fontSize: 10, color: 'rgba(196,181,253,0.7)', background: 'rgba(0,0,0,0.25)', padding: '1px 7px', borderRadius: 8 }}>{selectedEl.key}</span>
        </div>
        <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 2 }}><X size={14}/></button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {['text', 'style'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t ? '#c4b5fd' : 'rgba(255,255,255,0.4)', borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t === 'text' ? '✏️ Rich Text' : '🎨 Style'}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {tab === 'text' && (
          <>
            {/* Toolbar row 1: history + basic formatting */}
            <div style={s.toolbar}>
              <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={12}/></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={12}/></ToolBtn>
              <Sep/>
              <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} title="Highlight"><Highlighter size={12}/></ToolBtn>
              <Sep/>
              <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List"><List size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List"><ListOrdered size={12}/></ToolBtn>
              <Sep/>
              <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left"><AlignLeft size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center"><AlignCenter size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right"><AlignRight size={12}/></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify"><AlignJustify size={12}/></ToolBtn>
            </div>

            {/* Toolbar row 2: font + color + size */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Font family */}
              <select value={fontFamily} onChange={e => { const f = e.target.value; setFontFamily(f); if (f !== 'Default') editor.chain().focus().setFontFamily(f).run(); else editor.chain().focus().unsetFontFamily().run() }}
                style={{ ...s.input, flex: '1 1 110px', minWidth: 110 }}>
                {FONTS.map(f => <option key={f} value={f} style={{ background: '#1e1b4b' }}>{f}</option>)}
              </select>

              {/* Font size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button onMouseDown={e => { e.preventDefault(); setFontSize(f => Math.max(8, f - 1)) }} style={{ ...s.input, width: 22, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={10}/></button>
                <input type="number" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value) || 14)} style={{ ...s.input, width: 42, textAlign: 'center' }} min={8} max={200}/>
                <button onMouseDown={e => { e.preventDefault(); setFontSize(f => Math.min(200, f + 1)) }} style={{ ...s.input, width: 22, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={10}/></button>
              </div>

              {/* Text color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>A</span>
                <input type="color" defaultValue="#ffffff"
                  onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                  style={{ width: 28, height: 24, borderRadius: 5, border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', padding: 2, background: 'none' }} title="Text Color"/>
              </div>

              {/* Highlight color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Highlighter size={11} color="rgba(255,255,255,0.5)"/>
                <input type="color" defaultValue="#fef08a"
                  onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                  style={{ width: 28, height: 24, borderRadius: 5, border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', padding: 2, background: 'none' }} title="Highlight Color"/>
              </div>
            </div>

            {/* TipTap editor */}
            <div className="cms-wysiwyg" style={{ fontSize: fontSize }}>
              <EditorContent editor={editor} />
            </div>
          </>
        )}

        {tab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Font size */}
            <div>
              <span style={s.label}>Font Size — {fontSize}px</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="range" min={8} max={96} value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} style={{ flex: 1, accentColor: '#6366f1' }}/>
                <input type="number" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value) || 16)} style={{ ...s.input, width: 56, textAlign: 'center' }} min={8} max={200}/>
              </div>
            </div>

            {/* Background color */}
            <div>
              <span style={s.label}>Background Color</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={bgColor || '#000000'} onChange={e => setBgColor(e.target.value)}
                  style={{ width: 36, height: 30, borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', padding: 2, background: 'none' }}/>
                <input value={bgColor} onChange={e => setBgColor(e.target.value)} placeholder="transparent"
                  style={{ ...s.input, flex: 1 }}/>
                {bgColor && <button onClick={() => setBgColor('')} style={{ ...s.input, cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>Clear</button>}
              </div>
            </div>

            {/* Font family */}
            <div>
              <span style={s.label}>Font Family</span>
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={{ ...s.input, width: '100%' }}>
                {FONTS.map(f => <option key={f} value={f} style={{ background: '#1e1b4b' }}>{f}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 7, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 2 }}>
          <button onClick={handleReset} title="Remove all overrides" style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={11}/> Reset
          </button>
          <button onClick={handleClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '8px 0', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, background: saved ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'background 0.3s' }}>
            <Save size={12}/>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
