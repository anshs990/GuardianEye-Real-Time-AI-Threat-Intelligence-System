# GuardianEye — Hackathon Demo Script & Pitch Writeup

---

## 🎯 ONE-LINE PITCH
> GuardianEye is a real-time AI security agent that doesn't just see threats —
> it understands them, using YOLO, Moondream, and Claude to reason across time
> like a seasoned security professional.

---

## 📋 PROJECT SUBMISSION WRITEUP

### What We Built
GuardianEye is a multi-modal AI security agent that transforms any live video
feed into an intelligent, context-aware threat intelligence system.

Unlike traditional security software that triggers on simple motion or object
thresholds, GuardianEye reasons across time — understanding not just *what*
it sees, but *what it means*.

### The Problem
Existing security systems are dumb. They fire thousands of false alerts on
leaves blowing past sensors, or miss real threats because no single frame
crosses a simple threshold. Human operators experience alert fatigue and
miss genuine incidents. The result: critical threats slip through.

### Our Solution
GuardianEye uses a three-layer AI pipeline built on Vision Agents SDK:

**Layer 1 — Perception (YOLO v8)**
Processes every frame at <18ms latency via Stream's edge network. Detects
and localizes people, vehicles, and objects with bounding boxes streamed
live to the dashboard.

**Layer 2 — Understanding (Moondream)**
Every 2.5 seconds, Moondream generates a rich natural language scene description:
"Individual in dark jacket crouching near the east entrance door, checking
phone repeatedly, third pass in 5 minutes." This is the scene *context*
that raw bounding boxes can't provide.

**Layer 3 — Reasoning (Claude)**
Every 5 seconds, Claude receives the full observation history — a rolling
window of YOLO detections + Moondream descriptions — and reasons like a
security professional:
- Is there a pattern across time?
- Is this behavior consistent with the location and time of day?
- What's the threat level, and what should the operator do right now?

**Output**
- Live annotated video feed with real-time bounding boxes
- Running scene intelligence log
- Structured incident reports with recommended actions
- TTS audio alerts for critical threats
- React dashboard with all data in one view

### Why Vision Agents?
Vision Agents by Stream gave us the critical infrastructure we couldn't
build ourselves in a hackathon: <500ms join latency, sub-30ms A/V latency,
and WebRTC infrastructure that just works. We used native SDK methods for
video frame processing, allowing us to focus entirely on the AI pipeline.

### Impact
Security monitoring is a $45B industry still largely relying on human
operators watching screens. GuardianEye demonstrates that AI can augment
(and eventually replace) this in high-value areas — reducing false positives
by reasoning contextually, and catching threats that pixel-threshold systems
miss entirely.

---

## 🎬 DEMO SCRIPT (5 minutes)

### Hook (0:00 – 0:30)
"Every day, security operators watch thousands of hours of footage and miss
critical incidents — not because they're not paying attention, but because
their tools are too dumb to tell them what matters.

GuardianEye changes that. This is a real-time AI agent that watches your
video feeds and reasons about them like a seasoned security professional."

*[Show dashboard loading, live feed starting]*

### Architecture walkthrough (0:30 – 1:30)
"There are three AI layers working together here.

First, YOLOv8 — running right there on every frame. See that bounding box?
That's 18 milliseconds. That's the Vision Agents SDK + Stream's edge
network giving us real-time detection at scale.

But bounding boxes alone don't tell you anything meaningful. So every few
seconds, Moondream looks at the scene and gives us this..."

*[Point to scene intelligence log, read latest entry aloud]*

"That's the scene context. Now here's where it gets interesting."

### Claude reasoning demo (1:30 – 2:30)
"Claude receives the last 20 observations — that's everything YOLO detected
and everything Moondream described — and reasons about it as a timeline.

Watch what happens when I walk past the camera three times..."

*[Demonstrate loitering behavior in front of camera]*
*[Wait for MONITORING → ALERT escalation to appear]*

"There it is. Claude didn't fire on the first pass, or the second. It saw
the pattern — three passes, checking exits, unusual for this time of day —
and escalated to ALERT with a specific recommended action."

*[Read the recommended action aloud]*

### Incident log (2:30 – 3:15)
"Every ALERT and CRITICAL event gets logged here as a structured incident
report — with a summary, the key observations that triggered it, and the
recommended next step for the operator.

This is audit-ready out of the box. You can export this, plug it into your
SIEM, or just let the on-site security team act on it."

### The stack (3:15 – 4:00)
"To summarize what's running here:
- Vision Agents SDK handles the WebRTC stream and frame delivery
- YOLOv8 runs detection at <30ms per frame
- Moondream generates scene descriptions every 2.5 seconds
- Claude reasons over the rolling observation history every 5 seconds
- This React dashboard consumes it all via WebSocket in real-time

The entire backend is ~400 lines of Python. Vision Agents handled
everything that would have taken us weeks to build."

### Close (4:00 – 5:00)
"Security is one of the most important real-world applications for
real-time video AI. GuardianEye proves you can build something genuinely
useful, genuinely novel, and genuinely low-latency using Vision Agents
as the foundation.

We're not showing you a prototype. This is a working agent. And the same
architecture — perception, understanding, reasoning — applies to sports
coaching, healthcare monitoring, industrial safety, retail analytics.

This is what Vision Agents makes possible."

---

## ✅ JUDGING CRITERIA CHECKLIST

| Criterion               | How GuardianEye Scores                                         |
|-------------------------|----------------------------------------------------------------|
| **Potential Impact**    | $45B security market, genuine problem, enterprise-ready output |
| **Creativity & Innovation** | Temporal reasoning over video history — never done this way before |
| **Technical Excellence** | Full 3-layer AI pipeline, clean architecture, production-grade |
| **Real-Time Performance** | <18ms YOLO, 2.5s scene analysis, <30ms via Stream edge network |
| **User Experience**     | Tactical dashboard, instant visual feedback, audio alerts       |
| **Best Use of Vision Agents** | YOLO + Moondream + Claude + Stream SDK all native           |

---

## 📱 SOCIAL MEDIA POST (for @VisionAgents tag)

> 🔐 Built GuardianEye at the @VisionAgents hackathon
>
> An AI security agent that REASONS about threats — not just detects objects.
>
> Stack: YOLO (perception) → Moondream (understanding) → Claude (reasoning)
> All running in real-time via @Stream's Vision Agents SDK
>
> 18ms detection. Context-aware threat analysis. Incident reports that write themselves.
>
> The future of physical security is here 👁️
>
> #VisionAgents #WeMakeDevs #BuildInPublic #RealtimeAI #ComputerVision

---

## 🗂️ README SUMMARY

# GuardianEye

Real-time AI threat intelligence agent powered by Vision Agents (Stream).

**Stack:** Python · FastAPI · YOLOv8 · Moondream · Claude API · React · Vision Agents SDK

**How it works:**
1. Vision Agents SDK streams live video via Stream's WebRTC edge network
2. YOLOv8 detects objects on every frame (<18ms latency)
3. Moondream generates scene descriptions every 2.5 seconds
4. Claude reasons over the observation history every 5 seconds
5. React dashboard displays everything in real-time via WebSocket

**Setup:**
```bash
# Backend
pip install -r requirements.txt
STREAM_API_KEY=xxx ANTHROPIC_API_KEY=xxx python agent.py

# Frontend
cd frontend && npm install && npm run dev
```

Built for the WeMakeDevs × Vision Agents Hackathon.
