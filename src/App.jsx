import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import './App.css'; // Stellt sicher, dass unsere neuen Klassen geladen werden

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

  const addLog = (text, type = 'info') => {
    setLogs(prev => [{ text, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleBundleIngest = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    setLogs([]); 
    setPreviewUrl(null);
    setCurrentBundleName("");
    
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) {
      addLog("⚠️ Keine NEF Datei ausgewählt.", 'error');
      setIsProcessing(false);
      return;
    }

    addLog(`Batch Start: ${nefs.length} RAWs + ${jpgs.length} JPGs.`, 'info');

    for (const rawFile of nefs) {
      setCurrentBundleName(rawFile.name);
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      const previewFile = jpgs.find(j => j.name.includes(baseName));

      if (!previewFile) {
        addLog(`SKIP: ${rawFile.name} (Kein JPG Partner)`, 'error');
        continue;
      }

      setPreviewUrl(URL.createObjectURL(previewFile));
      addLog(`⚡ Verarbeite: ${rawFile.name}`, 'process');

      const success = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));

      if (success) {
        addLog(`✅ Archiviert: ${baseName}`, 'success');
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
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', letterSpacing: '-0.02em' }}>Lumina Ingest</h3>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>CoreBrain v0.2 MVP</div>
        </div>

        {/* Upload Area */}
        <div style={{ padding: '16px' }}>
          <input 
            type="file" 
            id="fileInput" 
            multiple 
            onChange={handleBundleIngest} 
            style={{ display: 'none' }} 
            accept=".nef,.dng,.jpg,.jpeg" 
            disabled={isProcessing()}
          />
          <label htmlFor="fileInput" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '120px',
            border: '1px dashed #444', 
            borderRadius: '6px', 
            cursor: isProcessing() ? 'wait' : 'pointer',
            background: isProcessing() ? '#1a1a1a' : '#161616',
            transition: 'all 0.2s',
            color: '#888'
          }}>
            <div style={{ fontSize: '20px', marginBottom: '8px', opacity: 0.7 }}>📥</div>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#ccc' }}>
              {isProcessing() ? "Pipeline läuft..." : "Bundle Importieren"}
            </div>
            <div style={{ fontSize: '9px', marginTop: '4px', opacity: 0.5 }}>NEF + JPG wählen</div>
          </label>
        </div>

        {/* Console */}
        <LogConsole logs={logs} />
      </div>

      {/* 2. CENTER STAGE */}
      <div class="center-stage">
        {/* Top Bar Info */}
        <div style={{ 
          height: '40px', 
          borderBottom: '1px solid #222', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#444', 
          fontSize: '11px',
          fontFamily: 'monospace',
          flexShrink: 0 // Verhindert, dass die Top-Bar schrumpft
        }}>
          {currentBundleName() || "WARTE AUF EINGABE"}
        </div>

        {/* Image Stage */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <Show when={previewUrl()} fallback={
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontSize: '12px' }}>
              Keine Vorschau
            </div>
          }>
            <img 
              src={previewUrl()} 
              alt="Preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain',
                display: 'block',
                borderRadius: '4px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }} 
            />
          </Show>
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR */}
      <div class="right-sidebar">
        <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>
          Status Monitor
        </div>
        
        <Show when={isProcessing() || previewUrl()}>
          <div style={{ background: '#161616', borderRadius: '4px', padding: '12px', border: '1px solid #222' }}>
            <div style={{ fontSize: '11px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f4', boxShadow: '0 0 5px #4f4' }}></div>
              Active Pipeline
            </div>
            <div style={{ fontSize: '10px', color: '#999', lineHeight: '1.4' }}>
              Simulierte Extraktion aus RAW aktiv.
            </div>
            
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #333', fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Input:</span> <span style={{color:'#888'}}>NEF (D610)</span></div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:'2px'}}><span>Proxy:</span> <span style={{color:'#888'}}>JPG (Embed)</span></div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:'2px'}}><span>Engine:</span> <span style={{color:'#888'}}>CoreBrain</span></div>
            </div>
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
