# 📷 Sistema de Cámaras con IA - Proyecto DataScience

Sistema de monitoreo de personas con detección de género en tiempo real usando IA, con dashboard web en Angular y backend en Python.

## 📁 Estructura del Proyecto

```
├── backend_api_camara.py     # API REST con FastAPI (Python)
├── vision_ia_camara.py       # Módulo de visión por computadora (IA)
├── gender_deploy.prototxt    # Arquitectura del modelo de género (Caffe)
├── gender_net.caffemodel     # Pesos del modelo de género (no incluido en Git)
├── yolov8n.pt                # Modelo YOLOv8 para detección (no incluido en Git)
└── frontend_personas/        # Aplicación Angular (frontend)
```

## 🚀 Cómo ejecutar

### Backend (Python)
```bash
pip install fastapi uvicorn opencv-python ultralytics openpyxl firebase-admin
python backend_api_camara.py
```
> Servidor disponible en: `http://localhost:8000`

### Frontend (Angular)
```bash
cd frontend_personas
npm install
ng serve
```
> App disponible en: `http://localhost:4200`

## 🧠 Tecnologías

| Capa | Tecnología |
|------|------------|
| Frontend | Angular 21, Firebase Auth |
| Backend | Python, FastAPI, Uvicorn |
| IA Detección | YOLOv8 (Ultralytics) |
| IA Género | Modelo Caffe (OpenCV DNN) |
| Base de datos | Firebase Firestore |
| Autenticación | Firebase Auth (Email + Google) |

## ⚠️ Notas

- Los modelos `.caffemodel` y `.pt` no están incluidos por su tamaño. Contáctanos para obtenerlos.
- Configura tus credenciales de Firebase en `src/environments/environment.ts`.
