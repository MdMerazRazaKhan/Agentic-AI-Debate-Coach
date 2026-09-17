"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthModal from '../../components/AuthModal';

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('session_id') || searchParams.get('id');

  const [downloading, setDownloading] = useState(null); // 'pdf', 'excel', 'coaching', 'roster_pdf', 'roster_excel'
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userRole, setUserRole] = useState('Learner');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(sessionIdParam || 'latest');
  const [statusMsg, setStatusMsg] = useState(null);
  const [lockedTopicTitle, setLockedTopicTitle] = useState('');

  const getToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role || 'Learner';
      setUserRole(role);
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
      
      const roleLower = role.toLowerCase();
      if (roleLower.includes('coach') || roleLower.includes('educator') || roleLower.includes('admin')) {
        fetchCoachStudents(token);
        if (!sessionIdParam) setSelectedSessionId('all');
      } else {
        fetchUserSessions(token);
      }
    } catch (e) {
      console.error("Token decoding error:", e);
    }
  }, []);

  useEffect(() => {
    if (sessionIdParam) {
      setSelectedSessionId(sessionIdParam);
      const token = getToken();
      fetch(`http://localhost:8000/api/v1/sessions/${sessionIdParam}/performance`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setLockedTopicTitle(data.topic || data.title || `Debate Session #${sessionIdParam}`);
        }
      })
      .catch(e => console.error("Could not fetch topic title for session:", e));
    }
  }, [sessionIdParam]);

  const fetchCoachStudents = async (token) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/coaching/coach/students", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStudents(data);
        }
      }
    } catch (err) {
      console.error("Failed to load coach students:", err);
    }
  };

  const fetchUserSessions = async (token) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/sessions/history", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSessions(data);
          if (sessionIdParam) {
            const found = data.find(s => String(s.id) === String(sessionIdParam));
            if (found) {
              setLockedTopicTitle(found.topic || found.title || `Debate Session #${sessionIdParam}`);
            }
          } else {
            setSelectedSessionId(String(data[0].id));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load user sessions:", err);
    }
  };

  const triggerBlobDownload = async (url, defaultFilename, downloadType) => {
    const token = getToken();
    if (!token) {
      setIsAuthModalOpen(true);
      return;
    }

    setDownloading(downloadType);
    setStatusMsg(null);

    try {
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = defaultFilename;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setStatusMsg({ type: 'success', text: `Successfully generated and downloaded: ${filename}` });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error("Download failed:", err);
      setStatusMsg({ type: 'error', text: `Export failed: ${err.message}. Please check connection to API backend.` });
    } finally {
      setDownloading(null);
    }
  };

  const roleStr = (userRole || 'Learner').trim().toLowerCase();
  const isCoachOrEducator = roleStr.includes('coach') || roleStr.includes('educator') || roleStr.includes('teacher') || roleStr.includes('admin');

  const handleDownloadAssessmentPDF = () => {
    const sid = selectedSessionId || (isCoachOrEducator ? 'all' : 'latest');
    if (isCoachOrEducator) {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/coach/roster/pdf?student_id=${sid}`,
        sid === 'all' ? 'LogosAI_Student_Roster_Audit.pdf' : `LogosAI_Coach_Assessment_${sid}.pdf`,
        'pdf'
      );
    } else {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/pdf/${sid}`,
        `LogosAI_Assessment_Report.pdf`,
        'pdf'
      );
    }
  };

  const handleDownloadExcel = () => {
    const sid = selectedSessionId || (isCoachOrEducator ? 'all' : 'latest');
    if (isCoachOrEducator) {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/coach/roster/excel?student_id=${sid}`,
        sid === 'all' ? 'LogosAI_Student_Roster.csv' : `LogosAI_Student_Metrics_${sid}.csv`,
        'excel'
      );
    } else {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/excel/${sid}`,
        `LogosAI_Metric_Scorecard.csv`,
        'excel'
      );
    }
  };

  const handleDownloadCoachingPDF = () => {
    const sid = selectedSessionId || (isCoachOrEducator ? 'all' : 'me');
    if (isCoachOrEducator) {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/coach/coaching/pdf?student_id=${sid}`,
        `LogosAI_Coach_Master_Plan.pdf`,
        'coaching'
      );
    } else {
      triggerBlobDownload(
        `http://localhost:8000/api/v1/reports/export/coaching/pdf/me`,
        `LogosAI_Coaching_Plan.pdf`,
        'coaching'
      );
    }
  };

  const handleDownloadRosterPDF = () => {
    triggerBlobDownload(
      `http://localhost:8000/api/v1/reports/export/coach/roster/pdf`,
      `LogosAI_Classroom_Roster_Audit.pdf`,
      'roster_pdf'
    );
  };

  const handleDownloadRosterExcel = () => {
    triggerBlobDownload(
      `http://localhost:8000/api/v1/reports/export/coach/roster/excel`,
      `LogosAI_Classroom_Roster.csv`,
      'roster_excel'
    );
  };

  return (
    <>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
          const t = getToken();
          if (t) fetchUserSessions(t);
        }}
      />

      <div className="section-container" style={{ paddingTop: '2.5rem', fontFamily: "'Inter', sans-serif" }}>
        
        {/* Global hover styling for boxes turning black on cursor hover */}
        <style jsx global>{`
          .perf-interactive-box {
            border: 2px solid #E5E7EB !important;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
          }
          .perf-interactive-box:hover {
            border-color: #000000 !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
          }
        `}</style>

        {/* Header navigation bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '0.6rem 1.1rem',
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}>
            <div style={{ color: '#D90429', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Export and Compliance Engine
            </div>
            <div style={{ color: '#991B1B', fontSize: '0.75rem', fontWeight: 600 }}>
              Role: <span style={{ textTransform: 'capitalize' }}>{userRole}</span>
            </div>
          </div>
          <Link href="/dashboard" style={{ color: '#4B5563', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', padding: '0.4rem 0' }}>
            ← BACK TO DASHBOARD
          </Link>
        </div>

        <h1 className="font-display" style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: '1.1', marginBottom: '0.5rem' }}>
          Reports & Performance Certificates
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '800px', fontSize: '0.95rem', lineHeight: '1.5' }}>
          Export certified performance scorecards, speech prosody audits, dynamic coaching plans, and official cohort audit reports in standard PDF and CSV formats with 100% authentic database integrity.
        </p>

        {/* Status Notification Toast */}
        {statusMsg && (
          <div style={{
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: '10px',
            background: statusMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5',
            color: statusMsg.type === 'error' ? '#DC2626' : '#059669',
            border: `1px solid ${statusMsg.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
          </div>
        )}

        {/* If navigated with a specific topic session_id, omit selector dropdown completely and show locked session banner */}
        {sessionIdParam ? (
          <div className="perf-interactive-box" style={{
            background: '#FFF',
            borderRadius: '14px',
            padding: '1.25rem 2rem',
            marginBottom: '2.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <span style={{ background: '#FEE2E2', color: '#D90429', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '6px', letterSpacing: '0.05em' }}>
                  LOCKED PRACTICE SESSION • SESSION {sessionIdParam}
                </span>
                <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                  DIRECT EXPORT ACTIVE
                </span>
              </div>
              <div className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>
                {lockedTopicTitle || `Debate Session ${sessionIdParam}`}
              </div>
            </div>
            <Link
              href={`/dashboard/performance?session_id=${sessionIdParam}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: '#111827',
                background: '#F3F4F6',
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ← Return to Performance Breakdown
            </Link>
          </div>
        ) : (
          /* Interactive Session / Student Selector Box when not locked to a specific session */
          <div className="perf-interactive-box" style={{ background: '#FFF', borderRadius: '14px', padding: '1.5rem 2rem', marginBottom: '2.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                {isCoachOrEducator ? 'TARGET STUDENT / COHORT FOR EXPORT' : 'TARGET PRACTICE SESSION FOR EXPORT'}
              </label>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>
                {isCoachOrEducator 
                  ? 'Select an individual student from your enrolled roster or export the full classroom cohort audit:'
                  : 'Choose a specific debate or speech recording from your database history to generate report:'}
              </p>
            </div>
            <div style={{ minWidth: '320px', flex: 1 }}>
              {isCoachOrEducator ? (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #D1D5DB', borderRadius: '8px', background: '#F9FAFB', fontSize: '0.88rem', fontWeight: 600, color: '#111827', outline: 'none' }}
                >
                  <option value="all">All Enrolled Students (Classroom Cohort Master Audit)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email}) - Grade: {s.grade || 'A'} - Topic: {s.topic || 'General Practice'}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #D1D5DB', borderRadius: '8px', background: '#F9FAFB', fontSize: '0.88rem', fontWeight: 600, color: '#111827', outline: 'none' }}
                >
                  <option value="latest">Latest Completed Practice Session (Recommended)</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.topic || s.title} ({s.format}) - {s.score}%
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* 3 Primary Report Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
          
          {/* Report Card 1: Debate & Presentation PDF */}
          <div className="perf-interactive-box" style={{ padding: '2.2rem', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                {isCoachOrEducator ? 'COACH EVALUATOR ASSESSMENT' : 'DEBATE & SPEECH ANALYSIS REPORT'}
              </div>
              <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' }}>
                ASSESSMENT PDF REPORT
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#4B5563', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {isCoachOrEducator
                  ? 'Official instructor evaluation PDF featuring student scores, cohort rankings, logic gaps, and coach directives.'
                  : 'Official PDF certificate featuring your 5-weighted performance scores, acoustic speech cadence (WPM, filler word density), and simulation fallacy audit logs.'}
              </p>
            </div>
            <button 
              onClick={handleDownloadAssessmentPDF} 
              disabled={downloading === 'pdf'}
              className="btn btn-red" 
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', fontWeight: 700, borderRadius: '8px' }}
            >
              {downloading === 'pdf' ? 'GENERATING PDF REPORT...' : (isCoachOrEducator ? 'DOWNLOAD COACH ASSESSMENT (PDF) →' : 'DOWNLOAD ASSESSMENT (PDF) →')}
            </button>
          </div>

          {/* Report Card 2: Excel / CSV Metric Scores */}
          <div className="perf-interactive-box" style={{ padding: '2.2rem', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                {isCoachOrEducator ? 'COHORT PERFORMANCE MATRIX' : '5-WEIGHTED PERFORMANCE MATRIX'}
              </div>
              <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' }}>
                {isCoachOrEducator ? 'COACH EXCEL & CSV MATRIX' : 'EXCEL & CSV METRIC EXPORT'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#4B5563', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {isCoachOrEducator
                  ? 'Excel-ready dataset mapping student rosters, topics, grades, average scores, and individual rhetorical skill metrics.'
                  : 'Excel-ready dataset mapping your Argument Quality, Evidence, Logical Consistency, Rebuttal Effectiveness, and Speech Metrics.'}
              </p>
            </div>
            <button 
              onClick={handleDownloadExcel} 
              disabled={downloading === 'excel'}
              className="btn btn-dark" 
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', fontWeight: 700, borderRadius: '8px' }}
            >
              {downloading === 'excel' ? 'EXPORTING CSV DATA...' : (isCoachOrEducator ? 'EXPORT COACH CSV MATRIX →' : 'EXPORT EXCEL / CSV DATA →')}
            </button>
          </div>

          {/* Report Card 3: Coaching & Learning Progress */}
          <div className="perf-interactive-box" style={{ padding: '2.2rem', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="font-mono text-red" style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                {isCoachOrEducator ? 'COACH MASTER DIRECTIVES' : 'COACHING & LEARNING PROGRESS'}
              </div>
              <h3 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' }}>
                {isCoachOrEducator ? 'COACHING PLANS (PDF)' : 'COACHING & PLANS (PDF)'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#4B5563', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {isCoachOrEducator
                  ? 'Comprehensive instructional directives PDF detailing top class pain points, dispatched student recommendations, and curriculum milestones.'
                  : 'Comprehensive coaching plan PDF detailing your rhetorical skill gap analysis, personalized practice drills, dynamic learning milestones, and coach directives.'}
              </p>
            </div>
            <button 
              onClick={handleDownloadCoachingPDF} 
              disabled={downloading === 'coaching'}
              className="btn btn-dark" 
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', fontWeight: 700, borderRadius: '8px' }}
            >
              {downloading === 'coaching' ? 'GENERATING COACHING PLAN...' : (isCoachOrEducator ? 'EXPORT COACHING PLANS (PDF) →' : 'DOWNLOAD COACHING PLANS (PDF) →')}
            </button>
          </div>
        </div>

        {/* Executive Coach & Educator Section (Available for Coaches, Educators, and Admins) */}
        {isCoachOrEducator && (
          <div className="perf-interactive-box" style={{ background: '#111827', color: '#FFF', padding: '2.5rem 2rem', marginBottom: '2.5rem', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="font-mono text-red" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  INSTRUCTOR & COACHING PORTAL AUDIT
                </div>
                <h3 className="font-display" style={{ fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                  Classroom Cohort & Student Roster Audit
                </h3>
                <p style={{ color: '#ccc', fontSize: '0.88rem', marginTop: '0.4rem', maxWidth: '650px' }}>
                  Generate an executive report summarizing all enrolled students, their active debate topics, letter grades (A+, A, B+, etc.), session counts, and class pain points.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleDownloadRosterPDF}
                  disabled={downloading === 'roster_pdf'}
                  className="btn btn-red"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.825rem', cursor: 'pointer', fontWeight: 700, borderRadius: '8px' }}
                >
                  {downloading === 'roster_pdf' ? 'GENERATING ROSTER PDF...' : 'DOWNLOAD ROSTER (PDF) →'}
                </button>
                <button
                  onClick={handleDownloadRosterExcel}
                  disabled={downloading === 'roster_excel'}
                  className="btn btn-login"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.825rem', cursor: 'pointer', background: '#FFF', color: '#111827', fontWeight: 700, borderRadius: '8px' }}
                >
                  {downloading === 'roster_excel' ? 'EXPORTING ROSTER CSV...' : 'EXPORT ROSTER (CSV) →'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontWeight: 700, color: '#D90429' }}>LOADING REPORTS &amp; CERTIFICATES...</div>
      </div>
    }>
      <ReportsPageContent />
    </Suspense>
  );
}
