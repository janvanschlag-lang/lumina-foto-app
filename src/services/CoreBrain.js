import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from '../firebase';
import ExifReader from 'exifreader';
import { analyzeImageWithPro } from './geminiService';

// --- LOGIC ENGINE ---
const calculateSmartRating = (aiData) => {
  if (!aiData.technical) return 0;

  const tech = aiData.technical;
  const comp = aiData.composition;
  const aest = aiData.aesthetic;

  // 1. TÜRSTEHER
  if (tech.focus_score < 5 && !tech.is_intentional) return 1;

  // 2. BASIS-NOTE
  let score = (
    (tech.focus_score * 2) + 
    (comp.score * 1.5) + 
    (aest.score * 1.5) +
    (tech.exposure_score * 1) 
  ) / 6.0;

  // 3. ABZÜGE
  if (comp.crop_issue) score = Math.min(score, 6.0);
  if (tech.noise_score < 3 && !tech.is_intentional) score -= 0.5; 

  // MAPPING
  if (score >= 8.5) return 5;
  if (score >= 7.0) return 4;
  if (score >= 5.0) return 3;
  if (score >= 3.0) return 2;
  return 1;
};

// --- XMP GENERATOR ---
const createXmpContent = (data) => {
  const rating = data.rating || 0;
  
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
    
    // A) Rating Header
    if (data.rating > 0) {
       lines.push(`RATING: ${data.rating}/5 Stars`);
       
       if (data.technical) {
         lines.push(`[Tech] Focus: ${data.technical.focus_score}/10 | Noise: ${data.technical.noise_score}/10 ${data.technical.noise_score < 5 ? '(DENOISE NEEDED)' : ''}`);
         if (data.technical.is_intentional) lines.push("NOTE: Artistic Intent Detected");
       }
       
       // NEU: COLOR REPORT
       if (data.color_analysis && data.color_analysis.cast_detected) {
         lines.push(`[Color] ⚠️ CAST: ${data.color_analysis.cast_color} (Conf: ${data.color_analysis.confidence}/10)`);
         lines.push(`[Color] FIX: ${data.color_analysis.correction_hint}`);
       }

       if (data.composition) lines.push(`[Comp] Score: ${data.composition.score}/10`);
       lines.push("--------------------------------");
    }
    
    // B) Text Analysis
    lines.push(`Subject: ${data.analysis.subject || '-'}`);
    lines.push(`Lighting: ${data.analysis.lighting || '-'}`);
    lines.push(`Composition: ${data.analysis.composition || '-'}`);
    lines.push(`Tech Notes: ${data.analysis.technical || '-'}`);
    
    userComment = lines.join('\n');
  }

  // 3. Technical Metadata Helpers
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
    onStatus("Sende an Gemini (Colorist)...");
    
    let aiResult = { 
        keywords: [], 
        analysis: null, 
        technical: null, 
        color_analysis: null, // NEU
        composition: null, 
        aesthetic: null,
        rating: 0 
    };
    
    try {
        const result = await analyzeImageWithPro(previewFile);
        
        // Daten übertragen
        if (result.keywords) aiResult.keywords = result.keywords;
        if (result.analysis) aiResult.analysis = result.analysis;
        if (result.technical) aiResult.technical = result.technical;
        if (result.color_analysis) aiResult.color_analysis = result.color_analysis; // NEU
        if (result.composition) aiResult.composition = result.composition;
        if (result.aesthetic) aiResult.aesthetic = result.aesthetic;
        
        // Rating berechnen
        if (aiResult.technical) {
            aiResult.rating = calculateSmartRating(aiResult);
            onStatus(`⭐ AI Rating: ${aiResult.rating}/5`);
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