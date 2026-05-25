from sqlalchemy import Column, Integer, String, DateTime, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from database import Base
from datetime import datetime

Base = declarative_base()
class Usuario(Base):
    __tablename__ = "Usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100))
    correo = Column(String(150), unique=True)
    password_hash = Column(String(255))
    fecha_registro = Column(DateTime, default=datetime.now)
    face_embedding = Column(LargeBinary, nullable=True)