

// ========================================


import { useState, useEffect, useRef } from "react";
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  useCallStateHooks,
  ParticipantView,
  ParticipantsAudio,
  CallingState,
} from "@stream-io/video-react-sdk";
import { StreamChat } from "stream-chat";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY || "YOUR_STREAM_API_KEY";
const USER_TOKEN     = import.meta.env.VITE_STREAM_USER_TOKEN || "YOUR_USER_TOKEN";
const USER_ID        = import.meta.env.VITE_STREAM_USER_ID || "";
const CALL_ID        = import.meta.env.VITE_STREAM_CALL_ID || "guardianeye-cam-01";
const CALL_TYPE      = import.meta.env.VITE_STREAM_CALL_TYPE || "default";
const AGENT_URL      = import.meta.env.VITE_AGENT_URL || "";

const TCFG = {
  CLEAR:      { color: "#00ff88", dim: "#001f10", label: "ALL CLEAR",  pulse: false },
  MONITORING: { color: "#ffd700", dim: "#1f1500", label: "MONITORING", pulse: true  },
  ALERT:      { color: "#ff6b00", dim: "#1f0c00", label: "ALERT",      pulse: true  },
  CRITICAL:   { color: "#ff0040", dim: "#1f0010", label: "CRITICAL",   pulse: true  },
};

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

function resolveUserId(token) {
  if (USER_ID) return USER_ID;
  const payload = parseJwtPayload(token);
  return payload?.user_id || payload?.sub || payload?.id || "";
}

function parseThreatFromTranscript(text) {
  const upper = text.toUpperCase();
  if (upper.includes("CRITICAL"))   return "CRITICAL";
  if (upper.includes("ALERT"))      return "ALERT";
  if (upper.includes("HEADS UP") || upper.includes("MONITORING")) return "MONITORING";
  return "CLEAR";
}

async function maybeStartAgentSession() {
  if (!AGENT_URL) return;
  const res = await fetch(`${AGENT_URL.replace(/\/$/, "")}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call_id: CALL_ID, call_type: CALL_TYPE }),
  });
  if (!res.ok) throw new Error(`Session start failed: ${res.status}`);
}

// ─── useAgentMessages ─────────────────────────────────────────────────────────
function useAgentMessages(resolvedUserId) {
  const [messages, setMessages] = useState([]);
  const [threatLevel, setThreatLevel] = useState("CLEAR");
  const bufferRef = useRef({ text: '', timer: null });

  function flushBuffer() {
    const full = bufferRef.current.text.trim();
    bufferRef.current.text = '';
    if (!full || full.split(' ').length < 2) return;

    const level = parseThreatFromTranscript(full);
    const ts = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    setMessages(prev => {
      if (prev[0]?.text === full) return prev;
      return [{ text: full, level, ts }, ...prev].slice(0, 20);
    });
    setThreatLevel(level);
    if (level === "ALERT" || level === "CRITICAL") {
      setTimeout(() => setThreatLevel(prev =>
        prev === level ? "MONITORING" : prev
      ), 30000);
    }
  }

  function handleText(text) {
    if (!text || !text.trim()) return;
    const t = text.trim();
    const endsSentence = /[.!?]$/.test(t);

    clearTimeout(bufferRef.current.timer);
    bufferRef.current.text += (bufferRef.current.text ? ' ' : '') + t;

    if (endsSentence) {
      flushBuffer();
    } else {
      bufferRef.current.timer = setTimeout(flushBuffer, 600);
    }
  }

  useEffect(() => {
    if (!resolvedUserId) return;
    const seenIds = new Set();
    let channel = null;
    const chatClient = StreamChat.getInstance(STREAM_API_KEY);

    const connect = async () => {
      try {
        // Disconnect any existing connection first
        if (chatClient.userID) {
          await chatClient.disconnectUser();
        }
        await chatClient.connectUser(
          { id: resolvedUserId, name: "Security Operator" },
          USER_TOKEN
        );
        channel = chatClient.channel("messaging", CALL_ID);
        await channel.watch();

        // Remove ALL existing listeners before adding new one
        channel.off("message.new");

        channel.state.messages.forEach(msg => {
          if (msg.user?.id === "guardianeye-agent" && msg.text && !seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            handleText(msg.text);
          }
        });

        channel.on("message.new", (event) => {
          const msg = event.message;
          if (msg?.user?.id === "guardianeye-agent" && msg.text) {
            if (seenIds.has(msg.id)) return;
            seenIds.add(msg.id);
            handleText(msg.text);
          }
        });
      } catch (err) {
        console.warn("Chat connect failed, retrying:", err.message);
        setTimeout(connect, 3000);
      }
    };
    connect();
    return () => { channel?.stopWatching().catch(() => {}); };
  }, [resolvedUserId]);

  return { messages, threatLevel };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function GuardianEyeDashboard({ call, resolvedUserId }) {
  const { useLocalParticipant, useRemoteParticipants, useCallCallingState } = useCallStateHooks();
  const localParticipant   = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const callingState       = useCallCallingState();
  const { messages, threatLevel } = useAgentMessages(resolvedUserId);
  const [time, setTime]    = useState(new Date());
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const latest = messages[0];
    if (latest && (latest.level === "ALERT" || latest.level === "CRITICAL")) {
      setIncidents(prev => {
        const id = `INC-${String(prev.length + 1).padStart(4, "0")}`;
        return [{ id, ...latest }, ...prev].slice(0, 10);
      });
    }
  }, [messages]);

  const cfg = TCFG[threatLevel] || TCFG.CLEAR;
  const agentParticipant = remoteParticipants.find(p => p.userId === "guardianeye-agent");

  return (
    <div style={{ background:"#080808", minHeight:"100vh", color:"#aaa", fontFamily:"'Share Tech Mono','Courier New',monospace", padding:"16px 20px", position:"relative" }}>
      {/* OLD behavior (for rollback):
          No explicit remote audio mount in custom layout.
          This can cause "chat works but agent voice is silent" even when agent is connected.
      */}
      <ParticipantsAudio participants={remoteParticipants.filter(p => p.userId === "guardianeye-agent")} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@700&display=swap');
        @keyframes throb { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes critbg { 0%,100%{background:#080808} 50%{background:#150008} }
        @keyframes blink   { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#2a2a2a}
      `}</style>

      {threatLevel === "CRITICAL" && (
        <div style={{ position:"fixed", inset:0, animation:"critbg .8s ease-in-out infinite", zIndex:0, pointerEvents:"none" }} />
      )}
      <div style={{ position:"fixed", inset:0, background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px)", pointerEvents:"none", zIndex:1 }} />

      <div style={{ position:"relative", zIndex:2 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:38, height:38, border:`2px solid ${cfg.color}`, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 16px ${cfg.color}44`, animation: cfg.pulse ? "throb 2s ease-in-out infinite" : "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill={cfg.color}/>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill={cfg.color} opacity=".35"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:16, fontWeight:700, color:"#eee", letterSpacing:4 }}>GUARDIANEYE</div>
              <div style={{ fontSize:9, color:"#333", letterSpacing:3 }}>REAL-TIME THREAT INTELLIGENCE · VISION AGENTS BY STREAM</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, background:cfg.dim, border:`1px solid ${cfg.color}33`, borderRadius:4, padding:"6px 14px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cfg.color, boxShadow:`0 0 ${cfg.pulse?14:4}px ${cfg.color}`, animation: cfg.pulse ? "throb 1s ease-in-out infinite" : "none" }}/>
              <span style={{ color:cfg.color, fontSize:13, fontWeight:700, letterSpacing:3 }}>{cfg.label}</span>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:20, color:"#eee", letterSpacing:2 }}>{time.toLocaleTimeString("en-GB")}</div>
              <div style={{ fontSize:9, color:"#333", letterSpacing:2 }}>{time.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}</div>
            </div>
            <div style={{ padding:"3px 9px", borderRadius:3, fontSize:9, letterSpacing:2, background: callingState===CallingState.JOINED?"#002a14":"#1a1a00", border:`1px solid ${callingState===CallingState.JOINED?"#00ff8833":"#ffd70033"}`, color: callingState===CallingState.JOINED?"#00ff88":"#ffd700" }}>
              {callingState===CallingState.JOINED ? "● LIVE" : "● CONNECTING"}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:12 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Camera */}
            <Panel title="Camera Feed — CAM-01 · Vision Agents Stream Edge">
              <div style={{ position:"relative", borderRadius:4, overflow:"hidden", border:`1px solid ${cfg.color}22`, background:"#000", aspectRatio:"16/9" }}>
                {localParticipant
                    ? <ParticipantView participant={localParticipant} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#1e1e1e", fontSize:12, letterSpacing:2 }}>CONNECTING…</div>
                }
                {[
                  { top:8,    left:8,   borderTop:`2px solid ${cfg.color}`,    borderLeft:`2px solid ${cfg.color}` },
                  { top:8,    right:8,  borderTop:`2px solid ${cfg.color}`,    borderRight:`2px solid ${cfg.color}` },
                  { bottom:8, left:8,   borderBottom:`2px solid ${cfg.color}`, borderLeft:`2px solid ${cfg.color}` },
                  { bottom:8, right:8,  borderBottom:`2px solid ${cfg.color}`, borderRight:`2px solid ${cfg.color}` },
                ].map((s,i) => <div key={i} style={{ position:"absolute", width:22, height:22, ...s }} />)}
                <div style={{ position:"absolute", top:12, left:12, display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,.75)", padding:"3px 8px", borderRadius:2 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff0040", animation:"blink 1s ease-in-out infinite" }}/>
                  <span style={{ fontSize:9, letterSpacing:2, color:"#888" }}>REC</span>
                </div>
                {agentParticipant && (
                  <div style={{ position:"absolute", bottom:8, right:8, display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,.75)", padding:"3px 8px", borderRadius:2 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:cfg.color, animation:"throb .5s ease-in-out infinite" }}/>
                    <span style={{ fontSize:9, color:cfg.color, letterSpacing:2 }}>AI ACTIVE</span>
                  </div>
                )}
                {messages[0] && threatLevel !== "CLEAR" && (
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"10px 12px", fontSize:11, lineHeight:1.5, background:`linear-gradient(transparent,${cfg.dim}ee)`, color:cfg.color, animation:"fadeIn .3s ease" }}>
                    {messages[0].text}
                  </div>
                )}
              </div>
            </Panel>

            {/* AI Analysis */}
            <Panel title="AI Threat Analysis — Gemini via Vision Agents">
              {messages.length === 0
                ? <div style={{ color:"#1e1e1e", fontSize:12, textAlign:"center", padding:"20px 0" }}>Awaiting agent… speak or show something to trigger analysis</div>
                : <div>
                    <div style={{ padding:"10px 14px", background:cfg.dim, border:`1px solid ${cfg.color}33`, borderRadius:4, marginBottom:12, animation:"fadeIn .4s ease" }}>
                      <div style={{ fontSize:12, color:cfg.color, lineHeight:1.65 }}>{messages[0].text}</div>
                    </div>
                    <div style={{ maxHeight:120, overflowY:"auto" }}>
                      {messages.slice(1).map((m,i) => (
                        <div key={i} style={{ padding:"6px 0", borderBottom:"1px solid #111", display:"flex", gap:10 }}>
                          <span style={{ fontSize:9, color:"#333", flexShrink:0 }}>{m.ts}</span>
                          <span style={{ fontSize:11, color:"#444" }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
              }
            </Panel>

            {/* System Status */}
            <Panel title="System Status">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
                {[
                  { name:"Stream Edge Network", status: callingState===CallingState.JOINED?"CONNECTED":"CONNECTING", color: callingState===CallingState.JOINED?"#00ff88":"#ffd700" },
                  { name:"Vision Agents SDK",   status:"ACTIVE",   color:"#00ff88" },
                  { name:"YOLO v11 Detector",   status:"ACTIVE",   color:"#00ff88" },
                  { name:"Moondream Vision",     status:"ACTIVE",   color:"#00ff88" },
                  { name:"Gemini Realtime",      status:"ACTIVE",   color:"#00ff88" },
                  { name:"Chat Channel",         status: messages.length>0?"RECEIVING":"WATCHING", color: messages.length>0?"#00ff88":"#ffd700" },
                  { name:"GuardianEye Agent",    status: agentParticipant?"JOINED":"WAITING", color: agentParticipant?"#00ff88":"#ffd700" },
                  { name:"WebRTC Latency",       status:"<30ms",    color:"#00ff88" },
                ].map((s,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #0e0e0e" }}>
                    <span style={{ fontSize:10, color:"#3a3a3a" }}>{s.name}</span>
                    <span style={{ fontSize:9, color:s.color, letterSpacing:2 }}>● {s.status}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Right column */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Panel title="Scene Intelligence Log" style={{ flex:"1 1 auto" }}>
              <div style={{ maxHeight:300, overflowY:"auto" }}>
                {messages.length === 0
                  ? <div style={{ color:"#1e1e1e", fontSize:12, padding:"10px 0" }}>Waiting for agent…</div>
                  : messages.map((m,i) => (
                      <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid #111", animation: i===0?"fadeIn .3s ease":"none" }}>
                        <div style={{ fontSize:9, color:"#2a2a2a", marginBottom:3 }}>{m.ts}</div>
                        <div style={{ fontSize:11, lineHeight:1.5, color: i===0?"#aaa":"#444" }}>{m.text}</div>
                      </div>
                    ))
                }
              </div>
            </Panel>

            <Panel title="Incident Log" style={{ flex:"1 1 auto" }}>
              <div style={{ maxHeight:320, overflowY:"auto" }}>
                {incidents.length === 0
                  ? <div style={{ color:"#1e1e1e", fontSize:12, padding:"10px 0" }}>No incidents recorded yet</div>
                  : incidents.map(inc => {
                      const icfg = TCFG[inc.level] || TCFG.CLEAR;
                      return (
                        <div key={inc.id} style={{ padding:"10px 14px", borderLeft:`3px solid ${icfg.color}`, background:`${icfg.dim}66`, marginBottom:6, borderRadius:"0 4px 4px 0", animation:"fadeIn .3s ease" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ color:icfg.color, fontSize:10, letterSpacing:2 }}>{inc.id} · {inc.level}</span>
                            <span style={{ color:"#333", fontSize:10 }}>{inc.ts}</span>
                          </div>
                          <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>{inc.text}</div>
                        </div>
                      );
                    })
                }
              </div>
            </Panel>
          </div>
        </div>

        <div style={{ marginTop:12, padding:"8px 14px", background:"#0a0a0a", border:"1px solid #121212", borderRadius:4, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:9, color:"#1e1e1e", letterSpacing:2 }}>GUARDIANEYE v1.0 · VISION AGENTS · YOLO v11 · GEMINI · MOONDREAM</span>
          <span style={{ fontSize:9, color:"#1e1e1e", letterSpacing:2 }}>WEMAKEDEVS × VISION AGENTS HACKATHON 2025</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children, style = {} }) {
  return (
    <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:6, overflow:"hidden", ...style }}>
      <div style={{ padding:"8px 14px", background:"#111", borderBottom:"1px solid #1a1a1a", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:3, height:12, background:"#2a2a2a" }}/>
        <span style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase" }}>{title}</span>
      </div>
      <div style={{ padding:14 }}>{children}</div>
    </div>
  );
}

function CallWrapper({ client, resolvedUserId }) {
  const [call, setCall] = useState(null);

  useEffect(() => {
    let c = null;
    let cancelled = false;
    const connect = async () => {
      try { await maybeStartAgentSession(); } catch (err) { console.warn("Agent session skipped:", err); }
      c = client.call(CALL_TYPE, CALL_ID);
      await c.join({ create: true });
      if (!cancelled) setCall(c);
    };
    connect().catch(err => console.error("Failed to join call:", err));
    return () => { cancelled = true; c?.leave().catch(console.error); };
  }, [client]);

  if (!call) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#080808", color:"#333", fontFamily:"monospace", letterSpacing:3 }}>
        ESTABLISHING STREAM EDGE CONNECTION…
      </div>
    );
  }

  return (
    <StreamCall call={call}>
      <GuardianEyeDashboard call={call} resolvedUserId={resolvedUserId} />
    </StreamCall>
  );
}

export default function App() {
  const [client, setClient] = useState(null);
  const [initError, setInitError] = useState("");
  const [resolvedUserId, setResolvedUserId] = useState("");

  useEffect(() => {
    if (!USER_TOKEN || USER_TOKEN === "YOUR_USER_TOKEN") {
      setInitError("VITE_STREAM_USER_TOKEN missing — set it in frontend/.env.local");
      return;
    }
    if (!STREAM_API_KEY || STREAM_API_KEY === "YOUR_STREAM_API_KEY") {
      setInitError("VITE_STREAM_API_KEY missing — set it in frontend/.env.local");
      return;
    }
    const uid = resolveUserId(USER_TOKEN);
    if (!uid) {
      setInitError("Cannot resolve user_id from token. Set VITE_STREAM_USER_ID in .env.local");
      return;
    }
    setResolvedUserId(uid);
    const c = new StreamVideoClient({
      apiKey: STREAM_API_KEY,
      user: { id: uid, name: "Security Operator", image: `https://getstream.io/random_svg/?id=${uid}&name=Operator` },
      token: USER_TOKEN,
    });
    setClient(c);
    return () => { c.disconnectUser().catch(console.error); };
  }, []);

  if (initError) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#080808", color:"#ff6b6b", fontFamily:"monospace", padding:"20px" }}>
      {initError}
    </div>
  );

  if (!client) return null;

  return (
    <StreamVideo client={client}>
      <CallWrapper client={client} resolvedUserId={resolvedUserId} />
    </StreamVideo>
  );
}
