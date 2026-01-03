from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Stock Value Analyzer", version="1.0.0")

# CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "Stock Value Analyzer API running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# TODO: Add more endpoints
