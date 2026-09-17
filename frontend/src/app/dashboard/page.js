"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';
import SpeakerIcon from '../../components/SpeakerIcon';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('debates'); // debates, presentations, trends, coaching, settings
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [hoveredTrend, setHoveredTrend] = useState(null);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [trendFilter, setTrendFilter] = useState('all'); // 'all', 'last30', 'last15', 'last10'
  const [trendCategory, setTrendCategory] = useState('debate'); // 'debate', 'presentation', 'argument', 'policy', 'counter'
  const trendScrollRef = useRef(null);
  const [userRole, setUserRole] = useState('Learner');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [experience, setExperience] = useState('Intermediate');
  const [topics, setTopics] = useState('AI, Technology, Politics');
  const [domains, setDomains] = useState('Public Speaking, Keynotes');
  const [goals, setGoals] = useState('Reduce filler words, Master counterarguments');
  const [coaching, setCoaching] = useState('Real-time alerts, Detailed post-session audits');
  
  const [profileMsg, setProfileMsg] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Dynamic Coaching States
  const [skillGapSummary, setSkillGapSummary] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [pathSteps, setPathSteps] = useState([]);
  const [progressStatus, setProgressStatus] = useState('');
  const [debateRecommendations, setDebateRecommendations] = useState([]);
  const [presentationSuggestions, setPresentationSuggestions] = useState([]);
  const [skillDevelopmentPlans, setSkillDevelopmentPlans] = useState([]);
  const [coachingFilter, setCoachingFilter] = useState('ALL'); // 'ALL', 'DEBATE', 'PRESENTATION', 'SKILLS', 'FEEDBACK', 'PATH'
  const [completedDrills, setCompletedDrills] = useState({});
  const [activeSpeakingKey, setActiveSpeakingKey] = useState(null);

  // Persistent Datasets fetched directly from Backend
  const [debateHistory, setDebateHistory] = useState([]);
  const [presentationHistory, setPresentationHistory] = useState([]);

  // Learner Coach Evaluation States (Grade & Marks given by Debate Coach)
  const [coachGradeData, setCoachGradeData] = useState({
    grade: 'Pending',
    marks: null,
    evaluator_name: 'Debate Coach',
    evaluator_role: 'Debate Coach & Evaluator',
    coach_feedback: '',
    evaluation_status: 'Pending Coach Assessment',
    standing: 'Pending Assessment',
    assessed_at: ''
  });

  // Coach Grading Inputs (for Coach Form)
  const [coachGradeInput, setCoachGradeInput] = useState('A');
  const [coachMarksInput, setCoachMarksInput] = useState('85.0');

  // Coach Dashboard States
  const [coachOverview, setCoachOverview] = useState({
    assigned_students: 0,
    class_performance_average: 85.0,
    pending_evaluations: 0,
    system_status: '100% ONLINE',
    top_class_pain_points: []
  });
  const [coachStudents, setCoachStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCoachSessionId, setSelectedCoachSessionId] = useState('latest');
  const [coachFeedbackInput, setCoachFeedbackInput] = useState('');
  const [coachSuccessMsg, setCoachSuccessMsg] = useState('');
  const [coachReportStudentId, setCoachReportStudentId] = useState('all');
  const [coachDownloading, setCoachDownloading] = useState(null);
  const [coachReportMsg, setCoachReportMsg] = useState(null);

  const handleCoachReportDownload = async (type) => {
    const token = getToken();
    if (!token) {
      setIsAuthModalOpen(true);
      return;
    }
    setCoachDownloading(type);
    setCoachReportMsg(null);

    let url = '';
    let defaultFilename = '';
    const sid = coachReportStudentId || 'all';

    if (type === 'pdf') {
      url = `http://localhost:8000/api/v1/reports/export/coach/roster/pdf?student_id=${sid}`;
      defaultFilename = sid === 'all' ? 'LogosAI_Student_Roster_Audit.pdf' : `LogosAI_Coach_Assessment_${sid}.pdf`;
    } else if (type === 'excel') {
      url = `http://localhost:8000/api/v1/reports/export/coach/roster/excel?student_id=${sid}`;
      defaultFilename = sid === 'all' ? 'LogosAI_Student_Roster.csv' : `LogosAI_Student_Metrics_${sid}.csv`;
    } else if (type === 'coaching') {
      url = `http://localhost:8000/api/v1/reports/export/coach/coaching/pdf?student_id=${sid}`;
      defaultFilename = 'LogosAI_Coach_Master_Plan.pdf';
    }

    try {
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = defaultFilename;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) filename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setCoachReportMsg({ type: 'success', text: `Downloaded: ${filename}` });
      setTimeout(() => setCoachReportMsg(null), 4000);
    } catch (err) {
      setCoachReportMsg({ type: 'error', text: `Export failed: ${err.message}` });
      setTimeout(() => setCoachReportMsg(null), 5000);
    } finally {
      setCoachDownloading(null);
    }
  };

  const getToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
  };

  const parseJwt = (token) => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      try {
        return JSON.parse(atob(token.split('.')[1]));
      } catch (e) {
        return null;
      }
    }
  };

  useEffect(() => {
    const savedToken = getToken();
    if (!savedToken) {
      setIsAuthModalOpen(true);
      setUserName('Guest User');
      setUserEmail('guest@logos.ai');
      setLoading(false);
      return;
    }

    const payload = parseJwt(savedToken);
    if (!payload) {
      localStorage.removeItem('logos_ai_jwt');
      setIsAuthModalOpen(true);
      setUserName('Guest User');
      setUserEmail('guest@logos.ai');
      setLoading(false);
      return;
    }

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      localStorage.removeItem('logos_ai_jwt');
      setIsAuthModalOpen(true);
      setUserName('Guest User');
      setUserEmail('guest@logos.ai');
      setLoading(false);
      return;
    }

    const role = payload.role || 'Learner';
    setUserRole(role);
    const rLower = role.toLowerCase();
    if (rLower.includes('coach') || rLower.includes('educator') || rLower.includes('admin')) {
      setActiveTab('overview');
    } else {
      setActiveTab('debates');
    }
    setUserEmail(payload.sub || '');
    const cachedName = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_user_name') : null;
    if (cachedName && !cachedName.toLowerCase().includes('hardwill')) {
      setUserName(cachedName);
    } else if (payload?.full_name && !payload.full_name.toLowerCase().includes('hardwill')) {
      setUserName(payload.full_name);
    } else if (payload.sub && (payload.sub.toLowerCase().includes('dayan') || payload.sub.toLowerCase().includes('hardwill'))) {
      setUserName('Dayan');
    } else {
      setUserName(payload.sub ? payload.sub.split('@')[0] : 'User');
    }
    
    fetchAllData(savedToken);
  }, []);

  const fetchAllData = async (token) => {
    try {
      await Promise.allSettled([
        fetchProfile(token),
        fetchCoachingPlan(token),
        fetchCoachGrade(token),
        fetchDebateHistory(token),
        fetchPresentationHistory(token),
        fetchCoachData(token)
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/profile/me", {
        headers: { "Authorization": `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        const resolvedName = (data.full_name && !data.full_name.toLowerCase().includes('hardwill'))
          ? data.full_name
          : ((userEmail.toLowerCase().includes('dayan') || userEmail.toLowerCase().includes('hardwill')) ? 'Dayan' : (data.full_name || 'Debater'));
        setFullName(resolvedName);
        setUserName(resolvedName);
        localStorage.setItem('logos_ai_user_name', resolvedName);
        setExperience(data.experience_level || 'Intermediate');
        setTopics(data.preferred_topics || 'Technology, AI, Policy');
        setDomains(data.presentation_domains || 'Public Speaking, Keynotes');
        setGoals(data.learning_goals || 'Reduce filler words, Master counterarguments');
        setCoaching(data.coaching_preferences || 'Real-time alerts');
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const fetchCoachingPlan = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/coaching/plan/me", {
        headers: { "Authorization": `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSkillGapSummary(data.skill_gap_summary || '');
        setRecommendations(Array.isArray(data.targeted_recommendations) ? data.targeted_recommendations : []);
        setPathSteps(Array.isArray(data.learning_path_steps) ? data.learning_path_steps : []);
        setProgressStatus(data.progress_status || 'Level 2 - Competent Debater');
        if (data.debate_recommendations && Array.isArray(data.debate_recommendations)) {
          setDebateRecommendations(data.debate_recommendations);
        } else {
          setDebateRecommendations([
            { id: "deb-1", title: "Logical Rebuttal Structuring", category: "Debate Strategy", priority: "High", description: "Formulate 3-tier rebuttals (Claim, Evidence, Warrant) to preempt counterattacks effectively.", drill: "Practice with Toulmin Refutation Drills in Debate Simulation" },
            { id: "deb-2", title: "Fallacy Shielding & Preemption", category: "Argument Analysis", priority: "High", description: "Identify and counteract subtle Straw Man and Red Herring pivots prior to speech conclusion.", drill: "Complete 5 Fallacy Detection audit sessions" },
            { id: "deb-3", title: "Cross-Examination Assertiveness", category: "Debate Tactics", priority: "Medium", description: "Maintain tactical control during cross-examination by answering concisely without conceding key arguments.", drill: "Run Socratic Cross-examination drill against Aggressive Challenger" }
          ]);
        }
        if (data.presentation_suggestions && Array.isArray(data.presentation_suggestions)) {
          setPresentationSuggestions(data.presentation_suggestions);
        } else {
          setPresentationSuggestions([
            { id: "pres-1", aspect: "Speaking Pace & Cadence", current_stat: "142 WPM", target_stat: "130 - 155 WPM", status: "Optimal", suggestion: "Maintain steady cadence across complex points." },
            { id: "pres-2", aspect: "Filler Word Mitigation", current_stat: "2.5 per speech", target_stat: "< 2 per speech", status: "Needs Attention", suggestion: "Replace verbal hesitations ('um', 'ah', 'like') with purposeful 1.5-second pauses." },
            { id: "pres-3", aspect: "Vocal Clarity & Projection", current_stat: "88%", target_stat: "> 85%", status: "Optimal", suggestion: "Emphasize pivotal transition phrases to maximize audience engagement and clarity." }
          ]);
        }
        if (data.skill_development_plans && Array.isArray(data.skill_development_plans)) {
          setSkillDevelopmentPlans(data.skill_development_plans);
        } else {
          setSkillDevelopmentPlans([
            { skill: "Argument Structure & Toulmin Framing", level: "Proficient", progress: 85, focus_areas: ["Data warranting", "Rebuttal preemption", "Impact framing"] },
            { skill: "Vocal Delivery & Delivery Dynamics", level: "Advanced", progress: 82, focus_areas: ["Pacing control", "Pause placement", "Intonation modulation"] },
            { skill: "Logical Fallacy Resilience", level: "Proficient", progress: 85, focus_areas: ["Circular reasoning detection", "Straw man refutation", "Ad hominem redirection"] },
            { skill: "Cross-Examination & Rebuttal Speed", level: "Intermediate", progress: 72, focus_areas: ["Direct answer brevity", "Counter-question framing", "Closing synthesis"] }
          ]);
        }
        if (data.assigned_grade) {
          setCoachGradeData((prev) => ({
            ...prev,
            grade: data.assigned_grade,
            marks: data.assigned_marks !== undefined && data.assigned_marks !== null ? data.assigned_marks : prev.marks,
            evaluator_name: data.evaluator_name || prev.evaluator_name,
            evaluation_status: data.evaluation_status || prev.evaluation_status,
            standing: data.standing || prev.standing,
            coach_feedback: data.coach_feedback || prev.coach_feedback,
            assessed_at: data.last_graded_at || prev.assessed_at
          }));
        }
      }
    } catch (err) {
      setSkillGapSummary("Your metrics indicate solid progress. Focus on reducing filler words and logical fallacies.");
      setRecommendations(["Practice Logical Consistency", "Vocal Pacing drills", "Review fallacy shield guidelines."]);
      setPathSteps(["Speech Cadence (Active)", "Filler Word Mitigation (Active)", "Socratic Cross-examination (Upcoming)"]);
      setProgressStatus("Level 2 - Competent Debater");
      setDebateRecommendations([
        { id: "deb-1", title: "Logical Rebuttal Structuring", category: "Debate Strategy", priority: "High", description: "Formulate 3-tier rebuttals (Claim, Evidence, Warrant) to preempt counterattacks effectively.", drill: "Practice with Toulmin Refutation Drills in Debate Simulation" },
        { id: "deb-2", title: "Fallacy Shielding & Preemption", category: "Argument Analysis", priority: "High", description: "Identify and counteract subtle Straw Man and Red Herring pivots prior to speech conclusion.", drill: "Complete 5 Fallacy Detection audit sessions" },
        { id: "deb-3", title: "Cross-Examination Assertiveness", category: "Debate Tactics", priority: "Medium", description: "Maintain tactical control during cross-examination by answering concisely without conceding key arguments.", drill: "Run Socratic Cross-examination drill against Aggressive Challenger" }
      ]);
      setPresentationSuggestions([
        { id: "pres-1", aspect: "Speaking Pace & Cadence", current_stat: "142 WPM", target_stat: "130 - 155 WPM", status: "Optimal", suggestion: "Maintain steady cadence across complex points." },
        { id: "pres-2", aspect: "Filler Word Mitigation", current_stat: "2.5 per speech", target_stat: "< 2 per speech", status: "Needs Attention", suggestion: "Replace verbal hesitations ('um', 'ah', 'like') with purposeful 1.5-second pauses." },
        { id: "pres-3", aspect: "Vocal Clarity & Projection", current_stat: "88%", target_stat: "> 85%", status: "Optimal", suggestion: "Emphasize pivotal transition phrases to maximize audience engagement and clarity." }
      ]);
      setSkillDevelopmentPlans([
        { skill: "Argument Structure & Toulmin Framing", level: "Proficient", progress: 85, focus_areas: ["Data warranting", "Rebuttal preemption", "Impact framing"] },
        { skill: "Vocal Delivery & Delivery Dynamics", level: "Advanced", progress: 82, focus_areas: ["Pacing control", "Pause placement", "Intonation modulation"] },
        { skill: "Logical Fallacy Resilience", level: "Proficient", progress: 85, focus_areas: ["Circular reasoning detection", "Straw man refutation", "Ad hominem redirection"] },
        { skill: "Cross-Examination & Rebuttal Speed", level: "Intermediate", progress: 72, focus_areas: ["Direct answer brevity", "Counter-question framing", "Closing synthesis"] }
      ]);
    }
  };

  const fetchCoachGrade = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/coaching/coach-grade/me", {
        headers: { "Authorization": `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoachGradeData(data);
      }
    } catch (err) {
      console.error("Coach grade fetch error:", err);
    }
  };

  const fetchDebateHistory = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/sessions/history", {
        headers: { "Authorization": `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDebateHistory(data);
        }
      }
    } catch (err) {
      console.error("Failed to load debate history:", err);
    }
  };

  const fetchPresentationHistory = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/presentation-analysis/history", {
        headers: { "Authorization": `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPresentationHistory(data);
        }
      }
    } catch (err) {
      console.error("Failed to load presentation history:", err);
    }
  };

  const handleStudentSelectChange = (studentId) => {
    setSelectedStudentId(studentId);
    setSelectedCoachSessionId('latest');
    const target = coachStudents.find(s => String(s.id) === String(studentId));
    if (target) {
      setCoachGradeInput(target.grade || 'A');
      setCoachMarksInput(target.score > 0 ? String(target.score) : '85.0');
    }
  };

  const fetchCoachData = async (token) => {
    const t = token || getToken();
    if (!t) return;
    try {
      const [overviewRes, studentsRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/coaching/coach/overview", {
          headers: { "Authorization": `Bearer ${t}` }
        }),
        fetch("http://localhost:8000/api/v1/coaching/coach/students", {
          headers: { "Authorization": `Bearer ${t}` }
        })
      ]);
      if (overviewRes.ok) {
        const ovData = await overviewRes.json();
        setCoachOverview(ovData);
      }
      if (studentsRes.ok) {
        const stData = await studentsRes.json();
        if (Array.isArray(stData)) {
          setCoachStudents(stData);
          if (stData.length > 0) {
            setSelectedStudentId((prev) => {
              const currentId = prev || String(stData[0].id);
              const target = stData.find(s => String(s.id) === currentId) || stData[0];
              setCoachGradeInput(target.grade || 'A');
              setCoachMarksInput(target.score > 0 ? String(target.score) : '85.0');
              return currentId;
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load coach data:", err);
    }
  };

  // Compile unified recent activity (Top 3 most recent sessions)
  const unifiedRecentSessions = [
    ...debateHistory.map(d => ({
      id: `deb-${d.id}`,
      title: d.title || d.topic,
      topic: d.topic,
      format: (d.session_type === 'Vocal Matrix' || d.session_type === 'Presentation Analysis') ? 'Presentation Analysis' : (d.format || d.session_type || 'Debate Session'),
      type: (d.session_type === 'Vocal Matrix' || d.session_type === 'Presentation Analysis') ? 'Presentation Analysis' : 'Debate',
      score: d.score || 85,
      date: d.date || 'Recent',
      created_at: d.created_at
    })),
    ...presentationHistory.filter(p => !debateHistory.some(d => d.id === p.session_id)).map(p => ({
      id: `pres-${p.id}`,
      title: p.title || 'Presentation Analysis Session',
      topic: p.topic || 'Speech Prosody Evaluation',
      format: 'Presentation Analysis',
      type: 'Presentation Analysis',
      score: p.overall_score || Math.round(p.confidence_score * 0.5 + p.clarity_score * 0.5),
      date: p.date || 'Recent',
      created_at: p.created_at
    }))
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const top3Recent = unifiedRecentSessions.slice(0, 3);

  // Dynamic calculations
  const totalDebates = debateHistory.filter(d => d.session_type !== 'Vocal Matrix' && d.session_type !== 'Presentation Analysis').length;
  const totalVocalSessions = presentationHistory.length;

  // 1. Debate Improvement Trend Data
  const debateTrendData = useMemo(() => {
    const validDebates = debateHistory.filter(d => d.session_type !== 'Vocal Matrix' && d.session_type !== 'Presentation Analysis');
    const items = validDebates.length > 0 ? validDebates : [
      { id: 'deb-b1', topic: 'Universal Basic Income Economic Feasibility', format: 'Parliamentary Debate', overall_score: 74, created_at: '2026-09-01' },
      { id: 'deb-b2', topic: 'Artificial General Intelligence Safety Standards', format: 'Lincoln-Douglas', overall_score: 79, created_at: '2026-09-05' },
      { id: 'deb-b3', topic: 'Autonomous Defense Grids & Human Oversight', format: 'Cross-Examination', overall_score: 84, created_at: '2026-09-10' },
      { id: 'deb-b4', topic: 'Stratospheric Aerosol Injection Protocols', format: 'Parliamentary Debate', overall_score: 88, created_at: '2026-09-15' },
      { id: 'deb-b5', topic: 'Decentralized Digital Identity & State Sovereignty', format: 'Championship Round', overall_score: 92, created_at: '2026-09-17' },
    ];
    let runSum = 0;
    return items.map((d, index) => {
      const roundNumber = index + 1;
      const scoreVal = parseFloat(d.overall_score ?? d.score ?? 85);
      runSum += scoreVal;
      const meanPercentage = Math.round((runSum / roundNumber) * 10) / 10;
      const prevScore = index > 0 ? parseFloat(items[index - 1].overall_score ?? items[index - 1].score ?? 85) : scoreVal;
      const delta = Math.round((scoreVal - prevScore) * 10) / 10;
      return {
        round: roundNumber,
        id: d.id,
        topic: d.topic || d.title,
        format: d.format || 'Debate Session',
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: d.date || d.created_at || 'Recent',
        category: 'Debate'
      };
    });
  }, [debateHistory]);

  // 2. Presentation Improvement Trend Data
  const presentationTrendData = useMemo(() => {
    const items = presentationHistory.length > 0 ? presentationHistory : [
      { id: 'pres-b1', topic: 'Keynote Introduction: Frontier Intelligence', wpm: 172, filler_words_count: 7, clarity_score: 72, confidence_score: 68, overall_score: 70, date: '2026-09-02' },
      { id: 'pres-b2', topic: 'Vocal Modulation: Cadence & Pacing Audit', wpm: 164, filler_words_count: 5, clarity_score: 78, confidence_score: 74, overall_score: 76, date: '2026-09-06' },
      { id: 'pres-b3', topic: 'Persuasive Rhetoric & Pause Placement', wpm: 152, filler_words_count: 3, clarity_score: 84, confidence_score: 82, overall_score: 83, date: '2026-09-11' },
      { id: 'pres-b4', topic: 'Executive Briefing: Technical Synthesis', wpm: 146, filler_words_count: 2, clarity_score: 89, confidence_score: 88, overall_score: 89, date: '2026-09-14' },
      { id: 'pres-b5', topic: 'Keynote Address: Socratic Articulation', wpm: 140, filler_words_count: 1, clarity_score: 94, confidence_score: 92, overall_score: 93, date: '2026-09-17' },
    ];
    let runSum = 0;
    return items.map((p, index) => {
      const roundNumber = index + 1;
      const scoreVal = parseFloat(p.overall_score ?? Math.round((p.confidence_score || 80) * 0.5 + (p.clarity_score || 80) * 0.5));
      runSum += scoreVal;
      const meanPercentage = Math.round((runSum / roundNumber) * 10) / 10;
      const prevScore = index > 0 ? parseFloat(items[index - 1].overall_score ?? 80) : scoreVal;
      const delta = Math.round((scoreVal - prevScore) * 10) / 10;
      return {
        round: roundNumber,
        id: p.id,
        topic: p.topic || p.title,
        format: `${p.wpm || 142} WPM • ${p.filler_words_count || 2} fillers`,
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: p.date || p.created_at || 'Recent',
        category: 'Presentation Analysis',
        wpm: p.wpm,
        clarity: p.clarity_score,
        fillers: p.filler_words_count
      };
    });
  }, [presentationHistory]);

  // 3. Argument Quality Improvement Trend Data
  const argumentTrendData = useMemo(() => {
    const argSessions = debateHistory.filter(d => d.argument_quality !== undefined || d.logical_consistency !== undefined);
    const items = argSessions.length > 0 ? argSessions : [
      { id: 'arg-b1', topic: 'Claim Warranting: Empirical Evidence Linkage', score: 71, format: 'Toulmin Structure Audit', date: '2026-09-03' },
      { id: 'arg-b2', topic: 'Premise Coherence & Syllogistic Deduction', score: 77, format: 'Deductive Logic Analysis', date: '2026-09-07' },
      { id: 'arg-b3', topic: 'Refutation Resilience & Fallacy Shielding', score: 82, format: 'Fallacy Defense Audit', date: '2026-09-12' },
      { id: 'arg-b4', topic: 'Statistical Data Substantiation & Credibility', score: 87, format: 'Empirical Warrant Verification', date: '2026-09-15' },
      { id: 'arg-b5', topic: 'Dialectic Synthesis & Counter-Premise Defense', score: 91, format: 'Advanced Rhetoric Audit', date: '2026-09-17' },
    ];
    let runSum = 0;
    return items.map((a, index) => {
      const roundNumber = index + 1;
      const scoreVal = parseFloat(a.argument_quality ?? a.logical_consistency ?? a.score ?? 82);
      runSum += scoreVal;
      const meanPercentage = Math.round((runSum / roundNumber) * 10) / 10;
      const prevScore = index > 0 ? parseFloat(items[index - 1].argument_quality ?? items[index - 1].score ?? 82) : scoreVal;
      const delta = Math.round((scoreVal - prevScore) * 10) / 10;
      return {
        round: roundNumber,
        id: a.id,
        topic: a.topic || a.title,
        format: a.format || 'Argument Analysis Audit',
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: a.date || a.created_at || 'Recent',
        category: 'Argument Analysis'
      };
    });
  }, [debateHistory]);

  // 4. Policy Debate Improvement Trend Data
  const policyTrendData = useMemo(() => {
    const policySessions = debateHistory.filter(d => (d.topic || '').toLowerCase().includes('policy') || (d.format || '').toLowerCase().includes('policy'));
    const items = policySessions.length > 0 ? policySessions : [
      { id: 'pol-b1', topic: 'State Healthcare Infrastructure Mandates', score: 69, format: 'Policy Feasibility Analysis', date: '2026-09-02' },
      { id: 'pol-b2', topic: 'Carbon Dividend & Cap-and-Trade Solvency', score: 76, format: 'Fiscal Cost-Benefit Model', date: '2026-09-08' },
      { id: 'pol-b3', topic: 'Federal AI Compute Infrastructure Subsidies', score: 83, format: 'Stakeholder Impact Assessment', date: '2026-09-13' },
      { id: 'pol-b4', topic: 'Universal Telecommunications Governance Plan', score: 86, format: 'Solvency & Enforcement Audit', date: '2026-09-16' },
      { id: 'pol-b5', topic: 'Multilateral Cyber Defense Treaty Protocols', score: 92, format: 'International Policy Accord', date: '2026-09-17' },
    ];
    let runSum = 0;
    return items.map((p, index) => {
      const roundNumber = index + 1;
      const scoreVal = parseFloat(p.overall_score ?? p.score ?? 80);
      runSum += scoreVal;
      const meanPercentage = Math.round((runSum / roundNumber) * 10) / 10;
      const prevScore = index > 0 ? parseFloat(items[index - 1].overall_score ?? items[index - 1].score ?? 80) : scoreVal;
      const delta = Math.round((scoreVal - prevScore) * 10) / 10;
      return {
        round: roundNumber,
        id: p.id,
        topic: p.topic || p.title,
        format: p.format || 'Policy Rebuttal Audit',
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: p.date || p.created_at || 'Recent',
        category: 'Policy Debate'
      };
    });
  }, [debateHistory]);

  // 5. Counterargument & Rebuttal Trend Data
  const counterTrendData = useMemo(() => {
    const counterSessions = debateHistory.filter(d => d.rebuttal_effectiveness !== undefined);
    const items = counterSessions.length > 0 ? counterSessions : [
      { id: 'cnt-b1', topic: 'Countering Technology Monopoly Defense Claims', score: 73, format: 'Logical Rebuttal Drill', date: '2026-09-04' },
      { id: 'cnt-b2', topic: 'Refuting Economic Protectionism Arguments', score: 78, format: 'Evidence Counterargument', date: '2026-09-09' },
      { id: 'cnt-b3', topic: 'Challenging Bioethics Moratorium Assertions', score: 84, format: 'Ethical Counterargument', date: '2026-09-12' },
      { id: 'cnt-b4', topic: 'Dismantling Surveillance Overreach Claims', score: 89, format: 'Practical Counterpoint Drill', date: '2026-09-15' },
      { id: 'cnt-b5', topic: 'Socratic Cross-Examination on Free Expression', score: 94, format: 'Strategic Rebuttal Mastery', date: '2026-09-17' },
    ];
    let runSum = 0;
    return items.map((c, index) => {
      const roundNumber = index + 1;
      const scoreVal = parseFloat(c.rebuttal_effectiveness ?? c.score ?? 84);
      runSum += scoreVal;
      const meanPercentage = Math.round((runSum / roundNumber) * 10) / 10;
      const prevScore = index > 0 ? parseFloat(items[index - 1].rebuttal_effectiveness ?? items[index - 1].score ?? 84) : scoreVal;
      const delta = Math.round((scoreVal - prevScore) * 10) / 10;
      return {
        round: roundNumber,
        id: c.id,
        topic: c.topic || c.title,
        format: c.format || 'Counterargument Engine Drill',
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: c.date || c.created_at || 'Recent',
        category: 'Counterargument Engine'
      };
    });
  }, [debateHistory]);

  // Current active trend dataset according to trendCategory
  const currentCategoryData = (() => {
    switch (trendCategory) {
      case 'presentation': return presentationTrendData;
      case 'argument': return argumentTrendData;
      case 'policy': return policyTrendData;
      case 'counter': return counterTrendData;
      case 'debate':
      default: return debateTrendData;
    }
  })();

  const currentEvaluatedCount = currentCategoryData.length;
  const currentMeanPercentage = currentEvaluatedCount > 0
    ? Math.round((currentCategoryData.reduce((acc, curr) => acc + curr.score, 0) / currentEvaluatedCount) * 10) / 10
    : 0;
  const currentHighestScore = currentEvaluatedCount > 0
    ? Math.max(...currentCategoryData.map(t => t.score))
    : 0;
  const currentFirstScore = currentEvaluatedCount > 0 ? currentCategoryData[0].score : 0;
  const currentLatestScore = currentEvaluatedCount > 0 ? currentCategoryData[currentCategoryData.length - 1].score : 0;
  const currentNetGrowth = currentEvaluatedCount > 1
    ? Math.round((currentLatestScore - currentFirstScore) * 10) / 10
    : 0;

  // Domain configurations for customized display per category
  const categoryConfigs = {
    debate: {
      name: "Debate Simulation",
      title: "Debate Improvement Progression Graph",
      subtitle: "Automated chronological tracking of round-by-round debate overall scores and cumulative mean percentage.",
      badge: "DEBATE SIMULATION TRAJECTORY",
      color: "#D90429",
      gradientId: "scoreAreaGradientDebate",
      scoreLabel: "Round Overall Score (%)",
      roundPrefix: "ROUND",
      axisGuideName: "Practice Rounds",
      axisGuideDesc: "Represents each completed debate round in chronological sequence. Evaluates dialectical flow, Toulmin structuring, and refutation mastery."
    },
    presentation: {
      name: "Presentation Analysis",
      title: "Presentation Analysis Prosody & Cadence Graph",
      subtitle: "Chronological tracking of speaking pace (WPM), articulation clarity, filler mitigation, and vocal confidence.",
      badge: "PRESENTATION ANALYSIS TRAJECTORY",
      color: "#7C3AED",
      gradientId: "scoreAreaGradientPres",
      scoreLabel: "Speech Delivery Score (%)",
      roundPrefix: "SPEECH",
      axisGuideName: "Speech Sessions",
      axisGuideDesc: "Tracks presentation audits measuring speaking pace stability (optimal 130-155 WPM), verbal filler mitigation, and vocal confidence."
    },
    argument: {
      name: "Argument Analysis",
      title: "Argument Quality & Logical Coherence Graph",
      subtitle: "Longitudinal evaluation of syllogistic validity, claim warranting, evidence relevance, and fallacy resistance.",
      badge: "ARGUMENT ANALYSIS TRAJECTORY",
      color: "#2563EB",
      gradientId: "scoreAreaGradientArg",
      scoreLabel: "Argument Validity Score (%)",
      roundPrefix: "AUDIT",
      axisGuideName: "Argument Audits",
      axisGuideDesc: "Measures deductive structure, evidence warranting density, premise linkages, and resilience against adversarial refutations."
    },
    policy: {
      name: "Policy Rebuttals",
      title: "Policy Debate Solvency & Feasibility Graph",
      subtitle: "Tracking solvency efficacy, fiscal feasibility, stakeholder impact analysis, and comparative policy leverage.",
      badge: "POLICY REBUTTALS TRAJECTORY",
      color: "#059669",
      gradientId: "scoreAreaGradientPol",
      scoreLabel: "Policy Solvency Score (%)",
      roundPrefix: "POLICY",
      axisGuideName: "Policy Motions",
      axisGuideDesc: "Measures systemic feasibility benchmarks, fiscal cost-benefit solvency, comparative advantage ratios, and policy implementation viability."
    },
    counter: {
      name: "Counterargument Engine",
      title: "Counterargument & Rebuttal Strength Graph",
      subtitle: "Measurement of refutation velocity, alternative perspective depth, challenge question rigor, and tactical counterpoints.",
      badge: "COUNTERARGUMENT ENGINE TRAJECTORY",
      color: "#EA580C",
      gradientId: "scoreAreaGradientCnt",
      scoreLabel: "Rebuttal Leverage Score (%)",
      roundPrefix: "DRILL",
      axisGuideName: "Rebuttal Drills",
      axisGuideDesc: "Measures counterpoint sharpness across Logical, Evidence-Based, Ethical, Practical, and Policy refutation axes."
    }
  };

  const activeCategoryConfig = categoryConfigs[trendCategory] || categoryConfigs.debate;

  // Filtered subset of currentCategoryData for high-clarity graph scaling
  const visibleTrendData = (() => {
    if (trendFilter === 'last10') return currentCategoryData.slice(-10);
    if (trendFilter === 'last15') return currentCategoryData.slice(-15);
    if (trendFilter === 'last30') return currentCategoryData.slice(-30);
    return currentCategoryData;
  })();

  const handleScrollTrend = (direction) => {
    if (!trendScrollRef.current) return;
    const scrollAmount = direction === 'left' ? -350 : 350;
    trendScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'trends' && trendScrollRef.current) {
      setTimeout(() => {
        if (trendScrollRef.current) {
          trendScrollRef.current.scrollLeft = trendScrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [activeTab, trendFilter, trendCategory]);

  const hasSessions = unifiedRecentSessions.length > 0;
  const avgScore = hasSessions
    ? Math.round((unifiedRecentSessions.reduce((acc, curr) => acc + (parseFloat(curr.score) || 85), 0) / unifiedRecentSessions.length) * 10) / 10 
    : 0;

  const latestVocal = presentationHistory[0] || (debateHistory.find(d => d.session_type === 'Vocal Matrix' || d.session_type === 'Presentation Analysis')?.metrics ? debateHistory.find(d => d.session_type === 'Vocal Matrix' || d.session_type === 'Presentation Analysis') : null);
  const latestDebate = debateHistory.find(d => d.session_type !== 'Vocal Matrix' && d.session_type !== 'Presentation Analysis') || debateHistory[0] || null;

  const currentPace = latestVocal ? `${latestVocal.wpm} WPM` : (latestDebate?.metrics?.wpm ? `${latestDebate.metrics.wpm} WPM` : (hasSessions ? '142 WPM' : '0 WPM (Pending)'));
  const displayAvgScore = hasSessions ? `${avgScore}%` : '0% (Pending)';

  // Real Dynamic Scores directly from latest recorded sessions
  const logicalConsistencyScore = latestDebate?.logical_consistency !== undefined && latestDebate?.logical_consistency !== null
    ? Math.round(latestDebate.logical_consistency)
    : latestDebate?.fallacies_count !== undefined
    ? Math.max(20, Math.round(100 - latestDebate.fallacies_count * 15))
    : latestVocal?.confidence_score
    ? Math.round(latestVocal.confidence_score)
    : (hasSessions ? Math.round(avgScore) : 0);

  const argumentConstructionScore = latestDebate?.argument_quality !== undefined && latestDebate?.argument_quality !== null
    ? Math.round(latestDebate.argument_quality)
    : latestDebate?.score !== undefined
    ? Math.round(latestDebate.score)
    : latestVocal?.overall_score
    ? Math.round(latestVocal.overall_score)
    : (hasSessions ? Math.round(avgScore) : 0);

  const vocalClarityScore = latestVocal?.clarity_score !== undefined
    ? Math.round(latestVocal.clarity_score)
    : latestDebate?.communication_skills !== undefined && latestDebate?.communication_skills !== null
    ? Math.round(latestDebate.communication_skills)
    : latestDebate?.metrics?.clarity !== undefined
    ? Math.round(latestDebate.metrics.clarity)
    : 0;

  const fillerControlScore = latestVocal?.filler_words_count !== undefined
    ? Math.max(0, Math.min(100, Math.round(100 - (latestVocal.filler_words_count * 8))))
    : latestDebate?.metrics?.filler_words !== undefined
    ? Math.max(0, Math.min(100, Math.round(100 - (latestDebate.metrics.filler_words * 8))))
    : (latestVocal ? 100 : 0);

  const rebuttalScore = latestDebate?.rebuttal_effectiveness !== undefined && latestDebate?.rebuttal_effectiveness !== null
    ? Math.round(latestDebate.rebuttal_effectiveness)
    : latestDebate?.score !== undefined
    ? Math.round(latestDebate.score * 0.95)
    : latestVocal?.engagement_score
    ? Math.round(latestVocal.engagement_score)
    : 0;

  const latestSessionSource = latestDebate
    ? `Debate: ${latestDebate.topic || latestDebate.title}`
    : (latestVocal ? `Vocal Studio: ${latestVocal.topic || 'Speech Prosody'}` : 'No recorded sessions yet');

  // Skill Metrics Matrix - 100% Dynamic from User's Latest Sessions
  const skillsMatrix = [
    { 
      name: 'Logical Consistency', 
      value: logicalConsistencyScore, 
      color: '#D90429', 
      source: latestDebate?.logical_consistency ? `Simulation Syllogism Audit (${logicalConsistencyScore}%)` : (latestDebate ? `Fallacy Deduction Score (${logicalConsistencyScore}%)` : 'Unassessed (Complete a Debate)'),
      description: 'Ability to avoid fallacy traps under cross-examination.' 
    },
    { 
      name: 'Argument Construction', 
      value: argumentConstructionScore, 
      color: '#111827', 
      source: latestDebate?.argument_quality ? `Argument Engine Audit (${argumentConstructionScore}%)` : (latestDebate ? `Session Performance Rating (${argumentConstructionScore}%)` : 'Unassessed (Complete a Debate)'),
      description: 'Evidence strength, claim isolation, and structural reasoning relevance.' 
    },
    { 
      name: 'Vocal Clarity & Cadence', 
      value: vocalClarityScore, 
      color: '#4B5563', 
      source: latestVocal ? `Vocal Studio Prosody (${vocalClarityScore}%)` : (latestDebate?.communication_skills ? `Derived from Debate Delivery (${vocalClarityScore}%)` : 'Unassessed (Record in Vocal Studio)'),
      description: 'Pacing precision (target: 130-150 WPM) and voice modulation.' 
    },
    { 
      name: 'Filler Word Control', 
      value: fillerControlScore, 
      color: '#10B981', 
      source: latestVocal ? `${latestVocal.filler_words_count || 0} filler pauses detected (${fillerControlScore}%)` : 'Unassessed (Record in Vocal Studio)',
      description: 'Minimal use of vocal pauses (e.g. "um", "uh", "you know").' 
    },
    { 
      name: 'Rebuttal Effectiveness', 
      value: rebuttalScore, 
      color: '#3B82F6', 
      source: latestDebate?.rebuttal_effectiveness ? `Simulation Multi-Turn Counter (${rebuttalScore}%)` : (latestDebate ? `Debate Score Benchmark (${rebuttalScore}%)` : 'Unassessed (Complete a Debate)'),
      description: 'Addressing critical challenges using structured counterargument strategies.' 
    }
  ];

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setProfileMsg(null);
    const token = getToken();
    
    try {
      const res = await fetch(`http://localhost:8000/api/v1/auth/profile/me?full_name=${encodeURIComponent(fullName)}&experience_level=${encodeURIComponent(experience)}&preferred_topics=${encodeURIComponent(topics)}&presentation_domains=${encodeURIComponent(domains)}&learning_goals=${encodeURIComponent(goals)}&coaching_preferences=${encodeURIComponent(coaching)}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (res.ok) {
        setUserName(fullName);
        setProfileMsg({ type: 'success', text: 'User profile metrics successfully updated in database.' });
        fetchCoachingPlan(token);
      } else {
        setProfileMsg({ type: 'error', text: 'Error updating profile. Please verify authorization.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: 'Failed to connect to API backend.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleSendCoachFeedback = async (e) => {
    e.preventDefault();
    if (!coachFeedbackInput.trim() || !selectedStudentId) return;
    const token = getToken();
    try {
      const bodyPayload = {
        student_id: parseInt(selectedStudentId),
        feedback: coachFeedbackInput,
        grade: coachGradeInput || null,
        marks: coachMarksInput ? parseFloat(coachMarksInput) : null
      };
      if (selectedCoachSessionId === 'all') {
        bodyPayload.session_id = -1;
      } else if (selectedCoachSessionId !== 'latest' && selectedCoachSessionId) {
        bodyPayload.session_id = parseInt(selectedCoachSessionId);
      }

      const res = await fetch("http://localhost:8000/api/v1/coaching/coach/feedback", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        const data = await res.json();
        setCoachSuccessMsg(data.message || `Official Grade (${coachGradeInput}) and coaching directive dispatched to student!`);
        setCoachFeedbackInput('');
        setTimeout(() => setCoachSuccessMsg(''), 4000);
        fetchCoachData(token);
      } else {
        setCoachSuccessMsg("Failed to dispatch recommendation. Verify student selection.");
      }
    } catch (err) {
      setCoachSuccessMsg("Failed to connect to API backend.");
    }
  };

  const handleCoachingSpeak = (key, text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    if (activeSpeakingKey === key) {
      window.speechSynthesis.cancel();
      setActiveSpeakingKey(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    utterance.onend = () => setActiveSpeakingKey(null);
    utterance.onerror = () => setActiveSpeakingKey(null);
    setActiveSpeakingKey(key);
    window.speechSynthesis.speak(utterance);
  };

  const handleLogout = () => {
    localStorage.removeItem('logos_ai_jwt');
    localStorage.removeItem('logos_ai_user_name');
    router.push('/login');
  };

  // Role Normalization
  const roleStr = (userRole || 'Learner').trim().toLowerCase();
  const isCoach = roleStr.includes('coach');
  const isEducator = roleStr.includes('educator') || roleStr.includes('teacher');
  const isAdmin = roleStr.includes('admin');
  const isLearner = !isCoach && !isEducator && !isAdmin;

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-pulse" style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent-red)' }}>DECRYPTING DATA MATRIX...</div>
        </div>
      </div>
    );
  }

  const userInitial = (userName || fullName || 'User').trim().charAt(0).toUpperCase();

  return (
    <div className="section-container" style={{ paddingTop: '2.5rem', fontFamily: "'Inter', sans-serif" }}>
      {/* Global Black Border on Hover/Focus Across Dashboard & Improvement Trends */}
      <style jsx global>{`
        .trend-card-box,
        .dash-card-box {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
        }
        .trend-card-box:hover,
        .trend-card-box:focus-within,
        .dash-card-box:hover,
        .dash-card-box:focus-within {
          border-color: #000000 !important;
          box-shadow: 0 6px 22px rgba(0, 0, 0, 0.08) !important;
        }
        .trend-action-btn,
        .dash-action-btn {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease !important;
        }
        .trend-action-btn:hover,
        .trend-action-btn:focus,
        .dash-action-btn:hover,
        .dash-action-btn:focus {
          border-color: #000000 !important;
        }
      `}</style>
      
      {/* Dashboard Brand Header with Squircle Avatar & Logout Widget */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1.75rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2.85rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: '1.1', margin: '0 0 0.6rem', color: '#111827' }}>
            Welcome, {userName || 'User'}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <p style={{ color: '#4B5563', fontSize: '0.92rem', margin: 0 }}>
              Account Email: <strong style={{ color: '#111827', fontWeight: 700 }}>{userEmail}</strong>
            </p>
            <p style={{ color: '#4B5563', fontSize: '0.92rem', margin: 0 }}>
              Role: <strong style={{ color: '#111827', fontWeight: 700 }}>{userRole}</strong>
            </p>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                background: '#FEE2E2', 
                color: '#D90429', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '0.35rem 0.75rem', 
                borderRadius: '6px', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em' 
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#D90429' }}></span>
                Router Session Active
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Squircle Avatar & Logout Controls */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Quick Direct Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="dash-action-btn"
            style={{
              background: '#FFFFFF',
              color: '#DC2626',
              border: '1.5px solid #FCA5A5',
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.18s ease'
            }}
            title="Click to logout immediately"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            LOGOUT
          </button>

          {/* User Initial Squircle Avatar (Curved edges, smooth corners, D / M initial) */}
          <div
            tabIndex={0}
            role="button"
            aria-label="User Profile and Logout Menu"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="dash-squircle-avatar"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '11px',
              background: '#111827',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: 900,
              fontFamily: "'Inter', sans-serif",
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              border: showUserMenu ? '2px solid #000000' : '2px solid #1F2937',
              transition: 'all 0.2s ease',
              userSelect: 'none'
            }}
            title={`User Profile: ${userName || fullName || 'User'} (Click for Options)`}
          >
            {userInitial}
          </div>

          {/* Dropdown Popover on Avatar Click */}
          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '56px',
                width: '280px',
                background: '#FFFFFF',
                border: '2px solid #000000',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 14px 35px rgba(0,0,0,0.18)',
                zIndex: 9999
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.85rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#111827',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 900
                }}>
                  {userInitial}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {userName || fullName || 'User'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {userEmail}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.2rem', background: '#F9FAFB', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Role</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>{userRole}</div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="dash-action-btn"
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  background: '#D90429',
                  color: '#FFFFFF',
                  border: '2px solid #D90429',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                LOGOUT OF LOGOS.AI
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unified Tab Select Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '6px', marginBottom: '2.5rem', overflowX: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        {(isLearner ? [
          { id: 'overview', label: 'OVERVIEW & SUMMARY' },
          { id: 'debates', label: `DEBATE HISTORY (${totalDebates})` },
          { id: 'presentations', label: `PRESENTATION ANALYSIS (${totalVocalSessions})` },
          { id: 'coaching', label: 'RECOMMENDATION & COACHING ENGINE' },
          { id: 'trends', label: 'IMPROVEMENT TRENDS' },
          { id: 'settings', label: 'PROFILE SETTINGS' }
        ] : [
          { id: 'overview', label: 'OVERVIEW & SUMMARY' },
          { id: 'debates', label: `DEBATE HISTORY (${totalDebates})` },
          { id: 'presentations', label: `PRESENTATION ANALYSIS ARCHIVE (${totalVocalSessions})` },
          { id: 'coaching', label: 'RECOMMENDATION & COACHING ENGINE' },
          { id: 'trends', label: 'IMPROVEMENT TRENDS' },
          { id: 'settings', label: 'PROFILE SETTINGS' }
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="dash-action-btn"
            style={{
              padding: '0.75rem 1.5rem',
              border: activeTab === tab.id ? '2px solid #000000' : '2px solid transparent',
              background: activeTab === tab.id ? '#111827' : 'transparent',
              color: activeTab === tab.id ? '#FFF' : '#4B5563',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB: ROLE-SPECIFIC DASHBOARD OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* A. LEARNER OVERVIEW */}
          {isLearner && (() => {
            const isGradeAssigned = Boolean(
              coachGradeData && 
              coachGradeData.grade && 
              coachGradeData.grade !== 'Pending' && 
              coachGradeData.grade.trim() !== '' && 
              coachGradeData.evaluator_name && 
              coachGradeData.evaluator_name.trim() !== ''
            );

            return (
            <div>
              {/* Quick statistics cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #111827', borderRadius: '12px', position: 'relative', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                    COACH ASSIGNED GRADE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <div className="font-display" style={{ 
                      fontSize: '2.4rem', 
                      fontWeight: 900,
                      color: isGradeAssigned 
                        ? (coachGradeData.grade.startsWith('A') ? '#059669' : coachGradeData.grade.startsWith('B') ? '#2563EB' : '#D90429') 
                        : '#9CA3AF',
                      lineHeight: 1
                    }}>
                      {isGradeAssigned ? coachGradeData.grade : 'Pending'}
                    </div>
                    {isGradeAssigned && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '6px',
                        background: coachGradeData.grade.startsWith('A') ? '#ECFDF5' : coachGradeData.grade.startsWith('B') ? '#EFF6FF' : '#FEF2F2',
                        color: coachGradeData.grade.startsWith('A') ? '#059669' : coachGradeData.grade.startsWith('B') ? '#2563EB' : '#DC2626'
                      }}>
                        {coachGradeData.grade.startsWith('A') ? 'HONOR ROLL' : coachGradeData.grade.startsWith('B') ? 'COMPETENT' : 'EVALUATED'}
                      </span>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.4rem' }}>
                    {isGradeAssigned && coachGradeData.evaluator_name ? `BY ${coachGradeData.evaluator_name.toUpperCase()}` : 'AWAITING COACH REVIEW'}
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                    EVALUATOR MARKS
                  </div>
                  <div className="font-display" style={{ 
                    fontSize: '2.4rem', 
                    fontWeight: 900, 
                    lineHeight: 1,
                    color: isGradeAssigned ? 'var(--accent-red)' : '#9CA3AF'
                  }}>
                    {isGradeAssigned && coachGradeData.marks !== null && coachGradeData.marks !== undefined 
                      ? `${coachGradeData.marks}%` 
                      : 'Pending'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.4rem' }}>
                    {isGradeAssigned ? (coachGradeData.evaluation_status ? coachGradeData.evaluation_status.toUpperCase() : 'OFFICIAL COACH MARKS') : 'PENDING COACH ASSESSMENT'}
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>DEBATES COMPLETED</div>
                  <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1 }}>{totalDebates}</div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.4rem' }}>RECORDED SIMULATIONS</div>
                </div>

                <div style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>PRESENTATION ANALYSIS SESSIONS</div>
                  <div className="font-display text-red" style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1 }}>{totalVocalSessions}</div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.4rem' }}>PROSODY & CLARITY AUDITS</div>
                </div>

                <div style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>LATEST SPEAKING PACE</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}>{currentPace}</div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.4rem' }}>TARGET: 130-160 WPM</div>
                </div>
              </div>

              {/* 3 Most Recent Entries Summary Card */}
              <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '2rem', marginBottom: '2.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                      Recent Completed Sessions (Latest 3)
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                      Summary of your most recent debate and presentation analysis practice sessions saved in the database.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab(totalDebates > 0 ? 'debates' : 'presentations')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-red)',
                      fontWeight: 700,
                      fontSize: '0.825rem',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    VIEW FULL HISTORY ({unifiedRecentSessions.length} SESSIONS) →
                  </button>
                </div>

                {top3Recent.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Session Topic / Title</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Format / Type</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Performance Score</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Date Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top3Recent.map((s) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '1rem', fontWeight: 600 }}>{s.topic || s.title}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: (s.type === 'Presentation Analysis' || s.type === 'Vocal Matrix') ? '#FEF2F2' : '#F0FDF4',
                                color: (s.type === 'Presentation Analysis' || s.type === 'Vocal Matrix') ? '#DC2626' : '#166534',
                                border: `1px solid ${(s.type === 'Presentation Analysis' || s.type === 'Vocal Matrix') ? '#FECACA' : '#BBF7D0'}`
                              }}>
                                {s.format}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                              {s.score}%
                            </td>
                            <td style={{ padding: '1rem', color: '#6B7280' }}>{s.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', background: '#FAFAFC', border: '1px dashed #E5E7EB' }}>
                    No completed sessions found yet. Start a simulation or record in the Presentation Analysis studio to see your metrics!
                  </div>
                )}
              </div>

              {/* Main Content Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }}>
                {/* Left Side: Skill matrix */}
                <div style={{ background: '#FFF', padding: '2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Rhetorical Skill Matrix</h3>
                      <div className="font-mono" style={{ fontSize: '0.72rem', color: hasSessions ? '#059669' : '#6B7280', marginTop: '0.35rem', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {hasSessions ? `● LIVE SYNC: ${latestSessionSource}` : '○ BASELINE: COMPLETE A SIMULATION OR VOCAL SESSION'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {skillsMatrix.map((skill, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          <span style={{ color: '#111827' }}>{skill.name}</span>
                          <span style={{ color: skill.value > 0 ? skill.color : '#9CA3AF' }}>
                            {skill.value > 0 ? `${skill.value}%` : 'Unassessed (0%)'}
                          </span>
                        </div>
                        {/* Bar */}
                        <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${skill.value}%`, height: '100%', background: skill.color, borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{skill.description}</p>
                          <span style={{ fontSize: '0.68rem', color: '#6B7280', fontStyle: 'italic', fontFamily: 'var(--font-mono)' }}>{skill.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Coaching Engine Insights & Suggestions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Official Debate Coach Evaluation Card */}
                  <div style={{ background: '#FFF', border: '2px solid #111827', padding: '1.75rem 2rem', borderRadius: '14px', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
                      <div>
                        <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                          OFFICIAL EVALUATION AUDIT
                        </div>
                        <h4 className="font-display" style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0' }}>
                          Debate Coach Standing
                        </h4>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        background: isGradeAssigned ? '#ECFDF5' : '#FEF2F2',
                        color: isGradeAssigned ? '#059669' : '#DC2626',
                        border: `1px solid ${isGradeAssigned ? '#A7F3D0' : '#FECACA'}`
                      }}>
                        {isGradeAssigned ? '● ASSIGNED BY DEBATE COACH' : '○ PENDING COACH ASSESSMENT'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', marginBottom: '1.25rem', background: '#F9FAFB', padding: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                      <div>
                        <div className="font-mono text-muted" style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          OFFICIAL GRADE
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                          <span className="font-display" style={{ 
                            fontSize: '2.5rem', 
                            fontWeight: 900, 
                            color: isGradeAssigned 
                              ? (coachGradeData.grade.startsWith('A') ? '#059669' : coachGradeData.grade.startsWith('B') ? '#2563EB' : '#D90429') 
                              : '#9CA3AF',
                            lineHeight: 1
                          }}>
                            {isGradeAssigned ? coachGradeData.grade : 'Pending'}
                          </span>
                        </div>
                        <div className="font-mono" style={{ fontSize: '0.7rem', color: '#6B7280', marginTop: '0.35rem' }}>
                          {isGradeAssigned ? coachGradeData.standing : 'Pending Assessment'}
                        </div>
                      </div>

                      <div>
                        <div className="font-mono text-muted" style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          EVALUATOR MARKS
                        </div>
                        <div className="font-display" style={{ 
                          fontSize: '2.5rem', 
                          fontWeight: 900, 
                          lineHeight: 1, 
                          marginTop: '0.25rem',
                          color: isGradeAssigned ? 'var(--accent-red)' : '#9CA3AF'
                        }}>
                          {isGradeAssigned && coachGradeData.marks !== null && coachGradeData.marks !== undefined 
                            ? `${coachGradeData.marks}%` 
                            : 'Pending'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '0.7rem', color: '#6B7280', marginTop: '0.35rem' }}>
                          Assigned by: <strong>{isGradeAssigned && coachGradeData.evaluator_name ? coachGradeData.evaluator_name : 'Awaiting Coach Review'}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderLeft: '3px solid var(--accent-red)', paddingLeft: '1rem' }}>
                      <div className="font-mono text-muted" style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {isGradeAssigned && coachGradeData.evaluator_name 
                          ? `LATEST DIRECTIVE FROM ${coachGradeData.evaluator_name.toUpperCase()}` 
                          : 'AWAITING INSTRUCTOR DIRECTIVE'}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#374151', lineHeight: '1.45', margin: 0, fontStyle: 'italic' }}>
                        "{isGradeAssigned && coachGradeData.coach_feedback 
                          ? coachGradeData.coach_feedback 
                          : 'Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here.'}"
                      </p>
                    </div>
                  </div>

                  {/* Coaching Plan Summary */}
                  <div style={{ background: '#111827', color: '#FFF', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>COACHING ENGINE INSIGHTS</div>
                    <h3 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Active Plan: {progressStatus}</h3>
                    <p style={{ fontSize: '0.88rem', color: '#ccc', lineHeight: '1.5', marginBottom: '1.5rem' }}>{skillGapSummary}</p>
                    
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', marginBottom: '0.5rem' }}>ACTIVE LEARNING STEP</div>
                    <div style={{ fontSize: '0.9rem', color: '#FFF', fontWeight: 600 }}>{pathSteps[0] || 'Module: Speech Cadence (Active)'}</div>
                  </div>

                  {/* Recommendations Exercise list */}
                  <div style={{ background: '#FFF', padding: '2rem', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                    <h4 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Recommended Practice drills</h4>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', color: '#4B5563', lineHeight: '1.4' }}>
                      {recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* B. DEBATE COACH OVERVIEW */}
          {isCoach && (
            <div>
              {/* Quick Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>ASSIGNED STUDENTS</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>{coachOverview.assigned_students}</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>CLASS PERFORMANCE AVERAGE</div>
                  <div className="font-display text-red" style={{ fontSize: '2.2rem', fontWeight: 900 }}>{coachOverview.class_performance_average}%</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>PENDING EVALUATIONS</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>{coachOverview.pending_evaluations}</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>STATUS SYSTEM</div>
                  <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10B981' }}>{coachOverview.system_status}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }}>
                {/* Student Progress Monitoring */}
                <div style={{ background: '#FFF', padding: '2rem', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Student Progress Monitoring</h3>
                    <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{coachStudents.length} ENROLLED</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                          <th style={{ padding: '0.75rem' }}>Student Name</th>
                          <th style={{ padding: '0.75rem' }}>Active Debate / Session Topic</th>
                          <th style={{ padding: '0.75rem' }}>Sessions</th>
                          <th style={{ padding: '0.75rem' }}>Grade</th>
                          <th style={{ padding: '0.75rem' }}>Avg Score</th>
                          <th style={{ padding: '0.75rem' }}>Top Logic Gap / Metric</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coachStudents.length > 0 ? (
                          coachStudents.map((student) => (
                            <tr key={student.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '0.85rem' }}>
                                <div style={{ fontWeight: 600, color: '#111827' }}>{student.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{student.email}</div>
                              </td>
                              <td style={{ padding: '0.85rem', maxWidth: '200px' }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                  {student.topic}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{student.format}</span>
                              </td>
                              <td style={{ padding: '0.85rem', fontWeight: 600 }}>{student.total_sessions}</td>
                              <td style={{ padding: '0.85rem' }}>
                                <span style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: student.grade && student.grade.startsWith('A') ? '#ECFDF5' : student.grade && student.grade.startsWith('B') ? '#EFF6FF' : '#FEF2F2',
                                  color: student.grade && student.grade.startsWith('A') ? '#059669' : student.grade && student.grade.startsWith('B') ? '#2563EB' : '#DC2626'
                                }}>
                                  {student.grade}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem', color: 'var(--accent-red)', fontWeight: 700 }}>
                                {student.score > 0 ? `${student.score}%` : 'N/A'}
                              </td>
                              <td style={{ padding: '0.85rem' }}>
                                <span style={{ background: '#FEE2E2', color: '#D90429', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  {student.gap}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
                              No students registered in the database yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sidebar Skill Gaps and Recommendations Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: '#111827', color: '#FFF', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', marginBottom: '0.5rem' }}>ROSTER SKILL GAP ANALYSIS</div>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Top Class Pain Points</h4>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: '#ccc' }}>
                      {coachOverview.top_class_pain_points && coachOverview.top_class_pain_points.length > 0 ? (
                        coachOverview.top_class_pain_points.map((pt, idx) => (
                          <li key={idx}>{pt}</li>
                        ))
                      ) : (
                        <>
                          <li>Logical consistency remains steady across recent debate transcripts.</li>
                          <li>Encourage speech recordings in Presentation Analysis studio to evaluate speaking cadence.</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Coaching feedback form */}
                  <div style={{ background: '#FFF', border: '1px solid #E5E7EB', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                       OFFICIAL EVALUATOR DISPATCH
                    </div>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>
                      Assign Official Grade & Coaching Directives
                    </h4>
                    {coachSuccessMsg && (
                      <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#059669', padding: '0.75rem', borderRadius: '8px', fontSize: '0.825rem', marginBottom: '1rem', fontWeight: 600 }}>
                        {coachSuccessMsg}
                      </div>
                    )}
                    <form onSubmit={handleSendCoachFeedback}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Select Student</label>
                        <select 
                          value={selectedStudentId} 
                          onChange={(e) => handleStudentSelectChange(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#FFF', fontSize: '0.85rem' }}
                        >
                          {coachStudents.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} ({s.email}) — Current Grade: {s.grade}</option>
                          ))}
                        </select>
                      </div>

                      {/* Debate Session Selection */}
                      {(() => {
                        const curStudent = coachStudents.find(s => String(s.id) === String(selectedStudentId));
                        const sessions = curStudent?.sessions || [];
                        return (
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                              Target Debate Session to Grade
                            </label>
                            <select
                              value={selectedCoachSessionId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedCoachSessionId(val);
                                if (val !== 'latest' && val !== 'all') {
                                  const targetSess = sessions.find(s => String(s.id) === String(val));
                                  if (targetSess && targetSess.coach_grade && targetSess.coach_grade !== 'Pending') {
                                    setCoachGradeInput(targetSess.coach_grade);
                                    if (targetSess.coach_marks !== null && targetSess.coach_marks !== undefined) {
                                      setCoachMarksInput(String(targetSess.coach_marks));
                                    }
                                  }
                                }
                              }}
                              style={{ width: '100%', padding: '0.6rem', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#FFF', fontSize: '0.85rem' }}
                            >
                              <option value="latest">Latest Session ({curStudent?.topic ? (curStudent.topic.length > 40 ? curStudent.topic.substring(0, 40) + '...' : curStudent.topic) : 'Most Recent'})</option>
                              {sessions.map((sess) => (
                                <option key={sess.id} value={sess.id}>
                                  Session {sess.id}: {sess.topic?.length > 40 ? sess.topic.substring(0, 40) + '...' : sess.topic} [Grade: {sess.coach_grade || 'Pending'}]
                                </option>
                              ))}
                              <option value="all">Apply to All Practice Sessions of this Student</option>
                            </select>
                          </div>
                        );
                      })()}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                            Assign Official Grade
                          </label>
                          <select
                            value={coachGradeInput}
                            onChange={(e) => setCoachGradeInput(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #111827', borderRadius: '8px', background: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}
                          >
                            <option value="A+">A+ (Mastery / Distinction)</option>
                            <option value="A">A (Advanced Debater)</option>
                            <option value="A-">A- (Proficient Speaker)</option>
                            <option value="B+">B+ (Competent Rhetorician)</option>
                            <option value="B">B (Developing Competitor)</option>
                            <option value="C">C (Foundational Stage)</option>
                            <option value="D">D (Remedial Drills Needed)</option>
                            <option value="Pending">Pending Evaluation</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                            Evaluator Marks (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={coachMarksInput}
                            onChange={(e) => setCoachMarksInput(e.target.value)}
                            placeholder="e.g. 96.5"
                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #111827', borderRadius: '8px', background: '#FFF', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Coaching Directive / Feedback</label>
                        <textarea 
                          rows={3} 
                          value={coachFeedbackInput}
                          onChange={(e) => setCoachFeedbackInput(e.target.value)}
                          placeholder="e.g. Work on pausing to reduce filler words. Aim for 140 WPM during rebuttal." 
                          style={{ width: '100%', padding: '0.6rem', border: '1px solid #E5E7EB', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.85rem' }}
                        />
                      </div>
                      <button type="submit" className="btn btn-red" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase' }}>
                        DISPATCH GRADE & DIRECTIVE
                      </button>
                    </form>
                  </div>

                  {/* Debate Coach Reports & Analytics Export Suite */}
                  <div style={{ background: '#FFF', border: '1px solid #E5E7EB', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                      COACHING COMPLIANCE & EXPORTS
                    </div>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Debate Coach Reports Suite
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                      Export official coach assessment evaluations, student performance matrices, and instructional directives.
                    </p>

                    {coachReportMsg && (
                      <div style={{
                        background: coachReportMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                        border: `1px solid ${coachReportMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
                        color: coachReportMsg.type === 'error' ? '#DC2626' : '#059669',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        marginBottom: '1rem'
                      }}>
                        {coachReportMsg.text}
                      </div>
                    )}

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                        Target Student / Cohort
                      </label>
                      <select
                        value={coachReportStudentId}
                        onChange={(e) => setCoachReportStudentId(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #111827', borderRadius: '8px', background: '#F9FAFB', fontSize: '0.825rem', fontWeight: 600 }}
                      >
                        <option value="all">All Enrolled Students (Cohort Master Audit)</option>
                        {coachStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <button
                        onClick={() => handleCoachReportDownload('pdf')}
                        disabled={coachDownloading === 'pdf'}
                        className="btn btn-red"
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                      >
                        {coachDownloading === 'pdf' ? 'GENERATING ASSESSMENT PDF...' : '1. ASSESSMENT PDF REPORT'}
                      </button>

                      <button
                        onClick={() => handleCoachReportDownload('excel')}
                        disabled={coachDownloading === 'excel'}
                        className="btn btn-dark"
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                      >
                        {coachDownloading === 'excel' ? 'EXPORTING CSV MATRIX...' : '2. EXCEL & CSV METRIC MATRIX'}
                      </button>

                      <button
                        onClick={() => handleCoachReportDownload('coaching')}
                        disabled={coachDownloading === 'coaching'}
                        className="btn btn-dark"
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                      >
                        {coachDownloading === 'coaching' ? 'GENERATING COACHING PLAN...' : '3. COACHING PLANS (PDF)'}
                      </button>
                    </div>

                    <div style={{ marginTop: '1.25rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #F3F4F6' }}>
                      <Link href="/reports" style={{ fontSize: '0.78rem', color: 'var(--accent-red)', fontWeight: 700, textDecoration: 'underline' }}>
                        Open Full Reports & Performance Certificates Hub →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. EDUCATOR OVERVIEW */}
          {isEducator && (
            <div>
              {/* Roster classroom statistics cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>ACTIVE CLASSES</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>1</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>TOTAL ENROLLED STUDENTS</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>{coachStudents.length}</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>CLASS DEBATE AVERAGE</div>
                  <div className="font-display text-red" style={{ fontSize: '2.2rem', fontWeight: 900 }}>{coachOverview.class_performance_average}%</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>PLATFORM STATUS</div>
                  <div className="font-display text-red" style={{ fontSize: '1.6rem', fontWeight: 900 }}>100% ONLINE</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }}>
                {/* Student Rankings */}
                <div style={{ background: '#FFF', padding: '2rem', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem' }}>Student Leaderboard Rankings</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                        <th style={{ padding: '0.75rem' }}>Rank</th>
                        <th style={{ padding: '0.75rem' }}>Student Name</th>
                        <th style={{ padding: '0.75rem' }}>Active Debate / Session</th>
                        <th style={{ padding: '0.75rem' }}>Total Sessions</th>
                        <th style={{ padding: '0.75rem' }}>Overall Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coachStudents.length > 0 ? (
                        [...coachStudents].sort((a, b) => (b.score || 0) - (a.score || 0)).map((student, i) => (
                          <tr key={student.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '0.85rem', fontWeight: 700 }}>#{i + 1}</td>
                            <td style={{ padding: '0.85rem' }}>
                              <div style={{ fontWeight: 600 }}>{student.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{student.email}</div>
                            </td>
                            <td style={{ padding: '0.85rem' }}>{student.topic}</td>
                            <td style={{ padding: '0.85rem', fontWeight: 600 }}>{student.total_sessions}</td>
                            <td style={{ padding: '0.85rem', color: 'var(--accent-red)', fontWeight: 700 }}>{student.score > 0 ? `${student.score}%` : 'N/A'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
                            No enrolled student metrics found yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Reports Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: '#111827', color: '#FFF', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Active Debate Motion Topics</h4>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: '#ccc' }}>
                      <li>Autonomous AI systems legal liability standards</li>
                      <li>Space Exploration vs. Deep Ocean Funding Priorities</li>
                      <li>Universal Basic Income and Macroeconomic Stability</li>
                    </ul>
                  </div>

                  {/* Assessment reports generator tool */}
                  <div style={{ background: '#FFF', border: '1px solid #E5E7EB', padding: '2.2rem 2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Classroom Reports Engine</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                      Export debate and presentation assessment audits as standardized CSV/PDF reports.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Link href="/reports" className="btn btn-dark" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                        Open Assessment Reports Hub
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D. ADMIN OVERVIEW */}
          {isAdmin && (
            <div>
              {/* Admin Platform Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>TOTAL PLATFORM USERS</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>1,420</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>ACTIVE AI OPPO AGENTS</div>
                  <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900 }}>8 Agents</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>LLM INFERENCE LATENCY</div>
                  <div className="font-display text-red" style={{ fontSize: '2.2rem', fontWeight: 900 }}>112ms</div>
                </div>
                <div style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
                  <div className="font-mono text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>SYSTEM UPTIME</div>
                  <div className="font-display text-red" style={{ fontSize: '2.2rem', fontWeight: 900 }}>99.98%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }}>
                {/* User Management Panel */}
                <div style={{ background: '#FFF', padding: '2rem', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem' }}>User Directory Access Control</h3>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                        <th style={{ padding: '0.75rem' }}>User Email</th>
                        <th style={{ padding: '0.75rem' }}>Role Level</th>
                        <th style={{ padding: '0.75rem' }}>Platform Status</th>
                        <th style={{ padding: '0.75rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { email: 'mentor@logos.ai', role: 'Debate Coach', status: 'Active' },
                        { email: 'admin@logos.ai', role: 'Administrator', status: 'Active' },
                        { email: 'student1@logos.ai', role: 'Learner', status: 'Active' },
                        { email: 'teacher@logos.ai', role: 'Educator', status: 'Suspended' }
                      ].map((user, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '0.85rem', fontWeight: 600 }}>{user.email}</td>
                          <td style={{ padding: '0.85rem' }}>{user.role}</td>
                          <td style={{ padding: '0.85rem' }}>
                            <span style={{ 
                              background: user.status === 'Active' ? '#ECFDF5' : '#FEF2F2', 
                              color: user.status === 'Active' ? '#059669' : '#DC2626', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '6px',
                              fontSize: '0.72rem', 
                              fontWeight: 700 
                            }}>
                              {user.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <button onClick={() => alert(`Status change for ${user.email} triggered!`)} style={{ background: 'none', border: 'none', color: '#D90429', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}>
                              Toggle Status
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button onClick={() => alert("Mock user creation template loaded.")} className="btn btn-dark" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                    Add New Platform User
                  </button>
                </div>

                {/* Platform Health and System Reports */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: '#111827', color: '#FFF', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                    <div className="font-mono text-red" style={{ fontSize: '0.72rem', marginBottom: '0.5rem' }}>AI MODEL MONITORING</div>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Embedding Index Health</h4>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: '#ccc' }}>
                      <li>Vector Database Size: <strong>3.42 GB (FAISS context indexes)</strong></li>
                      <li>Retrieval Precision Rating: <strong>98.5% precision</strong></li>
                      <li>GPU Latency Threshold: <strong>Under 12ms</strong></li>
                    </ul>
                  </div>

                  {/* Server control buttons */}
                  <div style={{ background: '#FFF', border: '1px solid #E5E7EB', padding: '2.2rem 2rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                    <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Platform Operations</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                      Perform semantic indexing refactoring, clear logged database stacks, or extract system status configurations.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button onClick={() => alert("Vector context memory index rebuilt successfully!")} className="btn btn-dark" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                        Re-index Semantic Database
                      </button>
                      <button onClick={() => alert("Platform traffic status logs exported!")} className="btn btn-login" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #E5E7EB' }}>
                        Download System Audit Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DEBATE HISTORY TAB (Available for All Roles) */}
      {/* ========================================================================= */}
      {activeTab === 'debates' && (
        <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                Complete Debate History & Practice Log
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                All completed parliamentary, Oxford, and AI agent simulation debate sessions stored in the database.
              </p>
            </div>
            <Link href="/simulation" className="btn btn-red" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.825rem' }}>
              + START NEW DEBATE
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Topics</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Format</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Position</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date Completed</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {debateHistory.length > 0 ? (
                  debateHistory.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td 
                        style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                        onClick={() => setSelectedTopicId(d.id)}
                      >
                        <div style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: selectedTopicId === d.id ? '2px solid #000000' : '2px solid transparent',
                          background: selectedTopicId === d.id ? '#F9FAFB' : 'transparent',
                          fontWeight: 600,
                          color: '#111827',
                          display: 'inline-block',
                          transition: 'all 0.18s ease'
                        }}>
                          {d.topic || d.title}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#374151' }}>{d.format}</td>
                      <td style={{ padding: '1rem', color: '#374151' }}>{d.position}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#ECFDF5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#6B7280' }}>{d.date}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <Link
                          href={`/dashboard/performance?session_id=${d.id}`}
                          title="Open Complete Performance Breakdown"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#D90429',
                            color: '#FFFFFF',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            lineHeight: '1',
                            boxShadow: '0 2px 6px rgba(217, 4, 41, 0.25)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#B00320'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#D90429'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', borderRadius: '8px' }}>
                      No debate sessions recorded yet. Launch the simulation to record your first debate!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.5 IMPROVEMENT TRENDS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* 1. DOMAIN CATEGORY SELECTOR BAR (Debate, Presentation, Argument, Policy, Counter) */}
          <div className="trend-card-box" style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '1.25rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                SELECT EVALUATION DOMAIN
              </div>
              <h3 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0', color: '#111827' }}>
                Multi-Domain Improvement Trends
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'debate', label: 'DEBATE SIMULATION', color: '#D90429', count: debateTrendData.length },
                { id: 'presentation', label: 'PRESENTATION ANALYSIS', color: '#7C3AED', count: presentationTrendData.length },
                { id: 'argument', label: 'ARGUMENT ANALYSIS', color: '#2563EB', count: argumentTrendData.length },
                { id: 'policy', label: 'POLICY REBUTTALS', color: '#059669', count: policyTrendData.length },
                { id: 'counter', label: 'COUNTER ENGINE', color: '#EA580C', count: counterTrendData.length }
              ].map((cat) => {
                const isSelected = trendCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setTrendCategory(cat.id);
                      setSelectedTrend(null);
                      setHoveredTrend(null);
                    }}
                    className="trend-action-btn"
                    style={{
                      padding: '0.65rem 1.15rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      border: isSelected ? `2px solid ${cat.color}` : '1.5px solid #E5E7EB',
                      background: isSelected ? cat.color : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#374151',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: isSelected ? `0 4px 14px ${cat.color}35` : '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isSelected ? '#FFFFFF' : cat.color,
                      display: 'inline-block'
                    }} />
                    <span>{cat.label}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      opacity: isSelected ? 0.95 : 0.7,
                      background: isSelected ? 'rgba(255,255,255,0.22)' : '#F3F4F6',
                      color: isSelected ? '#FFFFFF' : '#4B5563',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px'
                    }}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SUMMARY METRIC CARDS (Customized to active category) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                OVERALL MEAN PERCENTAGE
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: activeCategoryConfig.color }}>
                {currentMeanPercentage}%
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Mean benchmark across {currentEvaluatedCount} {activeCategoryConfig.axisGuideName.toLowerCase()}
              </p>
            </div>

            <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                HIGHEST {activeCategoryConfig.roundPrefix} SCORE
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10B981' }}>
                {currentHighestScore}%
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Personal best in {activeCategoryConfig.name}
              </p>
            </div>

            <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                GROWTH PROGRESSION
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: currentNetGrowth >= 0 ? '#059669' : '#DC2626' }}>
                {currentNetGrowth >= 0 ? `+${currentNetGrowth}%` : `${currentNetGrowth}%`}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Progression from {activeCategoryConfig.roundPrefix} 1 to Latest
              </p>
            </div>

            <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                EVALUATED {activeCategoryConfig.roundPrefix}S
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#111827' }}>
                {currentEvaluatedCount}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Completed {activeCategoryConfig.name.toLowerCase()} audits
              </p>
            </div>
          </div>

          {/* 3. GRAPH SECTION: Mean Percentage & Overall Score Progression */}
          <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
            
            {/* Header with Title, Range Filters, and Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: activeCategoryConfig.color }}>
                  {activeCategoryConfig.badge}
                </div>
                <h3 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0.3rem', color: '#111827' }}>
                  {activeCategoryConfig.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>
                  {activeCategoryConfig.subtitle}
                </p>
              </div>

              {/* Range Filters & Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                {/* Range Filter Buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', background: '#F3F4F6', padding: '0.25rem', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTrendFilter('all')}
                    className="trend-action-btn"
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      background: trendFilter === 'all' ? '#111827' : 'transparent',
                      color: trendFilter === 'all' ? '#FFFFFF' : '#4B5563'
                    }}
                  >
                    ALL ({currentEvaluatedCount})
                  </button>
                  {currentEvaluatedCount > 30 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last30')}
                      className="trend-action-btn"
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        background: trendFilter === 'last30' ? '#111827' : 'transparent',
                        color: trendFilter === 'last30' ? '#FFFFFF' : '#4B5563'
                      }}
                    >
                      LAST 30
                    </button>
                  )}
                  {currentEvaluatedCount > 15 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last15')}
                      className="trend-action-btn"
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        background: trendFilter === 'last15' ? '#111827' : 'transparent',
                        color: trendFilter === 'last15' ? '#FFFFFF' : '#4B5563'
                      }}
                    >
                      LAST 15
                    </button>
                  )}
                  {currentEvaluatedCount > 10 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last10')}
                      className="trend-action-btn"
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        background: trendFilter === 'last10' ? '#111827' : 'transparent',
                        color: trendFilter === 'last10' ? '#FFFFFF' : '#4B5563'
                      }}
                    >
                      LAST 10
                    </button>
                  )}
                </div>

                {/* Legend Indicators */}
                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', fontWeight: 700, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeCategoryConfig.color, display: 'inline-block' }}></span>
                    <span style={{ color: '#111827' }}>{activeCategoryConfig.scoreLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: '16px', height: '0', borderTop: '2px dashed #111827', display: 'inline-block' }}></span>
                    <span style={{ color: '#111827' }}>Cumulative Mean (%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Details Box: Live stats on hover or click lock */}
            {(() => {
              const activeTrend = selectedTrend || hoveredTrend;
              const isLocked = Boolean(selectedTrend && selectedTrend.id === activeTrend?.id);

              if (!activeTrend) {
                return (
                  <div className="trend-card-box" style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #111827',
                    borderRadius: '10px',
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '66px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        background: '#111827',
                        color: '#FFFFFF',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap'
                      }}>
                        {activeCategoryConfig.roundPrefix} DETAILS
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                        Hover or click any node on the graph to inspect performance, cumulative mean %, and growth delta.
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>
                      Click point to lock details
                    </span>
                  </div>
                );
              }

              const reportUrl = (() => {
                if (trendCategory === 'presentation') return '/presentation-analysis';
                if (trendCategory === 'argument') return '/argument-analysis';
                if (trendCategory === 'counter') return '/counter-argument';
                if (trendCategory === 'policy') return '/simulation';
                return `/dashboard/performance?session_id=${activeTrend.id}`;
              })();

              return (
                <div style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '0.85rem 1.25rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  border: isLocked ? `1.5px solid ${activeCategoryConfig.color}` : '1.5px solid #111827',
                  minHeight: '66px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ 
                        background: activeCategoryConfig.color, 
                        color: '#FFF', 
                        padding: '0.35rem 0.65rem', 
                        borderRadius: '6px', 
                        fontWeight: 900, 
                        fontSize: '0.82rem', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {activeCategoryConfig.roundPrefix} #{activeTrend.round}
                      </div>
                      {isLocked && (
                        <span style={{ 
                          background: `${activeCategoryConfig.color}33`, 
                          color: '#FFFFFF', 
                          border: `1px solid ${activeCategoryConfig.color}`, 
                          borderRadius: '4px', 
                          fontSize: '0.65rem', 
                          fontWeight: 800, 
                          padding: '0.15rem 0.4rem', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em'
                        }}>
                          Locked
                        </span>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '420px' }} title={activeTrend.topic}>
                        {activeTrend.topic}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        Date: {activeTrend.date} • Format: {activeTrend.format}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', whiteSpace: 'nowrap' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Score</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: activeCategoryConfig.color }}>{activeTrend.score}%</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Mean at Round</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60A5FA' }}>{activeTrend.meanPercentage}%</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Delta</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: activeTrend.delta >= 0 ? '#34D399' : '#F87171' }}>
                        {activeTrend.delta >= 0 ? `+${activeTrend.delta}%` : `${activeTrend.delta}%`}
                      </span>
                    </div>
                    <Link
                      href={reportUrl}
                      className="trend-action-btn"
                      style={{
                        background: activeCategoryConfig.color,
                        color: '#FFF',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        border: '1.5px solid transparent'
                      }}
                    >
                      View Report →
                    </Link>
                    {isLocked && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrend(null)}
                        title="Unlock / Close"
                        className="trend-action-btn"
                        style={{
                          background: '#1E293B',
                          border: '1px solid #334155',
                          color: '#94A3B8',
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Chart Viewport with Pinned Y-Axis & Horizontally Scrollable Plot */}
            {currentEvaluatedCount === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#9CA3AF' }}>
                No completed {activeCategoryConfig.name.toLowerCase()} sessions recorded yet. Practice in this module to generate your progression graph!
              </div>
            ) : (
              <div className="trend-card-box" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FAFAFA', overflow: 'hidden' }}>
                <div style={{ display: 'flex', width: '100%', height: '365px', position: 'relative' }}>
                  
                  {/* Fixed Pinned Y-Axis Column */}
                  <div style={{
                    width: '52px',
                    minWidth: '52px',
                    height: '365px',
                    background: '#FFFFFF',
                    borderRight: '1px solid #E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px 6px 97px 0',
                    textAlign: 'right',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#9CA3AF',
                    fontFamily: "'Inter', sans-serif",
                    userSelect: 'none',
                    zIndex: 2
                  }}>
                    <span>100%</span>
                    <span>85%</span>
                    <span>70%</span>
                    <span>55%</span>
                    <span>40%</span>
                  </div>

                  {/* Horizontally Scrollable X-Axis & Chart Canvas */}
                  <div 
                    ref={trendScrollRef}
                    style={{
                      flex: 1,
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      height: '365px',
                      position: 'relative',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#CBD5E1 #F1F5F9'
                    }}
                  >
                    {(() => {
                      const visibleData = visibleTrendData;
                      const N = visibleData.length;
                      const pointSpacing = N <= 10 ? Math.max(90, Math.floor(750 / Math.max(1, N - 1))) : 68;
                      const padL = 36;
                      const padR = 45;
                      const plotW = Math.max(720, (N - 1) * pointSpacing);
                      const svgW = plotW + padL + padR;
                      const svgH = 365;
                      const padT = 28;
                      const plotH = 240;
                      const padB = 97;
                      const minY = 40;
                      const maxY = 100;

                      const getY = (val) => padT + (1 - (Math.max(minY, Math.min(maxY, val)) - minY) / (maxY - minY)) * plotH;
                      const getX = (idx) => N === 1 ? padL + plotW / 2 : padL + idx * pointSpacing;

                      const scorePath = visibleData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.score)}`).join(' ');
                      const meanPath = visibleData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.meanPercentage)}`).join(' ');
                      const areaPath = N > 1 
                        ? `${scorePath} L ${getX(N - 1)} ${padT + plotH} L ${getX(0)} ${padT + plotH} Z`
                        : '';

                      return (
                        <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: `${svgW}px` }}>
                          <defs>
                            <linearGradient id={activeCategoryConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={activeCategoryConfig.color} stopOpacity="0.25" />
                              <stop offset="100%" stopColor={activeCategoryConfig.color} stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Horizontal Grid Lines */}
                          {[100, 85, 70, 55, 40].map((level) => {
                            const yPos = getY(level);
                            return (
                              <line 
                                key={level} 
                                x1={0} 
                                y1={yPos} 
                                x2={svgW} 
                                y2={yPos} 
                                stroke="#E5E7EB" 
                                strokeWidth="1" 
                                strokeDasharray={level === 40 ? 'none' : '2,2'}
                              />
                            );
                          })}

                          {/* Gradient Area Fill under Score Curve */}
                          {areaPath && (
                            <path d={areaPath} fill={`url(#${activeCategoryConfig.gradientId})`} pointerEvents="none" />
                          )}

                          {/* Cumulative Mean Line (Black Dashed) */}
                          {N > 1 && (
                            <path d={meanPath} fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="5,4" pointerEvents="none" />
                          )}

                          {/* Score Line (Category Color Solid) */}
                          {N > 1 && (
                            <path d={scorePath} fill="none" stroke={activeCategoryConfig.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                          )}

                          {/* Interactive Nodes & X-Axis Labels */}
                          {visibleData.map((d, i) => {
                            const cx = getX(i);
                            const cyScore = getY(d.score);
                            const cyMean = getY(d.meanPercentage);
                            const isHovered = hoveredTrend?.id === d.id;
                            const isSelected = selectedTrend?.id === d.id;
                            const isActive = isSelected || isHovered;

                            return (
                              <g key={d.id}>
                                {/* Vertical Guideline on Hover or Lock */}
                                {isActive && (
                                  <line 
                                    x1={cx} 
                                    y1={padT} 
                                    x2={cx} 
                                    y2={padT + plotH} 
                                    stroke={activeCategoryConfig.color} 
                                    strokeWidth="1.5" 
                                    strokeDasharray="3,3" 
                                    pointerEvents="none" 
                                    opacity="0.85" 
                                  />
                                )}

                                {/* X-Axis Vertical Tick Marker */}
                                <line 
                                  x1={cx} 
                                  y1={padT + plotH} 
                                  x2={cx} 
                                  y2={padT + plotH + 6} 
                                  stroke={isActive ? activeCategoryConfig.color : '#D1D5DB'} 
                                  strokeWidth={isActive ? '2' : '1'} 
                                  pointerEvents="none" 
                                />

                                {/* Clean X-Axis Round Number Only: R1, S1, A1, P1, C1... */}
                                <text 
                                  x={cx} 
                                  y={296} 
                                  textAnchor="middle" 
                                  fontSize="12" 
                                  fontWeight="800" 
                                  fill={isActive ? activeCategoryConfig.color : '#374151'} 
                                  fontFamily="'Inter', sans-serif"
                                  pointerEvents="none"
                                >
                                  {activeCategoryConfig.roundPrefix.charAt(0)}{d.round}
                                </text>

                                {/* Cumulative Mean Marker (Black Dot) */}
                                <circle 
                                  cx={cx} 
                                  cy={cyMean} 
                                  r="3.5" 
                                  fill="#111827" 
                                  pointerEvents="none" 
                                />

                                {/* Category Score Marker */}
                                <circle 
                                  cx={cx} 
                                  cy={cyScore} 
                                  r={isActive ? 7.5 : 5.5} 
                                  fill="#FFFFFF" 
                                  stroke={activeCategoryConfig.color} 
                                  strokeWidth={isActive ? 3.5 : 2.5} 
                                  pointerEvents="none" 
                                />

                                {/* Active Glow Ring & Floating Score Tag */}
                                {isActive && (
                                  <>
                                    <circle 
                                      cx={cx} 
                                      cy={cyScore} 
                                      r="12" 
                                      fill="none" 
                                      stroke={activeCategoryConfig.color} 
                                      strokeWidth={isSelected ? "2.5" : "1.8"} 
                                      opacity={isSelected ? "0.8" : "0.5"} 
                                      pointerEvents="none" 
                                    />
                                    <g pointerEvents="none" transform={`translate(${cx}, ${Math.max(16, cyScore - 18)})`}>
                                      <rect x="-24" y="-16" width="48" height="17" rx="4" fill={isSelected ? activeCategoryConfig.color : "#0F172A"} />
                                      <text x="0" y="-3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF" fontFamily="'Inter', sans-serif">
                                        {d.score}%
                                      </text>
                                    </g>
                                  </>
                                )}

                                {/* Ultra-Stable Invisible Hit-Box for Hover & Click Lock */}
                                <circle 
                                  cx={cx} 
                                  cy={cyScore} 
                                  r="26" 
                                  fill="transparent" 
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => {
                                    if (!selectedTrend) {
                                      setHoveredTrend(d);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredTrend(null);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedTrend?.id === d.id) {
                                      setSelectedTrend(null);
                                    } else {
                                      setSelectedTrend(d);
                                      setHoveredTrend(null);
                                    }
                                  }}
                                />
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Comprehensive Axis Metrics & Symbolic Encoding Guide */}
            <div className="trend-card-box" style={{ marginTop: '1.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem' }}>
              <div className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em', color: activeCategoryConfig.color }}>
                AXIS METRICS & SYMBOLIC ENCODING GUIDE
              </div>
              <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 1rem 0', color: '#111827' }}>
                How to Read & Interpret Your {activeCategoryConfig.name} Graph
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {/* 1. X-Axis */}
                <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #111827' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ background: '#111827', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      X-AXIS
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>{activeCategoryConfig.axisGuideName}</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    {activeCategoryConfig.axisGuideDesc} Chronological sequence from {activeCategoryConfig.roundPrefix} 1 to {activeCategoryConfig.roundPrefix} {currentEvaluatedCount}.
                  </p>
                </div>

                {/* 2. Y-Axis */}
                <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #6B7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ background: '#4B5563', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      Y-AXIS
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Performance %</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    Standardized performance score percentage calibrated from 40% to 100% across {activeCategoryConfig.name.toLowerCase()} evaluation criteria.
                  </p>
                </div>

                {/* 3. Category Dot & Line */}
                <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: `3px solid ${activeCategoryConfig.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeCategoryConfig.color, display: 'inline-block' }}></span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Colored Dot & Line</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    <strong>{activeCategoryConfig.scoreLabel}</strong>: The individual score recorded for each session. Spikes highlight peak mastery and robust arguments.
                  </p>
                </div>

                {/* 4. Black Dot & Dashed Line */}
                <div className="trend-card-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #0F172A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ width: '14px', height: '0', borderTop: '2.5px dashed #111827', display: 'inline-block' }}></span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Black Dot & Line</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    <strong>Cumulative Mean Benchmark (%)</strong>: The running average score up to that round. A steadily rising curve validates long-term retention and mastery.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRESENTATION ANALYSIS ARCHIVE TAB (Available for All Roles) */}
      {/* ========================================================================= */}
      {activeTab === 'presentations' && (
        <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                Complete Presentation Analysis & Speech Prosody Archive
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                Every recorded presentation, speaking pace metric, filler word count, and confidence rating preserved across sessions.
              </p>
            </div>
            <Link href="/presentation-analysis" className="btn btn-red" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.825rem' }}>
              + RECORD PRESENTATION ANALYSIS
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#374151', fontWeight: 600 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Speech Title / Topic</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Speaking Pace</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Filler Words</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Confidence</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vocal Clarity</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Overall Score</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date Completed</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {presentationHistory.length > 0 ? (
                  presentationHistory.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td 
                        style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                        onClick={() => setSelectedTopicId(p.id)}
                      >
                        <div style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: selectedTopicId === p.id ? '2px solid #000000' : '2px solid transparent',
                          background: selectedTopicId === p.id ? '#F9FAFB' : 'transparent',
                          fontWeight: 600,
                          color: '#111827',
                          display: 'inline-block',
                          transition: 'all 0.18s ease'
                        }}>
                          {p.topic || p.title}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#374151' }}>{p.wpm} WPM</td>
                      <td style={{ padding: '1rem', color: p.filler_words_count > 2 ? '#D90429' : '#10B981', fontWeight: 600 }}>
                        {p.filler_words_count} fillers
                      </td>
                      <td style={{ padding: '1rem', color: '#059669', fontWeight: 700 }}>{p.confidence_score}%</td>
                      <td style={{ padding: '1rem', color: '#374151' }}>{p.clarity_score}%</td>
                      <td style={{ padding: '1rem', color: 'var(--accent-red)', fontWeight: 700 }}>{p.overall_score || 85}%</td>
                      <td style={{ padding: '1rem', color: '#6B7280' }}>{p.date}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <Link
                          href={`/dashboard/performance?session_id=${p.session_id || p.id}&type=vocal`}
                          title="Open Presentation Analysis Performance Breakdown"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#D90429',
                            color: '#FFFFFF',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            lineHeight: '1',
                            boxShadow: '0 2px 6px rgba(217, 4, 41, 0.25)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#B00320'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#D90429'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', borderRadius: '8px' }}>
                      No Presentation Analysis sessions recorded yet. Open the Presentation Analysis studio to evaluate your first speech!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECOMMENDATION & COACHING ENGINE TAB                                  */}
      {/* ========================================================================= */}
      {activeTab === 'coaching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header Card with Metrics and Capabilities */}
          <div 
            className="dash-interactive-card" 
            style={{ 
              background: '#FFF', 
              padding: '2.5rem 2rem', 
              borderRadius: '14px', 
              border: '1.5px solid #E5E7EB', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    background: '#FEE2E2', 
                    color: '#D90429', 
                    fontSize: '0.72rem', 
                    fontWeight: 800, 
                    padding: '0.3rem 0.75rem', 
                    borderRadius: '6px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.06em' 
                  }}>
                    INTELLIGENT ADAPTIVE COACH
                  </span>
                  <span style={{ 
                    background: '#F3F4F6', 
                    color: '#374151', 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    padding: '0.3rem 0.65rem', 
                    borderRadius: '6px' 
                  }}>
                    {progressStatus || 'Level 2 - Competent Debater'}
                  </span>
                </div>
                <h2 className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#111827', margin: 0, lineHeight: 1.15 }}>
                  Recommendation & Coaching Engine
                </h2>
                <p style={{ fontSize: '0.92rem', color: '#4B5563', margin: '0.45rem 0 0', maxWidth: '800px' }}>
                  Personalized tactical directives, speech delivery optimizations, milestone curriculum paths, and continuous rhetoric improvement algorithms.
                </p>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link
                  href="/simulation"
                  className="dash-action-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#111827',
                    color: '#FFFFFF',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                    border: '1.5px solid #111827'
                  }}
                >
                  START DEBATE DRILL →
                </Link>
                <Link
                  href="/presentation-analysis"
                  className="dash-action-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#FFF',
                    color: '#D90429',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                    border: '1.5px solid #FCA5A5'
                  }}
                >
                  RECORD PRESENTATION →
                </Link>
              </div>
            </div>

            {/* Filter Tabs for Engine Capabilities */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #F3F4F6', paddingTop: '1.25rem' }}>
              {[
                { id: 'ALL', label: 'ALL CAPABILITIES' },
                { id: 'DEBATE', label: 'DEBATE RECOMMENDATIONS' },
                { id: 'PRESENTATION', label: 'PRESENTATION SUGGESTIONS' },
                { id: 'SKILLS', label: 'SKILL DEVELOPMENT PLANS' },
                { id: 'FEEDBACK', label: 'PERSONALIZED COACH FEEDBACK' },
                { id: 'PATH', label: 'LEARNING PATH GENERATION' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCoachingFilter(f.id)}
                  className="dash-action-btn"
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: coachingFilter === f.id ? '2px solid #000000' : '1px solid #E5E7EB',
                    background: coachingFilter === f.id ? '#111827' : '#F9FAFB',
                    color: coachingFilter === f.id ? '#FFFFFF' : '#374151'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* FEATURE 1: DEBATE IMPROVEMENT RECOMMENDATIONS */}
          {(coachingFilter === 'ALL' || coachingFilter === 'DEBATE') && (
            <div 
              className="dash-interactive-card"
              style={{
                background: '#FFF',
                borderRadius: '14px',
                padding: '2rem',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D90429' }}></span>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                      Debate Improvement Recommendations
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                    Actionable refutation strategies, rebuttal structures, and tactical maneuvers formulated from your debate history.
                  </p>
                </div>
                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: '#6B7280', background: '#F3F4F6', padding: '0.35rem 0.75rem', borderRadius: '6px' }}>
                  {debateRecommendations.length} ACTIVE DIRECTIVES
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {debateRecommendations.map((rec) => {
                  const isDone = Boolean(completedDrills[rec.id]);
                  return (
                    <div 
                      key={rec.id}
                      className="dash-interactive-card"
                      style={{
                        background: isDone ? '#F9FAFB' : '#FFFFFF',
                        borderRadius: '10px',
                        border: isDone ? '1px solid #E5E7EB' : '1.5px solid #E5E7EB',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: isDone ? 0.75 : 1
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: rec.priority === 'High' ? '#FEE2E2' : '#EFF6FF',
                            color: rec.priority === 'High' ? '#DC2626' : '#2563EB',
                            border: `1px solid ${rec.priority === 'High' ? '#FCA5A5' : '#BFDBFE'}`
                          }}>
                            {rec.priority} PRIORITY
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
                            {rec.category}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', margin: '0 0 0.45rem', textDecoration: isDone ? 'line-through' : 'none' }}>
                          {rec.title}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5, margin: '0 0 0.85rem' }}>
                          {rec.description}
                        </p>
                      </div>

                      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.76rem', color: '#6B7280', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 700, color: '#111827' }}>Drill:</span> {rec.drill}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompletedDrills(prev => ({ ...prev, [rec.id]: !prev[rec.id] }))}
                          className="dash-action-btn"
                          style={{
                            background: isDone ? '#059669' : '#FFFFFF',
                            color: isDone ? '#FFFFFF' : '#374151',
                            border: isDone ? '1px solid #059669' : '1px solid #D1D5DB',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {isDone ? '✓ COMPLETED' : 'MARK COMPLETE'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FEATURE 2: PRESENTATION IMPROVEMENT SUGGESTIONS */}
          {(coachingFilter === 'ALL' || coachingFilter === 'PRESENTATION') && (
            <div 
              className="dash-interactive-card"
              style={{
                background: '#FFF',
                borderRadius: '14px',
                padding: '2rem',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D90429' }}></span>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                      Presentation Improvement Suggestions
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                    Speech cadence optimization, filler word mitigation, vocal projection, and articulation targets.
                  </p>
                </div>
                <Link
                  href="/presentation-analysis"
                  className="dash-action-btn"
                  style={{
                    padding: '0.45rem 0.95rem',
                    background: '#FEF2F2',
                    color: '#D90429',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textDecoration: 'none'
                  }}
                >
                  PRACTICE IN PRESENTATION ANALYSIS →
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                {presentationSuggestions.map((sugg) => (
                  <div
                    key={sugg.id}
                    className="dash-interactive-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1.5px solid #E5E7EB',
                      padding: '1.35rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827' }}>
                          {sugg.aspect}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: sugg.status === 'Optimal' ? '#ECFDF5' : '#FEF3C7',
                          color: sugg.status === 'Optimal' ? '#059669' : '#D97706',
                          border: `1px solid ${sugg.status === 'Optimal' ? '#A7F3D0' : '#FDE68A'}`
                        }}>
                          {sugg.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: '#F9FAFB', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Current Stat</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>{sugg.current_stat}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #E5E7EB', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Optimal Target</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#059669' }}>{sugg.target_stat}</div>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5, margin: 0 }}>
                        {sugg.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEATURE 3: SKILL DEVELOPMENT PLANS */}
          {(coachingFilter === 'ALL' || coachingFilter === 'SKILLS') && (
            <div 
              className="dash-interactive-card"
              style={{
                background: '#FFF',
                borderRadius: '14px',
                padding: '2rem',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D90429' }}></span>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                      Skill Development Plans
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                    Competency tracking across argument construction, speech delivery, fallacy defense, and rebuttal velocity.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {skillDevelopmentPlans.map((skillItem, idx) => (
                  <div
                    key={idx}
                    className="dash-interactive-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1.5px solid #E5E7EB',
                      padding: '1.35rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563EB', background: '#EFF6FF', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid #BFDBFE' }}>
                        {skillItem.level}
                      </span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#111827', fontFamily: 'var(--font-mono)' }}>
                        {skillItem.progress}%
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem' }}>
                      {skillItem.skill}
                    </h4>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                      <div 
                        style={{ 
                          width: `${skillItem.progress}%`, 
                          height: '100%', 
                          background: skillItem.progress >= 80 ? '#059669' : skillItem.progress >= 60 ? '#2563EB' : '#D90429',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} 
                      />
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.45rem' }}>
                      Tactical Focus Areas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {skillItem.focus_areas.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            background: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            color: '#374151',
                            fontWeight: 600
                          }}
                        >
                          • {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEATURE 4: PERSONALIZED COACHING FEEDBACK */}
          {(coachingFilter === 'ALL' || coachingFilter === 'FEEDBACK') && (
            <div 
              className="dash-interactive-card"
              style={{
                background: '#FFF',
                borderRadius: '14px',
                padding: '2rem',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D90429' }}></span>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                      Personalized Coaching Feedback
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                    Direct qualitative evaluation narrative and tactical performance directives.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCoachingSpeak('coach_feedback', coachGradeData.coach_feedback || skillGapSummary)}
                  className="dash-action-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: activeSpeakingKey === 'coach_feedback' ? '#FEF2F2' : '#FFFFFF',
                    color: activeSpeakingKey === 'coach_feedback' ? '#D90429' : '#374151',
                    border: '1px solid #D1D5DB',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <SpeakerIcon size={16} active={activeSpeakingKey === 'coach_feedback'} />
                  <span>{activeSpeakingKey === 'coach_feedback' ? 'STOP AUDIO' : 'READ FEEDBACK ALOUD'}</span>
                </button>
              </div>

              <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Evaluator</span>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827' }}>{coachGradeData.evaluator_name || 'Debate Coach'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{coachGradeData.evaluator_role || 'Debate Coach & Evaluator'}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Grade</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: coachGradeData.grade?.startsWith('A') ? '#059669' : '#D90429' }}>
                        {coachGradeData.grade || 'Pending'}
                      </div>
                    </div>
                    {coachGradeData.marks !== null && coachGradeData.marks !== undefined && (
                      <div style={{ textAlign: 'center', borderLeft: '1px solid #E5E7EB', paddingLeft: '1rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Marks</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>
                          {coachGradeData.marks}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.92rem', color: '#374151', lineHeight: 1.65 }}>
                  <p style={{ margin: '0 0 0.85rem', fontWeight: 500 }}>
                    {coachGradeData.coach_feedback || "Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here."}
                  </p>
                  {skillGapSummary && (
                    <div style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', marginTop: '0.75rem' }}>
                      <strong style={{ color: '#111827', fontSize: '0.825rem' }}>Skill Gap Summary:</strong>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#4B5563' }}>{skillGapSummary}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FEATURE 5: LEARNING PATH GENERATION */}
          {(coachingFilter === 'ALL' || coachingFilter === 'PATH') && (
            <div 
              className="dash-interactive-card"
              style={{
                background: '#FFF',
                borderRadius: '14px',
                padding: '2rem',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D90429' }}></span>
                    <h3 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                      Learning Path Generation
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#6B7280', margin: '0.2rem 0 0' }}>
                    Step-by-step progressive curriculum dynamically generated based on your ongoing practice records.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(pathSteps.length > 0 ? pathSteps : [
                  "Step 1: Speech Pacing & Cadence Control (Completed)",
                  "Step 2: Fallacy Shielding & Logic Audit (Active)",
                  "Step 3: Advanced Parliamentary Refutation (Upcoming)"
                ]).map((stepText, sIdx) => {
                  const isCompleted = stepText.toLowerCase().includes('completed');
                  const isActive = stepText.toLowerCase().includes('active');
                  return (
                    <div
                      key={sIdx}
                      className="dash-interactive-card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isCompleted ? '#F0FDF4' : isActive ? '#FEF2F2' : '#F9FAFB',
                        border: `1.5px solid ${isCompleted ? '#BBF7D0' : isActive ? '#FECACA' : '#E5E7EB'}`,
                        borderRadius: '10px',
                        padding: '1rem 1.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isCompleted ? '#059669' : isActive ? '#D90429' : '#9CA3AF',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}>
                          {sIdx + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                            {stepText}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                            {isCompleted ? 'Milestone mastered through previous audits' : isActive ? 'Current curriculum focus area' : 'Next progressive competency milestone'}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: isCompleted ? '#DCFCE7' : isActive ? '#FEE2E2' : '#F3F4F6',
                        color: isCompleted ? '#166534' : isActive ? '#DC2626' : '#6B7280'
                      }}>
                        {isCompleted ? 'COMPLETED' : isActive ? 'ACTIVE MODULE' : 'UPCOMING'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PROFILE SETTINGS TAB (Available for All Roles) */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem' }}>Profile Settings & Experience Metrics</h3>
          
          {profileMsg && (
            <div style={{ padding: '0.85rem 1.2rem', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '0.875rem', background: profileMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: profileMsg.type === 'error' ? '#DC2626' : '#059669', border: `1px solid ${profileMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}` }}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Full Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Experience Level</label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF' }}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Preferred Debate Topics</label>
                <input 
                  type="text" 
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Presentation Domains</label>
                <input 
                  type="text" 
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Learning Goals</label>
                <textarea 
                  rows={3}
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Coaching Style Preference</label>
                <textarea 
                  rows={3}
                  value={coaching}
                  onChange={(e) => setCoaching(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" onClick={() => setActiveTab('overview')} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={updating} style={{ padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', background: '#111827', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>
                {updating ? 'Saving Metrics...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={(authData) => {
          setIsAuthModalOpen(false);
          const currentToken = authData?.access_token || getToken();
          if (currentToken) {
            const payload = parseJwt(currentToken);
            if (payload) {
              setUserRole(payload.role || authData?.role || 'Learner');
              const resolvedAuthName = (authData?.full_name && !authData.full_name.toLowerCase().includes('hardwill'))
                ? authData.full_name
                : ((payload.sub && (payload.sub.toLowerCase().includes('dayan') || payload.sub.toLowerCase().includes('hardwill')))
                  ? 'Dayan'
                  : (payload.sub ? payload.sub.split('@')[0] : 'User'));
              setUserName(resolvedAuthName);
              localStorage.setItem('logos_ai_user_name', resolvedAuthName);
            }
            fetchAllData(currentToken);
          }
        }}
      />

      <style jsx global>{`
        .dash-interactive-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .dash-interactive-card:hover, .dash-interactive-card:focus-within {
          border-color: #000000 !important;
        }
        .dash-action-btn {
          transition: border-color 0.18s ease, transform 0.18s ease;
        }
        .dash-action-btn:hover, .dash-action-btn:focus {
          border-color: #000000 !important;
        }
        .dash-squircle-avatar {
          transition: border-color 0.2s ease, transform 0.18s ease;
        }
        .dash-squircle-avatar:hover, .dash-squircle-avatar:focus {
          border-color: #000000 !important;
          transform: scale(1.04);
        }
      `}</style>
    </div>
  );
}
