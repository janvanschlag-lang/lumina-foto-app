import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';

// --- XMP GENERATOR ---
const createXmpContent = (data) => {
  const rating = 0;
  const label = "";
  
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

// --- HELPER: Objektiv-Namen erraten ---
const formatLensName = (tags) => {
  // 1. Versuch: Echter Name aus den Metadaten
  const explicitName = tags['Lens']?.description || tags['LensModel']?.description || tags['LensID']?.description;
  if (explicitName) return explicitName;

  // 2. Versuch: Bauen aus Brennweite + Lichtstärke (z.B. "300 mm f/2.8")
  const focal = tags['FocalLength']?.description;
  const aperture = tags['MaxApertureValue']?.description; // z.B. 5.66

  if (focal && aperture) {
    // Wir runden die Blende auf 1 Nachkommastelle (5.66 -> 5.7)
    const fVal = Math.round(parseFloat(aperture) * 10) / 10; 
    return `${focal} f/${fVal}`;
  }

  // 3. Versuch: Nur Brennweite
  return focal || "Unbekanntes Objektiv";
};

// --- CORE LOGIC ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  const bundleId = rawFile.name;
  
  try {
    // 1. EXIF aus dem RAW lesen
    onStatus(`Lese EXIF aus ${rawFile.name}...`);
    const tags = await ExifReader.load(rawFile);
    
    // Intelligente Daten-Extraktion
    const exifData = {
      model: tags['Model']?.description || "Unbekannt",
      lens: formatLensName(tags), // Nutzt die neue Helper-Funktion
      iso: tags['ISOSpeedRatings']?.description || tags['ISOSpeedRatings']?.value || "--",
      aperture: tags['FNumber']?.description || "--",
      shutter: tags['ExposureTime']?.description || "--"
    };

    // 2. AI Analyse (Mock-Modus)
    const aiResult = { score: 0 }; 

    // 3. XMP Generieren
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
    await addDoc(collection(db, "assets"), {
      filename: rawFile.name,
      exif: exifData,
      urls: { raw: rawUrl, preview: previewCloudUrl, xmp: xmpUrl },
      uploadedAt: new Date()
    });

    onStatus("✅ Fertig.");
    return { success: true, data: exifData };

  } catch (error) {
    console.error(error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return { success: false, error: error.message };
  }
};