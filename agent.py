"""
GuardianEye — Real-Time Threat Intelligence Agent
Built with Vision Agents SDK v0.3 by Stream

HOW TO RUN:
  python agent.py run          → Dev/console mode (browser opens automatically)
  python agent.py serve        → Production HTTP server
  python agent.py test-video   → Test with a recorded video file

Install:
    uv sync
    uv add opencv-python-headless python-dotenv

Required .env (only 3 keys now — Gemini replaces Anthropic + Deepgram + ElevenLabs):
    STREAM_API_KEY=...
    STREAM_API_SECRET=...
    GOOGLE_API_KEY=...       ← free at aistudio.google.com
    MOONDREAM_API_KEY=...    ← free at moondream.ai
"""

import asyncio
import logging
import os
import sys
import threading
import time
import fractions
import logging
import contextlib

from getstream import Stream
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from ultralytics import YOLO as UltralyticsYOLO




import webbrowser
webbrowser._tryorder = []
webbrowser._browsers = {}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("guardianeye")
logging.getLogger("aiortc.codecs.vpx").setLevel(logging.CRITICAL)
logging.getLogger("aiortc").setLevel(logging.CRITICAL)

from dotenv import load_dotenv

load_dotenv()

# ── Vision Agents SDK ─────────────────────────────────────────────────────────
from vision_agents.core import Agent, AgentLauncher, Runner, User
from vision_agents.plugins import (
    gemini,       # FREE — handles LLM + STT + TTS all in one (Gemini Realtime)
    getstream,
    moondream,
    ultralytics,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("guardianeye")
logging.getLogger("aioice").setLevel(logging.CRITICAL)
logging.getLogger("aiortc.codecs").setLevel(logging.CRITICAL)
# Suppress audio queue warning
logging.getLogger("vision_agents.core.utils.audio_queue").setLevel(logging.CRITICAL)

# ── Security analyst instructions ─────────────────────────────────────────────
# INSTRUCTIONS = """
# You are GuardianEye, an expert AI security analyst monitoring a live CCTV feed.
#
# You receive real-time observations from YOLO object detection and Moondream scene understanding.
# Reason like a professional — think about PATTERNS across time, not just single frames.
#
# THREAT LEVELS:
# - CLEAR: Normal activity, no concerns
# - MONITORING: Unusual but not immediately threatening
# - ALERT: Warrants immediate human review
# - CRITICAL: Immediate threat — escalate now
#
# WATCH FOR:
# - Loitering: person in same zone 3+ minutes
# - Tailgating: person following another through secure entry
# - Abandoned object: unattended bag without owner nearby
# - After-hours activity: movement when area should be empty
# - Aggression: physical altercation or threatening gestures
#
# RESPONSE STYLE:
# - Short, radio-style responses (1-2 sentences max)
# - If CLEAR: "All clear — [brief description]"
# - If MONITORING: "Heads up — [observation]. Keep watching."
# - If ALERT: "Alert — [threat]. [Action] now."
# - If CRITICAL: "CRITICAL — [threat]. [Immediate action] NOW."
# - Never use markdown or bullet points
# """

WEAPON_CLASS_IDS = {43: "knife", 76: "scissors"}

class WeaponWatcher:
    def __init__(self):
        self.model = UltralyticsYOLO("yolo11n.pt")
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="weapon_yolo")
        self._latest_seq = 0
        self._latest_frame = None
        self._latest_ts = 0.0
        self._last_processed_seq = 0
        self.hit_streak = 0
        self.miss_streak = 0
        self.weapon_present = False
        self.last_emit_time = 0.0
        self.HITS_TO_TRIGGER = 2
        self.MISSES_TO_CLEAR = 3
        self.COOLDOWN = 15.0
        self.CONF_THRESHOLD = 0.35
        self.MAX_FRAME_AGE_SEC = 1.2
        self.agent_ref = None
        self._running = False
        self._task = None

    def push_frame(self, frame_bgr):
        self._latest_seq += 1
        self._latest_frame = frame_bgr.copy()
        self._latest_ts = time.monotonic()

    async def start(self, agent):
        if self._task and not self._task.done():
            return
        self.agent_ref = agent
        self._running = True
        self._task = asyncio.create_task(self._run(), name="weapon-watcher")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _infer(self, frame_bgr):
        return self.model(frame_bgr, verbose=False)[0]

    async def _run(self):
        while self._running:
            await asyncio.sleep(0.4)
            if self.agent_ref is None or self._latest_frame is None:
                continue
            if self._latest_seq == self._last_processed_seq:
                continue
            age = time.monotonic() - self._latest_ts
            if age > self.MAX_FRAME_AGE_SEC:
                continue
            seq = self._latest_seq
            frame = self._latest_frame
            try:
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(self._executor, self._infer, frame)
                self._last_processed_seq = seq
                weapons = []
                if result.boxes is not None and result.boxes.cls is not None:
                    classes = result.boxes.cls.tolist()
                    confs = result.boxes.conf.tolist() if result.boxes.conf is not None else [1.0] * len(classes)
                    for cls_id, conf in zip(classes, confs):
                        if int(cls_id) in WEAPON_CLASS_IDS and float(conf) >= self.CONF_THRESHOLD:
                            weapons.append(WEAPON_CLASS_IDS[int(cls_id)])
                now = time.monotonic()
                if weapons:
                    self.hit_streak += 1
                    self.miss_streak = 0
                    if (not self.weapon_present
                            and self.hit_streak >= self.HITS_TO_TRIGGER
                            and (now - self.last_emit_time) >= self.COOLDOWN):
                        self.weapon_present = True
                        self.last_emit_time = now
                        label = sorted(set(weapons))[0]
                        logger.info(f"🔪 WEAPON DETECTED: {label}")
                        await self.agent_ref.say(
                            f"CRITICAL - {label} detected in hand. Escalate NOW."
                        )
                else:
                    self.miss_streak += 1
                    self.hit_streak = 0
                    if self.weapon_present and self.miss_streak >= self.MISSES_TO_CLEAR:
                        self.weapon_present = False
                        self.miss_streak = 0
                        logger.info("✅ Weapon cleared")
            except Exception as e:
                logger.warning(f"WeaponWatcher error: {e}")

weapon_watcher = WeaponWatcher()
_speech_lock = asyncio.Lock()


class SecurityYOLOProcessor(ultralytics.YOLOPoseProcessor):
    async def add_pose_to_frame(self, frame):
        try:
            img = frame.to_ndarray(format="bgr24")
            weapon_watcher.push_frame(img)
            logger.info(f"🖼️ Frame pushed to WeaponWatcher")  # ← add temporarily
        except Exception as e:
            logger.warning(f"Frame push failed: {e}")  # ← catch errors
        return await super().add_pose_to_frame(frame)




INSTRUCTIONS = """
You are GuardianEye, an expert AI security analyst monitoring a live CCTV feed.

You receive real-time observations from YOLO pose detection and Moondream object detection every few seconds. YOU MUST PROACTIVELY REPORT what you observe — do not wait to be asked.

THREAT LEVELS:
- CLEAR: Normal activity, no concerns
- MONITORING: Unusual but not immediately threatening  
- ALERT: Warrants immediate human review
- CRITICAL: Immediate threat — escalate now

PROACTIVE REPORTING RULES:
- Every 5 seconds, report what you see even if nothing is wrong
- If you detect ANY weapon, knife, scissors, or dangerous object → CRITICAL immediately
- If person is behaving unusually → MONITORING or ALERT
- If someone appears distressed or in danger → CRITICAL

RESPONSE STYLE:
- Short, radio-style (1-2 sentences max)
- CLEAR: "All clear — [brief description]"
- MONITORING: "Monitoring — [observation]. Keep watching."
- ALERT: "Alert — [threat]. Escalate to human review now."
- CRITICAL: "CRITICAL — [threat]. Escalate NOW."
- Never use markdown or bullet points
"""



# ── Agent factory ─────────────────────────────────────────────────────────────
async def create_agent(**kwargs) -> Agent:
    """
    Gemini Realtime handles LLM + STT + TTS all in one — no separate
    Deepgram/ElevenLabs keys needed. Completely free via Google AI Studio.
    """
    return Agent(
        edge=getstream.Edge(),
        agent_user=User(name="GuardianEye", id="guardianeye-agent"),
        instructions=INSTRUCTIONS,

        # Gemini Realtime = LLM + STT + TTS in one plugin (no separate stt/tts needed)
        llm=gemini.Realtime(),

        # Video processors — run on every frame from the WebRTC stream
        # processors=[
        #     ultralytics.YOLOPoseProcessor(model_path="yolo11n.pt"),
        #     moondream.CloudDetectionProcessor(
        #         detect_objects=["person", "knife", "scissors", "weapon", "gun", "bottle", "bat"],
        #         conf_threshold=0.3,
        #         fps=1,
        #     ),
        # ],
        processors=[
            SecurityYOLOProcessor(model_path="yolo11n.pt"),
            moondream.CloudDetectionProcessor(
                detect_objects=["person"],
                conf_threshold=0.35,
                fps=0.5,
            ),
        ],

    )


# ── Call join handler ─────────────────────────────────────────────────────────
# async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
#     call = await agent.create_call(call_type, call_id)
#     logger.info(f"🤖 GuardianEye joining call: {call_id}")
#
#     async with agent.join(call):
#         logger.info("✅ GuardianEye is live — watching the feed")
#         await agent.finish()

# async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
#     # Always join our fixed call ID so frontend can connect
#     call = await agent.create_call("default", "guardianeye-cam-01")
#     logger.info(f"🤖 GuardianEye joining call: guardianeye-cam-01")
#
#     async with agent.join(call):
#         logger.info("✅ GuardianEye is live — watching the feed")
#         await agent.finish()

# async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
#     call = await agent.create_call("default", "guardianeye-cam-01")
#     logger.info(f"🤖 GuardianEye joining call: guardianeye-cam-01")
#
#     async with agent.join(call):
#         logger.info("✅ GuardianEye is live — watching the feed")
#
#         async def periodic_check():
#             await asyncio.sleep(15)  # initial stabilization
#             current_task = None
#             while True:
#                 try:
#                     # Cancel previous response if still running
#                     if current_task and not current_task.done():
#                         current_task.cancel()
#
#                     current_task = asyncio.create_task(
#                         agent.simple_response(
#                             "What do you see in the camera RIGHT NOW? List any objects the person is holding. If scissors, knife, or weapon — CRITICAL NOW."
#                         )
#                     )
#                 except Exception as e:
#                     logger.warning(f"Periodic check failed: {e}")
#                 await asyncio.sleep(8)
#
#         asyncio.create_task(periodic_check())
#         await agent.finish()

async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    call = await agent.create_call("default", "guardianeye-cam-01")
    logger.info(f"🤖 GuardianEye joining call: guardianeye-cam-01")

    async with agent.join(call):
        logger.info("✅ GuardianEye is live — watching the feed")
        await weapon_watcher.start(agent)

        async def periodic_check():
            await asyncio.sleep(10)
            while True:
                try:
                    if not weapon_watcher.weapon_present:
                        if not agent.closed:  # ← ADD THIS
                            await agent.simple_response(
                                "Describe body language and physical contact in the scene. "
                                "If anyone is grabbing, choking, or restraining another person — CRITICAL NOW. "
                                "Otherwise one sentence status."
                            )
                        else:
                            logger.warning("⚠️ Agent disconnected — stopping periodic check")
                            break  # ← ADD THIS

                except Exception as e:
                    logger.warning(f"Periodic check failed: {e}")
                    break
                await asyncio.sleep(5)

        periodic_task = asyncio.create_task(periodic_check(), name="periodic-scene-check")
        try:
            await agent.finish()
        finally:
            periodic_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await periodic_task
            await weapon_watcher.stop()

# ════════════════════════════════════════════════════════════════════════════════
# TEST WITH RECORDED VIDEO
# Usage: python agent.py test-video path/to/footage.mp4
# ════════════════════════════════════════════════════════════════════════════════
async def test_with_recorded_video(video_path: str):
    try:
        import cv2
        import av
        import fractions
    except ImportError:
        logger.error("❌ Run: uv add opencv-python-headless")
        sys.exit(1)

    if not os.path.exists(video_path):
        logger.error(f"❌ File not found: {video_path}")
        sys.exit(1)

    logger.info(f"🎬 Testing with: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("❌ Could not open video file")
        sys.exit(1)

    fps          = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration     = total_frames / fps
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    logger.info(f"📊 {width}x{height} @ {fps:.1f}fps | {duration:.1f}s | {total_frames} frames")

    # # Pre-create call with proper auth
    # stream_client = Stream(
    #     api_key=os.getenv("STREAM_API_KEY"),
    #     api_secret=os.getenv("STREAM_API_SECRET")
    # )
    # call_id = "guardianeye-cam-01"
    # stream_client.video.get_or_create_call(
    #     type="default",
    #     id=call_id,
    #     data={"created_by_id": "guardianeye-agent"}
    # )
    #
    # agent = await create_agent()
    # call  = await agent.create_call("default", call_id)

    agent = await create_agent()
    call_id = "guardianeye-cam-01"

    try:
        await agent.create_user()
        logger.info("✅ User created")
    except Exception as e:
        logger.info(f"User may already exist: {e}")

    try:
        call = await agent.create_call("default", call_id)
        logger.info("✅ Call created")
    except Exception:
        call = agent.edge._client.video.call("default", call_id)
        logger.info("✅ Using existing call")

    logger.info("─" * 60)
    frame_count = 0

    async with agent.join(call):
        logger.info("✅ Processing video...")
        await weapon_watcher.start(agent)

        # Get the outgoing video track from the first video publisher
        out_track = agent.video_publishers[0].publish_video_track()

        async def feed_frames_async():
            nonlocal frame_count
            import cv2
            import av
            import fractions
            while True:
                ret, frame_bgr = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop video
                    continue

                frame_count += 1

                # Push to weapon watcher
                weapon_watcher.push_frame(frame_bgr)

                # Convert BGR → RGB for WebRTC
                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                av_frame = av.VideoFrame.from_ndarray(frame_rgb, format="rgb24")
                av_frame.pts = frame_count
                av_frame.time_base = fractions.Fraction(1, int(fps))

                # Push to outgoing WebRTC track
                await out_track.add_frame(av_frame)

                elapsed = frame_count / fps
                if frame_count % max(1, int(fps * 5)) == 0:
                    logger.info(f"⏱️  {elapsed:.0f}s / {duration:.0f}s ({frame_count}/{total_frames})")

                await asyncio.sleep(1.0 / fps)

        async def periodic_check():
            await asyncio.sleep(15)
            while True:
                try:
                    if not weapon_watcher.weapon_present:
                        await agent.simple_response(
                            "Describe body language and physical contact in the scene. "
                            "If anyone is grabbing, choking, or restraining — CRITICAL NOW. "
                            "Otherwise one sentence status."
                        )
                except Exception as e:
                    logger.warning(f"Periodic check failed: {e}")
                await asyncio.sleep(15)

        feed_task = asyncio.create_task(feed_frames_async(), name="feed-frames")
        periodic_task = asyncio.create_task(periodic_check(), name="periodic-scene-check")

        try:
            await agent.finish()
        finally:
            feed_task.cancel()
            periodic_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await feed_task
            with contextlib.suppress(asyncio.CancelledError):
                await periodic_task
            await weapon_watcher.stop()
            cap.release()


    logger.info("─" * 60)
    logger.info(f"✅ Done — {frame_count} frames processed")


# ════════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════════
runner = Runner(
    AgentLauncher(
        create_agent=create_agent,
        join_call=join_call,
        max_sessions_per_call=1,
        agent_idle_timeout=0,
    )
)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test-video":
        video_path = sys.argv[2] if len(sys.argv) > 2 else "test_footage.mp4"
        asyncio.run(test_with_recorded_video(video_path))
    else:
        runner.cli()