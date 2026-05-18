# 🚀 Trip Planner — Developer Quickstart Guide

This guide describes how to set up, configure, and start both the Next.js frontend and the FastAPI backend dev servers.

---

## 📋 1. Environment Configuration

Both the frontend and backend share a **single, unified environment file** in the root workspace directory.

1. Locate the [.env](file:///d:/AI/Trip_planner/.env) file in the root folder.
2. Ensure the key credentials are set:
   ```ini
   # Supabase Auth & Database Settings
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-publishable-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-or-service-role-key

   # AI Orchestration Keys
   GROQ_API_KEY=gsk_...
   GOOGLE_GEMINI_API_KEY=your-gemini-key

   # Weather & API Keys
   OPENWEATHER_API_KEY=your-openweather-key
   LITEAPI_API_KEY=your-liteapi-key
   ```

*Note: The Python backend's `BaseSettings` automatically resolves this parent `.env` file (`../.env`) and ignores any frontend-specific keys, eliminating configuration duplicate errors.*

---

## 🐍 2. Starting the FastAPI Python Backend

The backend runs a high-performance Python ASGI server utilizing LangGraph and fuzzy-matched RAG scrapers.

### Prerequisites (First time only)
From the root workspace, navigate to the backend folder and install the dependencies:
```powershell
cd trip-planner-backend
pip install -r requirements.txt
```

### Start the Server
Launch the Uvicorn server on port `8000`:
```powershell
uvicorn main:app --port 8000 --reload
```
- **Backend API URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 3. Starting the Next.js Frontend

The frontend uses Next.js powered by Turbopack for near-instant compilations and reactive renders.

### Prerequisites (First time only)
From the workspace root directory, install the node dependencies:
```powershell
npm install
```

### Start the Server
Launch the Next.js server in development mode:
```powershell
npm run dev
```
- **Frontend Dashboard URL**: [http://localhost:3000](http://localhost:3000)

---

## 🔑 4. Configuring Supabase Auth for Local Testing

To log in immediately without having to configure email smtp delivery or check local email validation inbox:

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select your active project.
2. Go to **Auth** (user icon in the left menu) → **Providers** (under settings).
3. Select **Email** provider.
4. **Turn OFF** the toggle for **Confirm email**.
5. Save the provider settings.

Now, you can sign up or log in immediately using standard test accounts!
