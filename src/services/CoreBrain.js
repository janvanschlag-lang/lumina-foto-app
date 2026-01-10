import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';
import { analyzeImageWithPro } from './geminiService';

// --- XMP GENERATOR ---
const createXmpContent = (data) => {
  const rating = data.rating || 0;
  const label = "";
  
  // 1. Keywords (AI)
  let subjectBlock = "";
  if (data.keywords && data.keywords.length > 0) {
    const listItems = data.keywords.map(k => `<rdf:li>${k}</rdf:li>`).join('\n     ');
    subjectBlock = `
   <dc:subject>
    <rdf:Bag>
     ${listItems}
    </rdf:Bag>
   </dc:subject>`;
  }

  // 2. Datum
  let xmpDate = "";
  if (data.exif.dateTime && typeof data.exif.dateTime === 'string') {
    try {
        xmpDate = data.exif.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3T');
    } catch (e) { console.warn("Date error", e); }
  }

  // 3. Fokus-Distanz
  let focusDistanceLine = "";
  if (data.exif.focusDistance && typeof data.exif.focusDistance === 'string') {
    const distVal = data.exif.focusDistance.replace(/[^\d.]/g, ''); 
    if (distVal) focusDistanceLine = `<aux:ApproximateFocusDistance>${distVal}</aux:ApproximateFocusDistance>`;
  }

  const cleanAperture = (val) => (!val || typeof val !== 'string') ? "" : val.replace('f/', '');

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:aux="http://ns.adobe.com/exif/1.0/aux/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmp:Rating="${rating}"
    xmp:Label="${label}"
    xmp:CreateDate="${xmpDate}"
    xmp:ModifyDate="${xmpDate}">
   
   <xmp:UserComment>Imported by Lumina Pipeline</xmp:UserComment>
   ${subjectBlock}
   
   <tiff:Make>NIKON CORPORATION</tiff:Make>
   <tiff:Model>${data.exif.model}</tiff:Model>
   <aux:Lens>${data.exif.lens}</aux:Lens>
   ${focusDistanceLine}
   
   <tiff:Orientation>${data.exif.orientation}</tiff:Orientation>
   <exif:ColorSpace>${data.exif.colorSpace}</exif:ColorSpace>
   
   <exif:ExposureTime>${data.exif.shutter}</exif:ExposureTime>
   <exif:FNumber>${cleanAperture(data.exif.aperture)}</exif:FNumber>
   <exif:ISOSpeedRatings><rdf:Seq><rdf:li>${data.exif.iso}</rdf:li></rdf:Seq></exif:ISOSpeedRatings>
   
   <exif:ExposureProgram>${data.exif.program}</exif:ExposureProgram>
   <exif:MeteringMode>${data.exif.metering}</exif:MeteringMode>
   <exif:WhiteBalance>${data.exif.whiteBalance}</exif:WhiteBalance>
   <exif:DateTimeOriginal>${xmpDate}</exif:DateTimeOriginal>

  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

// --- HELPER: Objektiv-Namen ---
const formatLensName = (tags) => {
  const explicitName = tags['Lens']?.description || tags['LensModel']?.description || tags['LensID']?.description;
  if (explicitName) return explicitName;
  const focal = tags['FocalLength']?.description;
  const aperture = tags['MaxApertureValue']?.description; 
  if (focal && aperture) {
    const fValNum = parseFloat(aperture);
    if (!isNaN(fValNum)) {
        return `${focal} f/${Math.round(fValNum * 10) / 10}`;
    }
  }
  return focal || "Unbekanntes Objektiv";
};

// --- CORE LOGIC ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  
  try {
    // 1. EXIF lesen
    onStatus(`Lese EXIF aus ${rawFile.name}...`);
    const tags = await ExifReader.load(rawFile);
    
    const exifData = {
      model: tags['Model']?.description || "Unbekannt",
      lens: formatLensName(tags),
      iso: tags['ISOSpeedRatings']?.description || tags['ISOSpeedRatings']?.value || "--",
      aperture: tags['FNumber']?.description || "--",
      shutter: tags['ExposureTime']?.description || "--",
      dateTime: tags['DateTimeOriginal']?.description || tags['DateTime']?.description || null,
      program: tags['ExposureProgram']?.description || "Normal", 
      metering: tags['MeteringMode']?.description || "Pattern",
      whiteBalance: tags['WhiteBalance']?.description || "Auto",
      focusDistance: tags['FocusDistance']?.description || tags['SubjectDistance']?.description || null,
      orientation: tags['Orientation']?.value || 1,
      colorSpace: tags['ColorSpace']?.value || 65535 
    };

    // 2. AI Analyse
    onStatus("Sende Bild an Gemini (Analyse)...");
    let aiResult = { keywords: [], score: 0, rating: 0 };
    
    try {
        const analysis = await analyzeImageWithPro(previewFile);
        if (analysis && analysis.keywords) {
            aiResult.keywords = analysis.keywords;
            onStatus(`🤖 AI Schlagworte: ${analysis.keywords.slice(0, 3).join(", ")}...`);
        }
    } catch (aiError) {
        console.warn("AI Fehler (ignoriert):", aiError);
        onStatus("⚠️ AI Analyse fehlgeschlagen (nutze nur EXIF).");
    }

    // 3. XMP Generieren
    onStatus("Generiere Smart XMP...");
    const xmpString = createXmpContent({ 
        rating: aiResult.rating, 
        keywords: aiResult.keywords, 
        exif: exifData 
    });
    
    const xmpBlob = new Blob([xmpString], { type: "application/xml" });
    const xmpName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.')) + ".xmp";
    const xmpFile = new File([xmpBlob], xmpName);

    // 4. Upload
    const assetBaseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
    const assetPath = `assets/${assetBaseName}`; 
    onStatus(`Upload Bundle...`);
    
    const upload = async (file, pathName) => {
      const fileRef = ref(storage, `${assetPath}/${pathName}`);
      await uploadBytes(fileRef, file);
      return getDownloadURL(fileRef);
    };

    const [rawUrl, previewCloudUrl, xmpUrl] = await Promise.all([
      upload(rawFile, rawFile.name),
      upload(previewFile, previewFile.name),
      upload(xmpFile, xmpFile.name)
    ]);

    // 5. DB & RETURN
    onStatus("Registriere Asset in Datenbank...");
    await addDoc(collection(db, "assets"), {
      filename: rawFile.name,
      exif: exifData,
      ai: aiResult,
      urls: { raw: rawUrl, preview: previewCloudUrl, xmp: xmpUrl },
      uploadedAt: new Date()
    });

    onStatus("✅ Fertig.");
    
    // WICHTIG: Hier geben wir AI + EXIF zurück an die App!
    return { 
        success: true, 
        data: { 
            ...exifData, 
            ai: aiResult 
        } 
    };

  } catch (error) {
    console.error("PIPELINE ERROR:", error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return { success: false, error: error.message };
  }
};