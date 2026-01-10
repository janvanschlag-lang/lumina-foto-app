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

const createXmpString = (curatedExif) => {
  const flatExif = Object.values(curatedExif).reduce((acc, val) => ({ ...acc, ...val }), {});

  let exifItems = '';
  for (const [key, value] of Object.entries(flatExif)) {
    // Ensure value is a string and handle potential floating point issues
    const cleanValue = String(value).replace(',', '.');
    if (cleanValue !== 'N/A') {
      exifItems += `   <exif:${key}>${cleanValue}</exif:${key}>\n`;
    }
  }

  return `
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c111 79.158366, 2015/09/25-01:12:00        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:exif="http://ns.adobe.com/exif/1.0/">
${exifItems}  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
  `.trim();
};

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [previewUrl, setPreviewUrl] = createSignal(null);
  const [exifData, setExifData] = createSignal(null);
  const [selectedFile, setSelectedFile] = createSignal(null);

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
  };

  // NEU: Helper zur Formatierung der Anzeige
  const formatExifForDisplay = (key, value) => {
    if (value === 'N/A') return value;
    switch (key) {
      case 'FNumber':
        return `f/${value}`;
      case 'FocalLengthIn35mmFilm':
        return `${value} mm`;
      default:
        return String(value);
    }
  };

  const handleSingleIngest = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    if (!file) {
      setPreviewUrl(null);
      setExifData(null);
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setExifData(null);
    setIsUploading(true);
    setUploadProgress(0);
    addLog(`START: Verarbeite ${file.name}...`, 'info');

    try {
      ExifReader.load(file).then(tags => {
        addLog("Lese EXIF Daten...", 'process');

        const getExifDesc = (tag) => (tag?.description || "N/A");
        const getValue = (tag) => (tag?.value ?? "N/A");

        // KORRIGIERT: Daten werden jetzt "roh" gespeichert
        const curatedExif = {
          "Identifikation & Zeit": {
            Model: getExifDesc(tags['Model']),
            DateTimeOriginal: getExifDesc(tags['DateTimeOriginal']),
          },
          "Belichtung & Optik (KI-Input)": {
            ISOSpeedRatings: getValue(tags['ISOSpeedRatings']),
            ExposureTime: getExifDesc(tags['ExposureTime']),
            FNumber: getValue(tags['FNumber']), // Nur die Zahl, kein "f/"
            FocalLengthIn35mmFilm: getValue(tags['FocalLengthIn35mmFilm']), // Nur die Zahl, kein "mm"
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

        addLog("Generiere XMP Sidecar-Datei...", 'process');
        const xmpString = createXmpString(curatedExif);
        const xmpBlob = new Blob([xmpString], { type: 'application/rdf+xml' });
        const xmpFileName = `${file.name}.xmp`;

        addLog("Lade Bild in die Cloud...", 'process');
        const imageStorageRef = ref(storage, `uploads/${file.name}`);
        const imageUploadTask = uploadBytesResumable(imageStorageRef, file);

        imageUploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload-Fehler (Bild):", error);
            addLog(`UPLOAD FEHLER (Bild): ${error.message}`, 'error');
            setIsUploading(false);
          },
          () => {
            getDownloadURL(imageUploadTask.snapshot.ref).then(async (imageUrl) => {
              addLog("Bild-Upload fertig. URL generiert.", 'success');
              
              addLog("Lade XMP in die Cloud...", 'process');
              const xmpStorageRef = ref(storage, `uploads/${xmpFileName}`);
              const xmpUploadTask = uploadBytesResumable(xmpStorageRef, xmpBlob);

              xmpUploadTask.on('state_changed', null, 
                (error) => {
                  console.error("Upload-Fehler (XMP):", error);
                  addLog(`UPLOAD FEHLER (XMP): ${error.message}`, 'error');
                  setIsUploading(false);
                },
                () => {
                  getDownloadURL(xmpUploadTask.snapshot.ref).then(async (xmpUrl) => {
                    addLog("XMP-Upload fertig. URL generiert.", 'success');
                    addLog("Schreibe Asset in Datenbank...", 'process');

                    await addDoc(collection(db, "assets"), {
                      filename: file.name,
                      imageUrl: imageUrl,
                      xmpUrl: xmpUrl,
                      uploadedAt: new Date(),
                      curatedExif: curatedExif,
                      allExif: tags 
                    });
                    addLog("✅ ERFOLG! Asset und XMP in Firestore gespeichert.", 'success');
                    setIsUploading(false);
                  });
                }
              );
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
                      {/* KORRIGIERT: Formatierung zur Anzeigezeit */}
                      <For each={Object.entries(data)}>{([key, value]) => (
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontFamily: 'monospace', fontSize: '11px', color: '#ddd' }}>
                          <b style={{ color: '#888', paddingRight: '10px' }}>{key}:</b> 
                          <span>{formatExifForDisplay(key, value)}</span>
                        </p>)}
                      </For>
                    </div>
                  )}
                </For>
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
