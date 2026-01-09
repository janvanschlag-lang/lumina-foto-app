# Lumina Ingest Test - Blueprint

## Overview

This is a simple web application for testing the Lumina asset ingestion pipeline. It allows a user to upload an image file (JPG or NEF) and view the processing logs. The application focuses purely on the core upload and processing functionality.

## Features

*   **Image Upload:** Users can directly upload an image file (JPG, NEF, etc.) without needing to log in.
*   **Visual Upload Progress:** A progress bar and percentage display provide real-time feedback during file uploads.
*   **EXIF Data Extraction:** The application extracts EXIF data from the uploaded image, specifically the camera model.
*   **Cloud Storage:** The image is uploaded to a general `uploads/` folder in Firebase Storage.
*   **Database Entry:** A record of the uploaded asset is created in Firestore, including the filename, storage URL, camera model, ISO, and upload timestamp.
*   **Real-time Logging:** The application displays a real-time log of the entire ingestion process.

## Development Log

### Task: Focus on Core Ingest Pipeline (Completed)

1.  **Initial Problem:** The implementation of Firebase Authentication was blocking development due to complex configuration issues.
2.  **Strategic Decision:** Authentication was temporarily removed to focus on the core ingest pipeline.
3.  **Roadblock:** File uploads failed silently due to two issues:
    *   **CORS Policy:** Firebase Storage was blocking requests from the web preview's origin. This was resolved by setting a CORS policy on the Storage Bucket using `gsutil`.
    *   **Incorrect Bucket Name:** The client-side Firebase configuration (`firebase.js`) was pointing to an incorrect `storageBucket` URL (`...appspot.com` instead of `...firebasestorage.app`).
4.  **Resolution:** Both the server-side CORS policy and the client-side configuration were corrected, enabling successful uploads.
5.  **New Feature:** An upload progress bar was added to provide visual feedback for large files.
6.  **Outcome:** The core ingestion pipeline for both JPG and RAW (NEF) files is now fully functional and robust.

## Current Task: AI-Powered Image Analysis

*   **Next Step:** Integrate Gemini AI to perform an automated analysis of the uploaded image.
*   **Goal:** After a successful upload, trigger an AI function (`analyzeImageWithPro`) that provides a brief, actionable recommendation for improving the photo's light or composition.
*   **Implementation:** The result of the analysis will be displayed in the system log.