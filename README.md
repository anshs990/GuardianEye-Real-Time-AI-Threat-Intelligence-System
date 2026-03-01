# 👁️ GuardianEye — Real-Time AI Threat Intelligence System

> A multimodal AI security surveillance system that watches, understands, and escalates threats in real time — using vision, audio, and language models working together.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.12-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What It Does

GuardianEye monitors a live camera feed and automatically detects threats — weapons, physical altercations, distress signals — then escalates with a voice alert and updates a live operator dashboard.

- 🔴 **Weapon detection** — identifies knives, scissors, and dangerous objects in real time
- 🥊 **Physical threat detection** — detects choking, grabbing, and restraining behaviour
- 🎙️ **Voice escalation** — speaks CRITICAL/ALERT/MONITORING status via Gemini Realtime TTS
- 🌐 **Multi-language** — understands threat speech in English, Hindi, Malayalam, and more
- 📋 **Live dashboard** — React frontend shows incident log, threat level, and scene analysis
- 🎬 **Video file mode** — analyze recorded footage instead of live webcam

---

## Architecture

```
Live Webcam / Video File
        │
        ▼
┌─────────────────────────────────────┐
│         Stream Vision Agents SDK     │  ← WebRTC real-time transport
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  YOLO v11   │  │  Moondream   │  │  ← Frame-level analysis
│  │ Pose+Weapon │  │  Cloud VLM   │  │
│  └──────┬──────┘  └──────┬───────┘  │
│         └────────┬────────┘         │
│                  ▼                  │
│         Gemini Realtime             │  ← LLM + STT + TTS in one
│         (Audio + Vision)            │
└──────────────────┬──────────────────┘
                   │
          Stream Chat API
                   │
                   ▼
         React Dashboard
    (Threat level · Incidents · Log)
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent framework | Stream Vision Agents SDK |
| LLM + STT + TTS | Gemini Realtime (Google AI Studio) |
| Pose detection | YOLO v11 — Ultralytics |
| Weapon detection | YOLO v11 COCO (local, <1s latency) |
| Scene understanding | Moondream Cloud VLM |
| Video transport | Stream Video SDK (WebRTC) |
| Chat / messaging | Stream Chat SDK |
| Frontend | React + Stream Video React SDK |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- API keys for: Stream, Google AI Studio (Gemini), Moondream

### 1. Clone

```bash
git clone https://github.com/yourusername/guardianeye.git
cd guardianeye
```

### 2. Backend Setup

```bash
cd Vision-Agents
uv sync
uv add opencv-python-headless python-dotenv
```

Create `.env`:

```env
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
GOOGLE_API_KEY=your_google_ai_studio_key
MOONDREAM_API_KEY=your_moondream_api_key
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
VITE_STREAM_API_KEY=your_stream_api_key
VITE_STREAM_USER_TOKEN=your_operator_user_token
VITE_STREAM_USER_ID=operator-01
VITE_STREAM_CALL_ID=guardianeye-cam-01
VITE_STREAM_CALL_TYPE=default
```

### 4. Run

```bash
# Terminal 1 — Backend agent
cd Vision-Agents
python agent.py run

# Terminal 2 — Frontend dashboard
cd frontend
npm run dev
```

Open `http://localhost:5173`

---

## Usage

### Live Webcam Mode

```bash
python agent.py run
```

Open the dashboard, allow camera access. The agent joins the call automatically, monitors continuously, and escalates when a threat is detected.

### Recorded Video Mode

```bash
python agent.py test-video path/to/footage.mp4
```

The agent analyzes the video file and posts alerts to the dashboard in real time — useful for testing without a live camera.

---

## 🚧 Work in Progress

**Sub-second scene understanding latency** — currently the biggest active focus.

Right now, holding a knife in frame takes up to 20 seconds before the system triggers a CRITICAL alert. This is due to the architectural latency chain: Moondream processes at 1 FPS → periodic prompt fires every 10 seconds → Gemini generates a response (~2–3s). Total worst case: ~15–20 seconds.

The local YOLO weapon detector (`WeaponWatcher`) already brings **knife and scissors detection down to ~1 second** using a state machine with frame-level inference on CPU. The goal is to bring **all threat categories** — physical altercations, distress, loitering — to the same sub-second response window by moving scene understanding off the periodic polling model and onto a frame-triggered, event-driven architecture.

Planned approach:
- Replace polling-based `periodic_check` with event-driven triggers from YOLO pose anomaly detection
- Run a lightweight local VLM (e.g. Moondream edge) for instant scene classification per-frame
- Reserve Gemini Realtime for confirmation and natural language escalation only, not initial detection

---

## How Threat Detection Works

### Weapon Detection — Fast Path (~1s latency)

- `SecurityYOLOProcessor` intercepts every WebRTC frame via `add_pose_to_frame`
- Frames are pushed to `WeaponWatcher` which runs YOLO object detection locally on CPU
- Requires 2 consecutive detections above 35% confidence before triggering
- Requires 3 consecutive misses before clearing the alert
- 15 second cooldown between repeated alerts
- Calls `agent.say()` directly — bypasses LLM for instant voice response

### Behavioural Detection — Slow Path (~5–8s latency)

- `periodic_check` sends a prompt to Gemini Realtime every 10 seconds
- Gemini sees the live video frames alongside YOLO and Moondream context
- Detects choking, grabbing, restraining, distress, loitering
- Results posted to Stream Chat and rendered on the React dashboard

### Threat Levels

| Level | Trigger |
|-------|---------|
| 🟢 ALL CLEAR | No anomalies detected |
| 🟡 MONITORING | Unusual but non-threatening activity |
| 🟠 ALERT | Warrants immediate human review |
| 🔴 CRITICAL | Immediate threat — escalate now |

---

## Project Structure

```
guardianeye/
├── Vision-Agents/
│   ├── agent.py          # Main agent — processors, detection logic, join_call
│   ├── .env              # API keys (not committed)
│   └── yolo11n.pt        # YOLO model (auto-downloaded on first run)
└── frontend/
    ├── src/
    │   └── App.jsx       # Dashboard — Stream Video + Chat integration
    ├── .env.local        # Frontend keys (not committed)
    └── package.json
```

---

## API Keys

| Key | Where to get |
|-----|-------------|
| `STREAM_API_KEY` + `STREAM_API_SECRET` | [getstream.io](https://getstream.io) — free tier available |
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) — free |
| `MOONDREAM_API_KEY` | [moondream.ai](https://moondream.ai) — free tier available |

---

## License

MIT
