from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_client
from .matching import match_profiles
from .coach import generate_coach_response

app = FastAPI(title="AI Collab Link Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = create_db_client()

@app.get("/ping")
def ping():
    return {"status": "ok"}

@app.post("/match")
def match_endpoint(user_id: str):
    return match_profiles(user_id, db)

@app.post("/coach")
def coach_endpoint(prompt: str):
    return {"advice": generate_coach_response(prompt)}
