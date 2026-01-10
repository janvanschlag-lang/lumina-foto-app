import { GoogleGenerativeAI } from "@google/generative-ai";

// Standard: Gemini 2.5 Flash
const MODEL_NAME = "gemini-2.5-flash";

const getApiKey = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    console.error("CRITICAL: VITE_GEMINI_API_KEY fehlt in der .env Datei!");
    throw new Error("API Key fehlt. Bitte .env prüfen.");
  }
  return key;
};

const fileToGenerativePart = async (file) => {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

/**
 * Hauptfunktion: Analysiert das Bild mit Gemini Vision (Profi Curator + Colorist Mode)
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // DER PROFI PROMPT (JETZT MIT COLOR ANALYSIS)
    const prompt = `
      You are a professional Photo Editor & Curator.
      Analyze the image for a stock photography database. Be strict but fair.
      
      Structure your response into 4 sections:
      1. KEYWORDS: 10-15 English tags.
      2. ANALYSIS: Descriptive text blocks.
      3. RATING: Detailed scores (0-10) and flags.
      4. COLOR: White Balance check.

      CRITERIA:
      - Technical: Sharpness is paramount. Noise is acceptable if fixable.
      - Color: Detect unnatural color casts (e.g. green tint on skin/feathers).
      
      Response Format (JSON ONLY):
      {
        "keywords": ["Duck", "Water", ...],
        "analysis": {
          "subject": "Detailed description...",
          "lighting": "Description of light...",
          "composition": "Description of framing...",
          "technical": "Notes on noise, sharpness..."
        },
        "technical": {
          "focus_score": 8,       // 10=Perfect, 1=Blurry
          "noise_score": 5,       // 10=Clean, 1=Heavy Noise
          "exposure_score": 7,    // 10=Perfect, 1=Clipping
          "is_intentional": false 
        },
        "color_analysis": {
          "cast_detected": true,          // true if unnatural tint found
          "cast_color": "Green",          // e.g. Green, Blue, Magenta, Warm
          "confidence": 8,                // 0-10 how sure are you?
          "correction_hint": "Tint +15"   // What would a retoucher do?
        },
        "composition": {
          "score": 7,             
          "crop_issue": false,    
          "distractions": false   
        },
        "aesthetic": {
          "score": 8,             
          "commercial_appeal": 9  
        }
      }
    `;

    const imagePart = await fileToGenerativePart(imageFile);

    console.log(`🤖 Sende Bild an ${MODEL_NAME} (Colorist Mode)...`);
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("🤖 AI Roh-Antwort:", text);

    const jsonString = text.replace(/```json|```/g, "").trim();
    
    let parsedData = {};
    
    // Initialisierung
    let finalResult = {
        keywords: [],
        analysis: {},
        technical: null,
        color_analysis: null, // NEU
        composition: null,
        aesthetic: null
    };

    try {
        parsedData = JSON.parse(jsonString);
        
        // Mapping
        finalResult.keywords = parsedData.keywords || [];
        finalResult.analysis = parsedData.analysis || {};
        finalResult.technical = parsedData.technical || { focus_score: 5, noise_score: 5, exposure_score: 5 };
        finalResult.color_analysis = parsedData.color_analysis || { cast_detected: false };
        finalResult.composition = parsedData.composition || { score: 5 };
        finalResult.aesthetic = parsedData.aesthetic || { score: 5 };

    } catch (e) {
        console.error("JSON Parse Fehler:", e);
        finalResult.keywords = []; 
        finalResult.analysis = { error: "Parsing Failed" };
    }

    return { ...finalResult, raw: text };

  } catch (error) {
    console.error("AI Analyse fehlgeschlagen:", error);
    return { keywords: [], error: error.message };
  }
};