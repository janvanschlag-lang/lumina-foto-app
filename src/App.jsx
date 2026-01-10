import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import Gallery from './components/Gallery'; // Korrekter Import aus Unterordner
import './App.css';

// --- STYLES (Scrollbar) ---
const styles = `
  .vision-scroll::-webkit-scrollbar { width: 8px !important; display: block !important; }
  .vision-scroll::-webkit-scrollbar-track { background: #080808 !important; }
  .vision-scroll::-webkit-scrollbar-thumb { background: #333 !important; border-radius: 4px !important; border: 1px solid #080808 !important; }
  .vision-scroll { scrollbar-width: thin; scrollbar-color: #333 #080808; }
`;

const renderStars = (rating) => "★".repeat(rating || 0) + "☆".repeat(5 - (rating || 0));

// --- UI COMPONENTS ---
const LogConsole = (props) => (
  <div style={{ flex: 1, overflowY: 'auto', background: '#0a0a0a', padding: '10px', fontFamily: 'monospace', fontSize: '10px', borderTop: '1px solid #222' }}>
    <div style={{ color: '#555', marginBottom: '8px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Protokoll</div>
    <For each={props.logs()}>{(log) => (
      <div style={{ marginBottom: '3px', borderLeft: `2px solid ${log.type === 'error' ? '#f44' : log.type === 'success' ? '#4f4' : '#ff4'}`, paddingLeft: '6px', color: '#ccc', lineHeight: '1.4' }}>
        <span style={{ color: '#444', marginRight: '4px' }}>{log.time.split(' ')[0]}</span>
        <span style={{ color: log.type === 'error' ? '#f88' : log.type === 'success' ? '#afa' : log.type === 'process' ? '#fe9' : '#bbb' }}>{log.text}</span>
      </div>
    )}</For>
  </div>
);

// --- MAIN APP ---
function App() {
  const [logs, setLogs] = createSignal([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  
  // State für ausgewähltes Asset
  const [activeAsset, setActiveAsset] = createSignal(null); 

  const addLog = (text, type = 'info') => {
    setLogs(prev => [{ text, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  // Upload Handler
  const handleBundleIngest = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    setLogs([]); 
    setActiveAsset(null); // Reset Selection
    
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) {
      addLog("⚠️ Keine NEF Datei.", 'error'); setIsProcessing(false); return;
    }

    addLog(`Batch: ${nefs.length} RAWs.`, 'info');

    for (const rawFile of nefs) {
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      const previewFile = jpgs.find(j => j.name.includes(baseName));

      if (!previewFile) { addLog(`SKIP: ${rawFile.name} (Kein JPG)`, 'error'); continue; }

      // Temporäres Asset für Vorschau
      const tempPreviewUrl = URL.createObjectURL(previewFile);
      setActiveAsset({ 
          filename: rawFile.name,
          urls: { preview: tempPreviewUrl }, 
          ai: null 
      });
      
      addLog(`⚡ Verarbeite: ${rawFile.name}`, 'process');
      const result = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));

      if (result.success) {
        addLog(`✅ Archiviert: ${baseName}`, 'success');
        setActiveAsset({
            ...result.data, 
            urls: { preview: tempPreviewUrl }
        });
      } else {
        addLog(`❌ Fehler: ${baseName}`, 'error');
      }
    }
    setIsProcessing(false);
    addLog("--- Fertig ---", 'info');
  };

  // Handler: Wenn man in der Galerie ein Bild klickt
  const handleGallerySelect = (asset) => {
    // ADAPTER: Wir formen die Datenbank-Struktur in das UI-Format um
    setActiveAsset({
      filename: asset.filename,
      urls: asset.urls,
      ai: asset.aiAnalysis, // DB: aiAnalysis -> UI: ai
      exif: {
        model: asset.meta.camera, // DB: camera -> UI: model
        lens: asset.meta.lens,
        iso: asset.meta.iso,
        aperture: asset.meta.aperture,
        shutter: asset.meta.shutter
      }
    });
  };

  return (
    <div class="app-grid-container">
      <style>{styles}</style>
      
      {/* 1. LEFT SIDEBAR */}
      <div class="left-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', letterSpacing: '-0.02em' }}>Lumina Ingest</h3>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>CoreBrain v0.7 Gallery</div>
        </div>

        <div style={{ padding: '16px' }}>
          <input type="file" id="fileInput" multiple onChange={handleBundleIngest} style={{ display: 'none' }} accept=".nef,.dng,.jpg,.jpeg" disabled={isProcessing()}/>
          <label htmlFor="fileInput" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', border: '1px dashed #444', borderRadius: '6px', cursor: isProcessing() ? 'wait' : 'pointer', background: isProcessing() ? '#1a1a1a' : '#161616', transition: 'all 0.2s', color: '#888' }}>
            <div style={{ fontSize: '18px', marginBottom: '6px', opacity: 0.7 }}>📥</div>
            <div style={{ fontSize: '11px', fontWeight: '500', color: '#ccc' }}>Import Bundle</div>
          </label>
        </div>

        <LogConsole logs={logs} />
      </div>

      {/* 2. CENTER STAGE */}
      <div class="center-stage" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0e0e0e', position: 'relative' }}>
        
        {/* VIEW A: GALLERY */}
        <Show when={!activeAsset()}>
           <Gallery onSelect={handleGallerySelect} selectedId={null} />
        </Show>

        {/* VIEW B: ACTIVE ASSET PREVIEW */}
        <Show when={activeAsset()}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Toolbar */}
            <div style={{ height: '30px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding:'0 10px', background: '#111', flexShrink: 0 }}>
               <button onClick={() => setActiveAsset(null)} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'11px' }}>
                 ← Back to Library
               </button>
               <div style={{ color: '#555', fontSize: '10px', fontFamily: 'monospace' }}>{activeAsset().filename}</div>
               <div style={{ width:'20px' }}></div>
            </div>

            {/* Bild */}
            <div style={{ flex: '1', minHeight: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
              <img src={activeAsset().urls.preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 5px 20px rgba(0,0,0,0.6)' }} />
            </div>

            {/* Gemini Readout */}
            <Show when={activeAsset().ai?.analysis}>
              <div class="vision-scroll" style={{ height: '250px', flexShrink: 0, borderTop: '1px solid #222', background: '#080808', padding: '12px', overflowY: 'auto', fontFamily: 'monospace' }}>
                 
                 {/* Verdict Header */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                       <Show when={activeAsset().ai.flag === 'pick'}>
                         <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#eee', color:'#000', padding:'2px 8px 2px 4px', borderRadius:'12px', fontSize:'10px', fontWeight:'bold' }}>
                            <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px' }}>✓</div> PICK
                         </div>
                       </Show>
                       <Show when={activeAsset().ai.flag === 'reject'}>
                         <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#333', color:'#fff', padding:'2px 8px 2px 4px', borderRadius:'12px', fontSize:'10px', fontWeight:'bold', border:'1px solid #555' }}>
                            <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#fff', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px' }}>✕</div> REJECT
                         </div>
                       </Show>
                       <Show when={activeAsset().ai.flag === 'review'}>
                         <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#222', color:'#ccc', padding:'2px 8px 2px 4px', borderRadius:'12px', fontSize:'10px', fontWeight:'bold', border:'1px solid #444' }}>
                           <div style={{ width:'12px', height:'12px', borderRadius:'50%', border:'1px solid #ccc' }}></div> REVIEW
                         </div>
                       </Show>
                       <span style={{ fontSize: '11px', color: '#666', borderLeft:'1px solid #333', paddingLeft:'8px' }}>{activeAsset().ai.score} / 10</span>
                    </div>
                    <div>{renderStars(activeAsset().ai.rating)}</div>
                 </div>

                 {/* Text Details */}
                 <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', fontSize: '10px', lineHeight: '1.5', color:'#ccc' }}>
                    <div style={{ color:'#555' }}>SUBJECT</div><div>{activeAsset().ai.analysis.subject}</div>
                    <div style={{ color:'#555' }}>LIGHT</div><div>{activeAsset().ai.analysis.lighting}</div>
                    <Show when={activeAsset().ai.color_analysis?.cast_detected}>
                        <div style={{ color: '#c80' }}>COLOR FIX</div>
                        <div style={{ color: '#da6' }}>
                           Detected {activeAsset().ai.color_analysis.cast_color}. {activeAsset().ai.color_analysis.correction_hint}
                        </div>
                    </Show>
                    <div style={{ color:'#555' }}>TECH</div><div>{activeAsset().ai.analysis.technical}</div>
                 </div>
              </div>
            </Show>
          </div>
        </Show>

      </div>

      {/* 3. RIGHT SIDEBAR */}
      <div class="right-sidebar">
        <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>Status Monitor</div>
        <Show when={activeAsset() && activeAsset().exif} fallback={
           <div style={{ fontSize: '11px', color: '#444', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>Select an image from Library</div>
        }>
          <div style={{ background: '#161616', borderRadius: '4px', padding: '12px', border: '1px solid #222' }}>
             <div style={{ marginBottom: '16px' }}>
               <div style={{ fontSize: '9px', color: '#666', marginBottom: '8px', textTransform:'uppercase', fontWeight: 'bold' }}>RAW Metadaten</div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 4px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#555' }}>Camera</div>
                    <div style={{ fontSize: '11px', color: '#e5e5e5' }}>{activeAsset().exif.model}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#555' }}>Lens</div>
                    <div style={{ fontSize: '11px', color: '#ccc' }}>{activeAsset().exif.lens}</div>
                  </div>
                  <div><div style={{ fontSize:'9px', color:'#555' }}>ISO</div><div style={{ fontSize:'11px', color:'#ccc' }}>{activeAsset().exif.iso}</div></div>
                  <div><div style={{ fontSize:'9px', color:'#555' }}>Aperture</div><div style={{ fontSize:'11px', color:'#ccc' }}>{activeAsset().exif.aperture}</div></div>
                  <div><div style={{ fontSize:'9px', color:'#555' }}>Shutter</div><div style={{ fontSize:'11px', color:'#ccc' }}>{activeAsset().exif.shutter}</div></div>
               </div>
             </div>
             <Show when={activeAsset().ai?.keywords}>
                <div style={{ borderTop: '1px solid #333', paddingTop: '12px' }}>
                   <div style={{ fontSize: '9px', color: '#4d8', marginBottom: '8px' }}>✦ GEMINI TAGS</div>
                   <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                      <For each={activeAsset().ai.keywords.slice(0,5)}>{kw => (
                        <span style={{ fontSize:'10px', background:'#111', color:'#6f9', padding:'2px 6px', borderRadius:'4px', border:'1px solid #1a3a2a' }}>{kw}</span>
                      )}</For>
                   </div>
                </div>
             </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default App;