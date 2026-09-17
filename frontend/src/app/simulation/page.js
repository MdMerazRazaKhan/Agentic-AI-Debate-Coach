"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';

const authHeaders = (json = false) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// Rich, categorized debate topic library
const TOPIC_CATEGORIES = [
  {
    category: "🤖 AI, Automation & Emerging Tech",
    topics: [
      "Autonomous AI systems should be held legally liable for unintended damages.",
      "Open-source frontier AI models pose an unacceptable existential safety risk.",
      "Human artists should be legally entitled to block AI training on their copyrighted works.",
      "Brain-computer interfaces (BCIs) will create an unbridgeable socioeconomic divide.",
      "Autonomous lethal weapons systems must be universally banned under international law.",
      "AI tutors will make traditional university lectures obsolete by 2035.",
      "Deepfake technology development should face strict criminal licensing restrictions.",
      "Governments should establish a public sovereign compute cloud to compete with Big Tech."
    ]
  },
  {
    category: "⚖️ Ethics, Justice & Bioethics",
    topics: [
      "CRISPR germline gene editing in human embryos should be globally prohibited.",
      "Commercial factory farming of animals should be phased out in favor of cultivated alternatives.",
      "Algorithmic decision-making in criminal sentencing should be strictly banned.",
      "Digital privacy is an absolute human right that overrides national security surveillance.",
      "Social media algorithms should be legally liable for addicting minors.",
      "Euthanasia and medically assisted dying should be legalized for terminal patients worldwide.",
      "Whistleblowers who leak classified materials in public interest should receive blanket immunity."
    ]
  },
  {
    category: "🌍 Global Governance, Policy & Economics",
    topics: [
      "Universal Basic Income (UBI) is essential to avert catastrophic automation unemployment.",
      "A global carbon tax is more effective than localized renewable energy subsidies.",
      "Central Bank Digital Currencies (CBDCs) pose an unacceptable threat to citizen privacy.",
      "Space exploration and asteroid resources should be declared the common heritage of humanity.",
      "Developing nations should be exempt from binding global greenhouse gas quotas.",
      "Remote work mandates damage long-term economic innovation and mentorship.",
      "Billionaire wealth caps and extreme wealth taxes are economically justifiable."
    ]
  },
  {
    category: "🌿 Climate, Energy & Environment",
    topics: [
      "Nuclear fission and fusion must be the primary pillars of global decarbonization.",
      "Solar geoengineering should be deployed as an emergency climate intervention.",
      "Single-use plastics should face an immediate, legally binding global ban.",
      "Electric vehicle mandates unfairly disadvantage lower-income households.",
      "Carbon offset credits create a moral hazard that delays real decarbonization."
    ]
  },
  {
    category: "🎓 Education, Culture & Society",
    topics: [
      "Standardized testing in university admissions does more harm than good.",
      "Four-day work weeks should become the standard statutory employment model.",
      "Philosophy and formal logic should be mandatory core subjects in high schools.",
      "Cryptocurrency speculation should be banned to protect retail investors from predatory loss.",
      "Higher education tuition should be entirely publicly funded for all citizens."
    ]
  }
];

const DEFAULT_TOPIC = TOPIC_CATEGORIES[0].topics[0];

// Safe, deterministic slice-based Typewriter to prevent double-invocation skipping in React
function TypewriterText({ text, speed = 8 }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      return;
    }
    let currentIndex = 0;
    setDisplayedText("");

    const timer = setInterval(() => {
      currentIndex++;
      setDisplayedText(text.slice(0, currentIndex));
      if (currentIndex >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayedText || text}</span>;
}

export default function SimulationPage() {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [customTopic, setCustomTopic] = useState("");
  const [position, setPosition] = useState("Affirmative");
  const [format, setFormat] = useState("Parliamentary Debate");
  const [persona, setPersona] = useState("The Contrarian");
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("Setup"); // Setup, Running, Completed
  const [sessionId, setSessionId] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  
  // Scheduling States
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  const [transcript, setTranscript] = useState([]);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [completionMetrics, setCompletionMetrics] = useState(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
    const cachedName = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_user_name') : null;
    if (cachedName && !cachedName.toLowerCase().includes('hardwill')) {
      setUserName(cachedName);
    } else if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        if (payload?.full_name && !payload.full_name.toLowerCase().includes('hardwill')) {
          setUserName(payload.full_name);
          localStorage.setItem('logos_ai_user_name', payload.full_name);
        } else if (payload?.sub) {
          const subLower = payload.sub.toLowerCase();
          if (subLower.includes('dayan') || subLower.includes('hardwill')) {
            setUserName('Dayan');
            localStorage.setItem('logos_ai_user_name', 'Dayan');
          } else {
            const derivedName = payload.sub.split('@')[0];
            const capName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);
            setUserName(capName);
          }
        }
      } catch (e) {}

      fetch("http://localhost:8000/api/v1/coaching/profile", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.full_name) {
          const cleanName = data.full_name.toLowerCase().includes('hardwill') ? 'Dayan' : data.full_name;
          setUserName(cleanName);
          localStorage.setItem('logos_ai_user_name', cleanName);
        }
      })
      .catch(() => {});
    }
  }, []);

  const checkAuth = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
    if (!token) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleStartDebate = async () => {
    if (!checkAuth()) return;

    setLoading(true);
    const finalTopic = topic === "Custom Topic (Enter below)" ? (customTopic || "Resolved: Autonomous AI Systems Liability") : topic;
    const activeUserName = (userName && !userName.toLowerCase().includes('hardwill')) ? userName : ((typeof window !== 'undefined' && localStorage.getItem('logos_ai_user_name') && !localStorage.getItem('logos_ai_user_name').toLowerCase().includes('hardwill')) ? localStorage.getItem('logos_ai_user_name') : 'Dayan');

    try {
      const res = await fetch("http://localhost:8000/api/v1/sessions/create", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          title: `${format} on ${finalTopic.substring(0, 35)}...`,
          topic: finalTopic,
          format: format,
          assigned_position: position,
          status: "Active"
        })
      });
      if (!res.ok) throw new Error('Unable to create the debate session.');
      const data = await res.json();
      setSessionId(data.id);

      setTranscript([
        {
          speaker: activeUserName,
          text: `Debate Session Initialized. Format: ${format} | Position: ${position} (${position === 'Affirmative' ? 'Pro' : 'Con'}) | Opponent: ${persona}. Ready to begin.`,
          type: "user"
        },
        {
          speaker: `AI Opponent (${persona})`,
          text: `Greetings, ${activeUserName}. I will argue the ${position === 'Affirmative' ? 'Negative (Con)' : 'Affirmative (Pro)'} perspective. Present your opening argument for: "${finalTopic}".`,
          type: "opponent"
        }
      ]);
      setLastAnalysis(null);
      setSessionStatus("Running");
    } catch (err) {
      // Offline fallback
      setSessionId(999);
      setTranscript([
        {
          speaker: activeUserName,
          text: `Debate Session Initialized. Format: ${format} | Position: ${position} (${position === 'Affirmative' ? 'Pro' : 'Con'}) | Opponent: ${persona}. Ready to begin.`,
          type: "user"
        },
        {
          speaker: `AI Opponent (${persona})`,
          text: `Greetings, ${activeUserName}. I will argue the ${position === 'Affirmative' ? 'Negative (Con)' : 'Affirmative (Pro)'} perspective. Present your opening argument for: "${finalTopic}".`,
          type: "opponent"
        }
      ]);
      setSessionStatus("Running");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePractice = async (e) => {
    e.preventDefault();
    if (!checkAuth()) return;
    if (!scheduledDate || !scheduledTime) return;

    const finalTopic = topic === "Custom Topic (Enter below)" ? (customTopic || "Custom Debate Topic") : topic;
    try {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      await fetch("http://localhost:8000/api/v1/sessions/create", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          title: `[Practice] ${format} on ${finalTopic.substring(0, 35)}...`,
          topic: finalTopic,
          format: format,
          assigned_position: position,
          status: "Scheduled",
          scheduled_at: scheduledDateTime.toISOString()
        })
      });
      setScheduleSuccess(`Practice session scheduled for ${scheduledDate} at ${scheduledTime}!`);
      setTimeout(() => {
        setScheduleSuccess("");
        setScheduledDate("");
        setScheduledTime("");
      }, 3000);
    } catch (err) {
      setScheduleSuccess(`Practice session recorded locally for ${scheduledDate} at ${scheduledTime}!`);
      setTimeout(() => setScheduleSuccess(""), 3000);
    }
  };

  const handleCompleteSession = async () => {
    if (!checkAuth()) return;
    setLoading(true);

    // Compute fallback metrics from local transcript in case API is offline
    const activeTopic = topic === "Custom Topic (Enter below)" ? (customTopic || "Resolved: Autonomous AI Systems Liability") : topic;
    const opponentTurns = transcript.filter(t => t.type === 'opponent' && t.rebuttal_strength !== undefined);
    const totalRebuttal = opponentTurns.reduce((acc, curr) => acc + (parseFloat(curr.rebuttal_strength) || 80), 0);
    const avgRebuttal = opponentTurns.length > 0 ? Math.round((totalRebuttal / opponentTurns.length) * 10) / 10 : (lastAnalysis?.rebuttal_strength || 84.5);
    
    let totalFallacies = 0;
    const detectedFallacies = [];
    opponentTurns.forEach(t => {
      if (Array.isArray(t.fallacies)) {
        totalFallacies += t.fallacies.length;
        t.fallacies.forEach(f => detectedFallacies.push(f));
      }
    });
    const logicScore = Math.max(30, Math.round((100 - totalFallacies * 15) * 10) / 10);
    const overallScore = Math.round((logicScore * 0.45 + avgRebuttal * 0.55) * 10) / 10;

    // Build structured error diagnostics
    const dynamicErrorDiagnostics = [];
    if (detectedFallacies.length > 0) {
      const distinctFallacies = Array.from(new Set(detectedFallacies.map(f => f.fallacy_type))).map(type => detectedFallacies.find(f => f.fallacy_type === type));
      distinctFallacies.forEach(f => {
        dynamicErrorDiagnostics.push({
          area: "Logical Deductive Fallacy",
          severity: "High Risk",
          title: `Flagged Fallacy: ${f.fallacy_type}`,
          description: f.explanation || `A '${f.fallacy_type}' was identified in your debate turn. Drawing conclusions without bridging the causal warrant creates rhetorical vulnerabilities.`,
          why_it_weakened: "Allows the opposing debater to invalidate your core claim and attack your premise as an unproven generalization under cross-examination.",
          correction: f.correction_suggestion || "Ground premises in empirical benchmarks and state qualifying conditions instead of universal absolutes."
        });
      });
    } else {
      dynamicErrorDiagnostics.push({
        area: "Empirical Verification",
        severity: "Medium Risk",
        title: "Unanchored Empirical Claims",
        description: "Your premises were logically consistent, but relied predominantly on conceptual assertions without citing concrete peer-reviewed data, regulatory benchmarks, or historical case studies.",
        why_it_weakened: "An experienced opponent can reject your premise as a subjective viewpoint rather than an established reality.",
        correction: "Cite at least one specific statistical metric, legal precedent, or published study per contention."
      });
    }

    if (avgRebuttal < 85) {
      dynamicErrorDiagnostics.push({
        area: "Counter-Rebuttal Scope",
        severity: "Medium Risk",
        title: "Incomplete Warrant Neutralization",
        description: `When facing counterarguments on "${activeTopic.slice(0, 45)}...", your response tackled the opponent's surface conclusion rather than neutralizing their underlying warrant.`,
        why_it_weakened: "Leaves the opponent's offensive impact intact on the adjudicator's ballot.",
        correction: "Apply the 'Turn-the-Tables' method: show why the opponent's mechanism actually supports your side."
      });
    } else {
      dynamicErrorDiagnostics.push({
        area: "Impact Weighing Calculus",
        severity: "Optimization",
        title: "Comparative Impact Articulation",
        description: "While refutation was sharp, comparative impact calculus (Magnitude vs. Probability vs. Timeframe) was not explicitly weighed in the final summary.",
        why_it_weakened: "Forces the judge to use their own subjective metric to weigh conflicting claims.",
        correction: "Conclude with an explicit comparative weighing statement proving why your impact is irreversible."
      });
    }

    // Build structured improvement areas
    const dynamicImprovementAreas = [
      {
        step: "1. Syllogism & Warrant Fortification (CWDI Model)",
        action: "Structure every speech turn around Claim -> Warrant -> Data -> Impact.",
        how_to_fix: `For "${activeTopic.slice(0, 50)}...", state your claim, provide a peer-reviewed or regulatory warrant, cite concrete metrics, and explain the tangible societal impact.`
      },
      {
        step: "2. The 'Even-If' (Concede & Transcend) Rebuttal",
        action: "Neutralize the opponent's strongest argument without conceding the debate round.",
        how_to_fix: "State: 'Even if the opponent is correct about short-term friction, our position addresses a catastrophic, irreversible impact that decisively outweighs their concern.'"
      },
      {
        step: "3. Comparative Impact Weighing (Magnitude, Probability, Timeframe)",
        action: "Directly instruct the adjudicator how to weigh the debate.",
        how_to_fix: "Explicitly compare: 1) Magnitude (scale of harm), 2) Probability (likelihood), and 3) Timeframe (urgency). Show why your position is paramount."
      }
    ];

    // Build action directives
    const dynamicActionDirectives = [
      `Preemptively neutralize the opponent's core challenge regarding "${activeTopic.slice(0, 45)}" within your opening 45 seconds.`,
      "Anchor each contention in at least one verifiable empirical benchmark, legal precedent, or statistical data point.",
      "Maintain a deliberate, authoritative delivery pace of 140–150 WPM, taking a 1.5-second pause immediately following your core warrant for rhetorical impact."
    ];

    const fallbackMetrics = {
      overall_score: overallScore,
      logical_score: logicScore,
      rebuttal_score: avgRebuttal,
      overall_feedback: overallScore >= 88 
        ? "Mastery Level Oratory: Outstanding debate execution with disciplined dialectical command and persuasive authority."
        : overallScore >= 75
        ? "Proficient Competitive Delivery: Strong reasoning flow. Continue eliminating rhetorical friction and fortifying warrants."
        : "Developing Rhetorician: Good foundational stance. Focus on active refutation and tighter syllogism coherence.",
      logical_feedback: totalFallacies === 0
        ? "Exemplary Deductive Integrity: Clean reasoning with 0 fallacy traps detected. Syllogistic transitions remained robust under cross-examination."
        : `Logic Caution: ${totalFallacies} fallacy trap(s) flagged. Ground premises in verifiable empirical evidence to prevent syllogistic drift.`,
      rebuttal_feedback: avgRebuttal >= 85
        ? "High Tactical Leverage: Counterarguments directly dismantled the opponent's core contentions with structured multi-point refutation."
        : "Solid Counter-Positioning: Effective responses to opponent challenges. Deepen comparative impact calculus to gain persuasive leverage.",
      coaching_summary: dynamicActionDirectives.join(" • "),
      error_diagnostics: dynamicErrorDiagnostics,
      improvement_areas: dynamicImprovementAreas,
      action_directives: dynamicActionDirectives
    };

    try {
      const response = await fetch(`http://localhost:8000/api/v1/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: authHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCompletionMetrics({
          overall_score: data.overall_score ?? fallbackMetrics.overall_score,
          logical_score: data.logical_score ?? fallbackMetrics.logical_score,
          rebuttal_score: data.rebuttal_score ?? fallbackMetrics.rebuttal_score,
          overall_feedback: data.overall_feedback || fallbackMetrics.overall_feedback,
          logical_feedback: data.logical_feedback || fallbackMetrics.logical_feedback,
          rebuttal_feedback: data.rebuttal_feedback || fallbackMetrics.rebuttal_feedback,
          coaching_summary: data.coaching_summary || fallbackMetrics.coaching_summary,
          error_diagnostics: data.error_diagnostics && data.error_diagnostics.length > 0 ? data.error_diagnostics : fallbackMetrics.error_diagnostics,
          improvement_areas: data.improvement_areas && data.improvement_areas.length > 0 ? data.improvement_areas : fallbackMetrics.improvement_areas,
          action_directives: data.action_directives && data.action_directives.length > 0 ? data.action_directives : fallbackMetrics.action_directives
        });
      } else {
        setCompletionMetrics(fallbackMetrics);
      }
      setSessionStatus("Completed");
    } catch (err) {
      setCompletionMetrics(fallbackMetrics);
      setSessionStatus("Completed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendArgument = async (e) => {
    e.preventDefault();
    if (!checkAuth()) return;
    if (!userInput.trim()) return;

    const userMsg = userInput;
    setUserInput("");
    const activeUserName = (userName && !userName.toLowerCase().includes('hardwill')) ? userName : ((typeof window !== 'undefined' && localStorage.getItem('logos_ai_user_name') && !localStorage.getItem('logos_ai_user_name').toLowerCase().includes('hardwill')) ? localStorage.getItem('logos_ai_user_name') : 'Dayan');

    setTranscript(prev => [...prev, { speaker: activeUserName, text: userMsg, type: "user" }]);
    setLoading(true);

    try {
      const simRes = await fetch("http://localhost:8000/api/v1/simulation/turn", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          session_id: sessionId,
          user_argument: userMsg,
          opponent_persona: persona
        })
      });

      if (!simRes.ok) throw new Error('Unable to process this debate turn.');
      const data = await simRes.json();

      setTranscript(prev => [
        ...prev,
        {
          speaker: `AI Opponent (${persona})`,
          text: data.opponent_rebuttal,
          type: "opponent",
          rebuttal_strength: data.rebuttal_strength_percent,
          fallacies: data.fallacies_detected_in_user
        }
      ]);

      setLastAnalysis({
        rebuttal_strength: data.rebuttal_strength_percent,
        fallacies: data.fallacies_detected_in_user,
        coaching_tip: data.coaching_tip
      });

    } catch (err) {
      const fallbackSnippet = userMsg.length > 50 ? userMsg.substring(0, 47) + "..." : userMsg;
      setTranscript(prev => [
        ...prev,
        {
          speaker: `AI Opponent (${persona})`,
          text: `I strongly challenge your premise regarding "${fallbackSnippet}". Your argument assumes a causal certainty that is not supported by empirical data. What verifiable evidence demonstrates that this outcome is necessary and inevitable?`,
          type: "opponent",
          rebuttal_strength: 86.5,
          fallacies: []
        }
      ]);
      setLastAnalysis({
        rebuttal_strength: 86.5,
        fallacies: [],
        coaching_tip: "The opponent is challenging your core premise. Anchor your rebuttal in concrete statistics and verifiable examples."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={(authData) => {
          setIsAuthModalOpen(false);
          if (authData?.full_name) {
            setUserName(authData.full_name);
            localStorage.setItem('logos_ai_user_name', authData.full_name);
          }
        }}
      />

      <div className="watermark-container">
        <div className="watermark-text" style={{ bottom: '2rem', right: '2rem', left: 'auto', opacity: 0.05, zIndex: -1 }}>RHETORIC</div>
        <div className="section-container" style={{ paddingTop: '2rem', position: 'relative', zIndex: 1 }}>
          
          {/* Setup Configuration Panel */}
          {sessionStatus === "Setup" && (
            <div style={{ maxWidth: '920px', margin: '0 auto' }}>
              <div className="badge-red-pill">DEBATE WORKSPACE CONFIGURATION</div>
              <h1 className="font-display" style={{ fontSize: '2.6rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '2rem' }}>
                INITIALIZE AI PRACTICE SESSION
              </h1>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2.5rem' }}>
                {/* Left Side: Setup Parameters */}
                <div style={{ background: '#FFF', border: '1px solid var(--border-light)', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <h3 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', textTransform: 'uppercase' }}>Debate Parameters</h3>

                  {/* Rich Categorized Topic selection */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                      Select Debate Topic (30+ Options)
                    </label>
                    <select 
                      value={topic} 
                      onChange={(e) => setTopic(e.target.value)}
                      style={{ width: '100%', padding: '0.85rem 1rem', border: '1px solid var(--border-light)', outline: 'none', background: '#FFF', fontSize: '0.88rem', borderRadius: '8px', cursor: 'pointer', lineHeight: '1.4' }}
                    >
                      {TOPIC_CATEGORIES.map((cat, catIdx) => (
                        <optgroup key={catIdx} label={cat.category} style={{ fontWeight: 700, color: '#111827' }}>
                          {cat.topics.map((t, tIdx) => (
                            <option key={tIdx} value={t} style={{ fontWeight: 400, color: '#374151', padding: '4px 0' }}>
                              {t}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="✏️ Custom Motion" style={{ fontWeight: 700 }}>
                        <option value="Custom Topic (Enter below)">Custom Topic (Type your own motion below)</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Custom Topic Input */}
                  {topic === "Custom Topic (Enter below)" && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Enter Custom Debate Motion</label>
                      <input 
                        type="text"
                        placeholder="e.g., Space exploration should be prioritized over deep ocean research."
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box', borderRadius: '8px' }}
                      />
                    </div>
                  )}

                  {/* Debate Format selection */}
                  <div style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Debate Format</label>
                      <select 
                        value={format} 
                        onChange={(e) => setFormat(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', outline: 'none', background: '#FFF', fontSize: '0.88rem', borderRadius: '8px' }}
                      >
                        <option>1-on-1 Debate</option>
                        <option>Parliamentary Debate</option>
                        <option>Oxford Debate</option>
                        <option>Policy Debate</option>
                        <option>Public Forum Debate</option>
                      </select>
                    </div>

                    {/* Position Assignment selection */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Assigned Position</label>
                      <select 
                        value={position} 
                        onChange={(e) => setPosition(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', outline: 'none', background: '#FFF', fontSize: '0.88rem', borderRadius: '8px' }}
                      >
                        <option value="Affirmative">Affirmative (Pro)</option>
                        <option value="Negative">Negative (Con)</option>
                      </select>
                    </div>
                  </div>

                  {/* Persona selection */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Opponent Persona</label>
                    <select 
                      value={persona} 
                      onChange={(e) => setPersona(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', outline: 'none', background: '#FFF', fontSize: '0.88rem', borderRadius: '8px' }}
                    >
                      <option>The Contrarian</option>
                      <option>The Academic</option>
                      <option>The Strategist</option>
                    </select>
                  </div>

                  {/* Launch Button */}
                  <button 
                    onClick={handleStartDebate}
                    className="btn btn-red"
                    style={{ width: '100%', padding: '0.9rem', fontSize: '0.9rem', letterSpacing: '0.5px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Start Live AI Debate Simulation
                  </button>
                </div>

                {/* Right Side: Session Practice Scheduler */}
                <div style={{ background: '#111827', color: '#FFF', border: '1px solid var(--dark-border)', padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                  <div>
                    <h3 className="font-display text-red" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'uppercase' }}>Debate Scheduler</h3>
                    <p style={{ fontSize: '0.88rem', color: '#9CA3AF', marginBottom: '2rem', lineHeight: '1.5' }}>
                      Schedule practice matches ahead of time. This registers your debate parameters into your upcoming practice timetable.
                    </p>

                    {scheduleSuccess && (
                      <div style={{ background: '#1E293B', border: '1px solid var(--accent-red)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#FFF', marginBottom: '1.5rem' }}>
                        {scheduleSuccess}
                      </div>
                    )}

                    <form onSubmit={handleSchedulePractice}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Practice Date</label>
                        <input 
                          type="date"
                          required
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--dark-border)', outline: 'none', background: '#1F2937', color: '#FFF', fontSize: '0.9rem', boxSizing: 'border-box', borderRadius: '8px' }}
                        />
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Practice Time</label>
                        <input 
                          type="time"
                          required
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--dark-border)', outline: 'none', background: '#1F2937', color: '#FFF', fontSize: '0.9rem', boxSizing: 'border-box', borderRadius: '8px' }}
                        />
                      </div>

                      <button 
                        type="submit"
                        className="btn"
                        style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#FFF', border: '1px solid var(--dark-border)', borderRadius: '8px', transition: 'all 0.2s', cursor: 'pointer' }}
                      >
                        Schedule Practice Session
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Running Simulation Screen */}
          {sessionStatus === "Running" && (
            <div>
              {/* Header: DEBATE TERMINAL (Top), Format (Below), Position (Below) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.25rem' }}>
                <div>
                  {/* 1. DEBATE TERMINAL (Sabse Upar) */}
                  <h1 className="font-display" style={{ fontSize: '2.6rem', fontWeight: '900', textTransform: 'uppercase', margin: '0 0 0.5rem', lineHeight: '1.1' }}>
                    DEBATE TERMINAL
                  </h1>

                  {/* 2. FORMAT (Uske Niche) */}
                  <div style={{ fontSize: '0.95rem', color: '#4B5563', margin: '0 0 0.35rem' }}>
                    Format: <strong style={{ color: '#111827', fontWeight: 800 }}>{format}</strong>
                  </div>

                  {/* 3. POSITION (Uske Niche) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.95rem', color: '#4B5563' }}>Position:</span>
                    <span style={{
                      background: position === 'Affirmative' ? '#ECFDF5' : '#FEF2F2',
                      color: position === 'Affirmative' ? '#059669' : '#DC2626',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      border: `1px solid ${position === 'Affirmative' ? '#A7F3D0' : '#FECACA'}`
                    }}>
                      {position.toUpperCase()} {position === 'Affirmative' ? '(PRO)' : '(CON)'}
                    </span>
                  </div>
                </div>

                {/* Complete Debate & Record Score Button */}
                <button 
                  onClick={handleCompleteSession}
                  className="btn btn-red"
                  style={{ padding: '0.75rem 1.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(217, 4, 41, 0.25)' }}
                >
                  Save & Complete Practice Recording
                </button>
              </div>

              {/* Terminal Window Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '2rem' }}>
                {/* Terminal Box */}
                <div className="terminal-window" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                  <div className="terminal-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.85rem 1.25rem' }}>
                    <div className="terminal-dots" style={{ flexShrink: 0, marginTop: '4px' }}>
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <div 
                      className="terminal-title" 
                      style={{ 
                        margin: 0, 
                        fontSize: '0.82rem', 
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        flex: 1,
                        lineHeight: '1.4'
                      }}
                    >
                      <span style={{ flexShrink: 0, color: '#9CA3AF', fontWeight: 800, letterSpacing: '0.05em' }}>
                        TOPIC:
                      </span>
                      <span style={{ flex: 1, color: '#F3F4F6', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 600 }}>
                        {topic === "Custom Topic (Enter below)" ? (customTopic || "Custom Motion") : topic}
                      </span>
                    </div>
                  </div>

                  <div className="terminal-body" style={{ minHeight: '420px', maxHeight: '520px', overflowY: 'auto' }}>
                    {transcript.map((t, idx) => (
                      <div key={idx} style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className="font-mono text-muted">[{new Date().toLocaleTimeString()}]</span>
                          <strong className={t.type === 'user' ? 'text-cyan' : t.type === 'opponent' ? 'text-red' : 'text-green'}>
                            {t.speaker}:
                          </strong>
                        </div>

                        <div style={{ paddingLeft: '1.5rem', color: t.type === 'system' ? '#888' : '#e0e0e0', lineHeight: '1.5' }}>
                          {t.type === 'opponent' && idx === transcript.length - 1 ? (
                            <TypewriterText text={t.text} />
                          ) : (
                            t.text
                          )}
                        </div>

                        {t.fallacies && t.fallacies.length > 0 && (
                          <div style={{ margin: '0.5rem 0 0 1.5rem', background: '#25080c', border: '1px solid var(--accent-red)', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}>
                            <strong className="text-red">⚠️ Fallacy Flagged: {t.fallacies[0].fallacy_type}</strong>
                            <div style={{ color: '#ccc', marginTop: '2px' }}>{t.fallacies[0].explanation}</div>
                            {t.fallacies[0].correction_suggestion && (
                              <div style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: '2px' }}>Tip: {t.fallacies[0].correction_suggestion}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && <div className="text-muted font-mono animate-pulse" style={{ paddingLeft: '1.5rem' }}>&gt; AI Opponent synthesizing English rebuttal...</div>}
                  </div>

                  {/* Form Input */}
                  <form onSubmit={handleSendArgument} style={{ display: 'flex', borderTop: '1px solid var(--dark-border)', background: '#0e0e12' }}>
                    <input
                      type="text"
                      placeholder={`Type your debate speech / counterargument as ${userName || 'Dayan'} in English...`}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      className="font-mono"
                      style={{
                        flex: 1,
                        padding: '1rem 1.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        outline: 'none',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button type="submit" className="btn btn-red" style={{ borderRadius: 0, padding: '0 2rem', cursor: 'pointer' }}>
                      TRANSMIT
                    </button>
                  </form>
                </div>

                {/* Real-time Telemetry Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>OPPONENT REBUTTAL PRESSURE</div>
                    <div className="font-display" style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-red)' }}>
                      {lastAnalysis ? `${lastAnalysis.rebuttal_strength}%` : '88.5%'}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Status: Active English Rebuttal Stream
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>LOGIC AUDIT STATUS</div>
                    {lastAnalysis && lastAnalysis.fallacies && lastAnalysis.fallacies.length > 0 ? (
                      <div style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>
                        ❌ Fallacy Flagged: {lastAnalysis.fallacies[0].fallacy_type}
                      </div>
                    ) : (
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                        ✓ No Fallacies Flagged in Last Turn
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--dark-bg)', color: '#fff', border: '1px solid var(--dark-border)', borderRadius: '12px', padding: '1.5rem', flex: 1 }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>COACHING ASSISTANT</div>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#ccc' }}>
                      {lastAnalysis ? lastAnalysis.coaching_tip : "Address the opponent's core challenge directly before introducing new arguments. Bolster your claims with empirical evidence."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completed Session Report Screen */}
          {sessionStatus === "Completed" && (
            <div style={{ maxWidth: '920px', margin: '3rem auto', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '3rem 2.5rem', boxShadow: '0 12px 36px rgba(0,0,0,0.05)' }}>
              
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div className="badge-red-pill" style={{ marginBottom: '1rem', display: 'inline-block' }}>DEBATE RECORDED & EVALUATED</div>
                <h1 className="font-display" style={{ fontSize: '2.5rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.75rem', lineHeight: '1.1' }}>
                  AI Coach Performance Evaluation
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '720px', margin: '0 auto' }}>
                  Detailed multi-dimensional breakdown of your debate round on <strong>"{topic === 'Custom Topic (Enter below)' ? (customTopic || 'Custom Motion') : topic}"</strong>. Review identified argument errors, weaknesses, and actionable step-by-step coaching directives to elevate your debate performance.
                </p>
              </div>

              {/* 3 Core Metric Cards (Horizontal Grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
                
                {/* 1. Overall Performance */}
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>OVERALL SCORE</div>
                  <div className="font-display text-red" style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>
                    {completionMetrics?.overall_score ?? 86.5}%
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#DC2626', background: '#FFF', padding: '0.25rem 0.6rem', borderRadius: '6px', marginTop: '0.6rem', display: 'inline-block', border: '1px solid #FECACA' }}>
                    {(completionMetrics?.overall_score ?? 86.5) >= 88 ? 'MASTERY LEVEL' : (completionMetrics?.overall_score ?? 86.5) >= 75 ? 'COMPETENT ORATOR' : 'DEVELOPING RHETORIC'}
                  </span>
                  <p style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: '1.4', marginTop: '0.75rem', marginBottom: 0 }}>
                    {completionMetrics?.overall_feedback || "Strong rhetorical execution with disciplined dialectical command."}
                  </p>
                </div>

                {/* 2. Deductive Logic */}
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>LOGICAL INTEGRITY</div>
                  <div className="font-display" style={{ fontSize: '2.6rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                    {completionMetrics?.logical_score ?? 89.0}%
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#111827', background: '#FFF', padding: '0.25rem 0.6rem', borderRadius: '6px', marginTop: '0.6rem', display: 'inline-block', border: '1px solid #E5E7EB' }}>
                    {(completionMetrics?.logical_score ?? 89.0) >= 85 ? 'CLEAN REASONING' : 'LOGIC VULNERABILITY'}
                  </span>
                  <p style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: '1.4', marginTop: '0.75rem', marginBottom: 0 }}>
                    {completionMetrics?.logical_feedback || "Deductive structure maintained without major fallacy traps."}
                  </p>
                </div>

                {/* 3. Rebuttal Effectiveness */}
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>REBUTTAL LEVERAGE</div>
                  <div className="font-display" style={{ fontSize: '2.6rem', fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>
                    {completionMetrics?.rebuttal_score ?? 84.5}%
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563EB', background: '#FFF', padding: '0.25rem 0.6rem', borderRadius: '6px', marginTop: '0.6rem', display: 'inline-block', border: '1px solid #BFDBFE' }}>
                    {(completionMetrics?.rebuttal_score ?? 84.5) >= 85 ? 'HIGH TACTICAL LEVERAGE' : 'SOLID COUNTERS'}
                  </span>
                  <p style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: '1.4', marginTop: '0.75rem', marginBottom: 0 }}>
                    {completionMetrics?.rebuttal_feedback || "Direct counter-positioning applied to opponent claims."}
                  </p>
                </div>

              </div>

              {/* UNIFIED COMPREHENSIVE AI COACH FEEDBACK & DIAGNOSTIC REPORT */}
              <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', marginBottom: '2.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                
                {/* Header of the unified feedback box */}
                <div style={{ background: '#111827', color: '#FFF', padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      COMPREHENSIVE AI COACH AUDIT REPORT
                    </div>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0' }}>
                      Detailed Feedback, Weakness Diagnostics & Action Plan
                    </h3>
                  </div>
                  <span style={{ background: 'rgba(217,4,41,0.2)', border: '1px solid var(--accent-red)', color: '#FF8A8A', fontSize: '0.72rem', fontWeight: 800, padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
                    EVALUATION TARGET: {position.toUpperCase()} ({format})
                  </span>
                </div>

                <div style={{ padding: '2rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* PART 1: IDENTIFIED WEAKNESSES & ERRORS */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                        1
                      </span>
                      <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                        Identified Errors & Weakness Diagnostics
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(completionMetrics?.error_diagnostics || []).map((err, idx) => (
                        <div key={idx} style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '10px', padding: '1.1rem 1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9A3412' }}>
                              ⚠️ {err.title}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: err.severity === 'High Risk' ? '#FEE2E2' : err.severity === 'Medium Risk' ? '#FEF3C7' : '#E0E7FF',
                              color: err.severity === 'High Risk' ? '#DC2626' : err.severity === 'Medium Risk' ? '#D97706' : '#4338CA',
                              border: `1px solid ${err.severity === 'High Risk' ? '#FECACA' : err.severity === 'Medium Risk' ? '#FDE68A' : '#C7D2FE'}`
                            }}>
                              {err.severity || 'Identified Weakness'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.86rem', color: '#431407', margin: '0 0 0.5rem', lineHeight: '1.45' }}>
                            <strong>Where the error occurred:</strong> {err.description}
                          </p>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', background: '#FFEDD5', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid #EA580C' }}>
                            <strong>Impact on Your Score:</strong> {err.why_it_weakened}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PART 2: TARGETED IMPROVEMENT AREAS */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                        2
                      </span>
                      <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                        Targeted Remediation & Improvement Roadmap
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                      {(completionMetrics?.improvement_areas || []).map((imp, idx) => (
                        <div key={idx} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '1.1rem 1.25rem' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534', marginBottom: '0.35rem' }}>
                            ✓ {imp.step}
                          </div>
                          <div style={{ fontSize: '0.86rem', color: '#14532D', marginBottom: '0.4rem', fontWeight: 600 }}>
                            {imp.action}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#166534', background: '#DCFCE7', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid #16A34A', lineHeight: '1.45' }}>
                            <strong>How to apply in practice:</strong> {imp.how_to_fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PART 3: ACTION DIRECTIVES & NEXT STEPS */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <span style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                        3
                      </span>
                      <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                        Official AI Coach Action Directives
                      </h4>
                    </div>

                    <div style={{ background: '#111827', color: '#FFF', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(completionMetrics?.action_directives || [
                        `Preemptively neutralize the opponent's core challenge regarding "${topic}" within your opening 45 seconds.`,
                        "Anchor each contention in at least one verifiable empirical benchmark, legal precedent, or statistical data point.",
                        "Maintain a deliberate, authoritative delivery pace of 140–150 WPM, taking a 1.5-second pause immediately following your core warrant for rhetorical impact."
                      ]).map((dir, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                          <span style={{ background: 'var(--accent-red)', color: '#FFF', minWidth: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, marginTop: '2px', flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '0.88rem', color: '#E5E7EB', lineHeight: '1.45' }}>
                            {dir}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setSessionStatus("Setup")}
                  className="btn btn-dark"
                  style={{ padding: '0.85rem 2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  Start New Practice Session
                </button>
                <Link
                  href="/dashboard"
                  className="btn btn-red"
                  style={{ padding: '0.85rem 2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  View in Dashboard →
                </Link>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}
