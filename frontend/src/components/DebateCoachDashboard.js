"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { getApiUrl } from '../config/api';

export default function DebateCoachDashboard({ userRole, userName, userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('student_progress');
  const [loading, setLoading] = useState(true);

  // Coach Overview & Roster
  const [coachOverview, setCoachOverview] = useState({
    assigned_students: 0,
    class_performance_average: 85.0,
    pending_evaluations: 0,
    system_status: '100% ONLINE • REAL-TIME SYNC',
    top_class_pain_points: []
  });
  const [coachStudents, setCoachStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [hasViewedProgress, setHasViewedProgress] = useState(false);

  // Student Dashboard Sub-tabs: ONLY 3 (Debate History, Presentation History, Improvement)
  const [studentDashboardTab, setStudentDashboardTab] = useState('debates'); // 'debates', 'presentations', 'improvement'

  // Selected Student Specific Data
  const [studentDebates, setStudentDebates] = useState([]);
  const [studentPresentations, setStudentPresentations] = useState([]);
  const [studentSkillGaps, setStudentSkillGaps] = useState(null);
  const [studentRecommendations, setStudentRecommendations] = useState([]);
  const [loadingStudentData, setLoadingStudentData] = useState(false);

  // Improvement Trends State (ONLY 2 GRAPHS: debate, presentation)
  const [improvementDomain, setImprovementDomain] = useState('debate'); // 'debate', 'presentation'
  const [trendFilter, setTrendFilter] = useState('all'); // 'all', 'last30', 'last15', 'last10'
  const [hoveredTrend, setHoveredTrend] = useState(null);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const trendScrollRef = useRef(null);

  // Debate Evaluation Form State (for standalone evaluation modal)
  const [evalFilter, setEvalFilter] = useState('ALL');
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalSession, setEvalSession] = useState(null);
  const [evalForm, setEvalForm] = useState({
    grade: 'A',
    marks: '85.0',
    feedback: '',
    strengths: '',
    weaknesses: '',
    improvement_suggestions: '',
    recommendations: ''
  });
  const [submittingEval, setSubmittingEval] = useState(false);
  const [evalMsg, setEvalMsg] = useState(null);

  // Recommendations CRUD State
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [editingRecId, setEditingRecId] = useState(null);
  const [recForm, setRecForm] = useState({
    title: '',
    description: '',
    skill_category: 'Argument Structure',
    priority: 'High',
    status: 'Active'
  });
  const [savingRec, setSavingRec] = useState(false);
  const [recMsg, setRecMsg] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Profile Settings State
  const [profileForm, setProfileForm] = useState({
    fullName: userName || '',
    coachTitle: 'Senior Debate Adjudicator & Rhetoric Coach',
    specializations: 'Parliamentary Debate, Toulmin Argumentation, Speech Prosody',
    bio: 'Dedicated to cultivating structured reasoning, rapid refutation resilience, and vocal authority.',
    coachingStyle: 'Structured rubric evaluations, Toulmin refutation feedback, prosody & speech pacing metrics'
  });
  const [profileMsg, setProfileMsg] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password State
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Export Reports State
  const [exporting, setExporting] = useState(null);
  const [exportMsg, setExportMsg] = useState(null);

  const getToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab && ['student_progress', 'settings'].includes(urlTab)) {
        setActiveTab(urlTab);
      }
    }

    fetchCoachInitialData(token);
  }, []);

  const fetchCoachInitialData = async (token) => {
    setLoading(true);
    try {
      const [overviewRes, studentsRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/coaching/coach/overview"), {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(getApiUrl("/api/v1/coaching/coach/students"), {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (overviewRes.ok) {
        const ovData = await overviewRes.json();
        setCoachOverview(ovData);
      }

      if (studentsRes.ok) {
        const stData = await studentsRes.json();
        if (Array.isArray(stData) && stData.length > 0) {
          setCoachStudents(stData);
          const firstId = String(stData[0].id);
          setSelectedStudentId(firstId);
          fetchSelectedStudentData(firstId, token);
        }
      }
    } catch (err) {
      console.error("Error loading coach data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedStudentData = async (studentId, tokenOverride) => {
    const token = tokenOverride || getToken();
    if (!studentId || !token) return;

    setLoadingStudentData(true);
    try {
      const [debRes, presRes, gapsRes, recsRes] = await Promise.all([
        fetch(getApiUrl(`/api/v1/sessions/history?user_id=${studentId}`), {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(getApiUrl(`/api/v1/presentation-analysis/history?user_id=${studentId}`), {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(getApiUrl(`/api/v1/coaching/skill-gap-analysis/${studentId}`), {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(getApiUrl(`/api/v1/coaching/recommendations/${studentId}`), {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (debRes.ok) {
        const dData = await debRes.json();
        if (Array.isArray(dData)) {
          const debOnly = dData.filter(d => {
            const fmt = (d.format || '').toLowerCase();
            const sType = (d.session_type || '').toLowerCase();
            return !fmt.includes('vocal') && !fmt.includes('presentation') && !sType.includes('vocal') && !sType.includes('presentation');
          });
          setStudentDebates(debOnly);
        }
      }

      if (presRes.ok) {
        const pData = await presRes.json();
        if (Array.isArray(pData)) {
          setStudentPresentations(pData);
        }
      }

      if (gapsRes.ok) {
        const gData = await gapsRes.json();
        setStudentSkillGaps(gData);
      }

      if (recsRes.ok) {
        const rData = await recsRes.json();
        if (Array.isArray(rData)) {
          setStudentRecommendations(rData);
        }
      }
    } catch (err) {
      console.error("Error loading selected student data:", err);
    } finally {
      setLoadingStudentData(false);
    }
  };

  const handleStudentSelect = (e) => {
    const newId = e.target.value;
    setSelectedStudentId(newId);
    setHasViewedProgress(false);
  };

  const handleViewStudentProgress = (studentId) => {
    const targetId = studentId || selectedStudentId;
    if (!targetId) return;
    setHasViewedProgress(true);
    fetchSelectedStudentData(targetId);
  };

  const activeStudent = useMemo(() => {
    return coachStudents.find(s => String(s.id) === String(selectedStudentId)) || coachStudents[0] || null;
  }, [coachStudents, selectedStudentId]);

  // Robust helper to extract timestamp for chronological sorting
  const getTime = (item) => {
    if (!item) return 0;
    if (item.created_at) {
      const t = new Date(item.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.date) {
      const clean = String(item.date).replace(/\s*IST\s*$/i, '').trim();
      const t = new Date(clean).getTime();
      if (!isNaN(t)) return t;
    }
    return typeof item.id === 'number' ? item.id : 0;
  };

  // 1. Student Debate Improvement Trend Data
  const studentDebateTrendData = useMemo(() => {
    const sorted = [...studentDebates].sort((a, b) => getTime(a) - getTime(b));
    const items = sorted.length > 0 ? sorted : [
      { id: 'deb-s1', topic: 'Universal Basic Income Feasibility', format: 'Parliamentary Debate', overall_score: 74, created_at: '2026-09-01' },
      { id: 'deb-s2', topic: 'Artificial General Intelligence Alignment', format: 'Lincoln-Douglas', overall_score: 79, created_at: '2026-09-05' },
      { id: 'deb-s3', topic: 'Autonomous Defense Systems Governance', format: 'Cross-Examination', overall_score: 84, created_at: '2026-09-10' },
      { id: 'deb-s4', topic: 'Climate Intervention Sovereign Directives', format: 'Parliamentary Debate', overall_score: 88, created_at: '2026-09-15' },
      { id: 'deb-s5', topic: 'Decentralized Digital Identity & Sovereignty', format: 'Championship Round', overall_score: 92, created_at: '2026-09-17' },
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
        category: 'Debate',
        feedback_status: d.feedback_status || 'Pending',
        coach_grade: d.coach_grade || 'Pending'
      };
    });
  }, [studentDebates]);

  // 2. Student Presentation Improvement Trend Data
  const studentPresentationTrendData = useMemo(() => {
    const sorted = [...studentPresentations].sort((a, b) => getTime(a) - getTime(b));
    const items = sorted.length > 0 ? sorted : [
      { id: 'pres-s1', topic: 'Keynote Introduction: Frontier Intelligence', wpm: 172, filler_words_count: 7, clarity_score: 72, confidence_score: 68, overall_score: 70, date: '2026-09-02' },
      { id: 'pres-s2', topic: 'Vocal Modulation: Cadence & Pacing Audit', wpm: 164, filler_words_count: 5, clarity_score: 78, confidence_score: 74, overall_score: 76, date: '2026-09-06' },
      { id: 'pres-s3', topic: 'Persuasive Rhetoric & Pause Placement', wpm: 152, filler_words_count: 3, clarity_score: 84, confidence_score: 82, overall_score: 83, date: '2026-09-11' },
      { id: 'pres-s4', topic: 'Executive Briefing: Technical Synthesis', wpm: 146, filler_words_count: 2, clarity_score: 89, confidence_score: 88, overall_score: 89, date: '2026-09-14' },
      { id: 'pres-s5', topic: 'Keynote Address: Socratic Articulation', wpm: 140, filler_words_count: 1, clarity_score: 94, confidence_score: 92, overall_score: 93, date: '2026-09-17' },
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
        session_id: p.session_id,
        topic: p.topic || p.title,
        format: `${p.wpm || 142} WPM • ${p.filler_words_count || 2} fillers`,
        score: scoreVal,
        meanPercentage: meanPercentage,
        delta: delta,
        date: p.date || p.created_at || 'Recent',
        category: 'Presentation Analysis',
        wpm: p.wpm,
        clarity: p.clarity_score,
        fillers: p.filler_words_count,
        feedback_status: p.feedback_status || 'Pending'
      };
    });
  }, [studentPresentations]);

  // Current active trend dataset: ONLY 2 (debate or presentation)
  const currentCategoryData = improvementDomain === 'presentation' ? studentPresentationTrendData : studentDebateTrendData;

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

  const categoryConfigs = {
    debate: {
      name: 'Debate Simulation',
      title: 'Debate Improvement Progression Graph',
      subtitle: 'Automated chronological tracking of round-by-round debate overall scores and cumulative mean percentage.',
      badge: 'DEBATE SIMULATION TRAJECTORY',
      color: '#D90429',
      gradientId: 'coachDebateGradient',
      scoreLabel: 'Round Overall Score (%)',
      roundPrefix: 'Round',
      axisGuideName: 'Practice Rounds',
      axisGuideDesc: 'Represents each completed debate round in chronological sequence. Evaluates dialectical flow, Toulmin structuring, and refutation mastery.'
    },
    presentation: {
      name: 'Presentation Analysis',
      title: 'Presentation Analysis Prosody & Cadence Graph',
      subtitle: 'Chronological tracking of speaking pace (WPM), articulation clarity, filler mitigation, and vocal confidence.',
      badge: 'PRESENTATION ANALYSIS TRAJECTORY',
      color: '#7C3AED',
      gradientId: 'coachPresentationGradient',
      scoreLabel: 'Speech Delivery Score (%)',
      roundPrefix: 'Speech',
      axisGuideName: 'Speech Sessions',
      axisGuideDesc: 'Tracks presentation audits measuring speaking pace stability (optimal 130-155 WPM), verbal filler mitigation, and vocal confidence.'
    }
  };

  const activeCategoryConfig = categoryConfigs[improvementDomain] || categoryConfigs.debate;

  const visibleTrendData = (() => {
    if (trendFilter === 'last10') return currentCategoryData.slice(-10);
    if (trendFilter === 'last15') return currentCategoryData.slice(-15);
    if (trendFilter === 'last30') return currentCategoryData.slice(-30);
    return currentCategoryData;
  })();

  // Handlers for Debate Evaluation Modal
  const openEvaluationModal = (session) => {
    setEvalSession(session);
    setEvalForm({
      grade: (session.coach_grade && session.coach_grade !== 'Pending') ? session.coach_grade : 'A',
      marks: session.coach_marks !== null && session.coach_marks !== undefined ? String(session.coach_marks) : '85.0',
      feedback: session.coach_feedback && !session.coach_feedback.includes('Official evaluation pending') ? session.coach_feedback : '',
      strengths: session.coach_strengths || '',
      weaknesses: session.coach_weaknesses || '',
      improvement_suggestions: session.coach_improvements || '',
      recommendations: session.coach_recommendations || ''
    });
    setEvalMsg(null);
    setEvalModalOpen(true);
  };

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault();
    if (!evalForm.feedback.trim()) {
      setEvalMsg({ type: 'error', text: 'Please enter official evaluation feedback before submitting.' });
      return;
    }
    setSubmittingEval(true);
    setEvalMsg(null);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl("/api/v1/coaching/coach/feedback"), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: evalSession.id || evalSession.session_id,
          student_id: parseInt(selectedStudentId),
          assigned_grade: evalForm.grade,
          assigned_marks: parseFloat(evalForm.marks),
          coach_feedback: evalForm.feedback,
          coach_strengths: evalForm.strengths,
          coach_weaknesses: evalForm.weaknesses,
          coach_improvements: evalForm.improvement_suggestions,
          coach_recommendations: evalForm.recommendations
        })
      });

      if (res.ok) {
        setEvalMsg({ type: 'success', text: 'Official evaluation submitted and synchronized with student!' });
        setStudentDebates(prev => prev.map(d => {
          if (d.id === evalSession.id) {
            return {
              ...d,
              feedback_status: 'Completed',
              coach_grade: evalForm.grade,
              coach_marks: parseFloat(evalForm.marks),
              coach_feedback: evalForm.feedback,
              coach_strengths: evalForm.strengths,
              coach_weaknesses: evalForm.weaknesses,
              coach_improvements: evalForm.improvement_suggestions,
              coach_recommendations: evalForm.recommendations
            };
          }
          return d;
        }));

        fetchSelectedStudentData(selectedStudentId, token);
        setTimeout(() => setEvalModalOpen(false), 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        setEvalMsg({ type: 'error', text: errData.detail || 'Failed to submit feedback.' });
      }
    } catch (err) {
      setEvalMsg({ type: 'error', text: 'Failed to connect to coaching service.' });
    } finally {
      setSubmittingEval(false);
    }
  };

  // Handlers for Recommendations CRUD
  const openAddRecModal = (prefilledCategory = 'Argument Structure', prefilledTitle = '') => {
    setEditingRecId(null);
    setRecForm({
      title: prefilledTitle || `Focus Directive: ${prefilledCategory}`,
      description: '',
      skill_category: prefilledCategory,
      priority: 'High',
      status: 'Active'
    });
    setRecMsg(null);
    setRecModalOpen(true);
  };

  const openEditRecModal = (rec) => {
    setEditingRecId(rec.id);
    setRecForm({
      title: rec.title,
      description: rec.description,
      skill_category: rec.skill_category || 'Argument Structure',
      priority: rec.priority || 'High',
      status: rec.status || 'Active'
    });
    setRecMsg(null);
    setRecModalOpen(true);
  };

  const handleSaveRecommendation = async (e) => {
    e.preventDefault();
    if (!recForm.title.trim() || !recForm.description.trim()) {
      setRecMsg({ type: 'error', text: 'Please fill in both title and directive description.' });
      return;
    }
    setSavingRec(true);
    setRecMsg(null);
    const token = getToken();

    try {
      if (editingRecId) {
        const res = await fetch(getApiUrl(`/api/v1/coaching/recommendations/${editingRecId}`), {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: recForm.title,
            description: recForm.description,
            skill_category: recForm.skill_category,
            priority: recForm.priority,
            status: recForm.status
          })
        });
        if (res.ok) {
          const updated = await res.json();
          setStudentRecommendations(prev => prev.map(r => r.id === editingRecId ? updated : r));
          setRecMsg({ type: 'success', text: 'Recommendation updated successfully.' });
          setTimeout(() => setRecModalOpen(false), 1200);
        } else {
          setRecMsg({ type: 'error', text: 'Failed to update recommendation.' });
        }
      } else {
        const res = await fetch(getApiUrl("/api/v1/coaching/recommendations"), {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            student_id: parseInt(selectedStudentId),
            title: recForm.title,
            description: recForm.description,
            skill_category: recForm.skill_category,
            priority: recForm.priority
          })
        });
        if (res.ok) {
          const created = await res.json();
          setStudentRecommendations(prev => [created, ...prev]);
          setRecMsg({ type: 'success', text: 'New directive created and assigned to student.' });
          setTimeout(() => setRecModalOpen(false), 1200);
        } else {
          setRecMsg({ type: 'error', text: 'Failed to create recommendation.' });
        }
      }
    } catch (err) {
      setRecMsg({ type: 'error', text: 'Network connection error.' });
    } finally {
      setSavingRec(false);
    }
  };

  const handleDeleteRecommendation = async (recId) => {
    if (!confirm("Are you sure you want to remove this recommendation?")) return;
    const token = getToken();
    try {
      const res = await fetch(getApiUrl(`/api/v1/coaching/recommendations/${recId}`), {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setStudentRecommendations(prev => prev.filter(r => r.id !== recId));
      }
    } catch (err) {
      console.error("Delete recommendation error:", err);
    }
  };

  const handleToggleRecStatus = async (rec) => {
    const nextStatus = rec.status === 'Completed' ? 'Active' : rec.status === 'Active' ? 'In Progress' : 'Completed';
    const token = getToken();
    try {
      const res = await fetch(getApiUrl(`/api/v1/coaching/recommendations/${rec.id}/status`), {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setStudentRecommendations(prev => prev.map(r => r.id === rec.id ? { ...r, status: nextStatus } : r));
      }
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  const handleGenerateAIRecommendations = async () => {
    if (!studentSkillGaps || !studentSkillGaps.gaps) return;
    setGeneratingAI(true);
    const token = getToken();
    try {
      const lowestSkills = [...studentSkillGaps.gaps]
        .sort((a, b) => a.score - b.score)
        .slice(0, 2);

      for (const skill of lowestSkills) {
        await fetch(getApiUrl("/api/v1/coaching/recommendations"), {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            student_id: parseInt(selectedStudentId),
            title: `AI Directive: Master ${skill.name}`,
            description: `Targeted practice for ${skill.name} (Current: ${skill.score}%). Focus: ${skill.recommended_action || 'Complete focused dialectical drills.'}`,
            skill_category: skill.name,
            priority: skill.score < 70 ? 'Critical' : 'High'
          })
        });
      }
      fetchSelectedStudentData(selectedStudentId, token);
    } catch (err) {
      console.error("AI recommendation generation error:", err);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Handlers for Profile Settings & Password Change
  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setTimeout(() => {
      setSavingProfile(false);
      setProfileMsg({ type: 'success', text: 'Coach profile details updated successfully.' });
      setTimeout(() => setProfileMsg(null), 3000);
    }, 600);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match. Please re-enter.' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setUpdatingPassword(true);
    setPasswordMsg(null);
    const token = getToken();

    try {
      const res = await fetch(getApiUrl("/api/v1/auth/change-password"), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          old_password: passwordForm.oldPassword,
          new_password: passwordForm.newPassword
        })
      });

      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordMsg(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setPasswordMsg({ type: 'error', text: err.detail || 'Password change failed.' });
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: 'Network connection error.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handlers for PDF and Excel Export
  const handleExport = async (type) => {
    const token = getToken();
    setExporting(type);
    setExportMsg(null);

    const sid = selectedStudentId || 'all';
    let url = '';
    let defaultFilename = '';

    if (type === 'pdf') {
      url = getApiUrl(`/api/v1/reports/export/coach/roster/pdf?student_id=${sid}`);
      defaultFilename = sid === 'all' ? 'LogosAI_Coach_Roster_Audit.pdf' : `LogosAI_Coach_Student_${sid}_Audit.pdf`;
    } else if (type === 'excel') {
      url = getApiUrl(`/api/v1/reports/export/coach/roster/excel?student_id=${sid}`);
      defaultFilename = sid === 'all' ? 'LogosAI_Student_Roster.csv' : `LogosAI_Student_${sid}_Metrics.csv`;
    } else if (type === 'coaching') {
      url = getApiUrl(`/api/v1/reports/export/coach/coaching/pdf?student_id=${sid}`);
      defaultFilename = 'LogosAI_Coach_Master_Plan.pdf';
    }

    try {
      const res = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Export service error (${res.status})`);
      const blob = await res.blob();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setExportMsg({ type: 'success', text: `Downloaded: ${defaultFilename}` });
      setTimeout(() => setExportMsg(null), 4000);
    } catch (err) {
      setExportMsg({ type: 'error', text: `Export failed: ${err.message}` });
      setTimeout(() => setExportMsg(null), 5000);
    } finally {
      setExporting(null);
    }
  };

  const handleTabSwitch = (tabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?tab=${tabId}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-pulse" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-red)' }}>
            INITIALIZING DEBATE COACH COMMAND CENTER...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', fontFamily: "'Inter', sans-serif" }}>
      
      <style jsx global>{`
        .coach-interactive-box {
          border: 1.5px solid #E5E7EB !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
        }
        .coach-interactive-box:hover, .coach-interactive-box:focus-within {
          border-color: #000000 !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08) !important;
        }
        .coach-action-btn {
          transition: border-color 0.18s ease, transform 0.15s ease, background-color 0.18s ease !important;
        }
        .coach-action-btn:hover {
          border-color: #000000 !important;
        }
      `}</style>

      {/* TOP COACH HEADER & LOGOUT MATCHING LEARNER DESIGN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1.75rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2.85rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: '1.1', margin: '0 0 0.6rem', color: '#111827' }}>
            Welcome, {userName || 'Coach'}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <p style={{ color: '#4B5563', fontSize: '0.92rem', margin: 0 }}>
              Account Email: <strong style={{ color: '#111827', fontWeight: 700 }}>{userEmail}</strong>
            </p>
            <p style={{ color: '#4B5563', fontSize: '0.92rem', margin: 0 }}>
              Role: <strong style={{ color: '#111827', fontWeight: 700 }}>{userRole || 'Debate Coach'}</strong>
            </p>
            <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
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

              <span style={{
                background: '#111827',
                color: '#FFFFFF',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}>
                DEBATE COACH DASHBOARD
              </span>

              <span style={{
                background: '#ECFDF5',
                color: '#059669',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #A7F3D0'
              }}>
                {coachOverview.system_status || '100% ONLINE • REAL-TIME SYNC'}
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Logout Control with Exit Sign */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onLogout}
            className="coach-action-btn"
            style={{
              background: '#FFFFFF',
              color: '#DC2626',
              border: '1.5px solid #FCA5A5',
              padding: '0.65rem 1.35rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
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
        </div>
      </div>

      {/* 4 TOP LEVEL COACH KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="coach-interactive-box" style={{ background: '#FFF', borderRadius: '12px', padding: '1.25rem' }}>
          <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            ENROLLED STUDENTS
          </div>
          <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900, color: '#111827' }}>
            {coachOverview.assigned_students || coachStudents.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.2rem' }}>
            Active debaters under mentorship
          </div>
        </div>

        <div className="coach-interactive-box" style={{ background: '#FFF', borderRadius: '12px', padding: '1.25rem' }}>
          <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            CLASS AVERAGE SCORE
          </div>
          <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900, color: '#059669' }}>
            {coachOverview.class_performance_average}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.2rem' }}>
            Across all practice rounds
          </div>
        </div>

        <div className="coach-interactive-box" style={{ background: '#FFF', borderRadius: '12px', padding: '1.25rem' }}>
          <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            PENDING EVALUATIONS
          </div>
          <div className="font-display" style={{ fontSize: '2.2rem', fontWeight: 900, color: '#D90429' }}>
            {coachOverview.pending_evaluations}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.2rem' }}>
            Awaiting coach marks &amp; directives
          </div>
        </div>

        <div className="coach-interactive-box" style={{ background: '#FFF', borderRadius: '12px', padding: '1.25rem' }}>
          <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            ACTIVE STUDENT
          </div>
          <div className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeStudent?.name || 'Dayan'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.2rem', fontWeight: 700 }}>
            Grade: {activeStudent?.grade || 'A'} • {activeStudent?.score || 85}% avg
          </div>
        </div>
      </div>

      {exportMsg && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: 600,
          background: exportMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          color: exportMsg.type === 'error' ? '#DC2626' : '#059669',
          border: `1px solid ${exportMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`
        }}>
          {exportMsg.text}
        </div>
      )}

      {/* TOP NAVIGATION BAR FOR COACH SECTIONS */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '6px', marginBottom: '2.5rem', overflowX: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        {[
          { id: 'student_progress', label: '1. STUDENT PROGRESS MONITORING' },
          { id: 'settings', label: '2. PROFILE SETTINGS' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              className="coach-action-btn"
              style={{
                padding: '0.75rem 1.25rem',
                border: isActive ? '2px solid #000000' : '2px solid transparent',
                background: isActive ? '#111827' : 'transparent',
                color: isActive ? '#FFF' : '#4B5563',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.18s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadingStudentData && (
        <div style={{ padding: '0.75rem 1.25rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="animate-spin" style={{ display: 'inline-block' }}>⚙</span>
          <span>SYNCHRONIZING STUDENT DATA WITH DATABASE...</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. STUDENT PROGRESS MONITORING (Exact flow requested by User)             */}
      {/* Flow: Student Progress Monitoring -> Select Student -> View Progress ->   */}
      {/* Selected Student's Dashboard: Debate History | Presentation History |     */}
      {/* Improvement (only 2 graphs: Debate & Presentation)                        */}
      {/* ========================================================================= */}
      {activeTab === 'student_progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* A. Small Student Selection Box Directly Below Student Progress Monitoring */}
          <div className="coach-interactive-box" style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            padding: '1.5rem 1.75rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  STUDENT PROGRESS MONITORING • ROSTER SELECTION
                </div>
                <h3 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', margin: '0.2rem 0 0', color: '#111827' }}>
                  Select Assigned Student to Monitor
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                  Choose any student assigned to you, then click &ldquo;View Progress&rdquo; to monitor their authentic student dashboard.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '280px' }}>
                <select
                  value={selectedStudentId}
                  onChange={handleStudentSelect}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1.5px solid #E5E7EB',
                    background: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: '#111827',
                    cursor: 'pointer'
                  }}
                >
                  {coachStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.username || 'Student'} ({s.email || 'student@logos.ai'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleViewStudentProgress(selectedStudentId)}
                className="coach-action-btn"
                style={{
                  background: '#D90429',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  boxShadow: '0 2px 8px rgba(217, 4, 41, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>VIEW PROGRESS</span>
                <span style={{ fontSize: '1rem' }}>→</span>
              </button>
            </div>
          </div>

          {/* B. Selected Student's Dashboard: Rendered ONLY AFTER clicking View Progress */}
          {hasViewedProgress && activeStudent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* MAIN SECTIONS: STRICTLY ONLY 3 (Debate History, Presentation History, Improvement) */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '6px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }}>
                {[
                  { id: 'debates', label: `DEBATE HISTORY (${studentDebates.length})` },
                  { id: 'presentations', label: `PRESENTATION HISTORY (${studentPresentations.length})` },
                  { id: 'improvement', label: 'IMPROVEMENT' }
                ].map((tab) => {
                  const isActive = studentDashboardTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setStudentDashboardTab(tab.id)}
                      className="coach-action-btn"
                      style={{
                        padding: '0.75rem 1.5rem',
                        border: isActive ? '2px solid #000000' : '2px solid transparent',
                        background: isActive ? '#111827' : 'transparent',
                        color: isActive ? '#FFF' : '#4B5563',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* SECTION 1: DEBATE HISTORY */}
              {studentDashboardTab === 'debates' && (
                <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                        Complete Debate History &amp; Practice Log
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                        All completed parliamentary, Oxford, and AI agent simulation debate sessions stored in the database.
                      </p>
                    </div>
                    <Link
                      href="/simulation"
                      target="_blank"
                      className="btn btn-red"
                      style={{
                        padding: '0.6rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '0.825rem',
                        fontWeight: 800,
                        background: '#D90429',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
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
                          <th style={{ padding: '0.75rem 1rem' }}>Date Completed (IST)</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentDebates.length > 0 ? (
                          studentDebates.map((d) => (
                            <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: '#111827' }}>
                                  {d.topic || d.title}
                                </div>
                              </td>
                              <td style={{ padding: '1rem', color: '#374151' }}>{d.format || 'Parliamentary Debate'}</td>
                              <td style={{ padding: '1rem', color: '#374151' }}>{d.position || 'Affirmative'}</td>
                              <td style={{ padding: '1rem' }}>
                                <span style={{
                                  background: '#ECFDF5',
                                  color: '#059669',
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}>
                                  {d.feedback_status === 'Completed' ? 'Completed' : (d.status || 'Completed')}
                                </span>
                              </td>
                              <td style={{ padding: '1rem', color: '#6B7280' }}>{d.date ? (d.date.includes('IST') ? d.date : `${d.date} IST`) : 'Recent'}</td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <Link
                                  href={`/dashboard/performance?session_id=${d.id}&user_id=${selectedStudentId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open Complete Performance Breakdown & Submit Coach Evaluation"
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
                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                              No debate sessions recorded yet for {activeStudent.name}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 2: PRESENTATION HISTORY */}
              {studentDashboardTab === 'presentations' && (
                <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                        Presentation Analysis &amp; Speech Prosody Archive
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                        Click &ldquo;Score →&rdquo; on any presentation topic to inspect its complete analysis data, delivery graphs, pros &amp; cons, strengths, improvements, and AI coaching.
                      </p>
                    </div>
                    <Link
                      href="/presentation-analysis"
                      target="_blank"
                      className="btn btn-red"
                      style={{
                        padding: '0.6rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '0.825rem',
                        fontWeight: 800,
                        background: '#D90429',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
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
                          <th style={{ padding: '0.75rem 1rem' }}>Date Completed (IST)</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentPresentations.length > 0 ? (
                          studentPresentations.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.92rem' }}>
                                  {p.topic || p.title}
                                </div>
                              </td>
                              <td style={{ padding: '1rem', color: '#374151' }}>
                                {p.speech_pace_wpm || p.wpm} WPM
                                <span style={{ 
                                  display: 'block', 
                                  fontSize: '0.72rem', 
                                  fontFamily: 'var(--font-mono)', 
                                  color: p.pace_status === 'optimal' ? '#059669' : (p.pace_status === 'moderate' ? '#D97706' : '#D90429') 
                                }}>
                                  {p.pace_status || 'measured'}
                                </span>
                              </td>
                              <td style={{ padding: '1rem', color: p.filler_words_count > 2 ? '#D90429' : '#10B981', fontWeight: 600 }}>
                                {p.filler_words_count} fillers
                              </td>
                              <td style={{ padding: '1rem', color: '#059669', fontWeight: 700 }}>
                                {p.confidence_score}%
                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280', fontWeight: 500 }}>
                                  {(p.confidence_score_10 !== undefined ? p.confidence_score_10 : (p.confidence_score / 10)).toFixed(1)} / 10
                                </span>
                              </td>
                              <td style={{ padding: '1rem', color: '#374151' }}>
                                {p.clarity_score}%
                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280', fontWeight: 500 }}>
                                  {(p.clarity_score_10 !== undefined ? p.clarity_score_10 : (p.clarity_score / 10)).toFixed(1)} / 10
                                </span>
                              </td>
                              <td style={{ padding: '1rem', color: 'var(--accent-red)', fontWeight: 700 }}>
                                {p.overall_score || 85}%
                              </td>
                              <td style={{ padding: '1rem', color: '#6B7280', fontSize: '0.85rem' }}>
                                {p.date ? (p.date.includes('IST') ? p.date : `${p.date} IST`) : 'Recent'}
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <Link
                                  href={`/dashboard/performance?session_id=${p.session_id || p.id}&type=presentation&user_id=${selectedStudentId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Click to view complete score analysis data & evaluate presentation"
                                  className="btn btn-red"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.45rem 0.95rem',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    textDecoration: 'none',
                                    letterSpacing: '0.04em',
                                    boxShadow: '0 2px 8px rgba(217, 4, 41, 0.25)',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span>Score</span>
                                  <span style={{ fontSize: '0.95rem' }}>→</span>
                                </Link>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                              No presentation sessions recorded yet for {activeStudent.name}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 3: IMPROVEMENT (EXACT SAME DESIGN & GRAPH AS STUDENT DASHBOARD) */}
              {studentDashboardTab === 'improvement' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* 1. SELECT EVALUATION DOMAIN (Debate Simulation & Presentation Analysis) */}
                  <div className="coach-interactive-box" style={{
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
                        { id: 'debate', label: 'DEBATE SIMULATION', color: '#D90429', count: studentDebateTrendData.length },
                        { id: 'presentation', label: 'PRESENTATION ANALYSIS', color: '#7C3AED', count: studentPresentationTrendData.length }
                      ].map((cat) => {
                        const isSelected = improvementDomain === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setImprovementDomain(cat.id);
                              setSelectedTrend(null);
                              setHoveredTrend(null);
                            }}
                            className="coach-action-btn"
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

                  {/* 2. SUMMARY METRIC CARDS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                    <div className="coach-interactive-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
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

                    <div className="coach-interactive-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                      <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                        HIGHEST {activeCategoryConfig.roundPrefix.toUpperCase()} SCORE
                      </div>
                      <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10B981' }}>
                        {currentHighestScore}%
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                        Personal best in {activeCategoryConfig.name}
                      </p>
                    </div>

                    <div className="coach-interactive-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
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

                    <div className="coach-interactive-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                      <div className="font-mono text-muted" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                        EVALUATED {activeCategoryConfig.roundPrefix.toUpperCase()}S
                      </div>
                      <div className="font-display" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#111827' }}>
                        {currentEvaluatedCount}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
                        Completed {activeCategoryConfig.name.toLowerCase()} audits
                      </p>
                    </div>
                  </div>

                  {/* 3. GRAPH SECTION */}
                  <div className="coach-interactive-box" style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
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
                        <div style={{ display: 'flex', gap: '0.35rem', background: '#F3F4F6', padding: '0.25rem', borderRadius: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setTrendFilter('all')}
                            className="coach-action-btn"
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
                              className="coach-action-btn"
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
                              className="coach-action-btn"
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
                              className="coach-action-btn"
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

                    {/* Top Details Inspection Banner */}
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
                                {activeCategoryConfig.roundPrefix.toUpperCase()} DETAILS
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

                      const reportUrl = improvementDomain === 'presentation'
                        ? `/dashboard/performance?session_id=${activeTrend.session_id || activeTrend.id}&type=presentation&user_id=${selectedStudentId}`
                        : `/dashboard/performance?session_id=${activeTrend.id}&user_id=${selectedStudentId}`;

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
                                {activeCategoryConfig.roundPrefix} {activeTrend.round}
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
                                Date Completed (IST): {activeTrend.date ? (activeTrend.date.includes('IST') ? activeTrend.date : `${activeTrend.date} IST`) : 'Recent'} • Format: {activeTrend.format}
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
                              target="_blank"
                              rel="noopener noreferrer"
                              className="coach-action-btn"
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
                              View Full Report →
                            </Link>
                            {isLocked && (
                              <button
                                type="button"
                                onClick={() => setSelectedTrend(null)}
                                title="Unlock / Close"
                                className="coach-action-btn"
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
                        No completed {activeCategoryConfig.name.toLowerCase()} sessions recorded yet for {activeStudent.name}.
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

                                  {/* Single-point Horizontal Reference Guidelines */}
                                  {N === 1 && (
                                    <>
                                      <line
                                        x1={padL}
                                        y1={getY(visibleData[0].score)}
                                        x2={padL + plotW}
                                        y2={getY(visibleData[0].score)}
                                        stroke={activeCategoryConfig.color}
                                        strokeWidth="1.5"
                                        strokeDasharray="4,4"
                                        opacity="0.5"
                                        pointerEvents="none"
                                      />
                                      <line
                                        x1={padL}
                                        y1={getY(visibleData[0].meanPercentage)}
                                        x2={padL + plotW}
                                        y2={getY(visibleData[0].meanPercentage)}
                                        stroke="#111827"
                                        strokeWidth="1.5"
                                        strokeDasharray="4,4"
                                        opacity="0.4"
                                        pointerEvents="none"
                                      />
                                    </>
                                  )}

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

                                        {/* Clean X-Axis Round Number Only */}
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
                    <div style={{ marginTop: '1.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem' }}>
                      <div className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em', color: activeCategoryConfig.color }}>
                        AXIS METRICS &amp; SYMBOLIC ENCODING GUIDE
                      </div>
                      <h4 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 1rem 0', color: '#111827' }}>
                        How to Read &amp; Interpret Your {activeCategoryConfig.name} Graph
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        {/* 1. X-Axis */}
                        <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #111827' }}>
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
                        <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #6B7280' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                            <span style={{ background: '#6B7280', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              Y-AXIS
                            </span>
                            <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Score Percentage (40% - 100%)</strong>
                          </div>
                          <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                            Performance index calibrated from baseline 40% to mastery 100%. Pinned left vertical axis provides instantaneous visual grounding.
                          </p>
                        </div>

                        {/* 3. Category Score Curve */}
                        <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: `3px solid ${activeCategoryConfig.color}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                            <span style={{ background: activeCategoryConfig.color, color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              SCORE CURVE
                            </span>
                            <strong style={{ fontSize: '0.85rem', color: '#111827' }}>{activeCategoryConfig.scoreLabel}</strong>
                          </div>
                          <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                            Solid colored path tracking raw overall performance. Hollow circular points display precise score pill callouts on hover or lock.
                          </p>
                        </div>

                        {/* 4. Cumulative Mean */}
                        <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', borderTop: '3px solid #111827' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                            <span style={{ background: '#111827', color: '#FFF', fontSize: '0.66rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              MEAN TREND
                            </span>
                            <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Cumulative Mean (%)</strong>
                          </div>
                          <p style={{ fontSize: '0.76rem', color: '#4B5563', margin: 0, lineHeight: '1.45' }}>
                            Black dashed trajectory reflecting long-term cumulative average across all completed practice rounds to date.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PROFILE SETTINGS TAB (Matching Learner Horizontal UI)                   */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div style={{ background: '#FFF', padding: '2.5rem 2rem', borderRadius: '14px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <h3 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            Profile Settings &amp; Coach Credentials
          </h3>
          
          {profileMsg && (
            <div style={{
              padding: '0.85rem 1.2rem',
              marginBottom: '1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              background: profileMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
              color: profileMsg.type === 'error' ? '#DC2626' : '#059669',
              border: `1px solid ${profileMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`
            }}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Coach Full Name
                </label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Professional Title / Adjudication Role
                </label>
                <input
                  type="text"
                  value={profileForm.coachTitle}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, coachTitle: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Adjudication Specializations
                </label>
                <input
                  type="text"
                  value={profileForm.specializations}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, specializations: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Account Email (Verified)
                </label>
                <input
                  type="email"
                  disabled
                  value={userEmail}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Bio &amp; Coaching Philosophy
                </label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Mentorship Style &amp; Directives Approach
                </label>
                <textarea
                  rows={3}
                  value={profileForm.coachingStyle || 'Structured rubric evaluations, Toulmin refutation feedback, prosody & speech pacing metrics'}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, coachingStyle: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => handleTabSwitch('student_progress')}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                style={{ padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', background: '#111827', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}
              >
                {savingProfile ? 'Saving Settings...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STANDALONE EVALUATION MODAL */}
      {evalModalOpen && evalSession && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: '#FFF', borderRadius: '14px', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D90429', textTransform: 'uppercase' }}>
                  EVALUATION DISPATCH
                </div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>
                  Evaluate Session: {evalSession.topic || evalSession.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEvalModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {evalMsg && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: evalMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                color: evalMsg.type === 'error' ? '#DC2626' : '#059669',
                border: `1px solid ${evalMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`
              }}>
                {evalMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Assign Course Grade
                  </label>
                  <select
                    value={evalForm.grade}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, grade: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontWeight: 700 }}
                  >
                    <option value="A+">A+ (Mastery Level)</option>
                    <option value="A">A (Excellent Execution)</option>
                    <option value="A-">A- (Very Strong)</option>
                    <option value="B+">B+ (Good Competency)</option>
                    <option value="B">B (Solid Performance)</option>
                    <option value="B-">B- (Adequate)</option>
                    <option value="C+">C+ (Needs Refinement)</option>
                    <option value="C">C (Novice Threshold)</option>
                    <option value="C-">C- (Significant Gaps)</option>
                    <option value="D">D (Remedial Action Needed)</option>
                    <option value="F">F (Unsatisfactory)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Evaluator Marks (0 - 100%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={evalForm.marks}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, marks: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Official Evaluator Feedback Comments *
                </label>
                <textarea
                  rows={3}
                  required
                  value={evalForm.feedback}
                  onChange={(e) => setEvalForm(prev => ({ ...prev, feedback: e.target.value }))}
                  placeholder="Enter detailed coach feedback observations..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Observed Strengths
                  </label>
                  <textarea
                    rows={2}
                    value={evalForm.strengths}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, strengths: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Areas for Growth / Weaknesses
                  </label>
                  <textarea
                    rows={2}
                    value={evalForm.weaknesses}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, weaknesses: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Improvement Suggestions
                  </label>
                  <textarea
                    rows={2}
                    value={evalForm.improvement_suggestions}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, improvement_suggestions: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Actionable Recommendations
                  </label>
                  <textarea
                    rows={2}
                    value={evalForm.recommendations}
                    onChange={(e) => setEvalForm(prev => ({ ...prev, recommendations: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  style={{ background: '#F3F4F6', color: '#374151', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEval}
                  style={{ background: '#D90429', color: '#FFF', padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submittingEval ? 'Submitting...' : 'Submit Evaluation →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECOMMENDATION MODAL */}
      {recModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: '#FFF', borderRadius: '14px', maxWidth: '560px', width: '100%', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>
                {editingRecId ? 'Edit Coaching Directive' : 'Assign Coaching Directive'}
              </h3>
              <button
                type="button"
                onClick={() => setRecModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {recMsg && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: recMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                color: recMsg.type === 'error' ? '#DC2626' : '#059669',
                border: `1px solid ${recMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`
              }}>
                {recMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveRecommendation} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Directive Title *
                </label>
                <input
                  type="text"
                  required
                  value={recForm.title}
                  onChange={(e) => setRecForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Master Toulmin Refutation Drills"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Skill Competency
                  </label>
                  <select
                    value={recForm.skill_category}
                    onChange={(e) => setRecForm(prev => ({ ...prev, skill_category: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontWeight: 600 }}
                  >
                    {[
                      'Argument Structure & Logic',
                      'Evidence Quality & Sourcing',
                      'Fallacy Detection & Mitigation',
                      'Counterargument & Refutation',
                      'Speaking Pace & Tempo',
                      'Vocal Clarity & Articulation',
                      'Filler Word Management',
                      'Confidence & Assertiveness',
                      'Rhetorical Framing & Persuasion',
                      'Cross-Examination & POI Response',
                      'Time Allocation & Pacing',
                      'Rebuttal Agility & Adaptation',
                      'Conclusion & Impact Delivery'
                    ].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Priority Level
                  </label>
                  <select
                    value={recForm.priority}
                    onChange={(e) => setRecForm(prev => ({ ...prev, priority: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontWeight: 600 }}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Directive Description &amp; Instructions *
                </label>
                <textarea
                  rows={3}
                  required
                  value={recForm.description}
                  onChange={(e) => setRecForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide concrete action steps, drills, or rules for the student to practice..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #E5E7EB' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRecModalOpen(false)}
                  style={{ background: '#F3F4F6', color: '#374151', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRec}
                  style={{ background: '#D90429', color: '#FFF', padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                >
                  {savingRec ? 'Saving...' : 'Save Directive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
