import { GoogleGenerativeAI } from "@google/generative-ai";

// FIX: Wir nutzen den stabilen Alias, NICHT das Preview-Image Modell.
// Das normale Flash Modell ist bereits multimodal (kann Bilder sehen).
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
 */
export const analyzeImageWithPro = async (imageFile) => {
  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
      Analysiere dieses Bild professionell für eine Stock-Foto-Agentur.
      
      Aufgabe:
      1. Erstelle eine Liste von 5 bis 10 präzisen, beschreibenden Keywords.
      2. Mische deutsche und englische Begriffe.
      3. Achte auf: Hauptmotiv, Lichtstimmung, Technik, Emotion.
      
      WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON Array aus Strings.
      Kein Markdown. Beispiel: ["Ente", "Duck", "Wildlife", "Wasser"]
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
    // Hier fangen wir den Quota Fehler ab und zeigen ihn lesbar an
    console.error("AI Analyse fehlgeschlagen:", error);
    return { keywords: [], error: error.message };
  }
};