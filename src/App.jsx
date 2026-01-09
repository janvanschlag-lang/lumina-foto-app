import { createSignal } from 'solid-js';
import { db, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"; // uploadBytesResumable importieren
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
  const [uploadProgress, setUploadProgress] = createSignal(0); // Neuer State für den Fortschritt

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleSingleIngest = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    addLog(`START: Verarbeite ${file.name}...`, 'info');

    try {
      ExifReader.load(file).then(tags => {
        addLog("Lese EXIF Daten...", 'process');
        const cameraModel = tags['Model']?.description || "Unbekannt";
        addLog(`Kamera erkannt: ${cameraModel}`, 'success');
        
        addLog("Lade Bild in die Cloud...", 'process');
        const storageRef = ref(storage, `uploads/${file.name}`);
        
        // Wir verwenden uploadBytesResumable für den Fortschritt
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
                iso: tags['ISOSpeedRatings']?.value || 0,
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
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Lumina Pipeline Check</h2>
      </div>

      <div style={{ 
        border: '2px dashed #444', 
        padding: '40px', 
        textAlign: 'center', 
        borderRadius: '12px',
        background: '#1a1a1a',
        marginTop: '20px'
      }}>
        <input 
          type="file" 
          id="fileInput" 
          onChange={handleSingleIngest} 
          style={{ display: 'none' }} 
          accept="image/*,.nef,.dng"
          disabled={isUploading()}
        />
        <label 
          htmlFor="fileInput" 
          style={{ 
            cursor: isUploading() ? 'default' : 'pointer', 
            fontSize: '1.2rem', 
            color: isUploading() ? '#666' : '#fff',
            fontWeight: 'bold'
          }}
        >
          {isUploading() ? `Lade hoch... ${Math.round(uploadProgress())}%` : "📂 Wähle ein Test-Bild (JPG oder NEF)"}
        </label>
        {isUploading() && (
          <div style={{ marginTop: '20px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress()}%`, height: '10px', background: '#55ff55', transition: 'width 0.2s' }}></div>
          </div>
        )}
      </div>

      <LogConsole logs={logs} />
    </div>
  );
}

export default App;
