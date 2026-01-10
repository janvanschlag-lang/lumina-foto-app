import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';
import { analyzeImageWithPro } from './geminiService';

// --- LOGIC ENGINE: Das "Lumina Culling System" ---
const calculateLuminaVerdict = (aiData) => {
  if (!aiData.technical) return { score: 0, rating: 0, flag: 'none' };

  const tech = aiData.technical;
  const comp = aiData.composition;
  const aest = aiData.aesthetic;

  // 1. TÜRSTEHER (K.O. Kriterien)
  if (tech.focus_score < 5 && !tech.is_intentional) {
    return { score: 1.5, rating: 1, flag: 'reject' };
  }

  // 2. PRÄZISER SCORE (0.0 - 10.0)
  let rawScore = (
    (tech.focus_score * 2) + 
    (comp.score * 1.5) + 
    (aest.score * 1.5) +
    (tech.exposure_score * 1) 
  ) / 6.0;

  // 3. ABZÜGE
  if (comp.crop_issue) rawScore = Math.min(rawScore, 6.0);
  if (tech.noise_score < 3 && !tech.is_intentional) rawScore -= 0.5;

  // Runden
  const finalScore = Math.round(rawScore * 10) / 10;

  // 4. DER DREIKLANG (Flagging)
  let flag = 'review';
  let rating = 3;

  if (finalScore >= 8.5) {
    flag = 'pick';
    rating = 5;
  } else if (finalScore >= 7.0) {
    flag = 'review'; // Strong Review
    rating = 4;
  } else if (finalScore >= 5.0) {
    flag = 'review'; // Weak Review
    rating = 3;
  } else {
    flag = 'reject';
    rating = finalScore < 3.0 ? 1 : 2;
  }

  return { score: finalScore, rating, flag };
};

// --- XMP GENERATOR (ADOBE NATIVE) ---
const createXmpContent = (data) => {
  const rating = data.rating || 0;
  
  // Mapping Flag -> Lightroom Pick Status (crs:Pick)
  // 1 = Pick, -1 = Reject, 0 (oder nichts) = Unflagged
  let pickStatus = "";
  if (data.flag === 'pick') pickStatus = 'crs:Pick="1"';
  if (data.flag === 'reject') pickStatus = 'crs:Pick="-1"';
  // Review bleibt unflagged (neutral), damit du es in LR findest

  // 1. Keywords
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

  // 2. Report & Description
  let descriptionBlock = "";
  let userComment = "Imported by Lumina Pipeline";

  if (data.analysis) {
    if (data.analysis.subject) {
      descriptionBlock = `
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${data.analysis.subject}</rdf:li>
    </rdf:Alt>
   </dc:description>`;
    }

    // VISION REPORT GENERATOR
    const lines = ["--- LUMINA AI VISION REPORT ---"];
    
    if (data.rating > 0) {
       lines.push(`VERDICT: ${data.flag.toUpperCase()} (Score: ${data.score}/10 | Stars: ${data.rating}/5)`);
       
       if (data.technical) {
         lines.push(`[Tech] Focus: ${data.technical.focus_score}/10 | Noise: ${data.technical.noise_score}/10 ${data.technical.noise_score < 5 ? '(DENOISE NEEDED)' : ''}`);
         if (data.technical.is_intentional) lines.push("NOTE: Artistic Intent Detected");
       }
       
       if (data.color_analysis && data.color_analysis.cast_detected) {
         lines.push(`[Color] ⚠️ CAST: ${data.color_analysis.cast_color}`);
         lines.push(`[Color] FIX: ${data.color_analysis.correction_hint}`);
       }

       if (data.composition) lines.push(`[Comp] Score: ${data.composition.score}/10`);
       lines.push("--------------------------------");
    }
    
    lines.push(`Subject: ${data.analysis.subject || '-'}`);
    lines.push(`Lighting: ${data.analysis.lighting || '-'}`);
    lines.push(`Composition: ${data.analysis.composition || '-'}`);
    lines.push(`Tech Notes: ${data.analysis.technical || '-'}`);
    
    userComment = lines.join('\n');
  }

  // 3. Tech Metadata
  let xmpDate = "";
  if (data.exif.dateTime && typeof data.exif.dateTime === 'string') {
    try {
        xmpDate = data.exif.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3T');
    } catch (e) { console.warn("Date error", e); }
  }

  let focusDistanceLine = "";
  if (data.exif.focusDistance && typeof data.exif.focusDistance === 'string') {
    const distVal = data.exif.focusDistance.replace(/[^\d.]/g, ''); 
    if (distVal) focusDistanceLine = `<aux:ApproximateFocusDistance>${distVal}</aux:ApproximateFocusDistance>`;
  }

  const cleanAperture = (val) => (!val || typeof val !== 'string') ? "" : val.replace('f/', '');

  // HINWEIS: xmlns:crs hinzugefügt für Adobe Camera Raw Settings
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:aux="http://ns.adobe.com/exif/1.0/aux/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmp:Rating="${rating}"
    ${pickStatus}
    xmp:CreateDate="${xmpDate}"
    xmp:ModifyDate="${xmpDate}">
   
   <xmp:UserComment>${userComment}</xmp:UserComment>
   ${subjectBlock}
   ${descriptionBlock}
   
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

// --- CORE PIPELINE ---

export const processAssetBundle = async (rawFile, previewFile, onStatus) => {
  try {
    // 1. EXIF
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
    onStatus("Sende an Gemini (Verdict)...");
    
    let aiResult = { 
        keywords: [], 
        analysis: null, 
        technical: null, 
        color_analysis: null,
        composition: null, 
        aesthetic: null,
        rating: 0,
        score: 0,
        flag: 'none'
    };
    
    try {
        const result = await analyzeImageWithPro(previewFile);
        
        if (result.keywords) aiResult.keywords = result.keywords;
        if (result.analysis) aiResult.analysis = result.analysis;
        if (result.technical) aiResult.technical = result.technical;
        if (result.color_analysis) aiResult.color_analysis = result.color_analysis;
        if (result.composition) aiResult.composition = result.composition;
        if (result.aesthetic) aiResult.aesthetic = result.aesthetic;
        
        // VERDICT BERECHNEN
        if (aiResult.technical) {
            const verdict = calculateLuminaVerdict(aiResult);
            aiResult.rating = verdict.rating;
            aiResult.score = verdict.score;
            aiResult.flag = verdict.flag;
            
            onStatus(`⭐ Verdict: ${aiResult.flag.toUpperCase()} (${aiResult.score}/10)`);
        }

    } catch (aiError) {
        console.warn("AI Fehler:", aiError);
        onStatus("⚠️ AI Analyse fehlgeschlagen.");
    }

    // 3. XMP Generieren
    onStatus("Generiere Smart XMP...");
    const xmpString = createXmpContent({ ...aiResult, exif: exifData });
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
    onStatus("Registriere Asset...");
    await addDoc(collection(db, "assets"), {
      filename: rawFile.name,
      exif: exifData,
      ai: aiResult,
      urls: { raw: rawUrl, preview: previewCloudUrl, xmp: xmpUrl },
      uploadedAt: new Date()
    });

    onStatus("✅ Fertig.");
    return { success: true, data: { ...exifData, ai: aiResult } };

  } catch (error) {
    console.error("PIPELINE ERROR:", error);
    onStatus(`❌ FEHLER: ${error.message}`);
    return { success: false, error: error.message };
  }
};