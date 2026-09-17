"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SpeakerIcon from "../../components/SpeakerIcon";
import MicIcon from "../../components/MicIcon";

export default function ArgumentAnalysisPage() {
  const [topic, setTopic] = useState("");
  const [argument, setArgument] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // Audio Speech-to-Text & Text-to-Speech
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeaking, setActiveSpeaking] = useState(null);
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

  const loadSample = () => {
    setTopic(sampleBenchmark.topic);
    setArgument(sampleBenchmark.argument);
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!argument.trim()) {
      setError("Please enter or record an argument before running the analysis.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/argument-analysis/deep-evaluate", {
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
      console.error("Argument analysis failed:", err);
      setError("Failed to connect to argument analysis engine. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 7.5) return "#059669"; // Emerald
    if (score >= 5.0) return "#D97706"; // Amber
    return "var(--accent-red)";        // Red
  };

  const dimensionLabels = [
    { key: "clarity", label: "CLARITY" },
    { key: "relevance", label: "RELEVANCE" },
    { key: "persuasiveness", label: "PERSUASIVENESS" },
    { key: "evidence_strength", label: "EVIDENCE STRENGTH" },
    { key: "logical_consistency", label: "LOGICAL CONSISTENCY" }
  ];

  return (
    <div className="watermark-container" style={{ minHeight: "100vh", background: "var(--bg-secondary)", paddingBottom: "6rem" }}>
      {/* Scoped CSS for dynamic black borders on cursor hover and focus */}
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

        /* Result Cards */
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
        
        {/* Header Title Section: “Argument Analysis” at the top */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="badge-red-pill">
            <span className="badge-dot" />
            RHETORICAL EVALUATION SUITE
          </div>

          <h1 className="font-display" style={{
            fontSize: "2.8rem",
            fontWeight: 900,
            textTransform: "uppercase",
            marginBottom: "0.6rem",
            letterSpacing: "-0.5px",
            color: "var(--text-primary)"
          }}>
            ARGUMENT ANALYSIS
          </h1>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: "1.05rem",
            maxWidth: "840px",
            lineHeight: 1.6,
            margin: 0
          }}>
            Make your case, then find its cracks. Evaluate deductive clarity, measure evidentiary strength across 5 diagnostic dimensions, and identify critical claim vulnerabilities.
          </p>
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
              Argument / Case to Analyze
            </label>
            <textarea
              rows={4}
              className="ca-input-field"
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste or write the argument you want analyzed, or use voice input below..."
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

            {/* Submit / Analyze Button */}
            <button
              type="button"
              onClick={handleAnalyze}
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
                  <span>EVALUATING ARGUMENT STRUCTURE...</span>
                </>
              ) : (
                <>
                  <span>ANALYZE ARGUMENT</span>
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

            {/* Card 2: Overall Score */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2.25rem 2rem",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                marginBottom: "0.5rem"
              }}>
                OVERALL SCORE
              </div>

              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "3.5rem",
                fontWeight: 900,
                color: getScoreColor(results.overall_score),
                lineHeight: 1.1
              }}>
                {results.overall_score.toFixed(1)}<span style={{ fontSize: "1.8rem", color: "var(--text-muted)", fontWeight: 700 }}>/10</span>
              </div>
            </div>

            {/* Card 3: 5 Diagnostic Dimension Bars */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem 2.25rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                marginBottom: "1.5rem",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "0.75rem"
              }}>
                ARGUMENT QUALITY DIMENSIONS
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
                {dimensionLabels.map(({ key, label }) => {
                  const scoreVal = results.dimensions?.[key] ?? 7.0;
                  const pct = Math.min(100, Math.max(0, (scoreVal / 10) * 100));

                  return (
                    <div key={key}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.82rem",
                        fontWeight: 800,
                        fontFamily: "var(--font-mono)",
                        marginBottom: "0.45rem",
                        color: "#1F2937"
                      }}>
                        <span>{label}</span>
                        <span style={{ color: getScoreColor(scoreVal), fontWeight: 900, fontSize: "0.92rem" }}>
                          {scoreVal.toFixed(1)}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div style={{
                        width: "100%",
                        height: "8px",
                        background: "#E5E7EB",
                        borderRadius: "9999px",
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #F59E0B 0%, #D97706 100%)",
                          borderRadius: "9999px",
                          transition: "width 0.6s ease"
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 4: Strengths */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderLeft: "4px solid #059669",
              borderRadius: "14px",
              padding: "1.75rem",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                color: "#059669",
                fontFamily: "var(--font-mono)",
                fontWeight: 900,
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "1rem"
              }}>
                STRENGTHS
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {(results.strengths || []).map((st, i) => (
                  <li key={i} style={{ color: "#1F2937", fontSize: "0.95rem", lineHeight: 1.5, fontWeight: 500 }}>
                    {st}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 5: Weaknesses */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderLeft: "4px solid var(--accent-red)",
              borderRadius: "14px",
              padding: "1.75rem",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                color: "var(--accent-red)",
                fontFamily: "var(--font-mono)",
                fontWeight: 900,
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "1rem"
              }}>
                WEAKNESSES
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {(results.weaknesses || []).map((wk, i) => (
                  <li key={i} style={{ color: "#1F2937", fontSize: "0.95rem", lineHeight: 1.5, fontWeight: 500 }}>
                    {wk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 6: Claims Identified */}
            <div className="ca-card-box" style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)"
            }}>
              <div style={{
                fontSize: "0.88rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "#111827",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                marginBottom: "1.25rem",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "0.75rem"
              }}>
                CLAIMS IDENTIFIED
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {(results.claims_identified || []).map((claim, idx) => (
                  <div
                    key={idx}
                    className="ca-card-box"
                    style={{
                      background: "#F9FAFB",
                      borderRadius: "10px",
                      padding: "1.25rem 1.5rem"
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#111827", marginBottom: "0.4rem" }}>
                      {claim.title}
                    </div>

                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 800,
                      color: "#4B5563",
                      marginBottom: "0.6rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      <span style={{ color: "var(--accent-red)" }}>{claim.role}</span>
                      <span>·</span>
                      <span style={{
                        color: claim.evidence_level === "STRONG" ? "#059669" : claim.evidence_level === "MODERATE" ? "#D97706" : "#DC2626"
                      }}>
                        EVIDENCE: {claim.evidence_level}
                      </span>
                    </div>

                    <p style={{ margin: 0, color: "#4B5563", fontSize: "0.92rem", lineHeight: 1.5 }}>
                      {claim.evaluation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 7: Summary */}
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
                <div style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#111827",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase"
                }}>
                  SUMMARY
                </div>
                <button
                  type="button"
                  onClick={() => handleSpeak("summary", results.summary)}
                  className="ca-action-btn"
                  style={{
                    background: activeSpeaking === "summary" ? "#FEF2F2" : "#FFFFFF",
                    border: "1px solid var(--border-light)",
                    color: activeSpeaking === "summary" ? "var(--accent-red)" : "var(--text-secondary)",
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
                  <SpeakerIcon size={16} active={activeSpeaking === "summary"} />
                  <span>{activeSpeaking === "summary" ? "STOP AUDIO" : "READ ALOUD"}</span>
                </button>
              </div>

              <p style={{
                color: "var(--text-primary)",
                fontSize: "1.02rem",
                lineHeight: 1.7,
                margin: 0,
                fontWeight: 500
              }}>
                {results.summary}
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
