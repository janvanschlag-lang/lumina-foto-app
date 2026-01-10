# Lumina CoreBrain Ingest - Blueprint v0.2.1

## Overview
This is the operational MVP for the **Lumina CoreBrain** ingestion pipeline. It implements a professional "Asset Bundle" workflow, treating RAW files (Masters) and JPGs (Proxies) as logical units. The application reads authentic EXIF data directly from the RAW binary in the browser and synchronizes the complete asset bundle (Master + Proxy + XMP Sidecar) to the cloud.

## Core Features (Live)

* **Asset Bundle Ingest:** Automatically detects, matches, and processes pairs of Master (`.NEF`) and Proxy (`.jpg`) files.
* **True RAW Intelligence:** Uses `ExifReader` to extract authentic metadata (ISO, Aperture, Shutter, Lens) directly from the NEF binary, not the sidecar.
* **Simulated Extraction Workflow:** Bypasses browser RAW rendering limitations by using the provided JPG as a "Smart Proxy" for instant visual feedback.
* **XMP Sidecar Generation:** Automatically creates Adobe-standard `.xmp` files containing the extracted technical metadata.
* **Darkroom UI:**
    * **Left Panel:** Ingest controls and real-time system protocol.
    * **Center Stage:** Distortion-free image viewer with intelligent "letterboxing" for high-res assets.
    * **Right Panel:** Dual-mode Status Monitor showing pipeline state and live EXIF readouts.

## Technical Architecture

* **Logic Engine:** `CoreBrain.js` (Headless Service)
    * Orchestrates file pairing.
    * Extracts EXIF.
    * Generates XMP strings.
    * Manages parallel uploads to Firebase Storage (`assets/{filename}/...`).
* **Frontend:** SolidJS
    * Uses Signals for reactive state management.
    * Implements a 3-column CSS Grid layout with absolute positioning for robust image scaling.
* **Data Model:** Firestore `assets` collection stores references to rawUrl, previewUrl, xmpUrl, and structured `exif` data.

## Development Log

### Phase 1: Foundation (Completed)
* Auth removal for rapid prototyping.
* Firebase Storage CORS & Bucket configuration fixed.

### Phase 2: CoreBrain Pipeline (Completed)
* **Strategic Shift:** Moved from single-file ingest to Asset Bundles.
* **Round-Trip Readiness:** Implemented XMP generation to ensure compatibility with professional tools (Lightroom).
* **Visualization:** Implemented a robust "Status Monitor" that displays real technical readouts (e.g., "Nikon D610, 300mm, f/5.6") to verify data integrity before upload.
* **Layout Fix:** Solved CSS Grid/Flexbox overflow issues using a `position: absolute` strategy for the center stage.

## Next Steps: Intelligence Layer (Phase 3)

* **Goal:** Activate the AI analysis.
* **Action:** Integrate `geminiService.js`.
* **Workflow:**
    1.  Pass the *Proxy JPG* to Gemini 1.5 Flash.
    2.  Prompt: "Analyze lighting and composition. Provide a technical score (0-100) and a short recommendation."
    3.  Inject the Score/Recommendation into the `.xmp` sidecar (Rating/UserComment).
    4.  Visualize the Score in the UI Status Monitor.