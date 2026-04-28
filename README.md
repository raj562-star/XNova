AI Bias Detection & Audit Dashboard — Backend

A production-ready FastAPI backend for detecting, auditing, and explaining bias in datasets using fairness metrics and Google Gemini AI.
This API supports dataset uploads, preloaded benchmark datasets, and AI-powered analysis for understanding and mitigating bias in machine learning systems.
==Features
Bias detection using key fairness metrics:
Disparate Impact
Demographic Parity Difference
Equalized Odds Difference
Upload CSV datasets for real-time bias analysis
Built-in demo datasets (COMPAS, Adult Income, Hiring)
AI-powered insights using Google Gemini:
Bias explanation
Fix recommendations
SDG impact analysis
FastAPI-based REST API
CORS enabled for frontend integration
Docker support for deployment
==Tech Stack
FastAPI
Python 3.11+
Pandas, NumPy
Google Gemini API
Uvicorn
python-dotenv
 Project Structure


backend/
│
├── main.py
├── requirements.txt
├── Dockerfile
├── .env.example
