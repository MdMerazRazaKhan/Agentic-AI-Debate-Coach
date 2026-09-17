"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('debates'); // debates, presentations, trends, settings
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [hoveredTrend, setHoveredTrend] = useState(null);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [trendFilter, setTrendFilter] = useState('all'); // 'all', 'last30', 'last15', 'last10'
  const trendScrollRef = useRef(null);
  const [userRole, setUserRole] = useState('Learner');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
      format: d.format || d.session_type || 'Debate Session',
      type: d.session_type === 'Vocal Matrix' ? 'Vocal Matrix' : 'Debate',
      score: d.score || 85,
      date: d.date || 'Recent',
      created_at: d.created_at
    })),
    ...presentationHistory.filter(p => !debateHistory.some(d => d.id === p.session_id)).map(p => ({
      id: `pres-${p.id}`,
      title: p.title || 'Vocal Metrics Session',
      topic: p.topic || 'Speech Prosody Evaluation',
      format: 'Vocal Matrix',
      type: 'Vocal Matrix',
      score: p.overall_score || Math.round(p.confidence_score * 0.5 + p.clarity_score * 0.5),
      date: p.date || 'Recent',
      created_at: p.created_at
    }))
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const top3Recent = unifiedRecentSessions.slice(0, 3);

  // Dynamic calculations
  const totalDebates = debateHistory.filter(d => d.session_type !== 'Vocal Matrix').length;
  const totalVocalSessions = presentationHistory.length;

  // Compute Chronological Debate Improvement Trends
  const chronologicalDebates = [...debateHistory]
    .filter(d => d.session_type !== 'Vocal Matrix')
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  let runningSum = 0;
  const trendData = chronologicalDebates.map((d, index) => {
    const roundNumber = index + 1;
    const scoreVal = parseFloat(d.overall_score ?? d.score ?? 85);
    runningSum += scoreVal;
    const meanPercentage = Math.round((runningSum / roundNumber) * 10) / 10;
    const prevScore = index > 0 ? parseFloat(chronologicalDebates[index - 1].overall_score ?? chronologicalDebates[index - 1].score ?? 85) : scoreVal;
    const delta = Math.round((scoreVal - prevScore) * 10) / 10;

    return {
      round: roundNumber,
      id: d.id,
      topic: d.topic || d.title,
      format: d.format || 'Debate Session',
      score: scoreVal,
      meanPercentage: meanPercentage,
      delta: delta,
      date: d.date || 'Recent'
    };
  });

  const totalEvaluatedDebates = trendData.length;
  const overallMeanPercentage = totalEvaluatedDebates > 0
    ? Math.round((trendData.reduce((acc, curr) => acc + curr.score, 0) / totalEvaluatedDebates) * 10) / 10
    : 0;
  const highestDebateScore = totalEvaluatedDebates > 0
    ? Math.max(...trendData.map(t => t.score))
    : 0;
  const firstDebateScore = totalEvaluatedDebates > 0 ? trendData[0].score : 0;
  const latestDebateScore = totalEvaluatedDebates > 0 ? trendData[trendData.length - 1].score : 0;
  const netGrowth = totalEvaluatedDebates > 1
    ? Math.round((latestDebateScore - firstDebateScore) * 10) / 10
    : 0;

  // Filtered subset of trendData for high-clarity graph scaling
  const visibleTrendData = (() => {
    if (trendFilter === 'last10') return trendData.slice(-10);
    if (trendFilter === 'last15') return trendData.slice(-15);
    if (trendFilter === 'last30') return trendData.slice(-30);
    return trendData;
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
  }, [activeTab, trendFilter]);

  const hasSessions = unifiedRecentSessions.length > 0;
  const avgScore = hasSessions
    ? Math.round((unifiedRecentSessions.reduce((acc, curr) => acc + (parseFloat(curr.score) || 85), 0) / unifiedRecentSessions.length) * 10) / 10 
    : 0;

  const latestVocal = presentationHistory[0] || (debateHistory.find(d => d.session_type === 'Vocal Matrix')?.metrics ? debateHistory.find(d => d.session_type === 'Vocal Matrix') : null);
  const latestDebate = debateHistory.find(d => d.session_type !== 'Vocal Matrix') || debateHistory[0] || null;

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

  const handleLogout = () => {
    localStorage.removeItem('logos_ai_jwt');
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

  return (
    <div className="section-container" style={{ paddingTop: '2.5rem', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Dashboard Brand Header */}
      <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1.75rem' }}>
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

      {/* Unified Tab Select Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '6px', marginBottom: '2.5rem', overflowX: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        {(isLearner ? [
          { id: 'debates', label: `DEBATE HISTORY (${totalDebates})` },
          { id: 'presentations', label: `VOCAL MATRIX (${totalVocalSessions})` },
          { id: 'trends', label: 'IMPROVEMENT TRENDS' },
          { id: 'settings', label: 'PROFILE SETTINGS' }
        ] : [
          { id: 'overview', label: 'OVERVIEW & SUMMARY' },
          { id: 'debates', label: `DEBATE HISTORY (${totalDebates})` },
          { id: 'presentations', label: `VOCAL MATRIX ARCHIVE (${totalVocalSessions})` },
          { id: 'settings', label: 'PROFILE SETTINGS' }
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
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
                  <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.05em' }}>VOCAL MATRIX SESSIONS</div>
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
                      Summary of your most recent debate and vocal matrix practice sessions saved in the database.
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
                                background: s.type === 'Vocal Matrix' ? '#FEF2F2' : '#F0FDF4',
                                color: s.type === 'Vocal Matrix' ? '#DC2626' : '#166534',
                                border: `1px solid ${s.type === 'Vocal Matrix' ? '#FECACA' : '#BBF7D0'}`
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
                    No completed sessions found yet. Start a simulation or record in the Vocal Matrix studio to see your metrics!
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
                          <li>Encourage speech recordings in Vocal Matrix studio to evaluate speaking cadence.</li>
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
          
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                OVERALL MEAN PERCENTAGE
              </div>
              <div className="font-display text-red" style={{ fontSize: '2.4rem', fontWeight: 900 }}>
                {overallMeanPercentage}%
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Mean benchmark across {totalEvaluatedDebates} rounds
              </p>
            </div>

            <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                HIGHEST DEBATE SCORE
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10B981' }}>
                {highestDebateScore}%
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Personal best round performance
              </p>
            </div>

            <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                GROWTH PROGRESSION
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: netGrowth >= 0 ? '#059669' : '#DC2626' }}>
                {netGrowth >= 0 ? `+${netGrowth}%` : `${netGrowth}%`}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Progression from Round 1 to Latest
              </p>
            </div>

            <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                EVALUATED ROUNDS
              </div>
              <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#111827' }}>
                {totalEvaluatedDebates}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                Completed competitive transcripts
              </p>
            </div>
          </div>

          {/* Graph Section: Mean Percentage & Overall Score Progression */}
          <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
            
            {/* Header with Title, Range Filters, and Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  STATISTICAL PERFORMANCE TRAJECTORY
                </div>
                <h3 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0.3rem', color: '#111827' }}>
                  Debate Improvement Progression Graph
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>
                  Automated chronological tracking of round-by-round overall scores and cumulative mean percentage.
                </p>
              </div>

              {/* Range Filters & Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                {/* Range Filter Buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', background: '#F3F4F6', padding: '0.25rem', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTrendFilter('all')}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: trendFilter === 'all' ? '#111827' : 'transparent',
                      color: trendFilter === 'all' ? '#FFFFFF' : '#4B5563',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ALL ({totalEvaluatedDebates})
                  </button>
                  {totalEvaluatedDebates > 30 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last30')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: trendFilter === 'last30' ? '#111827' : 'transparent',
                        color: trendFilter === 'last30' ? '#FFFFFF' : '#4B5563',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      LAST 30
                    </button>
                  )}
                  {totalEvaluatedDebates > 15 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last15')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: trendFilter === 'last15' ? '#111827' : 'transparent',
                        color: trendFilter === 'last15' ? '#FFFFFF' : '#4B5563',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      LAST 15
                    </button>
                  )}
                  {totalEvaluatedDebates > 10 && (
                    <button
                      type="button"
                      onClick={() => setTrendFilter('last10')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: trendFilter === 'last10' ? '#111827' : 'transparent',
                        color: trendFilter === 'last10' ? '#FFFFFF' : '#4B5563',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      LAST 10
                    </button>
                  )}
                </div>

                {/* Legend Indicators */}
                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', fontWeight: 700, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D90429', display: 'inline-block' }}></span>
                    <span style={{ color: '#111827' }}>Round Overall Score (%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: '16px', height: '0', borderTop: '2px dashed #111827', display: 'inline-block' }}></span>
                    <span style={{ color: '#111827' }}>Cumulative Mean (%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Details Box: Default 'ROUND DETAILS' with black border, replaced with live stats on hover or click lock */}
            {(() => {
              const activeTrend = selectedTrend || hoveredTrend;
              const isLocked = Boolean(selectedTrend && selectedTrend.id === activeTrend?.id);

              if (!activeTrend) {
                return (
                  <div style={{
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
                        ROUND DETAILS
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                        Hover or click any round dot on the graph to inspect performance, cumulative mean %, and growth delta.
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>
                      Click point to lock details
                    </span>
                  </div>
                );
              }

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
                  border: isLocked ? '1.5px solid #D90429' : '1.5px solid #111827',
                  minHeight: '66px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ 
                        background: '#D90429', 
                        color: '#FFF', 
                        padding: '0.35rem 0.65rem', 
                        borderRadius: '6px', 
                        fontWeight: 900, 
                        fontSize: '0.82rem', 
                        whiteSpace: 'nowrap' 
                      }}>
                        ROUND #{activeTrend.round}
                      </div>
                      {isLocked && (
                        <span style={{ 
                          background: 'rgba(217, 4, 41, 0.2)', 
                          color: '#F87171', 
                          border: '1px solid #D90429', 
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
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Round Score</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F87171' }}>{activeTrend.score}%</span>
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
                      href={`/dashboard/performance?session_id=${activeTrend.id}`}
                      style={{
                        background: '#D90429',
                        color: '#FFF',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      View Report →
                    </Link>
                    {isLocked && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrend(null)}
                        title="Unlock / Close"
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
            {totalEvaluatedDebates === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#9CA3AF' }}>
                No completed debate rounds recorded yet. Launch the simulation to record your first debate and initialize your progression graph!
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FAFAFA', overflow: 'hidden' }}>
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
                            <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D90429" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#D90429" stopOpacity="0.0" />
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
                            <path d={areaPath} fill="url(#scoreAreaGradient)" pointerEvents="none" />
                          )}

                          {/* Cumulative Mean Line (Black Dashed) */}
                          {N > 1 && (
                            <path d={meanPath} fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="5,4" pointerEvents="none" />
                          )}

                          {/* Round Score Line (Red Solid) */}
                          {N > 1 && (
                            <path d={scorePath} fill="none" stroke="#D90429" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                          )}

                          {/* Interactive Debate Nodes & X-Axis Labels */}
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
                                    stroke="#DC2626" 
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
                                  stroke={isActive ? '#D90429' : '#D1D5DB'} 
                                  strokeWidth={isActive ? '2' : '1'} 
                                  pointerEvents="none" 
                                />

                                {/* Clean X-Axis Round Number Only: R1, R2, R3... with generous spacing above scrollbar */}
                                <text 
                                  x={cx} 
                                  y={296} 
                                  textAnchor="middle" 
                                  fontSize="12" 
                                  fontWeight="800" 
                                  fill={isActive ? '#D90429' : '#374151'} 
                                  fontFamily="'Inter', sans-serif"
                                  pointerEvents="none"
                                >
                                  R{d.round}
                                </text>

                                {/* Cumulative Mean Marker (Black Dot) */}
                                <circle 
                                  cx={cx} 
                                  cy={cyMean} 
                                  r="3.5" 
                                  fill="#111827" 
                                  pointerEvents="none" 
                                />

                                {/* Round Score Marker (Red Dot) */}
                                <circle 
                                  cx={cx} 
                                  cy={cyScore} 
                                  r={isActive ? 7.5 : 5.5} 
                                  fill="#FFFFFF" 
                                  stroke="#D90429" 
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
                                      stroke="#D90429" 
                                      strokeWidth={isSelected ? "2.5" : "1.8"} 
                                      opacity={isSelected ? "0.8" : "0.5"} 
                                      pointerEvents="none" 
                                    />
                                    <g pointerEvents="none" transform={`translate(${cx}, ${Math.max(16, cyScore - 18)})`}>
                                      <rect x="-24" y="-16" width="48" height="17" rx="4" fill={isSelected ? "#D90429" : "#0F172A"} />
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

            {/* Comprehensive Axis Metrics & Symbolic Encoding Guide (Replacing Old Log Table) */}
            <div style={{ marginTop: '1.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem' }}>
              <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                AXIS METRICS & SYMBOLIC ENCODING GUIDE
              </div>
              <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 1rem 0', color: '#111827' }}>
                How to Read & Interpret Your Improvement Graph
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {/* 1. X-Axis */}
                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #111827' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ background: '#111827', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      X-AXIS
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Practice Rounds</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    Represents each completed debate session in chronological order from Round 1 (earliest session) to Round {totalEvaluatedDebates} (most recent). Allows tracking longitudinal progress.
                  </p>
                </div>

                {/* 2. Y-Axis */}
                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #6B7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ background: '#4B5563', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      Y-AXIS
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Performance %</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    Standardized performance score percentage calibrated from 40% to 100%. Derived from dialectical validity, rebuttal leverage, warrant density, and prosody metrics.
                  </p>
                </div>

                {/* 3. Red Dot & Line */}
                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #D90429' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D90429', display: 'inline-block' }}></span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Red Dot & Solid Line</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    <strong>Individual Round Score (%)</strong>: The actual score achieved in that specific debate topic. Peaks when arguments are empirically substantiated and logical fallacies are neutralized.
                  </p>
                </div>

                {/* 4. Black Dot & Dashed Line */}
                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #0F172A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <span style={{ width: '14px', height: '0', borderTop: '2.5px dashed #111827', display: 'inline-block' }}></span>
                    <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Black Dot & Line</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                    <strong>Cumulative Mean Benchmark (%)</strong>: The running average score up to that round. A steadily rising curve validates long-term retention and rhetorical mastery.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VOCAL MATRIX ARCHIVE TAB (Available for All Roles) */}
      {/* ========================================================================= */}
      {activeTab === 'presentations' && (
        <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                Complete Vocal Matrix & Speech Prosody Archive
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                Every recorded presentation, speaking pace metric, filler word count, and confidence rating preserved across sessions.
              </p>
            </div>
            <Link href="/presentation" className="btn btn-red" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.825rem' }}>
              + RECORD VOCAL MATRIX
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
                          title="Open Vocal Matrix Performance Breakdown"
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
                      No Vocal Matrix sessions recorded yet. Open the Vocal Metrics studio to evaluate your first speech!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PROFILE SETTINGS TAB (Available for All Roles) */}
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
    </div>
  );
}
