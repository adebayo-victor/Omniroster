import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadFaceDetectionModels } from './utils/faceDetection';

// Asynchronously load the lightweight TinyFaceDetector neural network weights on application startup
loadFaceDetectionModels().catch((err) => {
  console.warn('Face detection startup initialization notice:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
