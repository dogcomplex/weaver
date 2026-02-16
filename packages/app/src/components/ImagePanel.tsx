import { useState } from 'react'

interface ImageInfo {
  filename: string
  url: string
}

interface QueueResult {
  prompt_id: string
  images: ImageInfo[]
}

interface ImagePanelProps {
  result: QueueResult
  onClose: () => void
}

export function ImagePanel({ result, onClose }: ImagePanelProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const image = result.images[selectedIdx]

  if (!result.images.length) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
            ComfyUI Output
          </span>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
          No images produced. Check ComfyUI logs.
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
          ComfyUI Output
        </span>
        <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}>
          {result.prompt_id.slice(0, 8)}...
        </span>
        <div style={{ flex: 1 }} />
        {result.images.length > 1 && (
          <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
            {result.images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  border: i === selectedIdx ? '1px solid #6a6' : '1px solid #444',
                  background: i === selectedIdx ? '#1e2a1a' : '#1a1a1a',
                  color: '#ccc',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      <div style={imageContainerStyle}>
        <img
          src={image.url}
          alt={image.filename}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 4,
          }}
        />
      </div>

      <div style={footerStyle}>
        <span style={{ fontSize: 10, color: '#666' }}>{image.filename}</span>
        <a
          href={image.url}
          download={image.filename}
          style={{ fontSize: 10, color: '#6a6', textDecoration: 'none' }}
        >
          Download
        </a>
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: '60%',
  background: '#0d0d0d',
  borderTop: '2px solid #2a5a2e',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 50,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid #222',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
}

const imageContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  minHeight: 200,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px',
  borderTop: '1px solid #222',
}
