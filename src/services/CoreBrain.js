import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';

// --- XMP GENERATOR ---
const createXmpContent = (data) => {
  const rating = 0;
  const label = "";
  
  // 1. Datum formatieren (Sicherer Check)
  let xmpDate = "";
  if (data.exif.dateTime && typeof data.exif.dateTime === 'string') {
    try {
        xmpDate = data.exif.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3T');
    } catch (e) {
        console.warn("Datums-Formatierung fehlgeschlagen:", e);
    }
  }

  // 2. Fokus-Distanz (Sicherer Check)
  let focusDistanceLine = "";
  if (data.exif.focusDistance && typeof data.exif.focusDistance === 'string') {
    const distVal = data.exif.focusDistance.replace(/[^\d.]/g, ''); 
    if (distVal && distVal.length > 0) {
      focusDistanceLine = `<aux:ApproximateFocusDistance>${distVal}</aux:ApproximateFocusDistance>`;
    }
  }

  // 3. Blende bereinigen
  const cleanAperture = (val) => {
      if (!val || typeof val !== 'string') return "";
      return val.replace('f/', '');
  };

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:aux="http://ns.adobe.com/exif/1.0/aux/"
    xmp:Rating="${rating}"
    xmp:Label="${label}"
    xmp:CreateDate="${xmpDate}"
    xmp:ModifyDate="${xmpDate}">
   
   <xmp:UserComment>Imported by Lumina Pipeline</xmp:UserComment>
   
   <tiff:Make>NIKON CORPORATION</tiff:Make>
   <tiff:Model>${data.exif.model}</tiff:Model>
   <aux:Lens>${data.exif.lens}</aux:Lens>
   ${focusDistanceLine}
   
   <tiff:Orientation>${data.exif.orientation}</tiff:Orientation>
   <exif:ColorSpace>${data.exif.colorSpace}</exif:ColorSpace>
   
   <exif:ExposureTime>${data.exif.shutter}</exif:ExposureTime>
   <exif:FNumber>${cleanAperture(data.exif.aperture)}</exif:FNumber>
   <exif:ISOSpeedRatings>
    <rdf:Seq>
     <rdf:li>${data.exif.iso}</rdf:li>
    </rdf:Seq>
   </exif:ISOSpeedRatings>
   
   <exif:ExposureProgram>${data.exif.program}</exif:ExposureProgram>
   <exif:MeteringMode>${data.exif.metering}</exif:MeteringMode>
   <exif:WhiteBalance>${data.exif.whiteBalance}</exif:WhiteBalance>
   <exif:DateTimeOriginal>${xmpDate}</exif:DateTimeOriginal>

  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

// --- HELPER: Objektiv-Namen erraten ---
const formatLensName = (tags) => {
  const explicitName = tags['Lens']?.description || tags['LensModel']?.description || tags['LensID']?.description;
  if (explicitName) return explicitName;

  const focal = tags['FocalLength']?.description;
  const aperture = tags['MaxApertureValue']?.description; 

  if (focal && aperture) {
    const fValNum = parseFloat(aperture);
    if (!isNaN(fValNum)) {
        const fVal = Math.round(fValNum * 10) / 10; 
        return `${focal} f/${fVal}`;
    }
  }
  return focal || "Unbekanntes Objektiv";
};

// --- CORE LOGIC ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  const bundleId = rawFile.name;
  
  try {
    onStatus(`Lese EXIF aus ${rawFile.name}...`);
    const tags = await ExifReader.load(rawFile);
    
    // Daten extrahieren (Mit Fallbacks für alles)
    const exifData = {
      model: tags['Model']?.description || "Unbekannt",
      lens: formatLensName(tags),
      iso: tags['ISOSpeedRatings']?.description || tags['ISOSpeedRatings']?.value || "--",
      aperture: tags['FNumber']?.description || "--",
      shutter: tags['ExposureTime']?.description || "--",
      
      // Deep Metadata
      dateTime: tags['DateTimeOriginal']?.description || tags['DateTime']?.description || null,
      program: tags['ExposureProgram']?.description || "Normal", 
      metering: tags['MeteringMode']?.description || "Pattern",
      whiteBalance: tags['WhiteBalance']?.description || "Auto",
      
      // Safety Check für Firestore (kein undefined)
      focusDistance: tags['FocusDistance']?.description || tags['SubjectDistance']?.description || null,
      
      // NEU: Orientierung & Farbraum (mit Defaults)
      // 1 = Horizontal (Normal), 65535 = Uncalibrated (oft AdobeRGB)
      orientation: tags['Orientation']?.value || 1,
      colorSpace: tags['ColorSpace']?.value || 65535 
    };

    // 2. AI Analyse (Mock)
    const aiResult = { score: 0 }; 

    // 3. XMP Generieren
    onStatus("Generiere XMP...");
    const xmpString = createXmpContent({ score: aiResult.score, exif: exifData });
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

    // 5. DB Eintrag
    onStatus("Registriere Asset in Datenbank...");
    await addDoc(collection(db, "assets"), {
      filename: rawFile.name,
      exif: exifData,
      urls: { raw: rawUrl, preview: previewCloudUrl, xmp: xmpUrl },
      uploadedAt: new Date()
    });

    onStatus("✅ Fertig.");
    return { success: true, data: exifData };

  } catch (error) {
    console.error("PIPELINE ERROR:", error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return { success: false, error: error.message };
  }
};