import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';

// --- XMP GENERATOR (Unverändert) ---
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

// --- CORE LOGIC (Mit Debugging) ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  const bundleId = rawFile.name;
  
  try {
    // 1. EXIF aus dem RAW lesen
    onStatus(`Lese EXIF aus ${rawFile.name}...`);
    const tags = await ExifReader.load(rawFile);
    
    // --- 🕵️ DEBUG ZONE START ---
    console.group("📸 EXIF ANALYSE FÜR " + rawFile.name);
    console.log("Rohe Tags (Alle):", tags);
    console.log("Objektiv-Kandidaten:", {
        "Lens": tags['Lens'],           // Nikon Standard?
        "LensID": tags['LensID'],       // Oft die ID
        "LensModel": tags['LensModel'], // EXIF Standard
        "LensType": tags['LensType']    // Manchmal hier
    });
    console.groupEnd();
    // --- 🕵️ DEBUG ZONE END ---

    // Die Werte extrahieren (Hier erweitern wir später um das gefundene Lens-Feld)
    const exifData = {
      model: tags['Model']?.description || "Unbekannt",
      // Aktueller Fallback (wird bald ersetzt):
      lens: tags['Lens']?.description || tags['LensModel']?.description || tags['FocalLength']?.description || "-- mm",
      iso: tags['ISOSpeedRatings']?.description || tags['ISOSpeedRatings']?.value || "--",
      aperture: tags['FNumber']?.description || "--",
      shutter: tags['ExposureTime']?.description || "--"
    };

    // 2. AI (Mock-Modus)
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

    // 5. DB
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