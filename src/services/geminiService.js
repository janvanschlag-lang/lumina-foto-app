import { GoogleGenerativeAI } from "@google/generative-ai";

// Wir nutzen den stabilen Alias für Gemini 2.5 Flash
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
 * Hauptfunktion: Analysiert das Bild mit Gemini Vision
 * @param {File} imageFile - Das JPG Proxy Bild
 * @returns {Promise<{keywords: string[], analysis: object, raw: string}>}
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // DER NEUE PROMPT: COMPUTER VISION SYSTEM (Neutral & Faktisch)
    // Wir fordern jetzt ein komplexes JSON Objekt an, nicht nur eine Liste.
    const prompt = `
      You are a high-precision Computer Vision System for a stock photography database.
      Analyze the input image based on strictly visible visual data. Do not hallucinate details.
      
      Task:
      1. KEYWORDS: Generate 10-15 English keywords (Subjects, Action, Mood, Tech).
      2. VISUAL ANALYSIS: Provide a structured assessment of the image quality and content.
      
      Response Format:
      Return ONLY a valid JSON object with this exact structure:
      {
        "keywords": ["Keyword1", "Keyword2", ...],
        "analysis": {
          "subject": "Description of the main subject and its sharpness (e.g. 'Mallard duck in focus, side profile')",
          "lighting": "Description of lighting conditions (e.g. 'Soft diffuse daylight, no harsh shadows')",
          "composition": "Description of framing and background (e.g. 'Subject centered, bokeh background')",
          "technical": "Note on technical quality (e.g. 'High noise visible' or 'Clean and sharp')"
        }
      }
    `;

    const imagePart = await fileToGenerativePart(imageFile);

    console.log(`🤖 Sende Bild an ${MODEL_NAME} (Vision Mode)...`);
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("🤖 AI Roh-Antwort:", text);

    // Cleanup JSON
    const jsonString = text.replace(/```json|```/g, "").trim();
    
    let parsedData = {};
    let keywords = [];
    let analysis = {};

    try {
        parsedData = JSON.parse(jsonString);
        
        // INTELLIGENTES PARSING (Abwärtskompatibel)
        if (Array.isArray(parsedData)) {
            // Fallback: AI hat nur Liste geschickt (altes Verhalten)
            keywords = parsedData;
            analysis = { subject: "Not provided" };
        } else {
            // Neues Verhalten: Objekt mit keywords + analysis
            keywords = parsedData.keywords || [];
            analysis = parsedData.analysis || {};
        }

    } catch (e) {
        console.error("JSON Parse Fehler:", e);
        keywords = []; 
        analysis = { error: "Parsing Failed" };
    }

    return { 
      keywords: Array.isArray(keywords) ? keywords : [],
      analysis: analysis,
      raw: text 
    };

  } catch (error) {
    console.error("AI Analyse fehlgeschlagen:", error);
    return { keywords: [], analysis: {}, error: error.message };
  }
};