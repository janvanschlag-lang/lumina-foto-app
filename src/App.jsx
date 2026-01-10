import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import './App.css';

// --- UI KOMPONENTEN (Unverändert gut) ---

const LogConsole = (props) => {
  return (
    <div style={{ marginTop: '30px', background: '#000', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid #333' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>SYSTEM PROTOKOLL:</h4>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        <For each={props.logs()}>{(log) => (
          <div style={{ 
            marginBottom: '4px', 
            color: log.type === 'error' ? '#ff5555' : log.type === 'success' ? '#55ff55' : log.type === 'process' ? '#ffff55' : '#ccc' 
          }}>
            <span style={{ color: '#555' }}>[{log.time}]</span> {log.text}
          </div>
        )}</For>
      </div>
    </div>
  );
}

// --- MAIN APP ---

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [previewUrl, setPreviewUrl] = createSignal(null);
  const [currentBundleName, setCurrentBundleName] = createSignal("");

  // Logging Helper
  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  // Der neue Handler für Paare (NEF + JPG)
  const handleBundleIngest = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    setLogs([]); // Reset Logs
    setPreviewUrl(null);
    
    // 1. Dateien sortieren
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) {
      addLog("⚠️ Keine NEF Datei ausgewählt. Bitte wähle RAW + JPG.", 'error');
      setIsProcessing(false);
      return;
    }

    addLog(`Batch Start: ${nefs.length} RAWs und ${jpgs.length} JPGs gefunden.`, 'info');

    // 2. Schleife durch alle RAWs
    for (const rawFile of nefs) {
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      setCurrentBundleName(rawFile.name);
      
      // Suche passendes JPG (Simulierte Extraktion: Dateiname muss ähnlich sein)
      // Wir suchen nach [Name].jpg oder [Name]_Test.jpg
      const previewFile = jpgs.find(j => j.name.includes(baseName));

      if (!previewFile) {
        addLog(`❌ SKIP: Kein Vorschaubild für ${rawFile.name} gefunden.`, 'error');
        continue;
      }

      // Zeige das lokale JPG sofort an (User Feedback)
      const localUrl = URL.createObjectURL(previewFile);
      setPreviewUrl(localUrl);

      addLog(`⚡ Verarbeite Bundle: ${rawFile.name} + ${previewFile.name}`, 'process');

      // 3. Aufruf der CoreBrain Engine
      // Wir übergeben "addLog" als Callback, damit CoreBrain direkt hier reinschreiben kann
      const success = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));

      if (success) {
        addLog(`✅ Bundle ${baseName} erfolgreich archiviert & analysiert.`, 'success');
      } else {
        addLog(`❌ Fehler bei ${baseName}.`, 'error');
      }
    }

    setIsProcessing(false);
    addLog("--- Batch Vorgang beendet ---", 'info');
  };

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{margin: 0}}>Lumina CoreBrain Ingest</h2>
        <span style={{ fontSize: '12px', background: '#333', padding: '4px 8px', borderRadius: '4px', color: '#888' }}>v0.2 MVP</span>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
        
        {/* Linke Spalte: Upload Area */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            border: '2px dashed #444', 
            padding: '40px', 
            textAlign: 'center', 
            borderRadius: '12px', 
            background: '#1a1a1a',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            <input 
              type="file" 
              id="fileInput" 
              multiple // WICHTIG für Bundle Upload
              onChange={handleBundleIngest} 
              style={{ display: 'none' }} 
              accept=".nef,.dng,.jpg,.jpeg" 
              disabled={isProcessing()}
            />
            
            <label htmlFor="fileInput" style={{ 
              cursor: isProcessing() ? 'default' : 'pointer', 
              display: 'block' 
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📥</div>
              <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
                {isProcessing() ? "Verarbeite..." : "Bundle Auswählen"}
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#888' }}>
                Bitte <b>.NEF</b> und <b>.JPG</b> gleichzeitig wählen.
              </div>
            </label>
          </div>
        </div>

        {/* Rechte Spalte: Live Preview des aktuellen Bildes */}
        <Show when={previewUrl()}>
          <div style={{ flex: 1, background: '#1a1a1a', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#999', fontSize: '12px', textTransform: 'uppercase' }}>
              Aktuelle Verarbeitung
            </h4>
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
              <img src={previewUrl()} alt="Vorschau" style={{ width: '100%', display: 'block' }} />
              <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, 
                background: 'rgba(0,0,0,0.7)', color: 'white', 
                padding: '8px', fontSize: '10px', fontFamily: 'monospace' 
              }}>
                {currentBundleName()}
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#666' }}>
              Simulierte Extraktion aus RAW aktiv.
            </div>
          </div>
        </Show>
      </div>

      <LogConsole logs={logs} />
    </div>
  );
}

export default App;