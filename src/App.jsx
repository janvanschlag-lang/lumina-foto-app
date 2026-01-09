import { createSignal, Show } from 'solid-js';
import { db, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import ExifReader from 'exifreader';
import './App.css';

const LogConsole = (props) => {
  return (
    <div style={{ marginTop: '30px', background: '#000', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>SYSTEM PROTOKOLL:</h4>
      {props.logs().map((log, i) => (
        <div key={i} style={{ 
          marginBottom: '4px', 
          color: log.type === 'error' ? '#ff5555' : log.type === 'success' ? '#55ff55' : log.type === 'process' ? '#ffff55' : '#ccc' 
        }}>
          <span style={{ color: '#555' }}>[{log.time}]</span> {log.text}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [previewUrl, setPreviewUrl] = createSignal(null); // State für die Vorschau-URL
  const [exifData, setExifData] = createSignal(null); // State für die EXIF-Daten

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleSingleIngest = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setPreviewUrl(null);
      setExifData(null);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file)); // Lokale URL für die Vorschau erstellen
    setExifData(null); // Alte EXIF-Daten zurücksetzen
    setIsUploading(true);
    setUploadProgress(0);
    addLog(`START: Verarbeite ${file.name}...`, 'info');

    try {
      ExifReader.load(file).then(tags => {
        addLog("Lese EXIF Daten...", 'process');
        const cameraModel = tags['Model']?.description || "Unbekannt";
        const iso = tags['ISOSpeedRatings']?.value || "Unbekannt";
        setExifData({ camera: cameraModel, iso: iso }); // EXIF-Daten im State speichern

        addLog(`Kamera erkannt: ${cameraModel}`, 'success');
        
        addLog("Lade Bild in die Cloud...", 'process');
        const storageRef = ref(storage, `uploads/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload-Fehler:", error);
            addLog("UPLOAD FEHLER: " + error.message, 'error');
            setIsUploading(false);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then(async (url) => {
              addLog("Upload fertig. URL generiert.", 'success');
              addLog("Schreibe in Datenbank...", 'process');
              await addDoc(collection(db, "assets"), {
                filename: file.name,
                url: url,
                camera: cameraModel,
                iso: iso,
                uploadedAt: new Date()
              });
              addLog("✅ ERFOLG! Asset in Firestore gespeichert.", 'success');
              setIsUploading(false);
            });
          }
        );
      });
    } catch (error) {
      console.error(error);
      addLog("FEHLER: " + error.message, 'error');
      setIsUploading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Lumina Pipeline Check</h2>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {/* Linke Seite: Uploader */}
        <div style={{ flex: 1 }}>
          <div style={{ border: '2px dashed #444', padding: '40px', textAlign: 'center', borderRadius: '12px', background: '#1a1a1a' }}>
            <input type="file" id="fileInput" onChange={handleSingleIngest} style={{ display: 'none' }} accept="image/*,.nef,.dng" disabled={isUploading()}/>
            <label htmlFor="fileInput" style={{ cursor: isUploading() ? 'default' : 'pointer', fontSize: '1.2rem', color: isUploading() ? '#666' : '#fff', fontWeight: 'bold' }}>
              {isUploading() ? `Lade hoch... ${Math.round(uploadProgress())}%` : "📂 Wähle ein Test-Bild (JPG oder NEF)"}
            </label>
            {isUploading() && (
              <div style={{ marginTop: '20px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress()}%`, height: '10px', background: '#55ff55', transition: 'width 0.2s' }}></div>
              </div>
            )}
          </div>
        </div>

        {/* Rechte Seite: Vorschau & EXIF */}
        <Show when={previewUrl()}>
          <div style={{ flex: 1, background: '#1a1a1a', padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: '#999' }}>Vorschau</h4>
            <img src={previewUrl()} alt="Vorschau" style={{ maxWidth: '100%', borderRadius: '8px' }} />
            <Show when={exifData()}>
              <div style={{ marginTop: '15px' }}>
                <h5 style={{ marginBottom: '10px', color: '#999' }}>Gelesene EXIF Daten:</h5>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#ddd' }}><b>Kamera:</b> {exifData().camera}</p>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#ddd' }}><b>ISO:</b> {exifData().iso}</p>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      <LogConsole logs={logs} />
    </div>
  );
}

export default App;
