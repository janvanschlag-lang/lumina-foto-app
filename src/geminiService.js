import { GoogleGenAI, Type } from "@google/genai";

// 1. SICHERHEIT: Schlüssel aus der Umgebungsvariable laden
// Wichtig: In deiner .env Datei muss stehen: VITE_GEMINI_API_KEY=...
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("KRITISCHER FEHLER: API Key fehlt! Bitte .env Datei prüfen.");
}

// 2. INITIALISIERUNG
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// Hilfsfunktion: Bild in Base64 umwandeln
async function fileToInlineData(fileUrl) {
    try {
        if (fileUrl.startsWith('data:')) {
            const [meta, base64Data] = fileUrl.split(',');
            const mimeType = meta.split(';')[0].split(':')[1];
            return {
                inlineData: { data: base64Data, mimeType }
            };
        }
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = String(reader.result).split(',')[1];
                resolve({
                    inlineData: { data: base64Data, mimeType: blob.type }
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Fehler bei der Bildumwandlung:", error);
        throw new Error("Bild konnte nicht verarbeitet werden.");
    }
}

// --- FUNKTION 1: PRO ANALYSE (Katalog) ---
export const analyzeImageWithPro = async (imageUrl) => {
  try {
    const imagePart = await fileToInlineData(imageUrl);
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash', // Wir nutzen Flash für Speed im Katalog
        contents: {
            parts: [
                { text: "Analysiere dieses Foto. Gib eine ultrakurze Empfehlung (max 10 Wörter) zur Verbesserung von Licht oder Komposition auf Deutsch." },
                imagePart
            ]
        },
    });
    return response.text();
  } catch (error) {
    console.error("Gemini Fehler:", error);
    return "Analyse wartet...";
  }
};

// --- FUNKTION 2: EDITING (NanoBanana) ---
export const editImageWithPrompt = async (imageUrl, prompt) => {
  // Hinweis: Image Editing via API ist komplex. 
  // Für den MVP simulieren wir hier oft oder nutzen Prompt-to-Parameter.
  // Hier ist der Platzhalter für die echte Implementierung.
  console.log("Editing angefordert:", prompt);
  return imageUrl; // Gibt vorerst das Original zurück, damit nichts abstürzt
};

// --- FUNKTION 3: VISUAL CULLING (Ampel-System) ---
export const analyzeVisualCulling = async (imageUrl, exif) => {
    try {
        const imagePart = await fileToInlineData(imageUrl);
        const exifText = exif ? `EXIF: ${exif.model}, ISO ${exif.iso}, ${exif.fNumber}` : "Keine EXIF Daten";
        
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: {
                parts: [
                    { text: "Bewerte die technische Qualität (0-100). Sei streng. Gib JSON zurück: {score: number, reason: string}." },
                    imagePart,
                    { text: exifText }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });
        
        return response.data; // Das SDK parst JSON oft automatisch bei responseMimeType
    } catch (error) {
        // Fallback, damit die App nicht crasht
        return { score: 0, reason: "KI-Dienst nicht erreichbar" };
    }
};