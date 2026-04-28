# Bias Audit Dashboard
### AI-Powered Bias Detection · SDG 10 · Google GDP Solution Challenge

Detects, visualizes, and explains algorithmic bias across demographic groups.
Uses **Google Gemini 1.5 Flash** for AI-powered plain-language explanations.
Deploys to **Google Cloud Run** in minutes.

---

## Stack
| Layer | Tool |
|---|---|
| Backend API | Python + FastAPI |
| AI Analysis | **Google Gemini 1.5 Flash** |
| Bias Metrics | Custom engine (Disparate Impact, Demographic Parity, Equalized Odds) |
| Frontend | React + Vite |
| Deployment | **Google Cloud Run** |
| Containerization | Docker + docker-compose |

---

## Option A — Run locally (fastest)

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (free)

### 1. Clone / unzip and enter the project
```bash
cd bias-dashboard
```

### 2. Set your Gemini API key
```bash
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
```
Get a free key at: https://aistudio.google.com/app/apikey

### 3. Start the backend
```bash
cd backend
pip install -r requirements.txt
GEMINI_API_KEY=your_key_here uvicorn main:app --reload --port 8080
```
API docs at: http://localhost:8080/docs

### 4. Start the frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:3000

---

## Option B — Docker Compose (one command)

```bash
# Make sure Docker Desktop is running
cp .env.example .env   # add your GEMINI_API_KEY

docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

---

## Option C — Deploy to Google Cloud Run

### Prerequisites
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
- A GCP project with billing enabled
- Cloud Run API enabled

### Step 1 — Authenticate
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 2 — Deploy the backend
```bash
cd backend

# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/bias-backend

# Deploy to Cloud Run (sets Gemini key as secret)
gcloud run deploy bias-backend \
  --image gcr.io/YOUR_PROJECT_ID/bias-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here \
  --memory 512Mi \
  --port 8080
```
Note the deployed URL, e.g.: `https://bias-backend-xxxx-uc.a.run.app`

### Step 3 — Deploy the frontend
```bash
cd frontend

# Set the backend URL
echo "VITE_API_URL=https://bias-backend-xxxx-uc.a.run.app" > .env.production

gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/bias-frontend

gcloud run deploy bias-frontend \
  --image gcr.io/YOUR_PROJECT_ID/bias-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Step 4 — Done!
Your app is live at the frontend Cloud Run URL.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/datasets` | List available demo datasets |
| GET | `/api/audit/{key}` | Run bias audit on demo dataset |
| POST | `/api/upload` | Upload and audit your own CSV |
| POST | `/api/gemini/analyze` | Get Gemini AI analysis |
| GET | `/health` | Health check |

---

## CSV Upload Format

Your CSV needs:
- A **sensitive column**: `gender`, `sex`, `race`, `ethnicity`, `age`, etc.
- A **target/outcome column**: `label`, `outcome`, `prediction`, `target`, `approved`, `hired`, etc.

Example:
```
gender,age_group,credit_score,approved
Male,25-35,720,1
Female,25-35,718,0
Male,36-50,690,1
...
```

---

## Bias Metrics Explained

| Metric | Formula | Red flag |
|---|---|---|
| Disparate Impact | pos_rate(group) / pos_rate(privileged) | < 0.8 (4/5ths rule) |
| Demographic Parity Diff | \|pos_rate(group) - pos_rate(privileged)\| | > 0.1 |
| Equalized Odds Diff | \|FPR(group) - FPR(privileged)\| | > 0.1 |

---

## SDG 10 Alignment

This tool directly addresses **SDG Target 10.3** (equal opportunity, eliminate discrimination) and **10.2** (inclusion regardless of age, sex, ethnicity). Detecting and fixing bias in AI systems used for criminal justice, hiring, and lending is a measurable step toward reduced inequality.
