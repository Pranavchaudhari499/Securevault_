from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import numpy as np
import joblib
import os
import json
from datetime import datetime
from isolation_forest_model import IsolationForestModel

app = FastAPI(title="SecureVault ML Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Per-user model store
user_models: Dict[str, IsolationForestModel] = {}
MODEL_DIR = "./models/saved"
os.makedirs(MODEL_DIR, exist_ok=True)

def get_user_model(user_id: str) -> IsolationForestModel:
    if user_id not in user_models:
        model_path = f"{MODEL_DIR}/{user_id}.pkl"
        if os.path.exists(model_path):
            user_models[user_id] = joblib.load(model_path)
        else:
            user_models[user_id] = IsolationForestModel(user_id)
    return user_models[user_id]

class AnalyzeRequest(BaseModel):
    user_id: str
    features: Dict[str, Any]

class UpdateRequest(BaseModel):
    user_id: str
    features: Dict[str, Any]
    is_legitimate: bool

@app.get("/")
def root():
    return {"status": "SecureVault ML Service Running", "timestamp": datetime.now().isoformat()}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    model = get_user_model(request.user_id)
    feature_vector = extract_features(request.features)
    result = model.predict(feature_vector)
    return {
        "anomalyScore": float(result["score"]),
        "decision": result["decision"],
        "confidence": float(result["confidence"]),
        "threshold": float(result["threshold"]),
        "trainingSize": result["training_size"],
        "source": "isolation_forest"
    }

@app.post("/update")
def update(request: UpdateRequest):
    model = get_user_model(request.user_id)
    feature_vector = extract_features(request.features)
    model.add_sample(feature_vector, request.is_legitimate)
    # Retrain if we have enough samples
    if model.get_sample_count() >= 10 and model.get_sample_count() % 5 == 0:
        model.retrain()
        joblib.dump(model, f"{MODEL_DIR}/{request.user_id}.pkl")
    return {"success": True, "sampleCount": model.get_sample_count()}

@app.get("/threshold/{user_id}")
def get_threshold(user_id: str):
    model = get_user_model(user_id)
    thresholds = model.get_adaptive_thresholds()
    return thresholds

@app.get("/stats/{user_id}")
def get_stats(user_id: str):
    model = get_user_model(user_id)
    return {
        "userId": user_id,
        "sampleCount": model.get_sample_count(),
        "thresholds": model.get_adaptive_thresholds(),
        "modelTrained": model.is_trained()
    }

def extract_features(features: Dict) -> np.ndarray:
    return np.array([
        float(features.get("amount", 0)),
        float(features.get("hour", 12)),
        float(features.get("dayOfWeek", 0)),
        float(features.get("ipChanged", 0)),
        float(features.get("deviceChanged", 0)),
        float(features.get("velocityScore", 0)),
        float(features.get("userAvgAmount", 1000)),
        float(features.get("totalTransactions", 0)),
    ]).reshape(1, -1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
