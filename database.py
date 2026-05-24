from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SERVER = "DEPINFOR20\SQLEXPRESS"
DATABASE = "SeniorIA"

connection_string = (
    f"mssql+pyodbc://@{SERVER}/{DATABASE}"
    "?driver=ODBC+Driver+17+for+SQL+Server"
    "&trusted_connection=yes"
)

engine = create_engine(connection_string)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()