# Lumina CoreBrain Ingest - Blueprint v0.3 (AI Powered)

## Overview
This is the **AI-integrated MVP** for the Lumina ingestion pipeline. It features a fully automated "Hybrid Ingest" workflow:
1.  **Hard Facts:** Extracts technical metadata (EXIF) directly from RAW files.
2.  **Soft Skills:** Uses **Gemini 2.5 Flash** to visually analyze the image content.
3.  **Synthesis:** Merges both into a professional, Adobe-compliant XMP sidecar file including automated keywords.

## Core Features (Live)

* **Hybrid Asset Bundle:** Processes Master (`.NEF`) + Proxy (`.jpg`) + Smart Sidecar (`.xmp`) as one unit.
* **Gemini Vision Integration:**
    * Model: `gemini-2.5-flash` (via Google AI Studio).
    * Task: Semantic image analysis for stock photography.
    * Output: 10-15 precise, English-only keywords (e.g., "Mallard", "Iridescent", "Motion").
* **Smart XMP Generation:**
    * **Deep Metadata:** Writes Exposure, ISO, White Balance, Metering Mode.
    * **Lens Intelligence:** Calculates lens data (e.g., "300 mm f/5.7") even if specific MakerNotes are missing.
    * **Compatibility:** Includes `tiff:Orientation` and `exif:ColorSpace` for correct rendering in Lightroom.
    * **Taxonomy:** Writes AI keywords into standard Dublin Core (`dc:subject`) containers.
* **Real-time UI:**
    * Visual "Status Monitor" displaying live EXIF data.
    * Green "AI Tags" visualization immediately after analysis.

## Technical Architecture

* **Service Layer:**
    * `CoreBrain.js`: Orchestrator. Manages file pairing, EXIF extraction (`exifreader`), and Firestore syncing.
    * `geminiService.js`: Intelligence. Handles Base64 conversion, API communication, and JSON parsing/validation.
* **AI Strategy:** Uses the "Analyst" approach (Gemini Flash) to generate structured JSON data, which is then safely injected into XMP by the application logic.
* **Data Model:** Firestore stores a clean separation of `{ exif: ..., ai: { keywords: [...] } }`.

## Development Log

### Phase 1 & 2: Foundation (Completed)
* Established RAW/JPG pairing and basic EXIF extraction.
* Implemented "Deep Metadata" extraction (Focus Distance, DateTime, Exposure Mode).

### Phase 3: Intelligence Layer (Completed - Current)
* **Model Selection:** Evaluated `gemini-2.5-flash-image` vs. `gemini-2.5-flash`. Chose standard **Flash** to avoid "Nano Banana" generation quotas and focus on pure analysis.
* **Language Strategy:** Switched from mixed-language to **English Only** to prevent keyword duplication and ensure international stock compatibility.
* **Robustness:** Implemented fallback logic for XMP generation (handling `undefined` values for FocusDistance/Date) to prevent pipeline crashes.
* **Result:** Successfully generated XMP files with rich semantic tagging (e.g., "Iridescent", "Green Head").

## Next Steps: Asset Management (Phase 4)

* **Goal:** Move from "Ingest" to "Library".
* **Action:** Create a Gallery View to browse uploaded assets.
* **Features:** Filter by AI Keywords (e.g., show all "Ducks"), Sort by Date, View technical details.