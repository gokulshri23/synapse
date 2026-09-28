# Face-API.js Model Weights

This directory should contain the TinyFaceDetector model weights for face-api.js.

## Setup Instructions

Download the model files from the face-api.js GitHub repository:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Required files:
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

Place them in this directory (`public/models/`).

## Fallback Behavior

If these model files are not present, the ProctoredQuiz component will gracefully
fall back to the existing server-side proctoring via `/api/proctor-vision`.
The face detection features (no-face detection, multiple-face detection) will
simply be disabled without affecting quiz functionality.
