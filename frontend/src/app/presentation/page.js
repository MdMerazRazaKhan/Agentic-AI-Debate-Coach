"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';
import MicIcon from '../../components/MicIcon';
import SpeakerIcon from '../../components/SpeakerIcon';
import { getApiUrl } from '../../config/api';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const SAMPLE_SPEECHES = [
  {
    id: "filler",
    title: "High Filler Word Sample",
    badge: "⚠️ PRACTICE PAUSES",
    icon: "⚠️",
    duration: 25,
    defaultTopic: "AI Safety & Regulatory Oversight",
    simpleDescription: "Choose this if you want to practice removing hesitation words like 'um', 'uh', and 'basically'. It shows how the AI detects verbal crutches and lowers confidence.",
    text: "Um, so basically, we believe that AI policy, you know, must be strictly enforced. Uh, without proper controls, like, risks could increase, and actually, literally no one is prepared."
  },
  {
    id: "rapid",
    title: "Rapid Pace Oxford Debate Sample",
    badge: "⚡ SPEED & ARGUMENT DENSITY",
    icon: "⚡",
    duration: 15,
    defaultTopic: "Sovereign Compute & Global Trade Law",
    simpleDescription: "Choose this if you want to test fast-paced debating with complex arguments. It shows whether your speaking speed is easy to follow or too fast for listeners.",
    text: "The affirmative premise collapses because sovereign compute governance cannot be decoupled from international trade law without triggering severe retaliatory economic sanctions."
  },
  {
    id: "masterclass",
    title: "Masterclass Keynote Speech",
    badge: "🏆 145 WPM OPTIMAL BENCHMARK",
    icon: "🏆",
    duration: 35,
    defaultTopic: "The Art of Persuasion & Democratic Discourse",
    simpleDescription: "Choose this to practice the perfect 145 WPM keynote speaking rhythm. It shows how speaking calmly with zero filler words creates high clarity and authority.",
    text: "True rhetoric is not about shouting down your opponent. It is the deliberate art of discovering the available means of persuasion in any given case. When we construct clear premises backed by empirical truth, we elevate democratic discourse."
  }
];

export default function PresentationPage() {
  // Session Stage: 'Setup' (configuration box) or 'Studio' (active recording & analytics)
  const [sessionStatus, setSessionStatus] = useState("Setup");
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [topic, setTopic] = useState(SAMPLE_SPEECHES[0].defaultTopic);

  const [speechText, setSpeechText] = useState(SAMPLE_SPEECHES[0].text);
  const [duration, setDuration] = useState(SAMPLE_SPEECHES[0].duration);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeSpeaking, setActiveSpeaking] = useState(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [micError, setMicError] = useState(null);

  // Refs for Web Audio API & MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recognitionRef = useRef(null);

  const checkAuth = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
    if (!token) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    // Check Speech Recognition Support
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechRecognitionSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          if (fullTranscript.trim()) {
            setSpeechText(fullTranscript.trim());
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Visualizer Animation
  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0E0E12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#D90429');
        gradient.addColorStop(1, '#FF4D6D');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    render();
  };

  // Start Live Microphone Recording
  const startRecording = async () => {
    if (!checkAuth()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Audio Context for Live Visualizer
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser.fftSize = 128;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      drawWaveform();

      // Media Recorder for saving audio
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;

      // Start Speech Recognition
      if (recognitionRef.current) {
        setSpeechText("");
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }

      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          setDuration(next);
          return next;
        });
      }, 1000);

    } catch (err) {
      console.warn("Microphone access blocked or unavailable:", err);
      setMicError(
        "Microphone access was denied or is not available. To record live speech: (1) Click the lock/settings icon next to the URL bar in your browser and set Microphone to 'Allow', (2) In Windows Settings > Privacy & Security > Microphone, ensure microphone access is toggled ON. Alternatively, you can select any sample speech below or type your speech to analyze metrics immediately!"
      );
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
  };

  // Handle preset option selection in setup
  const handleSelectPreset = (idx) => {
    setSelectedSampleIndex(idx);
    const sample = SAMPLE_SPEECHES[idx];
    setSpeechText(sample.text);
    setDuration(sample.duration);
    setAudioUrl(null);
    setTopic(sample.defaultTopic);
  };

  // Transition from Setup box to Active Recording Studio
  const handleStartLiveRecordingStudio = () => {
    if (!checkAuth()) return;
    if (!topic.trim()) {
      setTopic(SAMPLE_SPEECHES[selectedSampleIndex]?.defaultTopic || "General Presentation Topic");
    }
    setSessionStatus("Studio");
  };

  // Analyze Speech Metrics via API
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!checkAuth()) return;
    setLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/v1/presentation-analysis/evaluate"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          speech_text: speechText || "Test speech presentation without text",
          audio_duration_seconds: parseFloat(duration) || 30.0,
          topic: topic || "Live Speech & Presentation Practice"
        })
      });

      if (!res.ok) throw new Error('Unable to analyze speech.');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      // Local fallback calculation
      const words = (speechText || "").trim().split(/\s+/).length;
      const calcDuration = Math.max(1, parseFloat(duration) || 30);
      const wpm = Math.round((words / (calcDuration / 60)) * 10) / 10;
      
      const fillerMatches = (speechText || "").match(/\b(um|uh|like|basically|actually|you know|literally|so)\b/gi) || [];
      const fillerCount = fillerMatches.length;

      const conf10 = Math.round(Math.max(1, Math.min(10, 9.5 - fillerCount * 0.8)) * 10) / 10;
      const clar10 = Math.round(Math.max(1, Math.min(10, wpm >= 130 && wpm <= 160 ? 9.2 : 7.5)) * 10) / 10;
      const eng10 = Math.round(Math.max(1, Math.min(10, 8.5 - fillerCount * 0.4)) * 10) / 10;
      setMetrics({
        speech_pace_wpm: wpm,
        pace_status: wpm < 110 ? "slow" : wpm > 165 ? "rapid" : "optimal",
        filler_words_count: fillerCount,
        filler_words_list: fillerMatches.length > 0 ? fillerMatches.join(', ') : "None",
        confidence_score_10: conf10,
        clarity_score_10: clar10,
        engagement_score_10: eng10,
        confidence_score: conf10 * 10,
        clarity_score: clar10 * 10,
        engagement_score: eng10 * 10,
        strengths: [
          fillerCount === 0 ? "Exceptional verbal discipline with zero filler word interruptions" : "Steady verbal delivery and focused speaking posture",
          wpm >= 130 && wpm <= 160 ? `Optimal keynote pacing (${wpm} WPM)` : `Recognizable presentation structure`
        ],
        improvements: [
          wpm < 110 ? `Increase speaking pace towards 130–155 WPM` : `Maintain balanced pauses between key arguments`,
          "Support core premises with empirical evidence and verified examples"
        ],
        summary: `Your presentation operates at ${wpm} WPM with ${fillerCount} filler words. Focus on refining structure and delivery momentum to maximize audience engagement.`
      });
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text, id) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (activeSpeaking === id) {
      window.speechSynthesis.cancel();
      setActiveSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setActiveSpeaking(null);
    utterance.onerror = () => setActiveSpeaking(null);

    setActiveSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Scoped CSS for dynamic black borders on cursor hover and focus */}
      <style jsx global>{`
        /* Dynamic Black Border on Cursor Hover and Focus */
        .pa-hover-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .pa-hover-card:hover,
        .pa-hover-card:focus-within {
          border-color: #000000 !important;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08) !important;
        }
        .pa-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .pa-input:hover,
        .pa-input:focus,
        .pa-input:focus-within {
          border-color: #000000 !important;
        }
        .pa-action-btn {
          transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .pa-action-btn:hover,
        .pa-action-btn:focus {
          border-color: #000000 !important;
        }
      `}</style>

      <div className="watermark-container">
        <div className="watermark-text" style={{ bottom: '2rem', right: '2rem', left: 'auto', opacity: 0.05, zIndex: -1 }}>RHETORIC</div>
        <div className="section-container" style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', paddingTop: '2.5rem' }}>
          
          {/* ========================================================================= */}
          {/* STAGE 1: SETUP & CONFIGURATION BOX */}
          {/* ========================================================================= */}
          {sessionStatus === "Setup" && (
            <div style={{ maxWidth: '940px', margin: '0 auto' }}>
              <div className="badge-red-pill">PRESENTATION ANALYSIS ENGINE</div>
              <h1 className="font-display" style={{ fontSize: '2.8rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
                PRESENTATION ANALYSIS & SPEECH AUDIT
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '780px', lineHeight: '1.6', marginBottom: '2rem' }}>
                Evaluate speech cadence, filler word frequency, and delivery dynamics. Measure vocal confidence, clarity, and audience engagement with AI-driven prosody diagnostics.
              </p>

              {/* Main Setup Box Container */}
              <div style={{ background: '#FFF', border: '1px solid var(--border-light)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 12px 36px rgba(0,0,0,0.04)' }}>
                
                {/* 1. Preset Speech Samples Selection */}
                <div style={{ marginBottom: '2.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <label style={{ fontSize: '0.92rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      1. Choose a Preset Speech Sample
                    </label>
                    <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
                      SELECT 1 OF 3 PRACTICE DRILLS
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 1.25rem', lineHeight: '1.4' }}>
                    Each sample is calibrated for a specific speaking challenge. Read the simple descriptions below to decide which skill you want to practice.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {SAMPLE_SPEECHES.map((sample, idx) => {
                      const isSelected = selectedSampleIndex === idx;
                      return (
                        <div
                          key={sample.id}
                          onClick={() => handleSelectPreset(idx)}
                          style={{
                            padding: '1.25rem 1.5rem',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid var(--accent-red)' : '1px solid var(--border-light)',
                            background: isSelected ? '#FEF2F2' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            gap: '1.25rem',
                            alignItems: 'flex-start',
                            boxShadow: isSelected ? '0 4px 16px rgba(217, 4, 41, 0.08)' : 'none'
                          }}
                        >
                          {/* Radio Dot */}
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isSelected ? '6px solid var(--accent-red)' : '2px solid #D1D5DB',
                            background: '#FFF',
                            marginTop: '2px',
                            flexShrink: 0,
                            transition: 'all 0.2s'
                          }} />

                          {/* Content */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <h4 className="font-display" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: isSelected ? '#991B1B' : '#111827', textTransform: 'uppercase' }}>
                                {sample.icon} {sample.title}
                              </h4>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '4px',
                                  background: isSelected ? '#FEE2E2' : '#F3F4F6',
                                  color: isSelected ? '#B91C1C' : '#4B5563',
                                  border: `1px solid ${isSelected ? '#FECACA' : '#E5E7EB'}`
                                }}>
                                  {sample.badge}
                                </span>
                              </div>
                            </div>

                            {/* 1-2 Line Simple Description in Easy Words */}
                            <p style={{ fontSize: '0.88rem', color: isSelected ? '#374151' : '#4B5563', margin: 0, lineHeight: '1.5' }}>
                              {sample.simpleDescription}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Topic Input Section */}
                <div style={{ marginBottom: '2.25rem', paddingTop: '1.75rem', borderTop: '1px solid #F3F4F6' }}>
                  <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    2. Enter Topic for Vocal Matrix
                  </label>
                  <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 0.75rem' }}>
                    Type the debate motion or speech title. This topic is recorded in your database history and displayed on your analytics skill matrix.
                  </p>
                  <input 
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., AI Safety & Regulatory Oversight, Nuclear Decarbonization, Oxford Debate Motion..."
                    style={{
                      width: '100%',
                      padding: '0.9rem 1.2rem',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#FFF'
                    }}
                  />
                </div>

                {/* 3. Launch Button: "Start the live recording" */}
                <div>
                  <button 
                    type="button"
                    onClick={handleStartLiveRecordingStudio}
                    className="btn btn-red"
                    style={{
                      width: '100%',
                      padding: '1.05rem',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.65rem',
                      boxShadow: '0 6px 20px rgba(217, 4, 41, 0.25)'
                    }}
                  >
                    <MicIcon size={18} white={true} />
                    <span>START THE LIVE RECORDING →</span>
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#6B7280', marginTop: '0.6rem' }}>
                    Opens the active live recording studio with your selected sample preloaded and microphone standby ready.
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: ACTIVE STUDIO & PROSODY ANALYTICS SCREEN */}
          {/* ========================================================================= */}
          {sessionStatus === "Studio" && (
            <div>
              {/* Header Details Bar as requested: Topic, Sample Chosen, Live Recording Status */}
              <div style={{
                background: '#111827',
                color: '#FFF',
                padding: '1.5rem 2rem',
                borderRadius: '14px',
                border: '1px solid var(--dark-border)',
                marginBottom: '2rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem'
              }}>
                <div>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        TOPIC:
                      </span>
                      <h2 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFF', margin: '0.1rem 0 0', textTransform: 'uppercase' }}>
                        {topic || "General Speech Presentation"}
                      </h2>
                    </div>

                    <div style={{ borderLeft: '1px solid #374151', paddingLeft: '1.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SPEECH SAMPLE CHOSEN:
                      </span>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F87171', margin: '0.1rem 0 0' }}>
                        {SAMPLE_SPEECHES[selectedSampleIndex]?.icon} {SAMPLE_SPEECHES[selectedSampleIndex]?.title}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setSessionStatus("Setup")}
                    style={{
                      background: 'transparent',
                      border: '1px solid #4B5563',
                      color: '#E5E7EB',
                      padding: '0.6rem 1.1rem',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ← Reconfigure Topic & Sample
                  </button>
                </div>
              </div>

              {/* Microphone Permission Help Banner */}
              {micError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #F87171',
                  color: '#991B1B',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '12px',
                  marginBottom: '2rem',
                  fontSize: '0.9rem',
                  lineHeight: '1.6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '1rem', marginBottom: '0.25rem' }}>
                        <MicIcon size={18} active={true} /> Microphone Permission Notice:
                      </strong>
                      {micError}
                    </div>
                    <button
                      onClick={() => setMicError(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.2rem',
                        color: '#991B1B',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        padding: '0 0.5rem'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Recording Control Bar */}
              <div style={{ background: '#0E0E12', color: '#FFF', padding: '1.75rem 2rem', borderRadius: '16px', border: '1px solid var(--dark-border)', marginBottom: '2rem', boxShadow: '0 12px 30px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                  
                  {/* Left: Recording Controls & Timer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          background: 'var(--accent-red)',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.75rem 1.4rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 14px rgba(217, 4, 41, 0.4)'
                        }}
                      >
                        <MicIcon size={16} white={true} />
                        START LIVE RECORDING
                      </button>
                    ) : (
                      <button 
                        onClick={stopRecording}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          background: '#111827',
                          color: '#FFF',
                          border: '1px solid var(--accent-red)',
                          borderRadius: '8px',
                          padding: '0.75rem 1.4rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <MicIcon size={16} active={true} />
                        STOP RECORDING ({formatTimer(recordingTime)})
                      </button>
                    )}

                    {/* Timer Display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: isRecording ? 'var(--accent-red)' : '#A0A0B0' }}>
                      <span>⏱️</span>
                      <span>{isRecording ? formatTimer(recordingTime) : `${duration}s`}</span>
                    </div>
                  </div>

                  {/* Status Tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.8rem', color: isRecording ? '#10B981' : '#9CA3AF', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRecording ? '#10B981' : '#6B7280' }}></span>
                      {isRecording ? 'STREAMING VOCAL SIGNAL...' : 'MICROPHONE STANDBY'}
                    </span>
                  </div>
                </div>

                {/* Live Waveform Canvas / Audio Player */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #1F1F26' }}>
                  {isRecording && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }}></span>
                        LIVE MICROPHONE STREAM AUDIO ACTIVE...
                      </div>
                      <canvas 
                        ref={canvasRef} 
                        width={800} 
                        height={70} 
                        style={{ width: '100%', height: '70px', borderRadius: '8px', background: '#09090B' }}
                      />
                    </div>
                  )}

                  {audioUrl && !isRecording && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#18181B', padding: '0.85rem 1.25rem', borderRadius: '10px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#A0A0B0' }}>
                        RECORDED AUDIO PLAYBACK:
                      </div>
                      <audio controls src={audioUrl} style={{ height: '36px', flex: 1 }} />
                    </div>
                  )}
                </div>
              </div>

              {/* 2-Column Grid: Form & Analytics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'stretch' }}>
                
                {/* Left Side: Speech Transcript & Duration Controls */}
                <form onSubmit={handleAnalyze} style={{ 
                  background: '#FFF', 
                  padding: '2.25rem', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '16px', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box'
                }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#111827' }}>
                      SPEECH TRANSCRIPT / SPOKEN TEXT:
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      {speechRecognitionSupported && isRecording && (
                        <span style={{ fontSize: '0.75rem', color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MicIcon size={14} active={true} /> Live Voice Transcribing...
                        </span>
                      )}
                    </div>
                  </div>

                  <textarea 
                    rows={6}
                    required
                    value={speechText}
                    onChange={(e) => setSpeechText(e.target.value)}
                    className="font-mono pa-input"
                    placeholder="Speak into microphone or edit the speech text here in English..."
                    style={{
                      width: '100%',
                      padding: '1rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      outline: 'none',
                      marginBottom: '1.25rem',
                      boxSizing: 'border-box',
                      lineHeight: '1.6',
                      background: '#F9FAFB'
                    }}
                  />

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="font-mono" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.4rem' }}>
                      SPEECH DURATION (SECONDS):
                    </label>
                    <input 
                      type="number"
                      min={1}
                      max={3600}
                      required
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="font-mono pa-input"
                      style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>
                      Auto-calculated from live microphone recording timer or manually set for preset pacing tests.
                    </span>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn btn-red pa-action-btn" 
                    style={{ width: '100%', padding: '0.95rem', fontSize: '0.9rem', borderRadius: '8px', letterSpacing: '0.5px', cursor: 'pointer', fontWeight: 800, marginTop: 'auto' }}
                  >
                    {loading ? 'COMPUTING PROSODY METRICS...' : 'ANALYZE PRESENTATION →'}
                  </button>
                </form>

                {/* Right Side: Presentation Analysis Dashboard matching Friend's Reference */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                  {metrics ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Top Row: PACE and FILLER WORDS */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        {/* Pace Card */}
                        <div 
                          className="pa-hover-card" 
                          style={{ 
                            padding: '1.5rem', 
                            border: '1px solid var(--border-light)', 
                            borderRadius: '14px', 
                            background: '#FFF', 
                            boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                            textAlign: 'center'
                          }}
                        >
                          <div className="font-mono text-muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                            PACE
                          </div>
                          <div className="font-display" style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                            {metrics.speech_pace_wpm} <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6B7280' }}>wpm</span>
                          </div>
                          <div style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            fontFamily: 'var(--font-mono)',
                            color: metrics.pace_status === 'optimal' ? '#059669' : '#D90429',
                            textTransform: 'lowercase'
                          }}>
                            {metrics.pace_status || (metrics.speech_pace_wpm < 110 ? 'slow' : metrics.speech_pace_wpm > 165 ? 'rapid' : 'optimal')}
                          </div>
                        </div>

                        {/* Filler Words Card */}
                        <div 
                          className="pa-hover-card" 
                          style={{ 
                            padding: '1.5rem', 
                            border: '1px solid var(--border-light)', 
                            borderRadius: '14px', 
                            background: '#FFF', 
                            boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                            textAlign: 'center'
                          }}
                        >
                          <div className="font-mono text-muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                            FILLER WORDS
                          </div>
                          <div className="font-display" style={{ fontSize: '2.5rem', fontWeight: 900, color: metrics.filler_words_count > 0 ? 'var(--accent-red)' : 'var(--text-primary)', margin: '0.2rem 0' }}>
                            {metrics.filler_words_count}
                          </div>
                          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                            {metrics.filler_words_count === 0 ? 'zero filler words detected' : metrics.filler_words_list}
                          </div>
                        </div>
                      </div>

                      {/* Presentation Delivery Metrics: Confidence, Clarity, Engagement */}
                      <div 
                        className="pa-hover-card" 
                        style={{ 
                          padding: '1.6rem', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '14px', 
                          background: '#FFF',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                          <span className="font-mono text-muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            PRESENTATION METRICS
                          </span>
                          <span className="font-mono" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                            1.0 – 10.0 SCALE
                          </span>
                        </div>

                        {/* Confidence Metric Row */}
                        <div style={{ marginBottom: '1.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', letterSpacing: '0.05em' }}>
                              CONFIDENCE
                            </span>
                            <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>
                              {(metrics.confidence_score_10 !== undefined ? metrics.confidence_score_10 : (metrics.confidence_score / 10)).toFixed(1)}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(5, ((metrics.confidence_score_10 !== undefined ? metrics.confidence_score_10 : (metrics.confidence_score / 10)) / 10) * 100))}%`, 
                              height: '100%', 
                              background: '#F97316', 
                              borderRadius: '9999px',
                              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}></div>
                          </div>
                        </div>

                        {/* Clarity Metric Row */}
                        <div style={{ marginBottom: '1.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', letterSpacing: '0.05em' }}>
                              CLARITY
                            </span>
                            <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>
                              {(metrics.clarity_score_10 !== undefined ? metrics.clarity_score_10 : (metrics.clarity_score / 10)).toFixed(1)}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(5, ((metrics.clarity_score_10 !== undefined ? metrics.clarity_score_10 : (metrics.clarity_score / 10)) / 10) * 100))}%`, 
                              height: '100%', 
                              background: '#F97316', 
                              borderRadius: '9999px',
                              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}></div>
                          </div>
                        </div>

                        {/* Engagement Metric Row */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', letterSpacing: '0.05em' }}>
                              ENGAGEMENT
                            </span>
                            <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>
                              {(metrics.engagement_score_10 !== undefined ? metrics.engagement_score_10 : (metrics.engagement_score / 10)).toFixed(1)}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(5, ((metrics.engagement_score_10 !== undefined ? metrics.engagement_score_10 : (metrics.engagement_score / 10)) / 10) * 100))}%`, 
                              height: '100%', 
                              background: '#F97316', 
                              borderRadius: '9999px',
                              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Strengths Card */}
                      <div 
                        className="pa-hover-card" 
                        style={{ 
                          padding: '1.5rem', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '14px', 
                          background: '#FFF',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                          STRENGTHS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {(metrics.strengths && metrics.strengths.length > 0 ? metrics.strengths : ["Shows an intention to address a school-policy issue"]).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', color: '#1F2937', lineHeight: '1.55' }}>
                              <span style={{ color: '#059669', fontWeight: 800, marginTop: '-1px' }}>•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Improvements Card */}
                      <div 
                        className="pa-hover-card" 
                        style={{ 
                          padding: '1.5rem', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '14px', 
                          background: '#FFF',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                          IMPROVEMENTS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {(metrics.improvements && metrics.improvements.length > 0 ? metrics.improvements : [
                            "Develop a clear thesis statement about allowing phones in school",
                            "Organize the argument into a logical sequence (e.g., introduction, benefits, counter-arguments, conclusion)",
                            "Eliminate incomplete or fragmented sentences",
                            "Use concrete examples and data to support claims",
                            "Incorporate rhetorical devices such as parallelism or rhetorical questions to keep listeners engaged"
                          ]).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', color: '#1F2937', lineHeight: '1.55' }}>
                              <span style={{ color: 'var(--accent-red)', fontWeight: 800, marginTop: '-1px' }}>•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rhetorical Pros & Cons Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        {/* Pros Card */}
                        <div 
                          className="pa-hover-card" 
                          style={{ 
                            padding: '1.5rem', 
                            border: '1px solid var(--border-light)', 
                            borderRadius: '14px', 
                            background: '#FFF',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            RHETORICAL PROS
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {(metrics.pros && metrics.pros.length > 0 ? metrics.pros : [
                              "Clear vocal delivery that conveys key premise and main speaking objective.",
                              "Direct articulate delivery with recognizable structural progression."
                            ]).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', color: '#1F2937', lineHeight: '1.55' }}>
                                <span style={{ color: '#059669', fontWeight: 800, marginTop: '-1px' }}>✓</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cons Card */}
                        <div 
                          className="pa-hover-card" 
                          style={{ 
                            padding: '1.5rem', 
                            border: '1px solid var(--border-light)', 
                            borderRadius: '14px', 
                            background: '#FFF',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            FRICTION POINTS &amp; CONS
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {(metrics.cons && metrics.cons.length > 0 ? metrics.cons : [
                              "Premise-to-conclusion transitions could benefit from tighter deductive connective phrasing.",
                              "Minor opportunities to introduce tactical 2-second rhetorical pauses before major assertions."
                            ]).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', color: '#1F2937', lineHeight: '1.55' }}>
                                <span style={{ color: '#D97706', fontWeight: 800, marginTop: '-1px' }}>⚠</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* AI Coach Feedback Card */}
                      {metrics.ai_feedback && (
                        <div 
                          style={{ 
                            background: '#0F172A', 
                            color: '#FFF', 
                            borderRadius: '14px', 
                            padding: '1.5rem 1.75rem', 
                            boxShadow: '0 4px 16px rgba(0,0,0,0.05)' 
                          }}
                        >
                          <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#EF4444', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                            AI COACH FEEDBACK:
                          </div>
                          <p style={{ fontSize: '0.95rem', color: '#F1F5F9', lineHeight: '1.6', margin: 0 }}>
                            {metrics.ai_feedback}
                          </p>
                        </div>
                      )}

                      {/* Summary Card with Read Aloud TTS */}
                      <div 
                        className="pa-hover-card" 
                        style={{ 
                          padding: '1.5rem', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '14px', 
                          background: '#FFF',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span className="font-mono text-muted" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            SUMMARY
                          </span>
                          <button
                            type="button"
                            onClick={() => speakText(metrics.summary || "The draft is too fragmentary to convey confidence or clarity, and it won't hold an audience's attention. Build a complete, well-structured argument with concrete examples and purposeful language to improve all three metrics.", "summary")}
                            className="btn pa-action-btn"
                            style={{
                              background: activeSpeaking === "summary" ? "#FEF2F2" : "#F9FAFB",
                              border: activeSpeaking === "summary" ? "1px solid var(--accent-red)" : "1px solid var(--border-light)",
                              color: activeSpeaking === "summary" ? "var(--accent-red)" : "var(--text-secondary)",
                              padding: "0.3rem 0.65rem",
                              fontSize: "0.72rem",
                              gap: "0.35rem",
                              display: "inline-flex",
                              alignItems: "center",
                              cursor: "pointer",
                              borderRadius: "6px"
                            }}
                            title="Read summary aloud"
                          >
                            <SpeakerIcon size={14} active={activeSpeaking === "summary"} />
                            <span>{activeSpeaking === "summary" ? "STOP" : "READ"}</span>
                          </button>
                        </div>
                        <p style={{ fontSize: '0.92rem', color: '#1F2937', lineHeight: '1.65', margin: 0 }}>
                          {metrics.summary || "The draft is too fragmentary to convey confidence or clarity, and it won't hold an audience's attention. Build a complete, well-structured argument with concrete examples and purposeful language to improve all three metrics."}
                        </p>
                      </div>

                      {/* Action Links */}
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setMetrics(null);
                            setSpeechText("");
                            setDuration(18);
                            setAudioUrl(null);
                          }}
                          className="btn btn-dark pa-action-btn"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer' }}
                        >
                          Clear & Reset Studio
                        </button>
                        <Link
                          href="/dashboard?tab=presentations"
                          className="btn btn-red pa-action-btn"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          View Dashboard →
                        </Link>
                      </div>

                    </div>
                  ) : (
                    <div 
                      className="pa-hover-card"
                      style={{ 
                        flex: 1, 
                        height: '100%', 
                        padding: '2.5rem 2rem', 
                        border: '2px dashed var(--border-light)', 
                        borderRadius: '16px', 
                        textAlign: 'center', 
                        color: 'var(--text-muted)', 
                        background: '#FAFAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ marginBottom: '0.85rem' }}>
                        <MicIcon size={52} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1F2937', marginBottom: '0.6rem' }}>
                        Live Microphone Recording Ready
                      </div>
                      <p style={{ fontSize: '0.88rem', maxWidth: '340px', margin: '0 auto 1.5rem', lineHeight: '1.6', color: '#4B5563' }}>
                        Click <strong>"START LIVE RECORDING"</strong> above to speak into your microphone, or click <strong>"ANALYZE PRESENTATION"</strong> on the left to evaluate your speech.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAnalyze()}
                        className="btn btn-login pa-action-btn"
                        style={{ padding: '0.75rem 1.4rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Run Quick Evaluation on Current Text →
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
