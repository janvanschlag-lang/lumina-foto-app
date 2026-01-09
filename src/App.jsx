import { createSignal, onMount } from 'solid-js';
import { auth, db, storage } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import ExifReader from 'exifreader';
import './App.css';

function App() {
  const [user, setUser] = createSignal(null);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  // Logs für die visuelle Kontrolle
  const [logs, setLogs] = createSignal([]);
  const [isUploading, setIsUploading] = createSignal(false);

  // Funktion um Nachrichten in die Konsole auf dem Bildschirm zu schreiben
  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  onMount(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if(u) addLog(`Verbunden als ${u.email}`, 'success');
    });
  });

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email(), password());
    } catch (e) {
      addLog("Login Fehler: " + e.message, 'error');
    }
  };

  // --- HIER PASSIERT DIE MAGIE ---
  const handleSingleIngest = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    addLog(`START: Verarbeite ${file.name}...`, 'info');

    try {
      // 1. EXIF DATEN LESEN (Lokal im Browser)
      addLog("Lese EXIF Daten...", 'process');
      const tags = await ExifReader.load(file);
      const cameraModel = tags['Model']?.description || "Unbekannt";
      addLog(`Kamera erkannt: ${cameraModel}`, 'success');

      // 2. UPLOAD IN STORAGE (Cloud Festplatte)
      addLog("Lade Bild in die Cloud...", 'process');
      // Speicherpfad: users/USER_ID/DATEINAME
      const storageRef = ref(storage, `users/${user().uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      addLog("Upload fertig. URL generiert.", 'success');

      // 3. DATENBANK EINTRAG (Firestore)
      addLog("Schreibe in Datenbank...", 'process');
      await addDoc(collection(db, "assets"), {
        userId: user().uid,
        filename: file.name,
        url: url,
        camera: cameraModel,
        iso: tags['ISOSpeedRatings']?.value || 0,
        uploadedAt: new Date()
      });
      addLog("✅ ERFOLG! Asset in Firestore gespeichert.", 'success');

    } catch (error) {
      console.error(error);
      addLog("FEHLER: " + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // --- UI ---
  if (!user()) {
    return (
      <div className="container">
        <h1>Lumina Ingest Test</h1>
        <input type="email" placeholder="Email" onInput={(e)=>setEmail(e.target.value)}/>
        <input type="password" placeholder="Passwort" onInput={(e)=>setPassword(e.target.value)}/>
        <button onClick={handleLogin}>Login</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Lumina Pipeline Check</h2>
        <button onClick={() => signOut(auth)} style={{ background: '#333' }}>Logout</button>
      </div>

      {/* DER UPLOAD BUTTON */}
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
          accept="image/*,.nef,.dng" // Akzeptiert auch deine RAWs
          disabled={isUploading()}
        />
        <label 
          htmlFor="fileInput" 
          style={{ 
            cursor: 'pointer', 
            fontSize: '1.2rem', 
            color: isUploading() ? '#666' : '#fff',
            fontWeight: 'bold'
          }}
        >
          {isUploading() ? "Verarbeite..." : "📂 Wähle ein Test-Bild (JPG oder NEF)"}
        </label>
      </div>

      {/* DIE LOG KONSOLE */}
      <div style={{ marginTop: '30px', background: '#000', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>SYSTEM PROTOKOLL:</h4>
        {logs().map((log, i) => (
          <div key={i} style={{ 
            marginBottom: '4px', 
            color: log.type === 'error' ? '#ff5555' : log.type === 'success' ? '#55ff55' : log.type === 'process' ? '#ffff55' : '#ccc' 
          }}>
            <span style={{ color: '#555' }}>[{log.time}]</span> {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;