"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SpeakerIcon from "../../components/SpeakerIcon";
import MicIcon from "../../components/MicIcon";

export default function CounterArgumentPage() {
  const [topic, setTopic] = useState("");
  const [argument, setArgument] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // Audio Speech-to-Text & Text-to-Speech
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeaking, setActiveSpeaking] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef("");

  const sampleBenchmark = {
    topic: "Should students be allowed to use mobile phones in school?",
    argument: "Mobile phones can be useful educational tools when used under proper rules. Students can use them to research information, access educational apps, use calculators, and communicate during emergencies. Instead of completely banning phones, schools should teach students how to use them responsibly."
  };

  // Initialize Speech Recognition (Matches Vocal Metrics implementation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (event) => {
          let fullTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + " ";
          }
          if (fullTranscript.trim()) {
            const prefix = baseTextRef.current ? baseTextRef.current + " " : "";
            setArgument(prefix + fullTranscript.trim());
          }
        };

        rec.onerror = (e) => {
          console.warn("Speech Recognition error:", e);
          setIsRecording(false);
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsRecording(false);
    } else {
      baseTextRef.current = argument.trim();
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn("Could not start recording:", err);
      }
    }
  };

  const handleSpeak = (textKey, textContent) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (activeSpeaking === textKey) {
      window.speechSynthesis.cancel();
      setActiveSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textContent);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    utterance.onend = () => setActiveSpeaking(null);
    utterance.onerror = () => setActiveSpeaking(null);

    setActiveSpeaking(textKey);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text, idx) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const loadSample = () => {
    setTopic(sampleBenchmark.topic);
    setArgument(sampleBenchmark.argument);
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!argument.trim()) {
      setError("Please enter or record an argument before generating counterarguments.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/counterarguments/deep-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          argument: argument.trim()
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Counterargument generation failed:", err);
      setError("Failed to connect to counterargument engine. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const rebuttalCategoryStyles = {
    "LOGICAL REBUTTAL": {
      tagColor: "#B91C1C",
      tagBg: "#FEF2F2",
      borderLeft: "4px solid #DC2626"
    },
    "EVIDENCE-BASED REBUTTAL": {
      tagColor: "#1D4ED8",
      tagBg: "#EFF6FF",
      borderLeft: "4px solid #2563EB"
    },
    "ETHICAL COUNTERARGUMENT": {
      tagColor: "#7C2D12",
      tagBg: "#FFF7ED",
      borderLeft: "4px solid #EA580C"
    },
    "PRACTICAL COUNTERARGUMENT": {
      tagColor: "#4338CA",
      tagBg: "#EEF2FF",
      borderLeft: "4px solid #4F46E5"
    },
    "POLICY COUNTERARGUMENT": {
      tagColor: "#047857",
      tagBg: "#ECFDF5",
      borderLeft: "4px solid #059669"
    }
  };

  return (
    <div className="watermark-container" style={{ minHeight: "100vh", background: "var(--bg-secondary)", paddingBottom: "6rem" }}>
      {/* Scoped CSS for dynamic black borders on cursor move (hover) and focus */}
      <style>{`
        /* Dynamic Black Border on Cursor Hover and Focus */
        .ca-black-border-hover {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
        }
        .ca-black-border-hover:hover,
        .ca-black-border-hover:focus,
        .ca-black-border-hover:focus-within {
          border-color: #000000 !important;
        }

        /* Input and Textarea Fields */
        .ca-input-field {
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
          border: 1px solid var(--border-light) !important;
        }
        .ca-input-field:hover,
        .ca-input-field:focus {
          border-color: #000000 !important;
          box-shadow: 0 0 0 1px #000000 !important;
          outline: none !important;
        }

        /* Rebuttal Result Cards */
        .ca-rebuttal-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
          border: 1px solid var(--border-light) !important;
        }
        .ca-rebuttal-card:hover {
          border-color: #000000 !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07) !important;
        }

        /* Diagnostic & Submission Cards */
        .ca-card-box {
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
          border: 1px solid var(--border-light) !important;
        }
        .ca-card-box:hover {
          border-color: #000000 !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important;
        }

        /* Interactive Buttons */
        .ca-action-btn {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease !important;
        }
        .ca-action-btn:hover,
        .ca-action-btn:focus {
          border-color: #000000 !important;
        }
      `}</style>

      <div className="watermark-text" style={{ bottom: "2rem", right: "2rem", left: "auto", opacity: 0.035, zIndex: 0 }}>RHETORIC</div>
      
      <div className="section-container" style={{ position: "relative", zIndex: 1, maxWidth: "1160px", margin: "0 auto", padding: "2.5rem 1.5rem 0" }}>
        
        {/* Header Title Section */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="badge-red-pill">
            <span className="badge-dot" />
            COUNTERARGUMENT GENERATION ENGINE
          </div>

          <h1 className="font-display" style={{
            fontSize: "2.8rem",
            fontWeight: 900,
            textTransform: "uppercase",
            marginBottom: "0.6rem",
            letterSpacing: "-0.5px",
            color: "var(--text-primary)"
          }}>
            COUNTERARGUMENT GENERATION ENGINE
          </h1>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: "1.05rem",
            maxWidth: "880px",
            lineHeight: 1.6,
            margin: 0
          }}>
            Interrogate debate motions, expose unstated assumptions, and synthesize multi-layered rebuttals across logical, empirical, ethical, practical, and policy dimensions alongside constructive counterpoints and strategic cross-examination probes.
          </p>

          {/* Engine Capabilities Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1.1rem" }}>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>⚡</span> REBUTTAL GENERATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>🛡️</span> COUNTERPOINT CREATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>👁️</span> ALTERNATIVE PERSPECTIVE GENERATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>❓</span> CHALLENGE QUESTION GENERATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>🎯</span> DEBATE STRATEGY SUGGESTIONS
            </span>
          </div>

          {/* Supported Counterargument Types Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
            <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--accent-red)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              COUNTERARGUMENT TYPES:
            </span>
            {["Logical Rebuttals", "Evidence-Based Rebuttals", "Ethical Counterarguments", "Practical Counterarguments", "Policy Counterarguments"].map((t, i) => (
              <span key={i} style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#F3F4F6", color: "#374151", padding: "0.2rem 0.55rem", borderRadius: "4px" }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Card 1: Main Workspace Card */}
        <div className="ca-card-box" style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "2.25rem",
          boxShadow: "0 12px 36px rgba(0,0,0,0.04)",
          marginBottom: "2.5rem"
        }}>
          {/* Topic Input */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{
                fontSize: "0.88rem",
                fontWeight: 800,
                color: "#111827",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontFamily: "var(--font-mono)"
              }}>
                1. DEBATE TOPIC (OPTIONAL)
              </label>
              <button
                type="button"
                onClick={loadSample}
                className="ca-action-btn"
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "var(--accent-red)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                ⚡ LOAD SAMPLE BENCHMARK
              </button>
            </div>
            <input
              type="text"
              className="ca-input-field"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Should students be allowed to use mobile phones in school?"
              style={{
                width: "100%",
                padding: "0.9rem 1.2rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                borderRadius: "8px",
                background: "#FFFFFF",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* Argument Input */}
          <div style={{ marginBottom: "1.75rem" }}>
            <label style={{
              display: "block",
              fontSize: "0.88rem",
              fontWeight: 800,
              color: "#111827",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-mono)",
              marginBottom: "0.5rem"
            }}>
              2. ARGUMENT FOR COUNTER-ANALYSIS
            </label>
            <textarea
              rows={4}
              className="ca-input-field"
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste the argument you want counterarguments for, or use voice input below..."
              style={{
                width: "100%",
                padding: "0.95rem 1.2rem",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                borderRadius: "8px",
                background: "#FFFFFF",
                color: "var(--text-primary)",
                resize: "vertical"
              }}
            />
          </div>

          {/* Action Toolbar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            paddingTop: "0.5rem"
          }}>
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleRecording}
              className="btn ca-action-btn"
              style={{
                background: isRecording ? "#FEF2F2" : "#FFFFFF",
                border: isRecording ? "1.5px solid var(--accent-red)" : "1px solid var(--border-light)",
                color: isRecording ? "var(--accent-red)" : "var(--text-primary)",
                gap: "0.5rem",
                padding: "0.75rem 1.4rem"
              }}
            >
              <MicIcon size={16} active={isRecording} />
              <span>{isRecording ? "RECORDING... (CLICK TO STOP)" : "VOICE RECORDING"}</span>
            </button>

            {/* Submit / Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="btn btn-red ca-action-btn"
              style={{
                gap: "0.6rem",
                padding: "0.85rem 2rem",
                fontSize: "0.9rem",
                letterSpacing: "0.5px",
                border: "2px solid transparent"
              }}
            >
              {loading ? (
                <>
                  <span>GENERATING REBUTTALS...</span>
                </>
              ) : (
                <>
                  <span>GENERATE COUNTERARGUMENTS</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: "1.25rem",
              padding: "0.85rem 1.2rem",
              borderRadius: "8px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.88rem",
              fontWeight: 600
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {results && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Card 2: Your Submission */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderLeft: "4px solid var(--accent-red)",
              borderRadius: "12px",
              padding: "1.5rem 1.75rem",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.02)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "0.75rem",
                marginBottom: "0.85rem"
              }}>
                <div style={{
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "var(--accent-red)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase"
                }}>
                  YOUR SUBMISSION
                </div>
                <button
                  type="button"
                  onClick={() => handleSpeak("submission", results.submission)}
                  className="ca-action-btn"
                  style={{
                    background: activeSpeaking === "submission" ? "#FEF2F2" : "#FFFFFF",
                    border: "1px solid var(--border-light)",
                    color: activeSpeaking === "submission" ? "var(--accent-red)" : "var(--text-secondary)",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem"
                  }}
                >
                  <SpeakerIcon size={16} active={activeSpeaking === "submission"} />
                  <span>{activeSpeaking === "submission" ? "STOP AUDIO" : "READ ALOUD"}</span>
                </button>
              </div>
              <div style={{
                color: "var(--text-primary)",
                fontSize: "1.02rem",
                lineHeight: 1.6,
                fontStyle: "italic"
              }}>
                "{results.submission}"
              </div>
            </div>

            {/* Card 3: Counterarguments Card */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "1.1rem",
                marginBottom: "1.75rem",
                flexWrap: "wrap",
                gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <h3 className="font-display" style={{
                    fontSize: "1.4rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.3px",
                    margin: 0,
                    color: "var(--text-primary)"
                  }}>
                    REBUTTAL GENERATION (5 TYPES)
                  </h3>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    background: "#FEF2F2",
                    color: "var(--accent-red)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    border: "1px solid #FECACA"
                  }}>
                    {results.counterarguments?.length || 5} STRATEGIC REBUTTALS
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allRebuttals = (results.counterarguments || [])
                      .map(r => `${r.type}. ${r.content}`)
                      .join(". Next rebuttal: ");
                    handleSpeak("all_rebuttals", allRebuttals);
                  }}
                  className="ca-action-btn"
                  style={{
                    background: activeSpeaking === "all_rebuttals" ? "#FEF2F2" : "#FFFFFF",
                    border: "1px solid var(--border-light)",
                    color: activeSpeaking === "all_rebuttals" ? "var(--accent-red)" : "var(--text-primary)",
                    padding: "0.45rem 1rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <SpeakerIcon size={16} active={activeSpeaking === "all_rebuttals"} />
                  <span>{activeSpeaking === "all_rebuttals" ? "STOP AUDIO" : "READ ALL REBUTTALS"}</span>
                </button>
              </div>

              {/* 5 Distinct Rebuttal Blocks */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {(results.counterarguments || []).map((rebuttal, idx) => {
                  const styleCfg = rebuttalCategoryStyles[rebuttal.type] || {
                    tagColor: "var(--accent-red)",
                    tagBg: "#FEF2F2",
                    borderLeft: "4px solid var(--accent-red)"
                  };

                  return (
                    <div
                      key={idx}
                      className="ca-rebuttal-card"
                      style={{
                        background: "#F9FAFB",
                        borderLeft: styleCfg.borderLeft,
                        borderRadius: "10px",
                        padding: "1.35rem 1.6rem"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.55rem"
                      }}>
                        <div>
                          <div style={{
                            display: "inline-block",
                            color: styleCfg.tagColor,
                            background: styleCfg.tagBg,
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.04em",
                            padding: "0.2rem 0.6rem",
                            borderRadius: "4px",
                            textTransform: "uppercase"
                          }}>
                            {rebuttal.type}
                          </div>
                          {rebuttal.subtext && (
                            <div style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.86rem",
                              fontStyle: "italic",
                              marginTop: "0.35rem"
                            }}>
                              {rebuttal.subtext}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => handleSpeak(`rebuttal_${idx}`, rebuttal.content)}
                            className="ca-action-btn"
                            style={{
                              background: activeSpeaking === `rebuttal_${idx}` ? "#FEF2F2" : "#FFFFFF",
                              border: "1px solid var(--border-light)",
                              color: activeSpeaking === `rebuttal_${idx}` ? "var(--accent-red)" : "var(--text-secondary)",
                              padding: "0.3rem 0.55rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Read this rebuttal"
                          >
                            <SpeakerIcon size={15} active={activeSpeaking === `rebuttal_${idx}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(rebuttal.content, idx)}
                            className="ca-action-btn"
                            style={{
                              background: copiedIndex === idx ? "#ECFDF5" : "#FFFFFF",
                              border: copiedIndex === idx ? "1px solid #A7F3D0" : "1px solid var(--border-light)",
                              color: copiedIndex === idx ? "#059669" : "var(--text-secondary)",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)"
                            }}
                            title="Copy to clipboard"
                          >
                            {copiedIndex === idx ? "COPIED" : "COPY"}
                          </button>
                        </div>
                      </div>

                      <p style={{
                        color: "var(--text-primary)",
                        fontSize: "0.97rem",
                        lineHeight: 1.65,
                        margin: 0
                      }}>
                        {rebuttal.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 4: COUNTERPOINT CREATION */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "1.1rem",
                marginBottom: "1.75rem",
                flexWrap: "wrap",
                gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <h3 className="font-display" style={{
                    fontSize: "1.4rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.3px",
                    margin: 0,
                    color: "var(--text-primary)"
                  }}>
                    COUNTERPOINT CREATION
                  </h3>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    border: "1px solid #BFDBFE"
                  }}>
                    {results.counterpoints?.length || 2} CONSTRUCTIVE ALTERNATIVES
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allCP = (results.counterpoints || [])
                      .map(cp => `${cp.title}. ${cp.content}`)
                      .join(". Next counterpoint: ");
                    handleSpeak("all_counterpoints", allCP);
                  }}
                  className="ca-action-btn"
                  style={{
                    background: activeSpeaking === "all_counterpoints" ? "#FEF2F2" : "#FFFFFF",
                    border: "1px solid var(--border-light)",
                    color: activeSpeaking === "all_counterpoints" ? "var(--accent-red)" : "var(--text-primary)",
                    padding: "0.45rem 1rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <SpeakerIcon size={16} active={activeSpeaking === "all_counterpoints"} />
                  <span>{activeSpeaking === "all_counterpoints" ? "STOP AUDIO" : "READ ALL COUNTERPOINTS"}</span>
                </button>
              </div>

              {/* Counterpoints Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.25rem" }}>
                {(results.counterpoints || [
                  {
                    title: "Dedicated Computer Lab Integration",
                    framework: "Constructive Alternative",
                    content: "Rather than attempting to monitor individual personal devices in regular classrooms, schools achieve far superior pedagogical outcomes by investing in dedicated computer labs and managed devices where educational tools are readily accessible while non-instructional distractions are completely eliminated."
                  },
                  {
                    title: "Equalized Access & Socioeconomic Fairness",
                    framework: "Institutional Equity",
                    content: "A universal device-free classroom standard removes peer status signaling and digital disparities between students who can afford high-end smartphones and those without them, fostering a classroom culture anchored in equitable engagement and mutual focus."
                  }
                ]).map((cp, cIdx) => (
                  <div
                    key={cIdx}
                    className="ca-rebuttal-card"
                    style={{
                      background: "#F9FAFB",
                      borderLeft: "4px solid #0284C7",
                      borderRadius: "10px",
                      padding: "1.35rem 1.6rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.6rem"
                      }}>
                        <div>
                          <span style={{
                            display: "inline-block",
                            color: "#0369A1",
                            background: "#E0F2FE",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.04em",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            marginBottom: "0.35rem"
                          }}>
                            {cp.framework || "CONSTRUCTIVE COUNTERPOINT"}
                          </span>
                          <h4 style={{
                            margin: 0,
                            fontSize: "1.05rem",
                            fontWeight: 800,
                            color: "#111827",
                            fontFamily: "var(--font-mono)"
                          }}>
                            {cp.title}
                          </h4>
                        </div>

                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => handleSpeak(`cp_${cIdx}`, `${cp.title}. ${cp.content}`)}
                            className="ca-action-btn"
                            style={{
                              background: activeSpeaking === `cp_${cIdx}` ? "#FEF2F2" : "#FFFFFF",
                              border: "1px solid var(--border-light)",
                              color: activeSpeaking === `cp_${cIdx}` ? "var(--accent-red)" : "var(--text-secondary)",
                              padding: "0.3rem 0.55rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Read counterpoint"
                          >
                            <SpeakerIcon size={15} active={activeSpeaking === `cp_${cIdx}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(`${cp.title}: ${cp.content}`, `cp_${cIdx}`)}
                            className="ca-action-btn"
                            style={{
                              background: copiedIndex === `cp_${cIdx}` ? "#ECFDF5" : "#FFFFFF",
                              border: copiedIndex === `cp_${cIdx}` ? "1px solid #A7F3D0" : "1px solid var(--border-light)",
                              color: copiedIndex === `cp_${cIdx}` ? "#059669" : "var(--text-secondary)",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)"
                            }}
                            title="Copy to clipboard"
                          >
                            {copiedIndex === `cp_${cIdx}` ? "COPIED" : "COPY"}
                          </button>
                        </div>
                      </div>

                      <p style={{
                        color: "var(--text-primary)",
                        fontSize: "0.95rem",
                        lineHeight: 1.65,
                        margin: 0
                      }}>
                        {cp.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom 3 Diagnostic Cards: CHALLENGE QUESTION GENERATION, ALTERNATIVE PERSPECTIVE GENERATION, DEBATE STRATEGY SUGGESTIONS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem"
            }}>
              
              {/* Card 5: CHALLENGE QUESTION GENERATION */}
              <div className="ca-card-box" style={{
                background: "#FFFFFF",
                borderTop: "4px solid #0284C7",
                borderRadius: "14px",
                padding: "1.5rem",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #F3F4F6",
                    paddingBottom: "0.6rem",
                    marginBottom: "0.85rem"
                  }}>
                    <div style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      color: "#0369A1",
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}>
                      <span>❓</span>
                      <span>CHALLENGE QUESTION GENERATION</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpeak("challenge", results.challenge_question)}
                      className="ca-action-btn"
                      style={{
                        background: activeSpeaking === "challenge" ? "#FEF2F2" : "transparent",
                        border: "1px solid transparent",
                        borderRadius: "4px",
                        padding: "0.25rem 0.45rem",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Read question"
                    >
                      <SpeakerIcon size={16} active={activeSpeaking === "challenge"} />
                    </button>
                  </div>
                  <p style={{
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: 0,
                    fontWeight: 500
                  }}>
                    "{results.challenge_question}"
                  </p>
                </div>
                <div style={{ marginTop: "1rem", paddingTop: "0.6rem", borderTop: "1px solid #F3F4F6", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Socratic cross-examination probe designed to dismantle unstated assumptions.
                </div>
              </div>

              {/* Card 6: ALTERNATIVE PERSPECTIVE GENERATION */}
              <div className="ca-card-box" style={{
                background: "#FFFFFF",
                borderTop: "4px solid #7C3AED",
                borderRadius: "14px",
                padding: "1.5rem",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #F3F4F6",
                    paddingBottom: "0.6rem",
                    marginBottom: "0.85rem"
                  }}>
                    <div style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      color: "#6D28D9",
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}>
                      <span>👁</span>
                      <span>ALTERNATIVE PERSPECTIVE GENERATION</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpeak("alternative", results.alternative_perspective)}
                      className="ca-action-btn"
                      style={{
                        background: activeSpeaking === "alternative" ? "#FEF2F2" : "transparent",
                        border: "1px solid transparent",
                        borderRadius: "4px",
                        padding: "0.25rem 0.45rem",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Read perspective"
                    >
                      <SpeakerIcon size={16} active={activeSpeaking === "alternative"} />
                    </button>
                  </div>
                  <p style={{
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: 0,
                    fontWeight: 500
                  }}>
                    {results.alternative_perspective}
                  </p>
                </div>
                <div style={{ marginTop: "1rem", paddingTop: "0.6rem", borderTop: "1px solid #F3F4F6", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Stakeholder reframing and pedagogical paradigm shift.
                </div>
              </div>

              {/* Card 7: DEBATE STRATEGY SUGGESTIONS */}
              <div className="ca-card-box" style={{
                background: "#FFFFFF",
                borderTop: "4px solid #059669",
                borderRadius: "14px",
                padding: "1.5rem",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #F3F4F6",
                    paddingBottom: "0.6rem",
                    marginBottom: "0.85rem"
                  }}>
                    <div style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      color: "#047857",
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}>
                      <span>🎯</span>
                      <span>DEBATE STRATEGY SUGGESTIONS</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpeak("strategy", results.strategy_suggestion)}
                      className="ca-action-btn"
                      style={{
                        background: activeSpeaking === "strategy" ? "#FEF2F2" : "transparent",
                        border: "1px solid transparent",
                        borderRadius: "4px",
                        padding: "0.25rem 0.45rem",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Read strategy"
                    >
                      <SpeakerIcon size={16} active={activeSpeaking === "strategy"} />
                    </button>
                  </div>
                  <p style={{
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: 0,
                    fontWeight: 500
                  }}>
                    {results.strategy_suggestion}
                  </p>
                </div>
                <div style={{ marginTop: "1rem", paddingTop: "0.6rem", borderTop: "1px solid #F3F4F6", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Tactical rebuttal deployment and empirical pressure recommendations.
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
