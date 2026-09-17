"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';

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
      const res = await fetch("http://localhost:8000/api/v1/presentation-analysis/evaluate", {
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

      setMetrics({
        speech_pace_wpm: wpm,
        filler_words_count: fillerCount,
        filler_words_list: fillerMatches.length > 0 ? fillerMatches.join(', ') : "None",
        confidence_score: Math.max(30, Math.min(98, 95 - fillerCount * 8)),
        clarity_score: Math.max(35, Math.min(99, wpm >= 130 && wpm <= 160 ? 92 : 75)),
        engagement_score: Math.max(40, Math.min(96, 85 - fillerCount * 4))
      });
    } finally {
      setLoading(false);
    }
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

      <div className="watermark-container">
        <div className="watermark-text" style={{ bottom: '2rem', right: '2rem', left: 'auto', opacity: 0.05, zIndex: -1 }}>RHETORIC</div>
        <div className="section-container" style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', paddingTop: '2.5rem' }}>
          
          {/* ========================================================================= */}
          {/* STAGE 1: SETUP & CONFIGURATION BOX (Like Simulation Setup) */}
          {/* ========================================================================= */}
          {sessionStatus === "Setup" && (
            <div style={{ maxWidth: '940px', margin: '0 auto' }}>
              <div className="badge-red-pill">VOCAL WORKSPACE CONFIGURATION</div>
              <h1 className="font-display" style={{ fontSize: '2.8rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
                INITIALIZE VOCAL MATRIX PRACTICE
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '780px', lineHeight: '1.6', marginBottom: '2rem' }}>
                Configure your vocal practice parameters below. Choose a preset speech sample to practice specific delivery skills, enter your speech topic, and launch the live recording studio.
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
                    <span>🎙️</span>
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
                      <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.25rem' }}>🎙️ Microphone Permission Notice:</strong>
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
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFF' }}></span>
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
                        <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent-red)', animation: 'pulse 1s infinite' }}></span>
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
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#111827' }}>
                      SPEECH TRANSCRIPT / SPOKEN TEXT:
                    </label>
                    {speechRecognitionSupported && isRecording && (
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        🎙️ Live Voice Transcribing...
                      </span>
                    )}
                  </div>

                  <textarea 
                    rows={6}
                    required
                    value={speechText}
                    onChange={(e) => setSpeechText(e.target.value)}
                    className="font-mono"
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
                      className="font-mono"
                      style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>
                      Auto-calculated from live microphone recording timer or manually set for preset pacing tests.
                    </span>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn btn-red" 
                    style={{ width: '100%', padding: '0.95rem', fontSize: '0.9rem', borderRadius: '8px', letterSpacing: '0.5px', cursor: 'pointer', fontWeight: 800, marginTop: 'auto' }}
                  >
                    {loading ? 'COMPUTING PROSODY METRICS...' : 'ANALYZE SPEECH METRICS'}
                  </button>
                </form>

                {/* Right Side: Prosody & Vocal Metrics Dashboard */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                  {metrics ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Speaking Pace Card */}
                      <div style={{ padding: '1.5rem', border: '1px solid var(--border-light)', borderRadius: '14px', background: '#FFF', boxShadow: '0 8px 20px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="font-mono text-muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>SPEECH PACE (WPM)</div>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: metrics.speech_pace_wpm >= 130 && metrics.speech_pace_wpm <= 160 ? '#ECFDF5' : '#FEF2F2', color: metrics.speech_pace_wpm >= 130 && metrics.speech_pace_wpm <= 160 ? '#059669' : '#DC2626', fontWeight: 700 }}>
                            {metrics.speech_pace_wpm >= 130 && metrics.speech_pace_wpm <= 160 ? '✓ Optimal Range (130-160 WPM)' : '⚡ Adjust Cadence'}
                          </span>
                        </div>
                        <div className="font-display" style={{ fontSize: '2.8rem', fontWeight: '900', color: 'var(--text-primary)', margin: '0.4rem 0' }}>
                          {metrics.speech_pace_wpm} <span style={{ fontSize: '1rem', color: '#6B7280', fontWeight: 600 }}>Words Per Minute</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {metrics.speech_pace_wpm < 120 ? 'Your pace is slightly slow. Pick up cadence to maintain audience engagement.' : metrics.speech_pace_wpm > 165 ? 'Your pace is rapid. Introduce strategic pauses between main points.' : 'Excellent speaking cadence! Clear, persuasive, and well-articulated.'}
                        </div>
                      </div>

                      {/* Filler Words Card */}
                      <div style={{ padding: '1.5rem', border: '1px solid var(--border-light)', borderRadius: '14px', background: '#FFF', boxShadow: '0 8px 20px rgba(0,0,0,0.03)' }}>
                        <div className="font-mono text-muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>FILLER WORDS DETECTED</div>
                        <div className="font-display" style={{ fontSize: '2.8rem', fontWeight: '900', color: metrics.filler_words_count > 3 ? 'var(--accent-red)' : '#10B981', margin: '0.4rem 0' }}>
                          {metrics.filler_words_count}
                        </div>
                        <div className="font-mono" style={{ fontSize: '0.825rem', color: '#4B5563', lineHeight: '1.4' }}>
                          <strong>Breakdown:</strong> {metrics.filler_words_list || 'None detected'}
                        </div>
                      </div>

                      {/* Confidence & Vocal Clarity Dual Meters */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: '14px', background: '#FFF' }}>
                          <div className="font-mono text-muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>CONFIDENCE</div>
                          <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: '900', color: metrics.confidence_score >= 80 ? '#10B981' : 'var(--accent-red)', marginTop: '0.25rem' }}>
                            {metrics.confidence_score}%
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: '14px', background: '#FFF' }}>
                          <div className="font-mono text-muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>VOCAL CLARITY</div>
                          <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: '900', color: metrics.clarity_score >= 80 ? '#10B981' : '#F59E0B', marginTop: '0.25rem' }}>
                            {metrics.clarity_score}%
                          </div>
                        </div>
                      </div>

                      {/* AI Coach Feedback Card */}
                      <div style={{ background: '#111827', color: '#FFF', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--dark-border)' }}>
                        <div className="font-mono text-red" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                          AI COACH FEEDBACK:
                        </div>
                        <p style={{ fontSize: '0.88rem', color: '#D1D5DB', lineHeight: '1.5', margin: 0 }}>
                          {metrics.filler_words_count > 3 
                            ? 'Practice the "3-Second Silence Rule". Whenever you feel the urge to say "um" or "like", take a silent breath instead. Silence projects executive presence.'
                            : metrics.speech_pace_wpm < 120 
                            ? 'Incorporate rhythmic cadence changes to emphasize rhetorical pivots.' 
                            : 'Superb prosody balance! Your pacing and minimal filler density project command over the debate motion.'}
                        </p>
                      </div>

                      {/* Action Links */}
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => {
                            setMetrics(null);
                            setSpeechText("");
                            setDuration(30);
                            setAudioUrl(null);
                          }}
                          className="btn btn-dark"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer' }}
                        >
                          Clear & Reset Studio
                        </button>
                        <Link
                          href="/dashboard"
                          className="btn btn-red"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          View in Dashboard →
                        </Link>
                      </div>

                    </div>
                  ) : (
                    <div style={{ 
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
                    }}>
                      <div style={{ fontSize: '2.8rem', marginBottom: '0.75rem' }}>🎙️</div>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1F2937', marginBottom: '0.6rem' }}>
                        Live Microphone Recording Ready
                      </div>
                      <p style={{ fontSize: '0.88rem', maxWidth: '340px', margin: '0 auto 1.5rem', lineHeight: '1.6', color: '#4B5563' }}>
                        Click <strong>"START LIVE RECORDING"</strong> above to speak into your microphone, or click <strong>"ANALYZE SPEECH METRICS"</strong> on the left to evaluate your speech.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAnalyze()}
                        className="btn btn-login"
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
