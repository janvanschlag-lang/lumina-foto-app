import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"; // Query Imports dazu!
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';
import { analyzeImageWithPro } from './geminiService';

// --- HELPER: Datum aus EXIF extrahieren ---
const getCaptureDateObj = (exifData) => {
  // Versuche das Datum zu parsen (Format: "YYYY:MM:DD HH:MM:SS" oder ISO)
  let dateStr = exifData.dateTimeOriginal || exifData.dateTime;
  
  if (!dateStr) return new Date(); // Fallback: Heute

  // Fix für Doppelpunkte im Datum (Standard EXIF Format)
  // "2026:01:10 14:00:00" -> "2026-01-10 14:00:00"
  if (dateStr.includes(':')) {
    const parts = dateStr.split(' ');
    parts[0] = parts[0].replace(/:/g, '-');
    dateStr = parts.join(' ');
  }

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
};

// --- HELPER: Pfad-Generator ---
const generateStoragePaths = (filename, dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  const dateFolder = `${year}-${month}-${day}`;
  const baseName = filename.substring(0, filename.lastIndexOf('.'));
  
  // Struktur: assets/2026/2026-01-10/...
  const basePath = `assets/${year}/${dateFolder}`;

  return {
    raw: `${basePath}/raw/${filename}`,
    preview: `${basePath}/preview/${baseName}.jpg`,
    xmp: `${basePath}/xmp/${baseName}.xmp`,
    folderDate: dateFolder // Zum Speichern in der DB
  };
};

// --- HELPER: Duplikat-Check ---
const checkDuplicate = async (filename) => {
  const assetsRef = collection(db, "assets");
  const q = query(assetsRef, where("filename", "==", filename));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty; // True wenn gefunden
};


// --- LOGIC ENGINE: Verdict (Bleibt gleich) ---
const calculateLuminaVerdict = (aiData) => {
  if (!aiData.technical) return { score: 0, rating: 0, flag: 'none' };
  const tech = aiData.technical;
  const comp = aiData.composition;
  const aest = aiData.aesthetic;

  if (tech.focus_score < 5 && !tech.is_intentional) return { score: 1.5, rating: 1, flag: 'reject' };

  let rawScore = ((tech.focus_score * 2) + (comp.score * 1.5) + (aest.score * 1.5) + (tech.exposure_score * 1)) / 6.0;
  if (comp.crop_issue) rawScore = Math.min(rawScore, 6.0);
  if (tech.noise_score < 3 && !tech.is_intentional) rawScore -= 0.5;
  const finalScore = Math.round(rawScore * 10) / 10;

  let flag = 'review';
  let rating = 3;
  if (finalScore >= 8.5) { flag = 'pick'; rating = 5; }
  else if (finalScore >= 7.0) { flag = 'review'; rating = 4; }
  else if (finalScore >= 5.0) { flag = 'review'; rating = 3; }
  else { flag = 'reject'; rating = finalScore < 3.0 ? 1 : 2; }

  return { score: finalScore, rating, flag };
};

// --- XMP GENERATOR (Bleibt gleich) ---
const createXmpContent = (data) => {
  const rating = data.rating || 0;
  let pickStatus = "";
  if (data.flag === 'pick') pickStatus = 'crs:Pick="1"';
  if (data.flag === 'reject') pickStatus = 'crs:Pick="-1"';

  let subjectBlock = "";
  if (data.keywords?.length > 0) {
    subjectBlock = `<dc:subject><rdf:Bag>${data.keywords.map(k => `<rdf:li>${k}</rdf:li>`).join('\n')}</rdf:Bag></dc:subject>`;
  }

  let descriptionBlock = "";
  let userComment = "Imported by Lumina Pipeline";

  if (data.analysis) {
    if (data.analysis.subject) descriptionBlock = `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${data.analysis.subject}</rdf:li></rdf:Alt></dc:description>`;
    
    const lines = ["--- LUMINA AI VISION REPORT ---"];
    if (data.rating > 0) {
       lines.push(`VERDICT: ${data.flag.toUpperCase()} (Score: ${data.score}/10 | Stars: ${data.rating}/5)`);
       if (data.technical) lines.push(`[Tech] Focus: ${data.technical.focus_score}/10 | Noise: ${data.technical.noise_score}/10`);
       if (data.color_analysis?.cast_detected) lines.push(`[Color] ⚠️ CAST: ${data.color_analysis.cast_color}`);
       lines.push("--------------------------------");
    }
    lines.push(`Subject: ${data.analysis.subject || '-'}`);
    userComment = lines.join('\n');
  }

  let xmpDate = "";
  try { xmpDate = data.exif.dateTime?.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3T'); } catch (e) {}
  
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmp:Rating="${rating}" ${pickStatus} xmp:CreateDate="${xmpDate}">
   <xmp:UserComment>${userComment}</xmp:UserComment>
   ${subjectBlock} ${descriptionBlock}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

// --- HELPER: Lens Name ---
const formatLensName = (tags) => {
  const explicit = tags['Lens']?.description || tags['LensModel']?.description;
  if (explicit) return explicit;
  const focal = tags['FocalLength']?.description;
  return focal || "Unknown Lens";
};


// --- CORE PIPELINE (Refactored) ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  try {
    // 1. DUPLIKAT CHECK (Erste Hürde)
    // Wir prüfen VOR dem EXIF lesen, um Ressourcen zu sparen, 
    // aber wir brauchen den Dateinamen.
    onStatus(`Prüfe Datenbank auf Duplikate...`);
    const isDuplicate = await checkDuplicate(rawFile.name);
    
    if (isDuplicate) {
      onStatus(`⚠️ Datei existiert bereits: ${rawFile.name}`);
      return { success: false, error: "Duplicate File", skipped: true };
    }

    // 2. EXIF LESEN (Für Datum & Ordnerstruktur)
    onStatus(`Lese EXIF für Struktur...`);
    const tags = await ExifReader.load(rawFile);
    
    // Datum ermitteln für Ordnerstruktur
    const captureDateObj = getCaptureDateObj({
        dateTimeOriginal: tags['DateTimeOriginal']?.description,
        dateTime: tags['DateTime']?.description
    });
    
    // Pfade generieren
    const paths = generateStoragePaths(rawFile.name, captureDateObj);
    onStatus(`📂 Ziel: /${paths.folderDate}/...`);

    // EXIF Daten normalisieren
    const exifData = {
      model: tags['Model']?.description || "Unbekannt",
      lens: formatLensName(tags),
      iso: tags['ISOSpeedRatings']?.description || tags['ISOSpeedRatings']?.value || "--",
      aperture: tags['FNumber']?.description || "--",
      shutter: tags['ExposureTime']?.description || "--",
      dateTime: tags['DateTimeOriginal']?.description || tags['DateTime']?.description,
      program: tags['ExposureProgram']?.description || "Normal", 
      metering: tags['MeteringMode']?.description || "Pattern",
      whiteBalance: tags['WhiteBalance']?.description || "Auto",
      focusDistance: tags['FocusDistance']?.description || null,
      orientation: tags['Orientation']?.value || 1,
      colorSpace: tags['ColorSpace']?.value || 65535,
      captureDate: captureDateObj // Das saubere JS Date Objekt
    };

    // 3. AI ANALYSE
    onStatus("Sende an Gemini...");
    let aiResult = { keywords: [], analysis: null, technical: null, color_analysis: null, composition: null, aesthetic: null, rating: 0, score: 0, flag: 'none' };
    
    try {
        const result = await analyzeImageWithPro(previewFile);
        if (result.keywords) aiResult.keywords = result.keywords;
        if (result.analysis) aiResult.analysis = result.analysis;
        if (result.technical) aiResult.technical = result.technical;
        if (result.color_analysis) aiResult.color_analysis = result.color_analysis;
        if (result.composition) aiResult.composition = result.composition;
        if (result.aesthetic) aiResult.aesthetic = result.aesthetic;
        
        if (aiResult.technical) {
            const verdict = calculateLuminaVerdict(aiResult);
            aiResult.rating = verdict.rating;
            aiResult.score = verdict.score;
            aiResult.flag = verdict.flag;
            onStatus(`⭐ Verdict: ${aiResult.flag.toUpperCase()} (${aiResult.score})`);
        }
    } catch (aiError) {
        console.warn("AI Fehler:", aiError);
        onStatus("⚠️ AI Fehler - Fahre fort.");
    }

    // 4. XMP GENERIEREN
    const xmpString = createXmpContent({ ...aiResult, exif: exifData });
    const xmpBlob = new Blob([xmpString], { type: "application/xml" });
    const xmpFile = new File([xmpBlob], rawFile.name.replace(/\.[^/.]+$/, ".xmp"));

    // 5. UPLOAD (In die neue Struktur!)
    onStatus(`Upload in ${paths.folderDate}...`);
    
    const uploadToPath = async (file, fullPath) => {
      const fileRef = ref(storage, fullPath);
      await uploadBytes(fileRef, file);
      return getDownloadURL(fileRef);
    };

    const [rawUrl, previewCloudUrl, xmpUrl] = await Promise.all([
      uploadToPath(rawFile, paths.raw),
      uploadToPath(previewFile, paths.preview),
      uploadToPath(xmpFile, paths.xmp)
    ]);

    // 6. DATENBANK (Clean Data Model)
    onStatus("Speichere Asset-Daten...");
    
    // Wir speichern ein sauberes Dokument für die Galerie
    const assetDoc = {
      filename: rawFile.name,
      captureDate: exifData.captureDate, // Wichtig für Sortierung!
      folderDate: paths.folderDate,      // Wichtig für Filterung
      
      // Meta-Subset für schnelle Galerie-Anzeige
      meta: {
        iso: exifData.iso,
        aperture: exifData.aperture,
        shutter: exifData.shutter,
        lens: exifData.lens,
        camera: exifData.model
      },

      // Verdict für Filterung
      verdict: {
        score: aiResult.score,
        rating: aiResult.rating,
        flag: aiResult.flag
      },

      // Pfade & URLs
      paths: {
        raw: paths.raw,
        preview: paths.preview,
        xmp: paths.xmp
      },
      urls: { 
        raw: rawUrl, 
        preview: previewCloudUrl, 
        xmp: xmpUrl 
      },

      // Full Data (Lazy Loading)
      aiAnalysis: aiResult, // Alles andere
      
      uploadedAt: new Date()
    };

    await addDoc(collection(db, "assets"), assetDoc);

    onStatus("✅ Fertig.");
    return { success: true, data: { ...exifData, ai: aiResult } };

  } catch (error) {
    console.error("PIPELINE ERROR:", error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return { success: false, error: error.message };
  }
};