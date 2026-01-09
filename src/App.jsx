import { createSignal, Show, For } from 'solid-js';
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
  const [previewUrl, setPreviewUrl] = createSignal(null);
  const [exifData, setExifData] = createSignal(null); // State for curated EXIF data
  const [allExifTags, setAllExifTags] = createSignal(null); // State for ALL EXIF tags
  const [selectedFile, setSelectedFile] = createSignal(null);

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleSingleIngest = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    if (!file) {
      setPreviewUrl(null);
      setExifData(null);
      setAllExifTags(null);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setExifData(null);
    setAllExifTags(null);
    setIsUploading(true);
    setUploadProgress(0);
    addLog(`START: Verarbeite ${file.name}...`, 'info');

    try {
      ExifReader.load(file).then(tags => {
        setAllExifTags(tags);
        addLog("Lese EXIF Daten...", 'process');

        const getExifDesc = (tag) => (tag?.description || "N/A");
        const getValue = (tag) => (tag?.value ?? "N/A");

        const curatedExif = {
          "Identifikation & Zeit": {
            Model: getExifDesc(tags['Model']),
            DateTimeOriginal: getExifDesc(tags['DateTimeOriginal']),
          },
          "Belichtung & Optik (KI-Input)": {
            ISOSpeedRatings: getValue(tags['ISOSpeedRatings']),
            ExposureTime: getExifDesc(tags['ExposureTime']),
            FNumber: `f/${getValue(tags['FNumber'])}`,
            FocalLengthIn35mmFilm: `${getValue(tags['FocalLengthIn35mmFilm'])} mm`,
            ExposureBiasValue: getExifDesc(tags['ExposureBiasValue']),
          },
          "Bildcharakteristik & Modus": {
            ExposureProgram: getExifDesc(tags['ExposureProgram']),
            WhiteBalance: getExifDesc(tags['WhiteBalance']),
            GainControl: getExifDesc(tags['GainControl']),
            MeteringMode: getExifDesc(tags['MeteringMode']),
          },
          "Technische Bildbasis": {
            ImageWidth: getValue(tags['ImageWidth']),
            ImageLength: getValue(tags['ImageLength']),
            Orientation: getExifDesc(tags['Orientation']),
          }
        };
        setExifData(curatedExif);
        addLog(`Kamera erkannt: ${curatedExif["Identifikation & Zeit"].Model}`, 'success');

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
                uploadedAt: new Date(),
                curatedExif: curatedExif, // Store the curated data
                allExif: tags // Store all EXIF data
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

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', alignItems: 'flex-start' }}>
        <div style={{ flex: 2 }}>
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

        <Show when={previewUrl()}>
          <div style={{ flex: 1, background: '#1a1a1a', padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: '#999' }}>Vorschau & Metadaten</h4>
            <img src={previewUrl()} alt="Vorschau" style={{ maxHeight: '150px', width: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
            
            <Show when={exifData()}>
              <div style={{ marginTop: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                <For each={Object.entries(exifData())}>{
                  ([category, data]) => (
                    <div style={{ marginBottom: '15px' }}>
                      <h5 style={{ marginBottom: '8px', color: '#aaa', borderBottom: '1px solid #444', paddingBottom: '4px' }}>{category}</h5>
                      <For each={Object.entries(data)}>{([key, value]) => (
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontFamily: 'monospace', fontSize: '11px', color: '#ddd' }}>
                          <b style={{ color: '#888', paddingRight: '10px' }}>{key}:</b> 
                          <span>{String(value)}</span>
                        </p>)}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* 
            MVP Fallback: Auskommentiert, aber bereit für später
            <Show when={allExifTags() && selectedFile() && selectedFile().name.toLowerCase().endsWith('.nef')}>
                <div style={{ marginTop: '20px', maxHeight: '250px', overflowY: 'auto', background: '#000', padding: '10px', borderRadius: '5px', border: '1px solid #333' }}>
                    <h5 style={{ color: '#999', marginTop: '0', marginBottom:'10px' }}>Alle EXIF-Daten (.NEF):</h5>
                    <For each={Object.entries(allExifTags())}>{
                        ([key, value]) => (
                            <div style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: '#ccc', borderBottom: '1px solid #222', paddingBottom: '4px', marginBottom: '4px' }}>
                                <b style={{color: '#888'}}>{key}:</b> {value?.description ? value.description : JSON.stringify(value)}
                            </div>
                        )}
                    </For>
                </div>
            </Show> 
            */}
          </div>
        </Show>
      </div>

      <LogConsole logs={logs} />
    </div>
  );
}

export default App;
