"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SpeakerIcon from "../../components/SpeakerIcon";
import MicIcon from "../../components/MicIcon";

export default function FallacyDetectorPage() {
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
    argument: "Mobile phones can be useful educational tools when used under proper rules. Students can use them to research information, access educational apps, use calculators, and communicate during emergencies. Instead of completely banning phones, schools should teach students how to use them responsibly"
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

  const SUPPORTED_FALLACIES = [
    {
      name: "Ad Hominem",
      topic: "Healthcare Reform",
      argument: "My opponent is a dishonest hypocrite and totally corrupt, so whatever they claim about healthcare reform is completely false."
    },
    {
      name: "Straw Man",
      topic: "Public Education Funding",
      argument: "So you're saying that you want to eliminate all school funding and leave every child completely illiterate!"
    },
    {
      name: "False Dilemma",
      topic: "Energy Policy",
      argument: "Either we ban all fossil fuels tomorrow morning, or the entire planet will be destroyed within five years. There are only two choices."
    },
    {
      name: "Slippery Slope",
      topic: "School Phone Rules",
      argument: "If we allow students to bring phones into school, next thing you know they will refuse to study, crime will skyrocket, and the nation will collapse into catastrophe."
    },
    {
      name: "Appeal to Authority",
      topic: "Medical Science",
      argument: "This dietary supplement must cure viral infections because a famous Hollywood celebrity said so on social media."
    },
    {
      name: "Circular Reasoning",
      topic: "Civil Liberties",
      argument: "Free speech is essential for society because it is obviously true that citizens must be allowed to speak freely."
    },
    {
      name: "Hasty Generalization",
      topic: "Driver Safety",
      argument: "Everyone knows that teenage drivers are always irresponsible based on my one friend who got a speeding ticket last week."
    },
    {
      name: "Red Herring",
      topic: "Climate Policy",
      argument: "Why are we discussing greenhouse emissions when what about rising property taxes in neighboring districts instead of talking about the weather?"
    }
  ];

  const loadSample = () => {
    setTopic(sampleBenchmark.topic);
    setArgument(sampleBenchmark.argument);
  };

  const loadFallacySample = (f) => {
    setTopic(f.topic);
    setArgument(f.argument);
  };

  const handleAudit = async (e) => {
    if (e) e.preventDefault();
    if (!argument.trim()) {
      setError("Please enter or record an argument before scanning for fallacies.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("logos_ai_jwt") : null;
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("http://localhost:8000/api/v1/fallacy-detection/deep-audit", {
        method: "POST",
        headers,
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
      console.error("Fallacy audit failed:", err);
      setError("Failed to connect to fallacy detection engine. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8.5) return "#059669"; // Emerald
    if (score >= 6.0) return "#D97706"; // Amber
    return "var(--accent-red)";        // Red
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

        /* Result Cards & Fallacy Breakdown Cards */
        .ca-card-box {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
          border: 1px solid var(--border-light) !important;
        }
        .ca-card-box:hover,
        .ca-card-box:focus-within {
          border-color: #000000 !important;
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.07) !important;
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
            LOGICAL FALLACY DETECTION ENGINE
          </div>

          <h1 className="font-display" style={{
            fontSize: "2.8rem",
            fontWeight: 900,
            textTransform: "uppercase",
            marginBottom: "0.6rem",
            letterSpacing: "-0.5px",
            color: "var(--text-primary)"
          }}>
            LOGICAL FALLACY DETECTION ENGINE
          </h1>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: "1.05rem",
            maxWidth: "880px",
            lineHeight: 1.6,
            margin: 0
          }}>
            Audit debate arguments, identify formal and informal fallacies, receive in-depth reasoning analyses, actionable correction suggestions, and empirical credibility assessments.
          </p>

          {/* Engine Capabilities Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1.1rem" }}>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>⚡</span> FALLACY IDENTIFICATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>📖</span> EXPLANATION GENERATION
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>💡</span> CORRECTION SUGGESTIONS
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>🧠</span> REASONING ANALYSIS
            </span>
            <span style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", fontWeight: 700, background: "#FFFFFF", border: "1px solid var(--border-light)", padding: "0.3rem 0.7rem", borderRadius: "6px", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span>📊</span> CREDIBILITY ASSESSMENT
            </span>
          </div>

          {/* Supported Fallacies (8 Types) Interactive Chips Bar */}
          <div style={{ marginTop: "1.1rem", background: "#FFFFFF", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.85rem 1.1rem" }} className="ca-card-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--accent-red)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                SUPPORTED FALLACIES (CLICK TO TEST):
              </span>
              <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600 }}>
                8 Core Logical Patterns Supported
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {SUPPORTED_FALLACIES.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => loadFallacySample(f)}
                  className="ca-action-btn"
                  style={{
                    fontSize: "0.74rem",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    background: topic === f.topic ? "#FEF2F2" : "#F3F4F6",
                    border: topic === f.topic ? "1px solid var(--accent-red)" : "1px solid transparent",
                    color: topic === f.topic ? "var(--accent-red)" : "#374151",
                    padding: "0.3rem 0.65rem",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                  title={`Click to test ${f.name}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
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
                Topic (optional)
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
              Argument / Reasoning to Check
            </label>
            <textarea
              rows={4}
              className="ca-input-field"
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste the argument or reasoning you want checked for fallacies, or use voice input below..."
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
              <span>{isRecording ? "RECORDING... (CLICK TO STOP)" : "START RECORDING"}</span>
            </button>

            {/* Submit / Detect Button */}
            <button
              type="button"
              onClick={handleAudit}
              disabled={loading}
              className="btn btn-red ca-action-btn"
              style={{
                gap: "0.6rem",
                padding: "0.85rem 2.2rem",
                fontSize: "0.9rem",
                letterSpacing: "0.5px",
                border: "2px solid transparent"
              }}
            >
              {loading ? (
                <>
                  <span>SCANNING LOGIC & FALLACIES...</span>
                </>
              ) : (
                <>
                  <span>DETECT FALLACIES</span>
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
            
            {/* Card 1: Your Submission */}
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

            {/* Card 2: Credibility Assessment */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2.25rem 2rem",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                <div style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase"
                }}>
                  CREDIBILITY ASSESSMENT
                </div>
                {(results.ai_verified || results.verification_status) && (
                  <span style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    background: "#ECFDF5",
                    color: "#065F46",
                    padding: "0.15rem 0.55rem",
                    borderRadius: "9999px",
                    border: "1px solid #A7F3D0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem"
                  }}>
                    <span>✓</span> AI VERIFIED
                  </span>
                )}
              </div>

              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "3.5rem",
                fontWeight: 900,
                color: getScoreColor(results.credibility_score),
                lineHeight: 1.1,
                marginBottom: "0.5rem"
              }}>
                {results.credibility_score.toFixed(1)}<span style={{ fontSize: "1.8rem", color: "var(--text-muted)", fontWeight: 700 }}>/10</span>
              </div>

              <div style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: results.fallacies_detected_count === 0 ? "#059669" : "var(--accent-red)",
                letterSpacing: "0.02em"
              }}>
                {results.fallacies_detected_count === 0
                  ? "No fallacies detected."
                  : `${results.fallacies_detected_count} logical fallacy/ies identified.`}
              </div>
            </div>

            {/* Zero Fallacies Verified Banner */}
            {results.fallacies_detected_count === 0 && (
              <div className="ca-card-box" style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "1.75rem 2rem",
                borderLeft: "4px solid #059669",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#059669", fontWeight: 800, fontSize: "0.92rem", fontFamily: "var(--font-mono)", marginBottom: "0.4rem" }}>
                  <span>✓</span>
                  <span>NO FALLACIES IDENTIFIED ACROSS 8 CATEGORIES</span>
                </div>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6 }}>
                  The submission was verified against all 8 supported fallacy categories (Ad Hominem, Straw Man, False Dilemma, Slippery Slope, Appeal to Authority, Circular Reasoning, Hasty Generalization, Red Herring) with zero deductive or inductive vulnerabilities found.
                </p>
              </div>
            )}

            {/* Card 2B: Fallacies Breakdown List (if any detected) */}
            {results.fallacies_detected && results.fallacies_detected.length > 0 && (
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
                  paddingBottom: "0.75rem",
                  marginBottom: "1.25rem",
                  flexWrap: "wrap",
                  gap: "0.5rem"
                }}>
                  <div style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "var(--accent-red)",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase"
                  }}>
                    ⚠️ FALLACY IDENTIFICATION & BREAKDOWN
                  </div>
                  <span style={{
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    background: "#FEF2F2",
                    color: "var(--accent-red)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    border: "1px solid #FECACA"
                  }}>
                    {results.fallacies_detected.length} DETECTED BREAKDOWN(S)
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {results.fallacies_detected.map((fallacy, idx) => (
                    <div
                      key={idx}
                      className="ca-card-box"
                      style={{
                        background: "#FEF2F2",
                        borderLeft: "4px solid var(--accent-red)",
                        borderRadius: "10px",
                        padding: "1.35rem 1.6rem"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <span style={{
                          background: "#FEE2E2",
                          color: "var(--accent-red)",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "4px",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em"
                        }}>
                          {fallacy.type}
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => handleSpeak(`fallacy_${idx}`, `${fallacy.type}. Fallacy identified: ${fallacy.excerpt}. Explanation: ${fallacy.explanation}. Correction suggestion: ${fallacy.correction_suggestion}`)}
                            className="ca-action-btn"
                            style={{
                              background: activeSpeaking === `fallacy_${idx}` ? "#FEF2F2" : "#FFFFFF",
                              border: "1px solid var(--border-light)",
                              color: "var(--text-secondary)",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Read this fallacy"
                          >
                            <SpeakerIcon size={15} active={activeSpeaking === `fallacy_${idx}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(`${fallacy.type}: "${fallacy.excerpt}" - ${fallacy.explanation} Correction: ${fallacy.correction_suggestion}`, idx)}
                            className="ca-action-btn"
                            style={{
                              background: copiedIndex === idx ? "#ECFDF5" : "#FFFFFF",
                              border: copiedIndex === idx ? "1px solid #A7F3D0" : "1px solid var(--border-light)",
                              color: copiedIndex === idx ? "#059669" : "var(--text-secondary)",
                              padding: "0.25rem 0.55rem",
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

                      {fallacy.excerpt && (
                        <div style={{ background: "#FFFFFF", padding: "0.6rem 0.85rem", borderRadius: "6px", border: "1px solid #FEE2E2", marginBottom: "0.65rem" }}>
                          <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--accent-red)", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                            FALLACY IDENTIFICATION (EXCERPT):
                          </div>
                          <div style={{ fontStyle: "italic", color: "#1F2937", fontSize: "0.92rem", lineHeight: 1.5 }}>
                            "{fallacy.excerpt}"
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: "0.65rem" }}>
                        <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 800, color: "#4B5563", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                          EXPLANATION GENERATION:
                        </div>
                        <p style={{ margin: 0, color: "#1F2937", fontSize: "0.92rem", lineHeight: 1.55 }}>
                          {fallacy.explanation}
                        </p>
                      </div>

                      {fallacy.correction_suggestion && (
                        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "0.6rem 0.85rem", borderRadius: "6px" }}>
                          <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 800, color: "#065F46", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                            💡 CORRECTION SUGGESTION:
                          </div>
                          <p style={{ margin: 0, color: "#065F46", fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.5 }}>
                            {fallacy.correction_suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card 3: Reasoning Analysis */}
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
                paddingBottom: "0.85rem",
                marginBottom: "1.25rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <div style={{
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: "#111827",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase"
                  }}>
                    REASONING ANALYSIS
                  </div>
                  {(results.ai_verified || results.verification_status) && (
                    <span style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      fontFamily: "var(--font-mono)",
                      background: "#F0FDF4",
                      color: "#166534",
                      padding: "0.15rem 0.55rem",
                      borderRadius: "9999px",
                      border: "1px solid #BBF7D0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem"
                    }}>
                      <span>✓</span> {results.verification_status || "AI Verified"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSpeak("reasoning", results.reasoning_analysis)}
                  className="ca-action-btn"
                  style={{
                    background: activeSpeaking === "reasoning" ? "#FEF2F2" : "#FFFFFF",
                    border: "1px solid var(--border-light)",
                    color: activeSpeaking === "reasoning" ? "var(--accent-red)" : "var(--text-secondary)",
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
                  <SpeakerIcon size={16} active={activeSpeaking === "reasoning"} />
                  <span>{activeSpeaking === "reasoning" ? "STOP AUDIO" : "READ ALOUD"}</span>
                </button>
              </div>

              <p style={{
                color: "var(--text-primary)",
                fontSize: "1.02rem",
                lineHeight: 1.7,
                margin: 0,
                fontWeight: 500
              }}>
                {results.reasoning_analysis}
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
