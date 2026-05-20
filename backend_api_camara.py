from sqlalchemy.orm import Session
import bcrypt
from database import SessionLocal, engine
from models import Usuario, Base
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
import pandas as pd
import os
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List
from fastapi import FastAPI, HTTPException
import filelock
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Inicialización de Firebase Admin
# Reemplaza el nombre del archivo por el que descargaste
cred = credentials.Certificate("personasdashboard_firebase.json") 
firebase_admin.initialize_app(cred)

from fastapi.responses import StreamingResponse
from vision_ia_camara import SeniorVisionSystem
import time
import cv2

app = FastAPI()
security = HTTPBearer()
# --- CONFIGURACIÓN ---
DB_FILE = "registro_transito.xlsx"
COLUMNS = ["id_registro", "clase", "genero", "fecha", "hora", "lugar"]
lock = filelock.FileLock(DB_FILE + ".lock")

app = FastAPI(title="Senior IA Traffic API")
# OTP temporales
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
            hashed_bytes = hashed_password.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception:
            return False

pwd_context = PasswordContext()

# Conexion DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite peticiones desde Angular (localhost:4200)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Excel
if not os.path.exists(DB_FILE):
    pd.DataFrame(columns=COLUMNS).to_excel(DB_FILE, index=False)

# --- MODELOS ---
class RegistroSchema(BaseModel):
    clase: str # persona o animal
    genero: Optional[str] = None
    lugar: str
class RegistroUsuario(BaseModel):
    nombre: str
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

# --- SISTEMA DE VISION GLOBAL (una sola cámara activa) ---
vision_system = SeniorVisionSystem(camera_index=0, lugar="Cámara Principal")
vision_system.start_camera()

# --- VIDEO STREAM ---
def generate_video():
    import numpy as np
    blank = np.zeros((10, 10, 3), dtype=np.uint8)
    _, blank_jpeg = cv2.imencode('.jpg', blank)
    blank_bytes = blank_jpeg.tobytes()
    while True:
        frame = vision_system.get_frame()
        if frame is None:
            time.sleep(0.1)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + blank_bytes + b'\r\n')
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.get("/api/camera/stream")
async def video_feed():
    return StreamingResponse(generate_video(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/camera/status")
async def get_camera_status():
    return {
        "camera_running": vision_system.is_camera_running,
        "detection_running": vision_system.is_detection_running
    }

@app.post("/api/camera/toggle")
async def toggle_detection():
    vision_system.is_detection_running = not vision_system.is_detection_running
    return {
        "status": "ok",
        "camera_running": vision_system.is_camera_running,
        "detection_running": vision_system.is_detection_running
    }

class CameraSourceSchema(BaseModel):
    source: str  # "0" para PC, o URL completa para DroidCam

@app.post("/api/camera/source")
async def change_camera_source(data: CameraSourceSchema):
    try:
        new_source = int(data.source)
    except ValueError:
        new_source = data.source
    vision_system.stop_camera()
    vision_system.camera_index = new_source
    vision_system.start_camera()
    return {"status": "ok", "source": str(new_source)}

class LocationUpdateSchema(BaseModel):
    lugar: str

@app.get("/api/camera/location")
async def get_camera_location():
    return {"lugar": vision_system.lugar}

@app.post("/api/camera/location")
async def update_camera_location(data: LocationUpdateSchema):
    vision_system.lugar = data.lugar
    return {"status": "ok", "lugar": vision_system.lugar}


async def get_current_user(res: HTTPAuthorizationCredentials = Depends(security)):
    token = res.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=401, 
            detail=f"Token inválido o expirado: {str(e)}"
        )
# --- ENDPOINTS CRUD ---

@app.post("/api/registros")
async def crear_registro(data: RegistroSchema):
    """Registra una detección en el Excel."""
    try:
        with lock.acquire(timeout=10):
            df = pd.read_excel(DB_FILE)
            now = datetime.now()
            nuevo = {
                "id_registro": f"ID-{now.strftime('%M%S%f')[:-3]}",
                "clase": data.clase,
                "genero": data.genero or "N/A",
                "fecha": now.strftime("%Y-%m-%d"),
                "hora": now.strftime("%H:%M:%S"),
                "lugar": data.lugar
            }
            df = pd.concat([df, pd.DataFrame([nuevo])], ignore_index=True)
            df.to_excel(DB_FILE, index=False)
            return nuevo
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# @app.get("/api/registros")
# async def obtener_registros(user: dict = Depends(get_current_user)):
#     # Ahora esta ruta está PROTEGIDA
#     try:
#         df = pd.read_excel(DB_FILE)
#         return df.to_dict(orient="records")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/registros")
async def obtener_registros():
    # Ruta temporal SIN PROTECCIÓN para pruebas del dashboard
    try:
        df = pd.read_excel(DB_FILE)
        # Reemplazar valores NaN por cadenas vacías
        df = df.fillna("")
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/registros/recent")
async def obtener_registros_recientes(limit: int = 50):
    try:
        if not os.path.exists(DB_FILE):
            return []
        df = pd.read_excel(DB_FILE)
        df = df.fillna("")
        df_recent = df.tail(limit).iloc[::-1] # Obtener los últimos N y revertir (más reciente primero)
        return df_recent.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# @app.delete("/api/registros/{id_registro}")
# async def eliminar_registro(id_registro: str, user: dict = Depends(get_current_user)):
#     # Solo un administrador logueado en Angular puede borrar
#     # ... tu lógica de eliminación aquí ...
#     return {"message": "Registro eliminado"}

@app.delete("/api/registros/{id_registro}")
async def eliminar_registro(id_registro: str):
    # Ruta temporal SIN PROTECCIÓN
    return {"message": "Registro eliminado"}

import smtplib
from email.message import EmailMessage
from datetime import timedelta
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER

class EmailReportSchema(BaseModel):
    email: str
    period_days: int

@app.post("/api/reports/email")
async def send_report_email(data: EmailReportSchema):
    try:
        if not os.path.exists(DB_FILE):
            raise HTTPException(status_code=404, detail="No hay datos registrados aún.")
            
        df = pd.read_excel(DB_FILE)
        df = df.fillna("")
        df['fecha'] = pd.to_datetime(df['fecha'])
        
        # Filtrar por fecha
        now_date = datetime.now()
        start_date = now_date - timedelta(days=data.period_days)
        df_filtered = df[df['fecha'] >= start_date].copy()
        
        if df_filtered.empty:
            raise HTTPException(status_code=404, detail=f"No hay registros en los últimos {data.period_days} días.")
            
        # Resumen: Asegurar que coincida "Masculino", "Hombre", "Femenino", "Mujer", ignorando mayúsculas/espacios
        df_personas = df_filtered[df_filtered['clase'].astype(str).str.strip().str.lower() == 'persona']
        total_personas = len(df_personas)
        
        generos = df_personas['genero'].astype(str).str.strip().str.lower()
        hombres = len(df_personas[generos.isin(['hombre', 'masculino', 'm', 'h'])])
        mujeres = len(df_personas[generos.isin(['mujer', 'femenino', 'f'])])
        
        df_filtered['fecha'] = df_filtered['fecha'].dt.strftime("%Y-%m-%d")

        # --- NO MÁS ARCHIVOS ADJUNTOS (Evita SPAM) ---
        # En su lugar, vamos a incrustar los últimos 50 registros directamente en el cuerpo del correo
        recent_df = df_filtered.tail(50).iloc[::-1]
        filas_html = ""
        for _, row in recent_df.iterrows():
            filas_html += f"""
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">{row['id_registro']}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">{row['fecha']}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">{row['hora']}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">{row['genero']}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">{row['lugar']}</td>
            </tr>
            """
            
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.utils import formataddr, formatdate, make_msgid
        
        # ==========================================
        # CONFIGURACIÓN DE CORREO (Ajustar por el usuario)
        # ==========================================
        REMITENTE = "dg102090@gmail.com" # CAMBIAR
        PASSWORD = "uroa vqqe nsea vrci" # CAMBIAR - Usar contraseña de aplicación de Google
        
        # 1. Contenedor Raíz (Alternative directamente, sin Mixed porque no hay adjuntos)
        msg = MIMEMultipart('alternative')
        
        # 2. Cabeceras Profesionales
        msg['Subject'] = f"Reporte Analítico de Monitoreo - Últimos {data.period_days} Días"
        msg['From'] = formataddr(('Departamento de Análisis de Datos', REMITENTE))
        msg['To'] = formataddr(('Administración', data.email))
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid(domain="sistema.corporativo")
        msg['Reply-To'] = REMITENTE
        msg['X-Priority'] = '3 (Normal)'
        
        # 3.1 Versión Texto Plano
        texto_plano = f"""Estimado(a),
        
Este es el informe analítico de detecciones de los últimos {data.period_days} días.

RESUMEN:
- Total: {total_personas}
- Hombres: {hombres}
- Mujeres: {mujeres}

Atentamente,
Departamento de Seguridad
"""
        msg.attach(MIMEText(texto_plano, 'plain', 'utf-8'))
        
        # 3.2 Versión HTML con la tabla incrustada
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333; line-height: 1.6; background-color: #f9f9f9; padding: 20px; margin: 0;">
            <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid #291aeb; padding-bottom: 15px; margin-bottom: 20px;">
                    <h2 style="color: #1a1c33; margin: 0; font-size: 22px;">Reporte Analítico de Monitoreo</h2>
                    <p style="color: #666666; margin: 5px 0 0 0; font-size: 14px;">Generado automáticamente por el Sistema IA</p>
                </div>
                
                <p style="font-size: 15px;">Estimado(a), a continuación se presenta el informe correspondiente a los últimos <b>{data.period_days} días</b>.</p>
                
                <div style="background-color: #f5f7ff; padding: 15px; border-radius: 6px; margin: 25px 0;">
                    <h3 style="margin-top: 0; color: #291aeb; font-size: 16px;">Resumen Ejecutivo</h3>
                    <table width="100%" cellpadding="5" cellspacing="0" style="font-size: 14px;">
                        <tr>
                            <td width="50%"><strong>Total de flujos registrados:</strong></td>
                            <td width="50%"><strong>{total_personas}</strong></td>
                        </tr>
                        <tr><td>Hombres:</td><td>{hombres}</td></tr>
                        <tr><td>Mujeres:</td><td>{mujeres}</td></tr>
                    </table>
                </div>
                
                <h3 style="color: #333; margin-top: 30px; font-size: 16px;">Últimos {len(recent_df)} Registros Detectados</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #1a1c33; color: #ffffff;">
                            <th style="padding: 10px; font-size: 13px; border-radius: 4px 0 0 4px;">ID</th>
                            <th style="padding: 10px; font-size: 13px;">Fecha</th>
                            <th style="padding: 10px; font-size: 13px;">Hora</th>
                            <th style="padding: 10px; font-size: 13px;">Género</th>
                            <th style="padding: 10px; font-size: 13px; border-radius: 0 4px 4px 0;">Lugar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas_html}
                    </tbody>
                </table>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888;">
                    <p style="margin: 0;"><strong>Departamento de Seguridad y Análisis</strong></p>
                </div>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, 'html', 'utf-8'))
        
        # Enviar correo usando STARTTLS (Puerto 587) - Mejor reputación en Gmail
        try:
            with smtplib.SMTP('smtp.gmail.com', 587) as smtp:
                smtp.ehlo()
                smtp.starttls() # Encriptación moderna
                smtp.ehlo()
                smtp.login(REMITENTE, PASSWORD)
                smtp.send_message(msg)
        except Exception as e:
            print("Error SMTP:", e)
            return {"status": "error", "message": "No se pudo enviar el correo. Revisa las credenciales SMTP en el backend."}
            
        return {"status": "ok", "message": f"Reporte enviado con éxito a {data.email}"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================
# REGISTRO DE USUARIO
# ==========================
@app.post("/api/register")
def register(
    user: RegistroUsuario,
    db: Session = Depends(get_db)
):

    usuario_existente = db.query(Usuario).filter(
        Usuario.correo == user.correo
    ).first()

    if usuario_existente:
        raise HTTPException(
            status_code=400,
            detail="El correo ya existe"
        )

    password_hash = pwd_context.hash(
        user.password
    )

    nuevo_usuario = Usuario(
        nombre=user.nombre,
        correo=user.correo,
        password_hash=password_hash
    )

    db.add(nuevo_usuario)
    db.commit()

    return {
        "message": "Usuario registrado correctamente"
    }


# ==========================
# LOGIN
# ==========================
@app.post("/api/login")
def login(
    user: LoginUsuario,
    db: Session = Depends(get_db)
):

    usuario = db.query(Usuario).filter(
        Usuario.correo == user.correo
    ).first()

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado"
        )

    if not pwd_context.verify(
        user.password,
        usuario.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Contraseña incorrecta"
        )

    # Generar OTP
    otp = str(
        random.randint(
            100000,
            999999
        )
    )

    otp_storage[user.correo] = otp

    # Configuración correo
    remitente = "dg102090@gmail.com"
    password = "uroa vqqe nsea vrci"

    asunto = "Código OTP - Senior IA"

    mensaje_html = f"""
    <h2>Senior IA</h2>
    <p>Tu código de acceso es:</p>

    <h1 style="color:#7c3aed;">
        {otp}
    </h1>

    <p>
    Este código expira pronto.
    </p>
    """

    mensaje = MIMEMultipart()
    mensaje["From"] = remitente
    mensaje["To"] = user.correo
    mensaje["Subject"] = asunto

    mensaje.attach(
        MIMEText(
            mensaje_html,
            "html"
        )
    )

    try:

        servidor = smtplib.SMTP(
            "smtp.gmail.com",
            587
        )

        servidor.starttls()

        servidor.login(
            remitente,
            password
        )

        servidor.sendmail(
            remitente,
            user.correo,
            mensaje.as_string()
        )

        servidor.quit()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando correo: {str(e)}"
        )

    return {
        "message":
        "OTP enviado al correo" 
    }

@app.post("/api/google-otp")
def enviar_google_otp(data: GoogleOTPRequest):
    otp = str(random.randint(100000, 999999))
    otp_storage[data.correo] = otp

    remitente = "dg102090@gmail.com"
    password = "uroa vqqe nsea vrci"

    asunto = "Código de verificación de Google - Senior IA"

    mensaje_html = f"""
    <h2>Senior IA</h2>
    <p>Has iniciado sesión con Google. Para completar el acceso y verificar tu identidad, ingresa el siguiente código de verificación:</p>
    <h1 style="color:#7c3aed;">
        {otp}
    </h1>
    <p>Este código expira pronto.</p>
    """

    mensaje = MIMEMultipart()
    mensaje["From"] = remitente
    mensaje["To"] = data.correo
    mensaje["Subject"] = asunto

    mensaje.attach(
        MIMEText(
            mensaje_html,
            "html"
        )
    )

    try:
        servidor = smtplib.SMTP("smtp.gmail.com", 587)
        servidor.starttls()
        servidor.login(remitente, password)
        servidor.sendmail(remitente, data.correo, mensaje.as_string())
        servidor.quit()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando correo: {str(e)}"
        )

    return {
        "message": "OTP enviado al correo de Google"
    }

@app.post("/api/verificar-otp")
def verificar_otp(
    data: VerificarOTP
):

    codigo_guardado = otp_storage.get(
        data.correo
    )

    if not codigo_guardado:

        raise HTTPException(
            status_code=404,
            detail="OTP no encontrado"
        )

    if (
        codigo_guardado !=
        data.codigo
    ):

        raise HTTPException(
            status_code=401,
            detail="Código incorrecto"
        )

    del otp_storage[data.correo]

    return {
        "message":
        "OTP correcto"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)