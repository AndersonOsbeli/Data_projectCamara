# ✅ Checklist de Validación - Face ID Login

## 🔍 Antes de Testing

### Base de Datos
- [ ] Tabla `Usuario` existe
- [ ] Columna `face_embedding` existe (BINARY/VARBINARY tipo)
- [ ] Campo `nombre` existe para guardar nombre del usuario
- [ ] SQLAlchemy models.py importado correctamente

### Backend
- [ ] `backend_api_camara.py` tiene import de `Request` en FastAPI
- [ ] Funciones `compute_face_similarity()` y `generate_facial_holograma()` existen
- [ ] Endpoint `/api/login-face` acepta POST con parámetros `correo` e `imagen`
- [ ] CORS habilitado para `http://127.0.0.1:4200`
- [ ] Puerto 8000 accesible desde frontend
- [ ] OpenCV instalado con cascadas Haar

### Frontend
- [ ] Angular imports incluyen `HttpClient`, `Router`, `AuthService`
- [ ] Variables en Login component: `faceVideo`, `faceCanvas`, `email`, `faceIDStream`
- [ ] Métodos existentes: `startFaceIDScan()`, `captureAndProcessFace()`, `stopFaceIDScan()`
- [ ] HTML include `<video>` y `<canvas>` con referencias
- [ ] Estilos CSS para `.faceid-preview`, `.scanner-viewport`, `.scan-circle`

---

## 🧪 Escenarios de Testing

### Escenario 1: Enrolamiento (Preparación)
```
1. Login → Registrarse
2. Email: usuario@test.com | Contraseña: Test123!
3. Verificar OTP del email
4. [Dashboard] Buscar botón "Enrolar Face ID"
5. Capturar rostro (debe ser claro, frontal, bien iluminado)
6. Esperado: ✅ "Rostro enrolado con éxito"

Verificación BD:
SELECT face_embedding FROM Usuario 
WHERE correo = 'usuario@test.com'
Esperado: ✅ NOT NULL (bytes binarios)
```

### Escenario 2: Login Exitoso
```
1. Ir a pantalla de login
2. Email: usuario@test.com
3. Click "Iniciar con Face ID"
4. [Esperar 3.5 segundos, centrar rostro]
5. [Se captura automáticamente]

Esperado en Backend:
[FACE_AUTH]: Usuario usuario@test.com | Similitud: 89.32% | Umbral: 65.00%
[FACE_SUCCESS]: Autenticación facial exitosa

Esperado en Frontend:
✅ Holograma con fondo BLANCO
✅ Puntos AZUL CIAN mapeados
✅ Texto "SIMILITUD: 89.3%" visible
✅ Redirige a dashboard en 4 seg
```

### Escenario 3: Similitud Baja
```
1. Email: usuario@test.com
2. Click "Iniciar con Face ID"
3. Cambiar ángulo/iluminación drásticamente
4. [Se captura]

Esperado:
❌ Error HTTP 401: "Rostro no reconocido. Similitud: 42.5% (requerido: 65.0%)"
✅ Cámara se cierra
✅ Mensaje de error claro
✅ Puedes reintentar
```

### Escenario 4: Sin Rostro Detectado
```
1. Email: usuario@test.com
2. Click "Iniciar con Face ID"
3. Coloca un objeto en lugar de rostro
4. [Se intenta capturar]

Esperado:
❌ Error HTTP 400: "No se detectó rostro en la captura..."
✅ Cámara se cierra
✅ Puedes reintentar
```

### Escenario 5: Usuario Sin Enrolamiento
```
1. Crear usuario nuevo SIN enrolar rostro
2. Ir a login
3. Email: nuevo@test.com
4. Click "Iniciar con Face ID"
5. [Se captura]

Esperado:
❌ Error HTTP 400: "Usuario no ha enrolado su rostro aún..."
✅ Mensaje claro
```

---

## 📡 Validación de API

### Test /api/login-face con cURL

```bash
# 1. Generar una imagen de prueba (necesitas una imagen real)
# Usar herramienta que convierta a base64

# 2. POST request
curl -X POST http://127.0.0.1:8000/api/login-face \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "usuario@test.com",
    "imagen": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'

# Respuesta esperada si exitoso:
{
  "status": "ok",
  "message": "¡Firma biométrica validada con éxito! Acceso concedido.",
  "nombre": "Usuario Prueba",
  "score_similitud": 0.893,
  "imagen_analitica": "data:image/jpeg;base64,..."
}

# Respuesta esperada si falla:
{
  "detail": "Rostro no reconocido. Similitud: 42.5% (requerido: 65.0%)"
}
```

---

## 🖥️ Verificación en Consola

### Backend (Terminal Python)
```
Logs esperados durante login exitoso:

[FACE_AUTH]: Usuario usuario@test.com | Similitud: 89.32% | Umbral: 65.00%
[FACE_SUCCESS]: Autenticación facial exitosa para usuario@test.com (similitud: 89.32%)
```

### Frontend (DevTools - F12)
```
Logs esperados:

[BIOMETRIA]: Captura completada. Analizando biometría para: usuario@test.com
[BIOMETRIC_SUCCESS]: Rostro validado
[SYSTEM]: Componente Login inicializado correctamente
```

---

## 🎯 Puntos Clave a Validar

| Elemento | ✅ Estado | Notas |
|----------|-----------|-------|
| Detección rostro | ✅ | Usa OpenCV Haar Cascade |
| Mapeo puntos | ✅ | 8 puntos + líneas de conexión |
| Fondo blanco | ✅ | rgb(255,255,255) en holograma |
| Puntos azules | ✅ | #00E5FF (255,229,0 en BGR) |
| Similitud MSE | ✅ | Umbral 65% |
| Error handling | ✅ | Maneja 5+ casos |
| UI/UX | ✅ | Feedback claro |
| Performance | ✅ | Captura <100ms |

---

## 🚀 Pasos Finales Pre-Producción

- [ ] Prueba enrolamiento con 5 usuarios diferentes
- [ ] Prueba login exitoso con cada usuario
- [ ] Prueba rechazo cuando cambias expresión/iluminación
- [ ] Verifica que la similitud varía apropiadamente
- [ ] Chequea logs en backend durante toda la sesión
- [ ] Valida que localStorage guarda usuario correctamente
- [ ] Verifica transición a dashboard sin errores
- [ ] Prueba con navegadores diferentes (Chrome, Firefox, Edge)
- [ ] Prueba con cámaras diferentes si es posible
- [ ] Documenta cualquier ajuste de umbral realizado

---

## 📊 Métricas de Éxito

- ✅ Similaridad promedio usuarios legítimos: 75-95%
- ✅ Tasa de rechazo falso: < 5%
- ✅ Tasa de aceptación falsa: < 1% 
- ✅ Tiempo promedio captura: 3.5 segundos
- ✅ Tiempo procesamiento backend: < 500ms
- ✅ Tiempo visualización holograma: 4 segundos

---

**Próximo paso**: Ejecutar Escenario 1 (Enrolamiento) → Escenario 2 (Login)
