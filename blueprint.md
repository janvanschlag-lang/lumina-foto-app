# Lumina CoreBrain Ingest - Blueprint v0.4 (AI Vision & Deep XMP)

**Date:** 2026-01-10
**Status:** Phase 3 Completed (Intelligence Layer Active)
**Model:** Gemini 2.5 Flash (Stable)

## 1. Overview
Lumina CoreBrain is now a **Hybrid Intelligent Ingest System**. It moves beyond simple file copying by acting as an automated "Computer Vision Analyst". It pairs RAW files with JPG proxies, extracts deep technical data, and uses Google's Gemini 2.5 Flash model to "see" and describe image content, writing the results into professional, Lightroom-compliant XMP sidecars.

## 2. Core Features (Live)

### A. Intelligent Analysis (Gemini 2.5 Flash)
* **Role:** "High-precision Computer Vision System" (Prompt Engineering).
* **Capabilities:**
    * **Semantic Keywords:** Generates 10-15 English-only keywords (e.g., "Mallard", "Iridescent", "Motion").
    * **Visual Analysis:** Structured assessment of Subject, Lighting, Composition, and Technical Quality.
    * **Deduplication:** Strict "English Only" policy to prevent multi-language tag clutter.
* **Model Strategy:** Uses `gemini-2.5-flash` (Multimodal Analyst) instead of `-image` variants to avoid generative quotas and focus on factual description.

### B. Smart XMP Generation (The "Golden File")
The system generates complex XMP sidecars (`.xmp`) that map AI and EXIF data to standard Adobe/IPTC fields:
* **`dc:subject` (Keywords):** AI Keywords stored in an `rdf:Bag` container.
* **`dc:description` (Caption):** Auto-generated caption from the AI's subject analysis.
* **`xmp:UserComment` (Vision Report):** A structured text block containing the full AI analysis (Lighting, Composition, Tech Check).
* **`aux:Lens`:** Intelligent formatting of lens data (e.g., "300 mm f/5.7").
* **`tiff:Orientation` & `exif:ColorSpace`:** Critical tags for correct image rendering in external DAMs.

### C. Real-time UI
* **Status Monitor:** Displays live EXIF data (ISO, Shutter, Aperture).
* **AI Visualization:** Shows the Top 3 AI-detected keywords immediately after processing.
* **Logs:** Detailed protocol of the ingest pipeline (EXIF read -> AI Analysis -> XMP Write).

## 3. Technical Architecture

* **`CoreBrain.js` (Orchestrator):**
    * Manages the file triplet: RAW + Preview + XMP.
    * Handles data fusion: Merges `exifReader` results with `geminiService` JSON.
    * **Safety:** Implements robust fallback logic (e.g., converting `undefined` focus distances to `null`) to prevent Firestore crashes.
* **`geminiService.js` (Brain):**
    * **Input:** Base64 encoded JPG proxy.
    * **Prompting:** Enforces strict JSON output (`{ keywords: [], analysis: {} }`) to ensure machine-readability.
    * **Resilience:** Handles JSON parsing errors and API fallbacks gracefully.
* **Data Model (Firestore):**
    * Collection: `assets`
    * Structure:
        ```json
        {
          "filename": "_DSC4667.NEF",
          "exif": { ...technical_data... },
          "ai": {
            "keywords": ["Mallard", "Water", ...],
            "analysis": {
              "subject": "...",
              "lighting": "...",
              "technical": "..."
            }
          },
          "urls": { ... }
        }
        ```

## 4. Development Log

* **Phase 1: Foundation (Done)** - Basic RAW/JPG pairing and upload.
* **Phase 2: Deep Metadata (Done)** - Extraction of Nikon specific tags (FocusDistance, Metering).
* **Phase 3: Intelligence Layer (COMPLETED)**
    * Migrated to **Gemini 2.5 Flash** (Stable).
    * Implemented "Computer Vision" prompt for factual analysis.
    * Solved `429 Quota Exceeded` issues by selecting the correct model alias.
    * Successfully wrote rich XMP with Description and UserComments.
    * Validated Lightroom compatibility (Subject, Orientation, Lens).

## 5. Next Steps: Phase 4 (The Library)

* **Goal:** Visualize the ingested data.
* **Task:** Build a **Gallery View**.
* **Features:**
    * Grid layout of uploaded assets.
    * Filter functionality (e.g., "Show me all 'Ducks'").