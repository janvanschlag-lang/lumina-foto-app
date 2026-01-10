import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import './App.css';

// --- STYLES ---
const styles = `
  .vision-scroll::-webkit-scrollbar {
    width: 8px !important;
    display: block !important;
  }
  .vision-scroll::-webkit-scrollbar-track {
    background: #080808 !important; 
  }
  .vision-scroll::-webkit-scrollbar-thumb {
    background: #333 !important; 
    border-radius: 4px !important;
    border: 1px solid #080808 !important;
  }
  .vision-scroll::-webkit-scrollbar-thumb:hover {
    background: #555 !important; 
  }
  .vision-scroll {
    scrollbar-width: thin;
    scrollbar-color: #333 #080808;
  }
`;

// --- HELPER ---
const renderStars = (rating) => {
  const r = rating || 0;
  return "★".repeat(r) + "☆".repeat(5 - r);
};

// --- UI COMPONENTS ---

const LogConsole = (props) => {
  return (
    <div style={{ 
      flex: 1, 
      overflowY: 'auto', 
      background: '#0a0a0a', 
      padding: '10px', 
      fontFamily: 'monospace', 
      fontSize: '10px', 
      borderTop: '1px solid #222'
    }}>
      <div style={{ color: '#555', marginBottom: '8px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Protokoll</div>
      <For each={props.logs()}>{(log) => (
        <div style={{ 
          marginBottom: '3px', 
          borderLeft: `2px solid ${log.type === 'error' ? '#f44' : log.type === 'success' ? '#4f4' : '#ff4'}`,
          paddingLeft: '6px',
          color: '#ccc',
          lineHeight: '1.4'
        }}>
          <span style={{ color: '#444', marginRight: '4px' }}>{log.time.split(' ')[0]}</span>
          <span style={{ color: log.type === 'error' ? '#f88' : log.type === 'success' ? '#afa' : log.type === 'process' ? '#fe9' : '#bbb' }}>
            {log.text}
          </span>
        </div>
      )}</For>
    </div>
  );
}

// --- MAIN APP ---

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [previewUrl, setPreviewUrl] = createSignal(null);
  const [currentBundleName, setCurrentBundleName] = createSignal("");
  const [activeExif, setActiveExif] = createSignal(null);

  const addLog = (text, type = 'info') => {
    setLogs(prev => [{ text, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleBundleIngest = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    setLogs([]); 
    setPreviewUrl(null);
    setActiveExif(null);
    setCurrentBundleName("");
    
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) {
      addLog("⚠️ Keine NEF Datei ausgewählt.", 'error');
      setIsProcessing(false);
      return;
    }

    addLog(`Batch: ${nefs.length} RAWs + ${jpgs.length} JPGs.`, 'info');

    for (const rawFile of nefs) {
      setCurrentBundleName(rawFile.name);
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      const previewFile = jpgs.find(j => j.name.includes(baseName));

      if (!previewFile) {
        addLog(`SKIP: ${rawFile.name} (Kein JPG)`, 'error');
        continue;
      }

      setPreviewUrl(URL.createObjectURL(previewFile));
      addLog(`⚡ Verarbeite: ${rawFile.name}`, 'process');

      const result = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));

      if (result.success) {
        addLog(`✅ Archiviert: ${baseName}`, 'success');
        setActiveExif(result.data); 
      } else {
        addLog(`❌ Fehler: ${baseName}`, 'error');
      }
    }
    setIsProcessing(false);
    addLog("--- Fertig ---", 'info');
  };

  return (
    <div class="app-grid-container">
      <style>{styles}</style>
      
      {/* 1. LEFT SIDEBAR */}
      <div class="left-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', letterSpacing: '-0.02em' }}>Lumina Ingest</h3>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>CoreBrain v0.7 Verdict</div>
        </div>

        <div style={{ padding: '16px' }}>
          <input type="file" id="fileInput" multiple onChange={handleBundleIngest} style={{ display: 'none' }} accept=".nef,.dng,.jpg,.jpeg" disabled={isProcessing()}/>
          <label htmlFor="fileInput" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', border: '1px dashed #444', borderRadius: '6px', cursor: isProcessing() ? 'wait' : 'pointer', background: isProcessing() ? '#1a1a1a' : '#161616', transition: 'all 0.2s', color: '#888' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px', opacity: 0.7 }}>📥</div>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#ccc' }}>{isProcessing() ? "Pipeline läuft..." : "Bundle Importieren"}</div>
            <div style={{ fontSize: '9px', marginTop: '4px', opacity: 0.5 }}>NEF + JPG wählen</div>
          </label>
        </div>

        <LogConsole logs={logs} />
      </div>

      {/* 2. CENTER STAGE */}
      <div class="center-stage" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0e0e0e' }}>
        
        <div style={{ height: '30px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '10px', fontFamily: 'monospace', flexShrink: 0, background: '#111' }}>
          {currentBundleName() || "IDLE"}
        </div>

        <Show when={previewUrl()} fallback={
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '11px' }}>Waiting for Input...</div>
        }>
          
          <div style={{ 
            flex: '1',            
            minHeight: '0',       
            width: '100%',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '20px', 
            boxSizing: 'border-box',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <img src={previewUrl()} alt="Preview" style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain', 
              boxShadow: '0 5px 20px rgba(0,0,0,0.6)' 
            }} />
          </div>

          {/* AI READOUT (NEW CHIP UI) */}
          <div class="vision-scroll" style={{ 
            height: '250px',        
            flexShrink: 0,          
            width: '100%',
            borderTop: '1px solid #222', 
            background: '#080808', 
            padding: '12px',
            boxSizing: 'border-box',
            overflowY: 'auto',      
            fontFamily: 'monospace'
          }}>
            <Show when={activeExif()?.ai?.analysis} fallback={
              <div style={{ color: '#333', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent:'center', height:'100%', gap: '8px' }}>
                <span class="blink">/// ANALYZING SIGNAL...</span>
              </div>
            }>
              
              {/* THE VERDICT HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                 
                 {/* LEFT: FLAG CHIPS (Monochrome) */}
                 <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    
                    {/* PICK CHIP */}
                    <Show when={activeExif()?.ai?.flag === 'pick'}>
                       <div style={{ 
                         display:'flex', alignItems:'center', gap:'6px', 
                         background:'#eee', color:'#000', 
                         padding:'2px 8px 2px 4px', borderRadius:'12px', 
                         fontSize:'10px', fontWeight:'bold' 
                       }}>
                         <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px' }}>✓</div>
                         PICK
                       </div>
                    </Show>

                    {/* REJECT CHIP */}
                    <Show when={activeExif()?.ai?.flag === 'reject'}>
                       <div style={{ 
                         display:'flex', alignItems:'center', gap:'6px', 
                         background:'#333', color:'#fff', 
                         padding:'2px 8px 2px 4px', borderRadius:'12px', 
                         fontSize:'10px', fontWeight:'bold', border:'1px solid #555' 
                       }}>
                         <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#fff', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px' }}>✕</div>
                         REJECT
                       </div>
                    </Show>

                    {/* REVIEW CHIP */}
                    <Show when={activeExif()?.ai?.flag === 'review'}>
                       <div style={{ 
                         display:'flex', alignItems:'center', gap:'6px', 
                         background:'#222', color:'#ccc', 
                         padding:'2px 8px 2px 4px', borderRadius:'12px', 
                         fontSize:'10px', fontWeight:'bold', border:'1px solid #444' 
                       }}>
                         <div style={{ width:'12px', height:'12px', borderRadius:'50%', border:'1px solid #ccc' }}></div>
                         REVIEW
                       </div>
                    </Show>

                    {/* SCORE NUMERIC */}
                    <div style={{ fontSize: '11px', color: '#666', borderLeft:'1px solid #333', paddingLeft:'8px' }}>
                       {activeExif()?.ai?.score} / 10
                    </div>
                 </div>

                 {/* RIGHT: STARS & WARNINGS */}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    
                    <Show when={activeExif()?.ai?.color_analysis?.cast_detected}>
                       <span style={{ fontSize: '9px', background: '#320', color: '#fb4', padding: '2px 4px', borderRadius:'2px', border:'1px solid #530' }}>
                         COLOR
                       </span>
                    </Show>
                    <Show when={activeExif()?.ai?.technical?.noise_score < 5}>
                       <span style={{ fontSize: '9px', background: '#023', color: '#aaf', padding: '2px 4px', borderRadius:'2px', border:'1px solid #035' }}>
                         NOISE
                       </span>
                    </Show>

                    <div style={{ color: '#ffd700', fontSize: '14px', letterSpacing: '1px' }}>
                      {renderStars(activeExif()?.ai?.rating)}
                    </div>
                 </div>
              </div>
              
              {/* DETAILS */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', fontSize: '10px', lineHeight: '1.5', paddingRight: '4px' }}>
                <div style={{ color: '#555' }}>SUBJECT</div>
                <div style={{ color: '#ccc' }}>{activeExif().ai.analysis.subject || '-'}</div>
                
                <div style={{ color: '#555' }}>LIGHT</div>
                <div style={{ color: '#999' }}>{activeExif().ai.analysis.lighting || '-'}</div>
                
                <Show when={activeExif()?.ai?.color_analysis?.cast_detected}>
                    <div style={{ color: '#c80' }}>COLOR FIX</div>
                    <div style={{ color: '#da6' }}>
                       Detected {activeExif().ai.color_analysis.cast_color} Cast (Conf: {activeExif().ai.color_analysis.confidence}). 
                       Suggestion: {activeExif().ai.color_analysis.correction_hint}
                    </div>
                </Show>

                <div style={{ color: '#555' }}>COMP</div>
                <div style={{ color: '#999' }}>{activeExif().ai.analysis.composition || '-'}</div>
                
                <div style={{ color: '#555' }}>TECH</div>
                <div style={{ color: '#999' }}>{activeExif().ai.analysis.technical || '-'}</div>
              </div>
            </Show>
          </div>

        </Show>
      </div>

      {/* 3. RIGHT SIDEBAR */}
      <div class="right-sidebar">
        {/* RECHTE LEISTE BLEIBT WIE SIE WAR */}
        <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>Status Monitor</div>
        <Show when={isProcessing() || previewUrl()}>
          <div style={{ background: '#161616', borderRadius: '4px', padding: '12px', border: '1px solid #222' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f4', boxShadow: '0 0 5px #4f4' }}></div>
                Active Pipeline
              </div>
              <div style={{ fontSize: '10px', color: '#999', lineHeight: '1.4' }}>
                Hybrid-Verarbeitung
              </div>
            </div>

            <Show when={activeExif()}>
              <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '12px' }}>
                <div style={{ fontSize: '9px', color: '#666', marginBottom: '8px', textTransform:'uppercase', fontWeight: 'bold' }}>RAW Metadaten</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 4px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#555' }}>Camera</div>
                    <div style={{ fontSize: '11px', color: '#e5e5e5', fontWeight:'500' }}>{activeExif().model}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2', marginBottom: '4px' }}>
                    <div style={{ fontSize: '9px', color: '#555' }}>Lens</div>
                    <div style={{ fontSize: '11px', color: '#ccc' }}>{activeExif().lens}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: '#555' }}>ISO</div>
                    <div style={{ fontSize: '11px', color: '#ccc', fontFamily: 'monospace' }}>{activeExif().iso}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: '#555' }}>Aperture</div>
                    <div style={{ fontSize: '11px', color: '#ccc', fontFamily: 'monospace' }}>{activeExif().aperture}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#555' }}>Shutter</div>
                    <div style={{ fontSize: '11px', color: '#ccc', fontFamily: 'monospace' }}>{activeExif().shutter}</div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <Show when={activeExif()?.ai?.keywords?.length > 0}>
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '12px' }}>
                  <div style={{ fontSize: '9px', color: '#4d8', marginBottom: '10px', textTransform:'uppercase', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'6px' }}>
                    <span>✦ Gemini Tags</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <For each={activeExif().ai.keywords.slice(0, 3)}>{(kw) => (
                      <div style={{ 
                        fontSize: '10px', 
                        background: '#111', 
                        color: '#6f9', 
                        padding: '4px 8px', 
                        borderRadius: '2px',
                        borderLeft: '2px solid #2f5f3f',
                        width: '100%',
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {kw}
                      </div>
                    )}</For>
                    <Show when={activeExif().ai.keywords.length > 3}>
                       <div style={{ fontSize: '9px', color: '#555', paddingLeft: '4px', marginTop: '4px' }}>
                         + {activeExif().ai.keywords.length - 3} more tags...
                       </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </Show>
        <Show when={!isProcessing() && !previewUrl()}>
          <div style={{ fontSize: '11px', color: '#444', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            System bereit.
          </div>
        </Show>
      </div>

    </div>
  );
}

export default App;