from sqlalchemy.orm import Session
import bcrypt
from database import SessionLocal, engine
from models import Usuario, Base
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
import pandas as pd
import os
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import Optional, List
import filelock
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import asynccontextmanager

# 🚀 PROCESAMIENTO BIOMÉTRICO CON OPENCV + MEDIAPIPE (importación lazy)
import base64
import cv2
import numpy as np

# Inicialización de Firebase Admin (Sentinel Vision)
if not firebase_admin._apps:
    cred = credentials.Certificate("personasdashboard_firebase.json") 
    firebase_admin.initialize_app(cred)

from fastapi.responses import StreamingResponse
from vision_ia_camara import SeniorVisionSystem
import time

# --- CONFIGURACIÓN ---
DB_FILE = "registro_transito.xlsx"
COLUMNS = ["id_registro", "clase", "genero", "fecha", "hora", "lugar"]
lock = filelock.FileLock(DB_FILE + ".lock")

# Cargar el detector de rostros por defecto de OpenCV
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

# --- INSTANCIA GLOBAL DE LA CÁMARA (PROYECTO CAMARA TRAFICO) ---
vision_system = SeniorVisionSystem(camera_index=0, lugar="Cámara Principal")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO] API iniciada. La cámara permanece en espera para Face ID o Monitoreo con OpenCV.")
    yield
    if vision_system.is_camera_running:
        vision_system.stop_camera()

app = FastAPI(title="Sentinel Vision IA Traffic API", lifespan=lifespan)
security = HTTPBearer()
otp_storage = {}
Base.metadata.create_all(bind=engine)

class PasswordContext:
    def hash(self, password: str) -> str:
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')

    def verify(self, password: str, hashed_password: str) -> bool:
        try:
            password_bytes = password.encode('utf-8')
            hashed_password_bytes = hashed_password.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hashed_password_bytes)
        except Exception:
            return False

pwd_context = PasswordContext()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not os.path.exists(DB_FILE):
    pd.DataFrame(columns=COLUMNS).to_excel(DB_FILE, index=False)

# --- MODELOS / SCHEMAS PYDANTIC ---
class RegistroSchema(BaseModel):
    clase: str
    genero: Optional[str] = None
    lugar: str

class RegistroUsuario(BaseModel):
    nombre: Optional[str] = None 
    correo: str
    password: str

class LoginUsuario(BaseModel):
    correo: str
    password: str

class VerificarOTP(BaseModel):
    correo: str
    codigo: str

class GoogleOTPRequest(BaseModel):
    correo: str

class FaceIDSchema(BaseModel):
    correo: str
    image_base64: str

class CameraSourceSchema(BaseModel):
    source: str

class LocationUpdateSchema(BaseModel):
    lugar: str

class EmailReportSchema(BaseModel):
    email: str
    period_days: int = 7


# =======================================================
# 🚀 MATRIZ DE COMPARACIÓN BIOMÉTRICA
# =======================================================
def compute_face_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    if embedding1.shape != embedding2.shape:
        return 0.0
    embedding1 = embedding1.astype(np.float32) / 255.0
    embedding2 = embedding2.astype(np.float32) / 255.0
    mse = np.mean((embedding1 - embedding2) ** 2)
    similitud = max(0, 1 - (mse / 0.065))
    return float(similitud)


# =======================================================
# 🚀 ENDPOINT INICIO DE SESIÓN FACIAL (REAL Y COMPACTO)
# =======================================================
@app.post("/api/login-face")
async def login_face(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        correo = data.get("correo")
        imagen_b64 = data.get("image_base64")

        if not correo or not imagen_b64:
            raise HTTPException(status_code=400, detail="Faltan parámetros requeridos (correo o imagen).")

        usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado in database.")

        if not usuario.face_embedding:
            raise HTTPException(status_code=400, detail="El usuario no ha enrolado su rostro aún.")

        format, imgstr = imagen_b64.split(';base64,')
        image_bytes = base64.b64decode(imgstr)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen de la cámara.")

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

        if len(faces) == 0:
            raise HTTPException(status_code=400, detail="No se detectó rostro en la captura. Intenta de nuevo.")

        (x, y, w, h) = faces[0]
        rostro_capturado = gray[y:y+h, x:x+w]
        rostro_estandarizado = cv2.resize(rostro_capturado, (150, 150))
        embedding_bytes_actuales = rostro_estandarizado.tobytes()
        
        embedding_guardado = np.frombuffer(usuario.face_embedding, dtype=np.uint8).reshape((150, 150))
        embedding_actual = np.frombuffer(embedding_bytes_actuales, dtype=np.uint8).reshape((150, 150))
        
        similitud = compute_face_similarity(embedding_actual, embedding_guardado)
        
        UMBRAL_MINIMO = 0.45
        print(f"[FACE_AUTH]: {correo} | Similitud: {similitud:.2%} | Umbral: {UMBRAL_MINIMO:.2%}")
        
        if similitud < UMBRAL_MINIMO:
            raise HTTPException(status_code=401, detail="El rostro no coincide con las firmas registradas.")

        print(f"[FACE_SUCCESS]: Acceso concedido para {correo}")
        
        return {
            "status": "ok", 
            "message": "¡Firma biométrica validada con éxito! Acceso concedido.", 
            "nombre": usuario.nombre,
            "score_similitud": similitud
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[FACE_ERROR]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en autenticación facial: {str(e)}")


# =======================================================
# 🚀 ENDPOINTS CRUD PARA EL EXCEL (DASHBOARD TRÁFICO)
# =======================================================
@app.get("/api/registros")
async def obtener_registros():
    try:
        df = pd.read_excel(DB_FILE)
        df = df.fillna("")
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/registros")
async def crear_registro_ia(request: Request):
    try:
        data = await request.json()
        clase = data.get("clase", "PERSONA")
        genero = data.get("genero", "Desconocido")
        lugar = data.get("lugar", getattr(vision_system, 'lugar', 'CasaJYJ'))

        now = datetime.now()
        fecha_str = now.strftime("%Y-%m-%d")
        hora_str = now.strftime("%H:%M:%S")
        id_random = f"REG-{random.randint(100000, 999999)}"

        nuevo_row = {
            "id_registro": id_random,
            "clase": clase.lower(),
            "genero": genero,
            "fecha": fecha_str,
            "hora": hora_str,
            "lugar": lugar
        }

        with lock:
            if os.path.exists(DB_FILE):
                df = pd.read_excel(DB_FILE)
            else:
                df = pd.DataFrame(columns=COLUMNS)
            df = pd.concat([df, pd.DataFrame([nuevo_row])], ignore_index=True)
            df.to_excel(DB_FILE, index=False)

        print(f"💾 [EXCEL GUARDADO]: {clase.upper()} ({genero}) registrado con éxito desde {lugar}.")
        return {"status": "ok", "message": "Registro almacenado en Excel."}

    except Exception as e:
        print(f"[🚨 DATABASE_ERROR]: Falló la escritura en el Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/api/registros/recent")
async def obtener_registros_recientes(limit: int = 50):
    try:
        if not os.path.exists(DB_FILE):
            return []
        df = pd.read_excel(DB_FILE)
        df = df.fillna("")
        df_recent = df.tail(limit).iloc[::-1]
        return df_recent.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =======================================================
# 🚀 SISTEMA DE MONITOREO DE CÁMARAS (ENDPOINTS INTEGRADOS)
# =======================================================
@app.get("/api/camera/status")
def get_camera_status():
    return {
        "camera_running": bool(getattr(vision_system, 'is_camera_running', False)),
        "detection_running": bool(getattr(vision_system, 'is_detection_running', False))
    }

@app.get("/api/camera/stream")
async def video_feed():
    def generate_real_frames():
        while True:
            if not getattr(vision_system, 'is_camera_running', False):
                print("[HARDWARE]: Apagado detectado desde el Dashboard. Forzando liberación...")
                if hasattr(vision_system, 'stop_camera'):
                    try: vision_system.stop_camera()
                    except Exception: pass
                if hasattr(vision_system, 'cap') and vision_system.cap is not None:
                    try:
                        vision_system.cap.release()
                        vision_system.cap = None
                        print("[HARDWARE SUCCESS]: cv2.VideoCapture liberado. LED APAGADO TOTALMENTE.")
                    except Exception as e:
                        print(f"[HARDWARE ERROR]: No se pudo liberar el puntero físico: {str(e)}")
                break

            frame_raw = None
            if hasattr(vision_system, 'current_frame') and vision_system.current_frame is not None:
                frame_raw = vision_system.current_frame
            elif hasattr(vision_system, 'get_frame'):
                try: frame_raw = vision_system.get_frame()
                except Exception: pass

            if frame_raw is not None and frame_raw.size > 0:
                try:
                    frame_copy = frame_raw.copy()
                    _, buffer = cv2.imencode('.jpg', frame_copy)
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                except Exception:
                    pass
            else:
                img_loading = np.zeros((480, 640, 3), dtype=np.uint8) + 25
                cv2.putText(img_loading, "CONECTANDO CON FLUJO DE VIDEO...", (120, 240), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 229, 255), 1, cv2.LINE_AA)
                _, buffer = cv2.imencode('.jpg', img_loading)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.04)
    return StreamingResponse(generate_real_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.post("/api/camera/toggle")
def toggle_detection(payload: ToggleRequest = None):
    import cv2
    accion_solicitada = payload.action.lower() if payload and payload.action else None
    if not accion_solicitada:
        accion_solicitada = "stop" if getattr(vision_system, 'is_camera_running', False) else "start"

    fuente_actual = getattr(vision_system, 'source', '0')
    if isinstance(fuente_actual, str) and fuente_actual.isdigit():
        fuente_actual = int(fuente_actual)

    if accion_solicitada == "start":
        print(f"[API IA]: Ejecutando orden EXPLICITA de ENCENDIDO. Fuente: {fuente_actual}")
        if not hasattr(vision_system, 'cap') or vision_system.cap is None:
            try:
                vision_system.cap = cv2.VideoCapture(fuente_actual)
                vision_system.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
            except Exception as e:
                print(f"[🚨 HARDWARE_ERROR]: Error al instanciar VideoCapture: {str(e)}")
        vision_system.is_camera_running = True
        vision_system.is_detection_running = True
        if hasattr(vision_system, 'start_camera'):
            try: vision_system.start_camera()
            except Exception: pass
    else:
        print("[API IA]: Ejecutando orden EXPLICITA de APAGADO. Liberando hardware...")
        vision_system.is_detection_running = False
        vision_system.is_camera_running = False
        if hasattr(vision_system, 'stop_camera'):
            try: vision_system.stop_camera()
            except Exception: pass
        if hasattr(vision_system, 'cap') and vision_system.cap is not None:
            try:
                vision_system.cap.release()
                vision_system.cap = None
                print("[API IA SUCCESS]: VideoCapture destruido. LED APAGADO TOTALMENTE.")
            except Exception:
                pass

    return {"status": "ok", "camera_running": vision_system.is_camera_running, "detection_running": vision_system.is_detection_running}

@app.get("/api/camera/location")
def get_camera_location():
    return {"lugar": str(getattr(vision_system, 'lugar', 'Cámara Principal'))}

@app.post("/api/camera/location")
def update_camera_location(data: LocationUpdateSchema):
    vision_system.lugar = data.lugar
    return {"status": "ok", "lugar": vision_system.lugar}

@app.post("/api/camera/source")
def change_camera_source(data: CameraSourceSchema):
    try: new_source = int(data.source)
    except ValueError: new_source = data.source
    if hasattr(vision_system, 'stop_camera'): vision_system.stop_camera()
    vision_system.camera_index = new_source
    if hasattr(vision_system, 'start_camera'): vision_system.start_camera()
    return {"status": "ok", "source": str(new_source)}


# =======================================================
# 🚀 REGISTRO TRADICIONAL & SEGURIDAD MULTI-OTP (SMTP NATIVO REINCORPORADO)
# =======================================================
@app.post("/api/register")
def register(user: RegistroUsuario, db: Session = Depends(get_db)):
    usuario_existente = db.query(Usuario).filter(Usuario.correo == user.correo).first()
    if usuario_existente: 
        raise HTTPException(status_code=400, detail="El correo ya existe")
    nombre_final = user.nombre if user.nombre else user.correo.split('@')[0]
    password_hash = pwd_context.hash(user.password)
    nuevo_usuario = Usuario(nombre=nombre_final, correo=user.correo, password_hash=password_hash)
    db.add(nuevo_usuario)
    db.commit()
    return {"status": "ok", "message": "Usuario registrado correctamente"}

# 🚀 RESTAURADO: Login Tradicional por SMTP
@app.post("/api/login")
def login(user: LoginUsuario, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.correo == user.correo).first()
    if not usuario: 
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if not pwd_context.verify(user.password, usuario.password_hash): 
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        
    otp = str(random.randint(100000, 999999))
    otp_storage[user.correo] = otp

    print(f"\n🔑 [CONSOLA OTP NATIVA]: {user.correo} -> CODE: {otp}\n")

    # Sistema de Envío Directo usando las credenciales estables de tu versión vieja
    remitente = "dg102090@gmail.com"
    password = "uroa vqqe nsea vrci"
    
    mensaje_html = f"""
    <h2>Sentinel IA</h2>
    <p>Tu código de acceso es:</p>
    <h1 style="color:#7c3aed;">{otp}</h1>
    <p>Este código expira pronto.</p>
    """
    mensaje = MIMEMultipart()
    mensaje["From"] = remitente
    mensaje["To"] = user.correo
    mensaje["Subject"] = "Código OTP - Sentinel IA"
    mensaje.attach(MIMEText(mensaje_html, "html"))

    try:
        servidor = smtplib.SMTP("smtp.gmail.com", 587)
        servidor.starttls()
        servidor.login(remitente, password)
        servidor.sendmail(remitente, user.correo, mensaje.as_string())
        servidor.quit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando correo: {str(e)}")

    return {"message": "OTP enviado al correo"}

# 🚀 RESTAURADO: Enlace de Autenticación de Google para auth.service.ts
@app.post("/api/google-otp")
def enviar_google_otp(data: GoogleOTPRequest):
    otp = str(random.randint(100000, 999999))
    otp_storage[data.correo] = otp

    print(f"\n🌐 [GOOGLE OTP CONSOLA]: {data.correo} -> CODE: {otp}\n")

    remitente = "dg102090@gmail.com"
    password = "uroa vqqe nsea vrci"

    mensaje_html = f"""
    <h2>Sentinel IA</h2>
    <p>Has iniciado sesión con Google. Para completar el acceso y verificar tu identidad, ingresa el siguiente código:</p>
    <h1 style="color:#7c3aed;">{otp}</h1>
    <p>Este código expira pronto.</p>
    """
    mensaje = MIMEMultipart()
    mensaje["From"] = remitente
    mensaje["To"] = data.correo
    mensaje["Subject"] = "Código de verificación de Google - Sentinel IA"
    mensaje.attach(MIMEText(mensaje_html, "html"))

    try:
        servidor = smtplib.SMTP("smtp.gmail.com", 587)
        servidor.starttls()
        servidor.login(remitente, password)
        servidor.sendmail(remitente, data.correo, mensaje.as_string())
        servidor.quit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando correo: {str(e)}")

    return {"message": "OTP enviado al correo de Google"}

# 🚀 COMBINADO: Verificación con soporte de Bypass Maestro para exposiciones rápidas
@app.post("/api/verificar-otp")
def verificar_otp(data: VerificarOTP):
    # Bypass para evitar trabas en plena defensa del proyecto
    if data.codigo == "123456":
        if data.correo in otp_storage: 
            del otp_storage[data.correo]
        return {"message": "OTP correcto"}

    codigo_guardado = otp_storage.get(data.correo)
    if not codigo_guardado:
        raise HTTPException(status_code=404, detail="OTP no encontrado")
    if codigo_guardado != data.codigo:
        raise HTTPException(status_code=401, detail="Código incorrecto")

    del otp_storage[data.correo]
    return {"message": "OTP correcto"}


# =======================================================
# 🚀 INICIALIZACIÓN DE LA APLICACIÓN
# =======================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)