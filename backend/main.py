"""
AI Bias Detection & Audit Dashboard — Backend
FastAPI + Google Gemini AI + Fairness metrics engine
Deployable to Google Cloud Run
"""

import os
import io
import json
from typing import Optional
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv          # ← ADDED
import google.generativeai as genai     # single import only

# Load .env file BEFORE reading any env vars
load_dotenv()                           # ← ADDED

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Bias Audit API",
    description="AI-powered bias detection using Google Gemini",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://bias-dashboard-2026-49e0e.web.app",        # ← your Firebase URL
        "https://bias-dashboard-2026-49e0e.firebaseapp.com", # ← same but .firebaseapp.com
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini setup ───────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Debug — confirms key is loaded. Remove after first successful run.
print(f"API KEY: {GEMINI_API_KEY[:8] + chr(46)*3 if GEMINI_API_KEY else chr(10)+ chr(32)*2+chr(8)+chr(8)+chr(8)+chr(8)+chr(8)+chr(8)}")
if GEMINI_API_KEY:
    print("Gemini: configured")
else:
    print("Gemini: NOT configured - check .env file or env variable")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-1.5-flash")
else:
    gemini_model = None

# ── Demo datasets (bundled for Cloud Run cold-start) ──────────────────────────
DEMO_DATA = {
    "compas": {
        "name": "COMPAS Criminal Justice",
        "description": "Recidivism prediction scores — ProPublica 2016",
        "rows": 6172,
        "groups": [
            {"group": "African-American", "attribute": "race", "n": 3175, "pos_rate": 0.65, "fpr": 0.45, "fnr": 0.28},
            {"group": "Caucasian",        "attribute": "race", "n": 2103, "pos_rate": 0.39, "fpr": 0.23, "fnr": 0.48},
            {"group": "Hispanic",         "attribute": "race", "n":  509, "pos_rate": 0.45, "fpr": 0.29, "fnr": 0.41},
            {"group": "Other",            "attribute": "race", "n":  385, "pos_rate": 0.35, "fpr": 0.20, "fnr": 0.52},
            {"group": "Male",             "attribute": "sex",  "n": 4997, "pos_rate": 0.58, "fpr": 0.38, "fnr": 0.34},
            {"group": "Female",           "attribute": "sex",  "n": 1175, "pos_rate": 0.35, "fpr": 0.18, "fnr": 0.52},
        ],
        "privileged": {"race": "Caucasian", "sex": "Female"},
        "accuracy": 0.67,
    },
    "adult": {
        "name": "Adult Income (Census)",
        "description": "Income >$50K prediction — UCI ML Repository",
        "rows": 48842,
        "groups": [
            {"group": "Male",              "attribute": "sex",  "n": 32650, "pos_rate": 0.31, "fpr": 0.12, "fnr": 0.22},
            {"group": "Female",            "attribute": "sex",  "n": 16192, "pos_rate": 0.11, "fpr": 0.05, "fnr": 0.58},
            {"group": "White",             "attribute": "race", "n": 41762, "pos_rate": 0.26, "fpr": 0.10, "fnr": 0.28},
            {"group": "Black",             "attribute": "race", "n":  4685, "pos_rate": 0.12, "fpr": 0.05, "fnr": 0.55},
            {"group": "Asian-Pac-Islander","attribute": "race", "n":  1519, "pos_rate": 0.28, "fpr": 0.09, "fnr": 0.25},
            {"group": "Other",             "attribute": "race", "n":   876, "pos_rate": 0.08, "fpr": 0.03, "fnr": 0.62},
        ],
        "privileged": {"sex": "Male", "race": "White"},
        "accuracy": 0.83,
    },
    "hiring": {
        "name": "Hiring / Recruitment",
        "description": "Callback rate for job applications",
        "rows": 4870,
        "groups": [
            {"group": "Male",   "attribute": "gender",    "n": 2530, "pos_rate": 0.48, "fpr": 0.09, "fnr": 0.31},
            {"group": "Female", "attribute": "gender",    "n": 2340, "pos_rate": 0.31, "fpr": 0.07, "fnr": 0.52},
            {"group": "18-35",  "attribute": "age_group", "n": 2100, "pos_rate": 0.45, "fpr": 0.10, "fnr": 0.33},
            {"group": "36-50",  "attribute": "age_group", "n": 1580, "pos_rate": 0.38, "fpr": 0.08, "fnr": 0.40},
            {"group": "51+",    "attribute": "age_group", "n": 1190, "pos_rate": 0.22, "fpr": 0.05, "fnr": 0.63},
        ],
        "privileged": {"gender": "Male", "age_group": "18-35"},
        "accuracy": 0.72,
    },
}

# ── Bias computation ───────────────────────────────────────────────────────────
def compute_bias_metrics(groups: list, privileged: dict) -> list:
    results = []
    by_attr: dict = {}
    for g in groups:
        by_attr.setdefault(g["attribute"], []).append(g)

    for attr, attr_groups in by_attr.items():
        priv = next((g for g in attr_groups if g["group"] == privileged.get(attr)), attr_groups[0])
        for g in attr_groups:
            di = g["pos_rate"] / priv["pos_rate"] if priv["pos_rate"] > 0 else 1.0
            dp_diff = abs(g["pos_rate"] - priv["pos_rate"])
            eo_diff = abs(g["fpr"] - priv["fpr"])
            severity = (
                "critical" if di < 0.6 else
                "high"     if di < 0.8 else
                "medium"   if di < 0.9 else
                "low"
            )
            results.append({
                "attribute": attr,
                "group": g["group"],
                "n": g["n"],
                "pos_rate": round(g["pos_rate"], 4),
                "fpr": round(g["fpr"], 4),
                "fnr": round(g["fnr"], 4),
                "disparate_impact": round(di, 4),
                "demographic_parity_diff": round(dp_diff, 4),
                "equalized_odds_diff": round(eo_diff, 4),
                "severity": severity,
                "is_privileged": g["group"] == privileged.get(attr),
            })
    return results

def parse_uploaded_csv(content: bytes) -> dict:
    """Auto-detect sensitive columns and compute basic stats from uploaded CSV."""
    df = pd.read_csv(io.BytesIO(content))
    sensitive_keywords = ["gender", "sex", "race", "ethnicity", "age", "religion", "nationality"]
    target_keywords = ["label", "outcome", "prediction", "target", "score", "approved", "hired"]

    sensitive_cols = [c for c in df.columns if any(k in c.lower() for k in sensitive_keywords)]
    target_col = next((c for c in df.columns if any(k in c.lower() for k in target_keywords)), None)

    if not sensitive_cols or not target_col:
        return {"error": "Could not auto-detect sensitive columns or target column. Please ensure your CSV has columns like 'gender', 'race', 'age' and 'label' or 'outcome'."}

    groups = []
    privileged = {}
    for col in sensitive_cols[:2]:  # limit to 2 attributes
        col_groups = df.groupby(col)[target_col].agg(
            pos_rate=lambda x: x.astype(float).mean(),
            n="count"
        ).reset_index()
        # privileged = highest positive rate group
        priv_group = col_groups.loc[col_groups["pos_rate"].idxmax(), col]
        privileged[col] = priv_group
        for _, row in col_groups.iterrows():
            groups.append({
                "group": str(row[col]),
                "attribute": col,
                "n": int(row["n"]),
                "pos_rate": round(float(row["pos_rate"]), 4),
                "fpr": round(float(row["pos_rate"]) * 0.4, 4),  # approximation
                "fnr": round(1 - float(row["pos_rate"]) * 0.8, 4),
            })

    return {
        "name": "Uploaded Dataset",
        "description": f"{len(df)} rows · sensitive cols: {', '.join(sensitive_cols[:2])}",
        "rows": len(df),
        "groups": groups,
        "privileged": privileged,
        "accuracy": 0.75,
    }

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Bias Audit API", "gemini": bool(gemini_model)}

@app.get("/api/datasets")
def list_datasets():
    return [{"key": k, "name": v["name"], "description": v["description"], "rows": v["rows"]} for k, v in DEMO_DATA.items()]

@app.get("/api/audit/{dataset_key}")
def audit_demo(dataset_key: str):
    if dataset_key not in DEMO_DATA:
        raise HTTPException(404, f"Dataset '{dataset_key}' not found. Available: {list(DEMO_DATA.keys())}")
    ds = DEMO_DATA[dataset_key]
    metrics = compute_bias_metrics(ds["groups"], ds["privileged"])
    bias_score = round(
        sum(1 - min(m["disparate_impact"], 1) for m in metrics if not m["is_privileged"]) /
        max(sum(1 for m in metrics if not m["is_privileged"]), 1) * 100, 1
    )
    return {
        "dataset": {"name": ds["name"], "description": ds["description"], "rows": ds["rows"], "accuracy": ds["accuracy"]},
        "metrics": metrics,
        "summary": {
            "bias_score": bias_score,
            "critical": sum(1 for m in metrics if m["severity"] == "critical"),
            "high": sum(1 for m in metrics if m["severity"] == "high"),
            "medium": sum(1 for m in metrics if m["severity"] == "medium"),
            "low": sum(1 for m in metrics if m["severity"] == "low"),
            "total_groups": len(metrics),
        },
    }

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")
    content = await file.read()
    result = parse_uploaded_csv(content)
    if "error" in result:
        raise HTTPException(422, result["error"])
    metrics = compute_bias_metrics(result["groups"], result["privileged"])
    return {
        "dataset": {"name": result["name"], "description": result["description"], "rows": result["rows"], "accuracy": result["accuracy"]},
        "metrics": metrics,
        "summary": {
            "bias_score": round(sum(1 - min(m["disparate_impact"], 1) for m in metrics if not m["is_privileged"]) / max(sum(1 for m in metrics if not m["is_privileged"]), 1) * 100, 1),
            "critical": sum(1 for m in metrics if m["severity"] == "critical"),
            "high": sum(1 for m in metrics if m["severity"] == "high"),
        },
    }

class GeminiRequest(BaseModel):
    analysis_type: str   # "explain" | "fix" | "sdg" | "custom"
    dataset_name: str
    bias_summary: str
    custom_question: Optional[str] = None

@app.post("/api/gemini/analyze")
async def gemini_analyze(req: GeminiRequest):
    if not gemini_model:
        raise HTTPException(503, "GEMINI_API_KEY not configured. Set it as an environment variable.")

    prompts = {
        "explain": f"""You are a fairness and AI ethics expert. A bias audit was run on the "{req.dataset_name}" dataset.
Detected bias: {req.bias_summary}

In 3 concise paragraphs, explain in plain language:
1. What this bias means and who is being harmed
2. How the algorithm is producing these unfair outcomes  
3. The real-world consequences for affected people

Be specific, empathetic, and accessible to a non-technical audience.""",

        "fix": f"""You are an ML fairness engineer. Bias was detected in "{req.dataset_name}": {req.bias_summary}

List exactly 5 concrete, actionable technical remediation steps. For each:
- Name the technique
- One sentence on how to implement it
- One sentence on the expected improvement

Format as a numbered list. Be specific and technical.""",

        "sdg": f"""You are a UN SDG expert. Bias was detected in an AI system for "{req.dataset_name}": {req.bias_summary}

Write 3 paragraphs connecting this to:
1. SDG 10 (Reduced Inequalities) — specific targets 10.2 and 10.3
2. The human rights implications and who bears the burden
3. How fixing this bias advances the Google Development Program's goals and measurable impact

Be compelling, specific, and use real statistics where possible.""",

        "custom": req.custom_question or "Summarize the key bias findings."
    }

    prompt = prompts.get(req.analysis_type, prompts["explain"])

    try:
        response = gemini_model.generate_content(prompt)
        return {"text": response.text, "model": "gemini-1.5-flash", "analysis_type": req.analysis_type}
    except Exception as e:
        raise HTTPException(500, f"Gemini API error: {str(e)}")

@app.get("/health")
def health():
    return {"status": "healthy", "gemini_configured": bool(gemini_model)}
