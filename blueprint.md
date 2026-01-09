# Lumina Ingest Test - Blueprint

## Overview

This is a simple web application for testing the Lumina asset ingestion pipeline. It allows a user to upload an image file (JPG or NEF) and view the processing logs. The application focuses purely on the core upload and processing functionality.

## Features

*   **Image Upload:** Users can directly upload an image file without needing to log in.
*   **EXIF Data Extraction:** The application extracts EXIF data from the uploaded image, specifically the camera model.
*   **Cloud Storage:** The image is uploaded to a general `uploads/` folder in Firebase Storage.
*   **Database Entry:** A record of the uploaded asset is created in Firestore, including the filename, storage URL, camera model, ISO, and upload timestamp.
*   **Real-time Logging:** The application displays a real-time log of the entire ingestion process.

## Current Task: Focus on Core Ingest Pipeline

1.  **Initial Problem:** The implementation of Firebase Authentication (both Email and Google) was blocking development due to complex and persistent configuration issues (`auth/configuration-not-found`, `400 Bad Request`).
2.  **Strategic Decision:** To accelerate progress, the user authentication feature has been **temporarily removed**.
3.  **Current State:** The application now boots directly into the file upload interface. The dependency on a user has been removed from the file storage path and the Firestore database record.
4.  **Next Steps:** Continue developing and testing the core asset ingestion functionality. Authentication can be re-integrated at a later stage once the core pipeline is stable and proven.