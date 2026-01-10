import { GoogleGenerativeAI } from "@google/generative-ai";

// Standard: Gemini 2.5 Flash (Schnell & Multimodal)
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
 * Hauptfunktion: Analysiert das Bild mit Gemini Vision (Curator Mode)
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // DER CURATOR PROMPT
    // Wir fordern: Keywords + Analyse + SCORING (Harte Zahlen)
    const prompt = `
      You are a strict AI Photo Editor & Curator (TÜV-Prüfer style).
      Analyze the input image based on strictly visible visual data.
      
      Task:
      1. KEYWORDS: Generate 10-15 English keywords (Stock photography standard).
      2. VISUAL ANALYSIS: Brief structured assessment (Subject, Light, Composition).
      3. SCORING: Rate the image strictly (0-10 integers) on technical standards.
         - focus: Sharpness of the main subject (10=Perfect eye sharpness, 1=Blurry).
         - exposure: Histogram balance (10=Perfect dynamic range, 1=Heavy clipping).
         - composition: Framing & Aesthetics (10=Masterpiece, 1=Poor/Cropped).
      
      Response Format (JSON ONLY):
      {
        "keywords": ["Mallard", "Duck", ...],
        "analysis": {
          "subject": "...",
          "lighting": "...",
          "composition": "...",
          "technical": "..."
        },
        "scores": {
          "focus": 8,
          "exposure": 9,
          "composition": 7
        }
      }
    `;

    const imagePart = await fileToGenerativePart(imageFile);

    console.log(`🤖 Sende Bild an ${MODEL_NAME} (Curator Mode)...`);
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("🤖 AI Roh-Antwort:", text);

    const jsonString = text.replace(/```json|```/g, "").trim();
    
    let parsedData = {};
    let keywords = [];
    let analysis = {};
    let scores = null;

    try {
        parsedData = JSON.parse(jsonString);
        
        // Robustes Parsing
        if (Array.isArray(parsedData)) {
            keywords = parsedData; // Fallback
        } else {
            keywords = parsedData.keywords || [];
            analysis = parsedData.analysis || {};
            scores = parsedData.scores || null; // NEU: Die Scores abgreifen
        }

    } catch (e) {
        console.error("JSON Parse Fehler:", e);
        keywords = []; 
        analysis = { error: "Parsing Failed" };
    }

    return { 
      keywords,
      analysis,
      scores, // Das geben wir jetzt zurück!
      raw: text 
    };

  } catch (error) {
    console.error("AI Analyse fehlgeschlagen:", error);
    return { keywords: [], analysis: {}, scores: null, error: error.message };
  }
};