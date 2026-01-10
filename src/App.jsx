import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import './App.css';

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
      
      {/* 1. LEFT SIDEBAR */}
      <div class="left-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', letterSpacing: '-0.02em' }}>Lumina Ingest</h3>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>CoreBrain v0.2.1 AI</div>
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
      <div class="center-stage">
        <div style={{ height: '40px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0 }}>
          {currentBundleName() || "WARTE AUF EINGABE"}
        </div>
        <div class="preview-stage">
          <Show when={previewUrl()} fallback={
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontSize: '12px' }}>Keine Vorschau</div>
          }>
            <img src={previewUrl()} alt="Preview" class="preview-image" />
          </Show>
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR - MIT TOP 3 AI KEYWORDS */}
      <div class="right-sidebar">
        <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>Status Monitor</div>
        
        <Show when={isProcessing() || previewUrl()}>
          <div style={{ background: '#161616', borderRadius: '4px', padding: '12px', border: '1px solid #222' }}>
            
            {/* Pipeline Status */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f4', boxShadow: '0 0 5px #4f4' }}></div>
                Active Pipeline
              </div>
              <div style={{ fontSize: '10px', color: '#999', lineHeight: '1.4' }}>
                Hybrid-Verarbeitung: EXIF (Raw) + Gemini 2.5 Flash
              </div>
            </div>

            {/* ECHTE DATEN */}
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

              {/* NEU: TOP 3 KEYWORDS */}
              <Show when={activeExif()?.ai?.keywords?.length > 0}>
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '12px' }}>
                  <div style={{ fontSize: '9px', color: '#4d8', marginBottom: '10px', textTransform:'uppercase', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'6px' }}>
                    <span>✦ Gemini Vision (Top 3)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {/* HIER: slice(0, 3) für maximal 3 Begriffe */}
                    <For each={activeExif().ai.keywords.slice(0, 3)}>{(kw) => (
                      <span style={{ 
                        fontSize: '10px', 
                        background: '#0f1f15', 
                        color: '#6f9', 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        border: '1px solid #1a3a2a',
                        whiteSpace: 'nowrap'
                      }}>
                        {kw}
                      </span>
                    )}</For>
                    
                    {/* Optional: +X more Anzeige */}
                    <Show when={activeExif().ai.keywords.length > 3}>
                       <span style={{ fontSize: '9px', color: '#555', alignSelf: 'center', marginLeft: '2px' }}>
                         +{activeExif().ai.keywords.length - 3} more
                       </span>
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