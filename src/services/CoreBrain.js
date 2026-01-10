import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
// import { analyzeImageWithPro } from '../geminiService'; <--- RAUS DAMIT!
import ExifReader from 'exifreader';

// --- XMP GENERATOR (Internal Helper) ---
const createXmpContent = (data) => {
  // Wir simulieren hier Scores, da die AI noch schläft
  const rating = data.score ? (data.score >= 80 ? 5 : 3) : 0;
  const label = data.score ? (data.score >= 80 ? "Green" : "Yellow") : "";
  
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmp:Rating="${rating}"
    xmp:Label="${label}">
   <xmp:UserComment>Imported by Lumina Pipeline</xmp:UserComment>
   <tiff:Model>${data.exif.model}</tiff:Model>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

// --- CORE LOGIC ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  const bundleId = rawFile.name;
  
  try {
    // 1. EXIF aus dem RAW lesen (Master Data)
    onStatus(`Lese EXIF aus ${rawFile.name}...`);
    const tags = await ExifReader.load(rawFile);
    
    // Sicheres Auslesen der Werte (ExifReader ist manchmal eigenwillig)
    const exifData = {
      model: tags['Model']?.description || "Unknown",
      iso: tags['ISOSpeedRatings']?.value || 0,
      fNumber: tags['FNumber']?.description || 0,
      exposure: tags['ExposureTime']?.description || 0,
    };

    // 2. AI ANALYSE ÜBERSPRINGEN (Wir sind noch nicht so weit)
    onStatus("AI Analyse übersprungen (Mock-Modus)...");
    const aiResult = { score: 0, recommendation: "Pending AI" }; 

    // 3. XMP Generieren
    onStatus("Erstelle XMP Sidecar...");
    const xmpString = createXmpContent({ score: aiResult.score, recommendation: aiResult.recommendation, exif: exifData });
    const xmpBlob = new Blob([xmpString], { type: "application/xml" });
    // Wichtig: Name muss gleich sein wie RAW, nur mit .xmp
    const xmpName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.')) + ".xmp";
    const xmpFile = new File([xmpBlob], xmpName);

    // 4. Cloud Upload (RAW + JPG + XMP)
    // Wir erstellen einen sauberen Unterordner pro Bild, damit es ordentlich bleibt
    const assetBaseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
    const assetPath = `assets/${assetBaseName}`; 
    
    onStatus(`Lade Bundle hoch: ${assetPath}...`);
    
    const upload = async (file, pathName) => {
      const fileRef = ref(storage, `${assetPath}/${pathName}`);
      await uploadBytes(fileRef, file);
      return getDownloadURL(fileRef);
    };

    // Parallel hochladen für Speed
    const [rawUrl, previewCloudUrl, xmpUrl] = await Promise.all([
      upload(rawFile, rawFile.name),
      upload(previewFile, previewFile.name), // Das JPG dient als Proxy
      upload(xmpFile, xmpFile.name)
    ]);

    // 5. Datenbank Eintrag
    onStatus("Registriere Asset in Datenbank...");
    await addDoc(collection(db, "assets"), {
      filename: rawFile.name,
      camera: exifData.model,
      iso: exifData.iso,
      score: null, // Noch kein Score
      urls: { 
        raw: rawUrl, 
        preview: previewCloudUrl, 
        xmp: xmpUrl 
      },
      uploadedAt: new Date()
    });

    onStatus("✅ Fertig! Bundle ist archiviert.");
    return true;

  } catch (error) {
    console.error(error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return false;
  }
};