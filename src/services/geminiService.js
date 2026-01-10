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
 * @returns {Promise<{keywords: string[], raw: string}>}
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // DER NEUE PROMPT: STRICTLY ENGLISH
    const prompt = `
      Analyze this image professionally for a stock photography agency.
      
      Task:
      1. Generate a list of 10-15 precise, descriptive keywords.
      2. LANGUAGE: ENGLISH ONLY. No other languages.
      3. Focus on: 
         - Main Subject (e.g., "Mallard", "Duck")
         - Action/State (e.g., "Flying", "Swimming")
         - Environment (e.g., "Lake", "Outdoors")
         - Technical/Visuals (e.g., "Bokeh", "Telephoto", "Sharp focus")
         - Concepts/Mood (e.g., "Freedom", "Wildlife", "Nature")
      
      IMPORTANT: Respond ONLY with a valid JSON Array of Strings.
      No Markdown, no explanations.
      Example Output: ["Mallard", "Duck", "Water", "Flight", "Wildlife", "Nature", "Green", "Motion"]
    `;

    const imagePart = await fileToGenerativePart(imageFile);

    console.log(`🤖 Sende Bild an ${MODEL_NAME}...`);
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("🤖 AI Roh-Antwort:", text);

    const jsonString = text.replace(/```json|```/g, "").trim();
    
    let keywords = [];
    try {
        keywords = JSON.parse(jsonString);
    } catch (e) {
        console.error("JSON Parse Fehler:", e);
        keywords = [text]; 
    }

    return { 
      keywords: Array.isArray(keywords) ? keywords : [],
      raw: text 
    };

  } catch (error) {
    console.error("AI Analyse fehlgeschlagen:", error);
    return { keywords: [], error: error.message };
  }
};