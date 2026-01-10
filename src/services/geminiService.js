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
 * Hauptfunktion: Analysiert das Bild mit Gemini Vision (Profi Curator Mode)
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // DER PROFI PROMPT
    const prompt = `
      You are a professional Photo Editor & Curator.
      Analyze the image for a stock photography database. Be strict but fair.
      
      Structure your response into 3 sections:
      1. KEYWORDS: 10-15 English tags.
      2. ANALYSIS: Descriptive text blocks.
      3. RATING: Detailed scores (0-10) and flags.

      CRITERIA FOR RATING:
      - Technical: Sharpness is paramount. Noise is acceptable if fixable.
      - Composition: Look for crops and distractions.
      - Aesthetic: Mood, moment, and impact.
      
      Response Format (JSON ONLY):
      {
        "keywords": ["Duck", "Water", ...],
        "analysis": {
          "subject": "Detailed description of subject...",
          "lighting": "Description of light...",
          "composition": "Description of framing...",
          "technical": "Notes on noise, sharpness, artifacts..."
        },
        "technical": {
          "focus_score": 8,       // 10=Perfect eye sharpness, 1=Blurry (CRITICAL)
          "noise_score": 5,       // 10=Clean, 1=Heavy Noise (Fixable)
          "exposure_score": 7,    // 10=Perfect Range, 1=Clipping
          "is_intentional": false // true if blur/darkness seems artistic
        },
        "composition": {
          "score": 7,             // General framing score
          "crop_issue": false,    // true if heads/limbs cut off awkwardly
          "distractions": false   // true if background is messy
        },
        "aesthetic": {
          "score": 8,             // "Wow" factor
          "commercial_appeal": 9  // Stock photo value
        }
      }
    `;

    const imagePart = await fileToGenerativePart(imageFile);

    console.log(`🤖 Sende Bild an ${MODEL_NAME} (Profi Mode)...`);
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("🤖 AI Roh-Antwort:", text);

    const jsonString = text.replace(/```json|```/g, "").trim();
    
    let parsedData = {};
    
    // Initialisierung der Return-Struktur
    let finalResult = {
        keywords: [],
        analysis: {},
        technical: null,
        composition: null,
        aesthetic: null
    };

    try {
        parsedData = JSON.parse(jsonString);
        
        // Mapping (Sicherstellen, dass wir Daten haben)
        finalResult.keywords = parsedData.keywords || [];
        finalResult.analysis = parsedData.analysis || {};
        finalResult.technical = parsedData.technical || { focus_score: 5, noise_score: 5, exposure_score: 5 };
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