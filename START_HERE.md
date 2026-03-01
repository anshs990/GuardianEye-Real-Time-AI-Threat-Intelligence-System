p# 🚀 GuardianEye — START HERE
> Read this first. Everything you need, in order.

---

## 📁 Project Structure

Create this folder structure on your computer:

```
guardianeye/                        ← your root project folder
│
├── agent.py                        ← Python backend (Vision Agents SDK)
├── requirements.txt                ← Python dependencies
├── .env                            ← Your API keys (copy from .env.example)
├── .env.example                    ← Template for API keys
├── Dockerfile                      ← For cloud deployment
│
├── frontend/                       ← React dashboard
│   ├── src/
│   │   ├── App.jsx                 ← Main React component (wired to Stream)
│   │   └── main.jsx                ← React entry point (you create this)
│   ├── index.html                  ← HTML entry point (you create this)
│   ├── package.json                ← npm dependencies
│   ├── vite.config.js              ← Vite bundler config
│   └── .env.local                  ← Frontend API keys (you create this)
│
├── prompts/
│   └── threat_reasoning_prompts.py ← All Claude prompts
│
├── docs/
│   ├── DEMO_SCRIPT.md              ← 5-min demo script + pitch
│   └── TESTING_AND_DEPLOYMENT.md  ← How to test + deploy
│
└── preview/
    └── guardianeye-dashboard.html  ← Standalone preview (open in browser NOW)
```

---

## 🔑 STEP 1 — Get Your API Keys

Open all 5 links below in separate browser tabs and sign up.
All have **free tiers** — no credit card needed except Anthropic.

---

### 1. Stream (Video transport — the core of Vision Agents)
**Link:** https://getstream.io

```
1. Click "Start Coding Free"
2. Sign up with GitHub or email
3. Click "Create App"
4. App Name: guardianeye   |   Region: pick closest to you
5. Copy:  API Key    → paste into .env as STREAM_API_KEY
          API Secret → paste into .env as STREAM_API_SECRET
```
> Also needed for frontend: go to Dashboard → Explorer
> → Users → POST /users → body: `{"id":"operator-01","name":"Security Operator","role":"user"}`
> → Then POST /user_tokens → body: `{"user_id":"operator-01"}`
> → Copy the token → paste into frontend/.env.local as VITE_STREAM_USER_TOKEN

---

### 2. Anthropic / Claude (Threat reasoning brain)
**Link:** https://console.anthropic.com

```
1. Sign up → verify email
2. Go to API Keys → Create Key
3. Name it: guardianeye
4. Copy the key → paste into .env as ANTHROPIC_API_KEY
```
> ⚠️ Anthropic requires a small top-up (~$5) to use the API.
> Go to Settings → Billing → Add credit card → Add $5.
> This will last the entire hackathon.

---

### 3. Moondream (Scene understanding)
**Link:** https://moondream.ai

```
1. Click "Get API Key"
2. Sign up with GitHub or email
3. Copy the API key → paste into .env as MOONDREAM_API_KEY
```
> Free tier: generous limits, plenty for hackathon use.

---

### 4. Deepgram (Speech-to-text — operator talks to agent)
**Link:** https://deepgram.com

```
1. Click "Get Started Free"
2. Sign up → verify email
3. Go to API Keys → Create API Key
4. Name it: guardianeye   |   Role: Member
5. Copy the key → paste into .env as DEEPGRAM_API_KEY
```
> Free tier: $200 credit — more than enough.

---

### 5. ElevenLabs (Agent speaks alerts out loud)
**Link:** https://elevenlabs.io

```
1. Sign up free
2. Click your profile icon (top right) → Profile + API Key
3. Copy the API key → paste into .env as ELEVENLABS_API_KEY
```
> Free tier: 10,000 characters/month — plenty for demo.

---

## 📝 STEP 2 — Fill In Your .env File

After collecting all keys, your `.env` file should look like this:

```bash
STREAM_API_KEY=abc123xyz...
STREAM_API_SECRET=def456uvw...
ANTHROPIC_API_KEY=sk-ant-...
MOONDREAM_API_KEY=md_...
DEEPGRAM_API_KEY=xyz789...
ELEVENLABS_API_KEY=el_...
```

And your `frontend/.env.local`:
```bash
VITE_STREAM_API_KEY=abc123xyz...        ← same as STREAM_API_KEY above
VITE_STREAM_USER_TOKEN=eyJ...           ← generated from Stream Explorer
```

---

## 💻 STEP 3 — Install & Run Backend

```bash
# 1. Clone Vision Agents SDK (required — your agent.py runs inside this)
git clone https://github.com/GetStream/Vision-Agents
cd Vision-Agents

# 2. Copy your files into the cloned repo
cp /path/to/guardianeye/agent.py ./agent.py
cp /path/to/guardianeye/.env ./.env

# 3. Install Python package manager
pip install uv

# 4. Create virtual environment
uv venv --python 3.12
source .venv/bin/activate        # Mac/Linux
# .venv\Scripts\activate         # Windows

# 5. Install all dependencies
uv add "vision-agents[anthropic,ultralytics,moondream,deepgram,elevenlabs,getstream]"
uv add opencv-python-headless python-dotenv

# 6. Start the agent (dev mode — browser opens automatically)
python agent.py dev
```

✅ You should see:
```
🚀 GuardianEye dev mode starting...
🌐 Browser will open automatically with camera access
```

---

## 🌐 STEP 4 — Install & Run Frontend

Open a **new terminal** (keep agent.py running):

```bash
# 1. Go to your frontend folder
cd /path/to/guardianeye/frontend

# 2. Create the two files that are NOT included (they're tiny)

# main.jsx
cat > src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GuardianEye</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

# .env.local
cat > .env.local << 'EOF'
VITE_STREAM_API_KEY=paste_your_stream_api_key_here
VITE_STREAM_USER_TOKEN=paste_your_user_token_here
EOF

# 3. Install dependencies
npm install

# 4. Start dev server
npm run dev
```

✅ Open http://localhost:5173 in your browser
✅ Click Allow on camera permission
✅ You should see your webcam in the tactical dashboard

---

## 🎬 STEP 5 — Test With Recorded Video (Optional)

```bash
# Download any MP4 security footage, then:
python agent.py test-video your_footage.mp4

# Watch Claude's threat assessments in the console
```

---

## ✅ Final Checklist Before Submitting

```
□ agent.py runs: python agent.py dev  → no errors
□ Frontend loads: http://localhost:5173  → shows dashboard
□ Webcam appears in the feed
□ YOLO detections show (wait 5s)
□ Scene log populates (wait 15s)
□ Walk past camera 3x → threat level changes to ALERT
□ Audio alert plays from speakers
□ Demo video recorded (most important!)
□ Code pushed to public GitHub repo
□ ⭐ Starred Vision Agents repo: github.com/GetStream/Vision-Agents
□ Social media post with @VisionAgents tag
```

---

## 🆘 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: vision_agents` | Run `uv add "vision-agents[...]"` inside the cloned repo |
| `Camera access denied` | Click camera icon in browser address bar → Allow → Refresh |
| `STREAM_API_KEY not found` | Check .env file is in the same folder as agent.py |
| `Token expired` | Generate a new user token from Stream Dashboard → Explorer |
| `YOLO model downloading...` | Normal on first run — yolo11n.pt downloads automatically (~6MB) |
| `anthropic.AuthenticationError` | Check ANTHROPIC_API_KEY in .env, ensure billing is set up |

---

*GuardianEye · WeMakeDevs × Vision Agents Hackathon 2025*
