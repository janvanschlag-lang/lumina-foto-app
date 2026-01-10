# Lumina CoreBrain Ingest - Blueprint v0.2

## Overview
This is the MVP (Minimum Viable Product) for the **Lumina CoreBrain** ingestion pipeline. It shifts from a simple file uploader to a professional "Asset Bundle" workflow. The application simulates a raw-converter environment by ingesting RAW files (NEF) alongside pre-generated proxies (JPG) to verify the data architecture without heavy browser-side processing.

## Core Features (v0.2)

* **Asset Bundle Ingest:** Recognizes and pairs Master files (`.NEF`) with Proxy files (`.jpg`) automatically.
* **Simulated RAW Extraction:** Uses the uploaded JPG as a "Smart Proxy" for the UI to bypass browser RAW rendering limitations.
* **XMP Sidecar Generation:** Automatically generates Adobe-compatible `.xmp` sidecar files containing EXIF data and (placeholder) ratings.
* **Structured Cloud Storage:** Assets are stored in organized subfolders (`assets/{filename}/{files...}`) containing the Master, Proxy, and Sidecar.
* **Professional UI:** A responsive 3-column layout (Sidebar/Stage/Info) optimized for image viewing without layout shifts.

## Technical Architecture

* **Logic Engine:** `CoreBrain.js` - A headless service that orchestrates file matching, XMP generation, and parallel cloud uploads.
* **Frontend:** SolidJS with CSS Grid & Flexbox.
* **Layout Strategy:** Fixed sidebars with a flexible center stage using absolute positioning to handle high-resolution image aspect ratios correctly.

## Development Log

### Phase 1: Foundation (Completed)
* **Auth Removal:** Removed blocking authentication to focus on data flow.
* **CORS & Config:** Fixed Firebase Storage bucket configuration and CORS policies.

### Phase 2: CoreBrain Pipeline (Completed - Current)
* **Strategic Shift:** Moved from single-file ingest to **Asset Bundles**.
* **Data Integrity:** Implemented a workflow where the NEF (Master) remains untouched, while a JPG serves as the visual proxy.
* **Round-Trip Readiness:** Implemented `XmpService` to generate standard XML sidecars, ensuring compatibility with Lightroom/Capture One.
* **UI Overhaul:** Replaced the debug console with a "Darkroom" style interface:
    * **Left:** Ingest controls & real-time System Protocol.
    * **Center:** Responsive Image Stage (fixed CSS overflow issues via absolute positioning).
    * **Right:** Status Monitor & Asset Metadata.

## Next Steps: Intelligence Layer

* **Goal:** Activate the "Brain" in CoreBrain.
* **Action:** Re-integrate the **Gemini AI Service**.
* **Workflow:**
    1.  Send the *Proxy JPG* (not the RAW) to Gemini.
    2.  Receive Technical Score (0-100) and Recommendation.
    3.  Inject these values into the `.xmp` file before upload.
    4.  Visualize the Score in the UI.