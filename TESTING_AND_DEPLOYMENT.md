# GuardianEye — Testing & Deployment Guide

---

## PART 1: Testing With a Recorded Video

This is the **easiest way to test** — no live camera needed, works fully offline
(except API calls to Claude/Moondream).

### Step 1 — Get a test video

Option A — Download free security footage:
- https://www.pexels.com/search/videos/security%20camera/
- https://www.videvo.net/search/security-camera/
- Search "CCTV footage free download" on YouTube → download with yt-dlp

Option B — Record your own:
```bash
# Record 60 seconds from your webcam using ffmpeg
ffmpeg -i /dev/video0 -t 60 -c:v libx264 test_footage.mp4

# Or on macOS:
ffmpeg -f avfoundation -i "0" -t 60 -c:v libx264 test_footage.mp4
```

Option C — Use any MP4 file you already have (a phone video of a room works fine)

---

### Step 2 — Run the test

```bash
# Basic test (looks for test_footage.mp4 in current folder)
python agent.py test-video

# Test with a specific file
python agent.py test-video path/to/your/security_footage.mp4

# Example with a downloaded file
python agent.py test-video ~/Downloads/cctv_sample.mp4
```

### What you'll see

```
🎬 Testing with recorded video: security_footage.mp4
📊 Video: 1920x1080 @ 25.0fps | Duration: 120.0s | Frames: 3000
🚀 Starting GuardianEye agent...
✅ Agent joined call — processing video...
⏱️  5s / 120s processed (125/3000 frames)

[YOLO DETECTION] 2 person(s) in frame
[MOONDREAM] Two individuals near loading area, one appears to be checking the door
[GUARDIANEYE] Heads up — two people near loading bay after hours. Keep watching.

⏱️  10s / 120s processed (250/3000 frames)
[YOLO DETECTION] 2 person(s) in frame | ⚠️ Person in frame continuously for 40+ seconds
[GUARDIANEYE] Alert — individuals have been at loading bay for 45 seconds with no clear purpose. 
              Request verification of authorized access now.
```

### Pro tip for demo recording

Test video mode is perfect for recording your **hackathon demo video** because:
- You control exactly what the agent sees (no relying on luck)
- You can use pre-recorded security footage that has interesting activity
- The demo looks exactly the same as the live version
- You can re-run it as many times as needed until it's perfect

---

## PART 2: Deployment Options

Vision Agents v0.3 has a built-in HTTP server. Here are 4 ways to deploy.

---

### Option A — Railway (Easiest, ~5 minutes, free tier)

Railway is the fastest way to get GuardianEye live on the internet.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway new guardianeye

# Set your environment variables in Railway dashboard:
# railway.app → your project → Variables → Add all 6 keys

# Deploy
railway up
```

Or connect via GitHub:
1. Push your code to a public GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Add all 6 environment variables in the Variables tab
5. Railway auto-deploys on every git push

**Procfile** (create this in your root folder):
```
web: python agent.py serve --host 0.0.0.0 --port $PORT
```

---

### Option B — Render (Free tier, auto-sleep)

```bash
# 1. Push code to GitHub
# 2. Go to render.com → New → Web Service
# 3. Connect your GitHub repo
# 4. Set:
#    Build Command: pip install uv && uv venv && uv add "vision-agents[...]"
#    Start Command: python agent.py serve --host 0.0.0.0 --port $PORT
# 5. Add environment variables in the Render dashboard
# 6. Click Deploy
```

**render.yaml** (optional, for auto-config):
```yaml
services:
  - type: web
    name: guardianeye
    env: python
    buildCommand: pip install uv && uv venv --python 3.12 && uv add "vision-agents[anthropic,ultralytics,moondream,deepgram,elevenlabs,getstream]"
    startCommand: python agent.py serve --host 0.0.0.0 --port $PORT
    envVars:
      - key: STREAM_API_KEY
        sync: false
      - key: STREAM_API_SECRET
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: MOONDREAM_API_KEY
        sync: false
      - key: DEEPGRAM_API_KEY
        sync: false
      - key: ELEVENLABS_API_KEY
        sync: false
```

---

### Option C — Docker + Any Cloud (Most portable)

**Dockerfile:**
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy project files
COPY agent.py .
COPY .env .

# Install dependencies
RUN uv venv && \
    uv add "vision-agents[anthropic,ultralytics,moondream,deepgram,elevenlabs,getstream]"

# Expose port
EXPOSE 8080

# Start in production mode
CMD ["python", "agent.py", "serve", "--host", "0.0.0.0", "--port", "8080"]
```

```bash
# Build
docker build -t guardianeye .

# Run locally
docker run -p 8080:8080 --env-file .env guardianeye

# Push to Docker Hub
docker tag guardianeye yourusername/guardianeye
docker push yourusername/guardianeye

# Deploy to any cloud that accepts Docker:
# - Google Cloud Run: gcloud run deploy --image yourusername/guardianeye
# - AWS ECS: push to ECR → create ECS task
# - DigitalOcean App Platform: connect Docker Hub repo
# - Fly.io: fly launch --image yourusername/guardianeye
```

---

### Option D — Fly.io (Best free tier for always-on)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (run from your project folder)
fly launch

# Set secrets (your .env variables)
fly secrets set STREAM_API_KEY=xxx
fly secrets set STREAM_API_SECRET=xxx
fly secrets set ANTHROPIC_API_KEY=xxx
fly secrets set MOONDREAM_API_KEY=xxx
fly secrets set DEEPGRAM_API_KEY=xxx
fly secrets set ELEVENLABS_API_KEY=xxx

# Deploy
fly deploy
```

**fly.toml** (auto-generated, but set the command):
```toml
[processes]
  app = "python agent.py serve --host 0.0.0.0 --port 8080"
```

---

## Calling Your Deployed Agent

Once deployed, your agent exposes a REST API (Vision Agents v0.3 built-in):

```bash
# Start a monitoring session
curl -X POST https://your-deployed-url.com/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "guardianeye-cam-01",
    "call_type": "default"
  }'

# Response:
# { "session_id": "abc-123", "status": "started", "call_id": "guardianeye-cam-01" }

# Check session metrics
curl https://your-deployed-url.com/sessions/abc-123/metrics

# Health check
curl https://your-deployed-url.com/health
```

Then update your React frontend `.env.local`:
```
VITE_STREAM_API_KEY=your_key
VITE_STREAM_USER_TOKEN=your_token
VITE_AGENT_URL=https://your-deployed-url.com
```

And in `App.jsx`, trigger the agent session before joining the call:
```javascript
// Start the agent session before joining
await fetch(`${import.meta.env.VITE_AGENT_URL}/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ call_id: CALL_ID, call_type: 'default' })
});

// Then join the call as normal
const call = client.call('default', CALL_ID);
await call.join({ create: true });
```

---

## Quick Reference

| Mode | Command | Use case |
|------|---------|----------|
| Local dev | `python agent.py dev` | Development with webcam |
| Recorded video | `python agent.py test-video footage.mp4` | Testing + demo recording |
| Production server | `python agent.py serve --host 0.0.0.0 --port 8080` | Deployment |
| Docker | `docker run -p 8080:8080 guardianeye` | Cloud deployment |

| Platform | Free tier | Best for |
|----------|-----------|----------|
| Railway | 500 hrs/month | Quick hackathon deploy |
| Render | 750 hrs/month | Simple setup |
| Fly.io | 3 shared VMs | Always-on free |
| Docker | N/A | Any cloud |
