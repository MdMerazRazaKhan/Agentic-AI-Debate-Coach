from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from routers.auth import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models, schemas
import json
from time_utils import format_ist, to_ist

router = APIRouter(prefix="/api/v1/coaching", tags=["Recommendation & Coaching Engine"])


class CoachFeedbackRequest(BaseModel):
    student_id: int
    feedback: str
    grade: Optional[str] = None
    marks: Optional[float] = None
    session_id: Optional[int] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    improvement_suggestions: Optional[str] = None
    recommendations: Optional[str] = None


class RecommendationCreate(BaseModel):
    user_id: int
    title: str
    description: str
    skill_category: Optional[str] = "General"
    priority: Optional[str] = "Medium"
    status: Optional[str] = "Active"


class RecommendationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skill_category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class RecommendationStatusUpdate(BaseModel):
    status: str


@router.get("/plan/me", response_model=schemas.CoachingPlanResponse)
def get_my_coaching_plan(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_coaching_plan(current_user.id, current_user, db)


@router.get("/plan/{user_id}", response_model=schemas.CoachingPlanResponse)
def get_coaching_plan(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_id != current_user.id and current_user.role not in ["Debate Coach", "Educator", "Administrator"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your own coaching plan.")
    # 1. Fetch recent metrics to make recommendations dynamic
    p_metrics = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == user_id).order_by(models.PresentationMetric.id.desc()).limit(5).all()
    scores = db.query(models.PerformanceScore).filter(models.PerformanceScore.user_id == user_id).order_by(models.PerformanceScore.id.desc()).limit(5).all()
    
    # 2. Defaults if database is empty
    summary = "No recorded practice sessions found yet. Get started by initializing an AI simulation debate or voice prosody audit."
    recommendations = [
        "Initialize your first live AI debate simulation.",
        "Perform a vocal metrics speech analysis to check speaking speed (WPM).",
        "Select your experience level and goals in dashboard Profile Settings."
    ]
    path_steps = [
        "Step 1: Speech Pacing & Tone Audit (Upcoming)",
        "Step 2: Fallacy Shielding Exercises (Upcoming)",
        "Step 3: Advanced Refutation Drills (Upcoming)"
    ]
    status_str = "Level 0 - Novice"

    # 3. Dynamic Calculation if data exists
    if p_metrics or scores:
        rec_list = []
        path_list = []
        
        # Speaking pace WPM audit
        if p_metrics:
            avg_wpm = sum(m.speech_pace_wpm for m in p_metrics) / len(p_metrics)
            avg_fillers = sum(m.filler_words_count for m in p_metrics) / len(p_metrics)
            avg_clarity = sum(m.clarity_score for m in p_metrics) / len(p_metrics)
            
            if avg_wpm > 160:
                rec_list.append(f"Slow down speaking rate (average: {round(avg_wpm)} WPM). Target an optimal range of 130-150 WPM.")
                path_list.append("Module: Cadence & Pacing control (Active)")
            elif avg_wpm < 110:
                rec_list.append(f"Increase speaking rate (average: {round(avg_wpm)} WPM) to build a more dynamic, persuasive rhythm.")
                path_list.append("Module: Conversational Flow control (Active)")
            else:
                rec_list.append("Maintain your excellent speaking pace (130-160 WPM).")
                path_list.append("Module: Speech Cadence (Completed)")

            if avg_fillers > 3:
                rec_list.append(f"Perform pauses to eliminate filler words (average: {round(avg_fillers, 1)} fillers/turn).")
                path_list.append("Module: Filler Word Mitigation (Active)")
            else:
                rec_list.append("Excellent filler word control (less than 3 fillers per speech).")
                path_list.append("Module: Speech Clarity (Completed)")

        # Debate logic / score audit
        if scores:
            avg_overall = sum(s.overall_weighted_score for s in scores) / len(scores)
            avg_logic = sum(s.logical_consistency for s in scores) / len(scores)
            
            if avg_logic < 80:
                rec_list.append(f"Identify and remove logical fallacies (average logic rating: {round(avg_logic, 1)}%).")
                path_list.append("Module: Fallacy Shielding & Logic Auditing (Active)")
            else:
                rec_list.append("Strong logical reasoning. Practice building more structured claims.")
                path_list.append("Module: Fallacy Shielding (Completed)")
                
            if avg_overall >= 85:
                status_str = "Level 3 - Master Orator"
            elif avg_overall >= 70:
                status_str = "Level 2 - Competent Debater"
            else:
                status_str = "Level 1 - Novice Rhetorician"
        
        # Deduplicate paths and structure output
        summary = "Your metrics indicate solid progress. Focus on reducing filler words and refining logical transitions."
        recommendations = rec_list if rec_list else ["Keep up the great work! Try more advanced debate formats."]
        
        # Assemble standard path steps
        path_steps = list(dict.fromkeys(path_list))
        if len(path_steps) < 3:
            path_steps.append("Module: Advanced Parliamentary Refutation (Upcoming)")
            path_steps.append("Module: Socratic Cross-examination (Upcoming)")
            
    # 4. Calculate letter grade and evaluator standing
    all_scores = db.query(models.PerformanceScore.overall_weighted_score).filter(models.PerformanceScore.user_id == user_id).all()
    if all_scores:
        computed_avg = round(sum(s[0] for s in all_scores) / len(all_scores), 1)
    else:
        p_all = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == user_id).all()
        if p_all:
            computed_avg = round(sum((m.confidence_score + m.clarity_score) / 2 for m in p_all) / len(p_all), 1)
        else:
            total_user_sessions = db.query(models.DebateSession).filter(models.DebateSession.user_id == user_id).count()
            computed_avg = 85.0 if total_user_sessions > 0 else 0.0

    if computed_avg >= 90:
        computed_grade = "A+"
        standing_str = "Cohort Honor Roll // Top 5%"
    elif computed_avg >= 85:
        computed_grade = "A"
        standing_str = "Advanced Debater // Top 15%"
    elif computed_avg >= 80:
        computed_grade = "A-"
        standing_str = "Proficient Debater // Top 25%"
    elif computed_avg >= 75:
        computed_grade = "B+"
        standing_str = "Competent Rhetorician"
    elif computed_avg >= 70:
        computed_grade = "B"
        standing_str = "Developing Competitor"
    elif computed_avg >= 60:
        computed_grade = "C"
        standing_str = "Foundational Stage"
    elif computed_avg > 0:
        computed_grade = "D"
        standing_str = "Remedial Drills Recommended"
    else:
        computed_grade = "Pending"
        standing_str = "Pending Coach Evaluation"

    # Fetch existing plan if already saved in DB
    plan = db.query(models.CoachingPlan).filter(models.CoachingPlan.user_id == user_id).first()

    # Determine if an actual Debate Coach has officially graded this student
    has_coach_graded = (
        plan is not None 
        and plan.assigned_grade is not None 
        and plan.assigned_grade.strip() != "" 
        and plan.assigned_grade.strip().lower() != "pending"
    )

    if has_coach_graded:
        assigned_grade = plan.assigned_grade
        assigned_marks = round(float(plan.assigned_marks), 1) if plan.assigned_marks is not None else 0.0
        evaluator_name = plan.evaluator_name or "Debate Coach"
        evaluator_role = "Debate Coach & Evaluator"
        eval_status = "Assigned by Debate Coach"
        standing_str = (
            "Cohort Honor Roll // Top 5%" if assigned_grade.startswith("A") else
            "Competent Rhetorician" if assigned_grade.startswith("B") else
            "Developing Competitor" if assigned_grade.startswith("C") else "Foundational Stage"
        )
        last_graded_str = format_ist(plan.updated_at, "%Y-%m-%d %H:%M") if plan.updated_at else format_ist(datetime.utcnow(), "%Y-%m-%d %H:%M")
        
        # Fetch latest coach directive / feedback from Notification or Plan
        latest_coach_notif = (
            db.query(models.Notification)
            .filter(models.Notification.user_id == user_id, models.Notification.category == "Coach Feedback")
            .order_by(models.Notification.id.desc())
            .first()
        )
        coach_feedback_text = latest_coach_notif.message if latest_coach_notif else (
            plan.targeted_recommendations.split("\n")[0] if plan.targeted_recommendations else "Maintain structured rebuttal flow and focus on verifiable evidence."
        )
    else:
        assigned_grade = "Pending"
        assigned_marks = None
        evaluator_name = None
        evaluator_role = None
        eval_status = "Pending Coach Assessment"
        standing_str = "Pending Assessment"
        last_graded_str = None
        coach_feedback_text = "Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here."

    # 5. Build structured Debate Recommendations, Presentation Suggestions, and Skill Development Plans
    avg_wpm_val = round(sum(m.speech_pace_wpm for m in p_metrics) / len(p_metrics), 1) if p_metrics else 142.0
    avg_fillers_val = round(sum(m.filler_words_count for m in p_metrics) / len(p_metrics), 1) if p_metrics else 2.5
    avg_clarity_val = round(sum(m.clarity_score for m in p_metrics) / len(p_metrics), 1) if p_metrics else 88.0

    debate_recs = [
        {
            "id": "deb-1",
            "title": "Logical Rebuttal Structuring",
            "category": "Debate Strategy",
            "priority": "High" if (scores and any(s.logical_consistency < 75 for s in scores)) else "Medium",
            "description": "Formulate 3-tier rebuttals (Claim, Evidence, Warrant) to preempt counterattacks effectively.",
            "drill": "Practice with Toulmin Refutation Drills in Debate Simulation"
        },
        {
            "id": "deb-2",
            "title": "Fallacy Shielding & Preemption",
            "category": "Argument Analysis",
            "priority": "High",
            "description": "Identify and counteract subtle Straw Man and Red Herring pivots prior to speech conclusion.",
            "drill": "Complete 5 Fallacy Detection audit sessions"
        },
        {
            "id": "deb-3",
            "title": "Cross-Examination Assertiveness",
            "category": "Debate Tactics",
            "priority": "Medium",
            "description": "Maintain tactical control during cross-examination by answering concisely without conceding key arguments.",
            "drill": "Run Socratic Cross-examination drill against Aggressive Challenger"
        }
    ]

    presentation_suggs = [
        {
            "id": "pres-1",
            "aspect": "Speaking Pace & Cadence",
            "current_stat": f"{avg_wpm_val} WPM",
            "target_stat": "130 - 155 WPM",
            "status": "Optimal" if 125 <= avg_wpm_val <= 160 else "Needs Moderation",
            "suggestion": "Moderate cadence during statistical citations to maximize audience retention." if avg_wpm_val > 155 else "Pacing is well-controlled. Maintain steady cadence across complex points."
        },
        {
            "id": "pres-2",
            "aspect": "Filler Word Mitigation",
            "current_stat": f"{avg_fillers_val} per speech",
            "target_stat": "< 2 per speech",
            "status": "Optimal" if avg_fillers_val <= 2 else "Needs Attention",
            "suggestion": "Replace verbal hesitations ('um', 'ah', 'like') with purposeful 1.5-second pauses."
        },
        {
            "id": "pres-3",
            "aspect": "Vocal Clarity & Projection",
            "current_stat": f"{avg_clarity_val}%",
            "target_stat": "> 85%",
            "status": "Optimal" if avg_clarity_val >= 85 else "Needs Attention",
            "suggestion": "Emphasize pivotal transition phrases to maximize audience engagement and clarity."
        }
    ]

    skill_plans = [
        {
            "skill": "Argument Structure & Toulmin Framing",
            "level": "Proficient" if computed_avg >= 80 else "Intermediate",
            "progress": min(100, max(20, int(computed_avg if computed_avg > 0 else 75))),
            "focus_areas": ["Data warranting", "Rebuttal preemption", "Impact framing"]
        },
        {
            "skill": "Vocal Delivery & Delivery Dynamics",
            "level": "Advanced" if (p_metrics and avg_fillers_val < 3) else "Intermediate",
            "progress": min(100, max(25, int(avg_clarity_val if p_metrics else 82))),
            "focus_areas": ["Pacing control", "Pause placement", "Intonation modulation"]
        },
        {
            "skill": "Logical Fallacy Resilience",
            "level": "Proficient",
            "progress": 85 if computed_avg >= 80 else 70,
            "focus_areas": ["Circular reasoning detection", "Straw man refutation", "Ad hominem redirection"]
        },
        {
            "skill": "Cross-Examination & Rebuttal Speed",
            "level": "Intermediate",
            "progress": 72,
            "focus_areas": ["Direct answer brevity", "Counter-question framing", "Closing synthesis"]
        }
    ]

    return {
        "user_id": user_id,
        "skill_gap_summary": summary,
        "targeted_recommendations": recommendations,
        "learning_path_steps": path_steps,
        "progress_status": status_str,
        "assigned_grade": assigned_grade,
        "assigned_marks": assigned_marks,
        "evaluator_name": evaluator_name,
        "evaluator_role": evaluator_role,
        "evaluation_status": eval_status,
        "standing": standing_str,
        "coach_feedback": coach_feedback_text,
        "last_graded_at": last_graded_str,
        "debate_recommendations": debate_recs,
        "presentation_suggestions": presentation_suggs,
        "skill_development_plans": skill_plans
    }


@router.get("/coach/overview")
def get_coach_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Total student count (learners / non-coaches)
    students = db.query(models.User).filter(
        models.User.id != current_user.id,
        models.User.role != "Debate Coach",
        models.User.role != "Administrator"
    ).all()
    if not students:
        students = db.query(models.User).filter(models.User.id != current_user.id).all()
    total_students = len(students)
    
    # 2. Average class score from all PerformanceScores in database
    all_scores = db.query(models.PerformanceScore.overall_weighted_score).all()
    if all_scores:
        avg_score = round(sum(s[0] for s in all_scores) / len(all_scores), 1)
    else:
        avg_score = 85.0
        
    # 3. Pending / Active evaluations
    pending_count = db.query(models.DebateSession).filter(models.DebateSession.status == "Active").count()
    
    # 4. Compute top class pain points from actual database records
    pain_points = []
    
    # Fallacy frequency check
    fallacy_counts = {}
    turns = db.query(models.SimulationTurn.fallacies_json).all()
    for t in turns:
        try:
            f_list = json.loads(t[0]) if isinstance(t[0], str) else t[0]
            if isinstance(f_list, list):
                for f_item in f_list:
                    name = f_item if isinstance(f_item, str) else f_item.get("fallacy_type", "Fallacy")
                    fallacy_counts[name] = fallacy_counts.get(name, 0) + 1
        except Exception:
            pass
            
    if fallacy_counts:
        top_fallacy = max(fallacy_counts, key=fallacy_counts.get)
        pain_points.append(f"{top_fallacy} fallacies flagged in {fallacy_counts[top_fallacy]} debate turns across student transcripts.")
    else:
        pain_points.append("Logical consistency remains steady across recent debate transcripts.")
        
    # WPM / Cadence check
    p_metrics = db.query(models.PresentationMetric.speech_pace_wpm, models.PresentationMetric.filler_words_count).all()
    if p_metrics:
        avg_wpm = round(sum(m[0] for m in p_metrics) / len(p_metrics), 1)
        avg_fill = round(sum(m[1] for m in p_metrics) / len(p_metrics), 1)
        if avg_wpm > 155:
            pain_points.append(f"Average speaking pace is high ({avg_wpm} WPM). Students need cadence moderation exercises.")
        elif avg_wpm < 120:
            pain_points.append(f"Speaking pace is cautious ({avg_wpm} WPM). Students can increase assertiveness and rhythm.")
        else:
            pain_points.append(f"Classroom speaking cadence is well-balanced at an average of {avg_wpm} WPM.")
            
        if avg_fill > 2:
            pain_points.append(f"Average vocal pause filler density: {avg_fill} filler words per speech turn.")
    else:
        pain_points.append("Students are encouraged to record speeches in the Vocal Matrix studio to evaluate speaking cadence.")

    return {
        "assigned_students": total_students,
        "class_performance_average": avg_score,
        "pending_evaluations": pending_count,
        "system_status": "100% ONLINE",
        "top_class_pain_points": pain_points
    }


@router.get("/coach/students")
def get_coach_students(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Query all students / learners
    users = db.query(models.User).filter(
        models.User.id != current_user.id,
        models.User.role != "Debate Coach",
        models.User.role != "Administrator"
    ).order_by(models.User.id.desc()).all()
    if not users:
        users = db.query(models.User).filter(models.User.id != current_user.id).order_by(models.User.id.desc()).all()
    
    student_roster = []
    for u in users:
        # Find latest session
        latest_session = db.query(models.DebateSession).filter(models.DebateSession.user_id == u.id).order_by(models.DebateSession.id.desc()).first()
        total_sessions = db.query(models.DebateSession).filter(models.DebateSession.user_id == u.id).count()
        
        # Calculate real average score
        scores = db.query(models.PerformanceScore.overall_weighted_score).filter(models.PerformanceScore.user_id == u.id).all()
        if scores:
            avg_score = round(sum(s[0] for s in scores) / len(scores), 1)
        else:
            # Check presentation metrics
            p_metrics = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == u.id).all()
            if p_metrics:
                avg_score = round(sum((m.confidence_score + m.clarity_score) / 2 for m in p_metrics) / len(p_metrics), 1)
            else:
                avg_score = 0.0
        top_gap = "None Detected"
        user_turn = db.query(models.SimulationTurn).filter(models.SimulationTurn.user_id == u.id).order_by(models.SimulationTurn.id.desc()).first()
        if user_turn and user_turn.fallacies_json:
            try:
                f_list = json.loads(user_turn.fallacies_json)
                if isinstance(f_list, list) and len(f_list) > 0:
                    top_gap = f_list[0] if isinstance(f_list[0], str) else f_list[0].get("fallacy_type", "Straw Man")
            except Exception:
                pass
                
        if top_gap == "None Detected":
            latest_metric = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == u.id).order_by(models.PresentationMetric.id.desc()).first()
            if latest_metric:
                if latest_metric.speech_pace_wpm > 165:
                    top_gap = "Fast Pacing (>165 WPM)"
                elif latest_metric.filler_words_count > 3:
                    top_gap = "Filler Pauses"
                else:
                    top_gap = "Solid Consistency"
            else:
                top_gap = "No Sessions Yet"
                
        # Check if coach explicitly assigned a grade/marks in CoachingPlan
        user_plan = db.query(models.CoachingPlan).filter(models.CoachingPlan.user_id == u.id).first()
        if user_plan and user_plan.assigned_grade and user_plan.assigned_grade.strip().lower() != "pending":
            grade = user_plan.assigned_grade
            if user_plan.assigned_marks is not None:
                avg_score = round(user_plan.assigned_marks, 1)
        else:
            grade = "Pending"

        # Collect all sessions for this student
        user_sessions = db.query(models.DebateSession).filter(models.DebateSession.user_id == u.id).order_by(models.DebateSession.id.desc()).all()
        sessions_list = []
        debate_count = 0
        presentation_count = 0
        pending_feedback_count = 0
        completed_feedback_count = 0

        for s_item in user_sessions:
            s_perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == s_item.id).first()
            s_metric = db.query(models.PresentationMetric).filter(models.PresentationMetric.session_id == s_item.id).first()
            s_sim = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == s_item.id).first()

            fmt = (s_item.format or "").strip()
            is_pres = bool(
                fmt in ["Vocal Matrix", "Presentation Analysis", "Presentation", "Speech Analysis"] or
                (s_metric is not None and not s_sim)
            )
            if is_pres:
                presentation_count += 1
                sess_type = "Presentation Analysis"
            else:
                debate_count += 1
                sess_type = "Debate"

            c_grade = s_perf.coach_grade if (s_perf and s_perf.coach_grade and s_perf.coach_grade.strip().lower() != "pending") else "Pending"
            c_marks = s_perf.coach_marks if (s_perf and s_perf.coach_marks is not None) else None
            c_feedback = s_perf.coach_feedback if (s_perf and s_perf.coach_feedback) else None

            is_completed = bool(
                (s_perf and s_perf.feedback_status == "Completed") or
                (c_grade != "Pending") or
                (c_marks is not None) or
                (c_feedback and "Official evaluation pending" not in c_feedback and c_feedback.strip() != "")
            )
            fb_status = "Completed" if is_completed else "Pending"
            if fb_status == "Completed":
                completed_feedback_count += 1
            else:
                pending_feedback_count += 1

            sessions_list.append({
                "id": s_item.id,
                "topic": s_item.topic,
                "format": s_item.format,
                "position": s_item.assigned_position,
                "session_type": sess_type,
                "score": round(s_perf.overall_weighted_score, 1) if (s_perf and s_perf.overall_weighted_score) else 85.0,
                "date": s_item.created_at.strftime("%Y-%m-%d %H:%M") if s_item.created_at else "Recent",
                "coach_grade": c_grade,
                "coach_marks": c_marks,
                "coach_feedback": c_feedback,
                "feedback_status": fb_status
            })

        student_roster.append({
            "id": u.id,
            "name": u.full_name or u.email.split("@")[0],
            "email": u.email,
            "topic": latest_session.topic if latest_session else "No Active Debate",
            "format": latest_session.format if latest_session else "N/A",
            "latest_session_id": latest_session.id if latest_session else None,
            "total_sessions": total_sessions,
            "debate_count": debate_count,
            "presentation_count": presentation_count,
            "pending_feedback_count": pending_feedback_count,
            "completed_feedback_count": completed_feedback_count,
            "grade": grade,
            "score": avg_score,
            "gap": top_gap,
            "experience": u.experience_level,
            "last_active": latest_session.created_at.strftime("%Y-%m-%d %H:%M") if latest_session else u.created_at.strftime("%Y-%m-%d"),
            "sessions": sessions_list
        })
        
    return student_roster


@router.post("/coach/feedback")
def send_coach_feedback(payload: CoachFeedbackRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    coach_name = current_user.full_name or "Debate Coach"

    # Compute default marks/grade if not explicitly supplied
    if payload.grade:
        assigned_grade = payload.grade.strip().upper()
    else:
        scores = db.query(models.PerformanceScore.overall_weighted_score).filter(models.PerformanceScore.user_id == payload.student_id).all()
        avg_score = sum(s[0] for s in scores) / len(scores) if scores else 85.0
        assigned_grade = "A+" if avg_score >= 90 else "A" if avg_score >= 85 else "B+" if avg_score >= 75 else "B" if avg_score >= 70 else "C"

    if payload.marks is not None:
        assigned_marks = round(float(payload.marks), 1)
    else:
        scores = db.query(models.PerformanceScore.overall_weighted_score).filter(models.PerformanceScore.user_id == payload.student_id).all()
        assigned_marks = round(sum(s[0] for s in scores) / len(scores), 1) if scores else 85.0

    # 1. Create a persistent notification for the student
    notification = models.Notification(
        user_id=payload.student_id,
        category="Coach Feedback",
        title=f"Grade {assigned_grade} & Directive Assigned by Coach {coach_name}",
        message=f"Official Grade: {assigned_grade} ({assigned_marks}%). Evaluator Feedback: {payload.feedback}",
        read=False
    )
    db.add(notification)
    
    # 2. Update student's coaching plan
    plan = db.query(models.CoachingPlan).filter(models.CoachingPlan.user_id == payload.student_id).first()
    if plan:
        existing_recs = plan.targeted_recommendations or ""
        plan.targeted_recommendations = f"{payload.feedback}\n{existing_recs}"
        plan.assigned_grade = assigned_grade
        plan.assigned_marks = assigned_marks
        plan.evaluator_name = coach_name
        plan.evaluator_id = current_user.id
        plan.skill_gap_summary = f"Directive from Coach {coach_name}: {payload.feedback}"
        plan.updated_at = datetime.utcnow()
    else:
        new_plan = models.CoachingPlan(
            user_id=payload.student_id,
            skill_gap_summary=f"Feedback from Coach {coach_name}: {payload.feedback}",
            targeted_recommendations=payload.feedback,
            learning_path_steps="Coach Directed Drill (Active)",
            progress_status="Under Active Mentorship",
            assigned_grade=assigned_grade,
            assigned_marks=assigned_marks,
            evaluator_name=coach_name,
            evaluator_id=current_user.id,
            updated_at=datetime.utcnow()
        )
        db.add(new_plan)

    # 3. Update the specific debate session or student's latest debate session PerformanceScore
    target_sessions = []
    if payload.session_id and payload.session_id > 0:
        s_target = db.query(models.DebateSession).filter(models.DebateSession.id == payload.session_id).first()
        if s_target:
            target_sessions.append(s_target)
    elif payload.session_id == -1:
        # All sessions for this student
        target_sessions = db.query(models.DebateSession).filter(models.DebateSession.user_id == payload.student_id).all()
    else:
        # Latest session for this student
        latest_s = db.query(models.DebateSession).filter(models.DebateSession.user_id == payload.student_id).order_by(models.DebateSession.id.desc()).first()
        if latest_s:
            target_sessions.append(latest_s)

    for sess in target_sessions:
        perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == sess.id).first()
        if not perf:
            perf = models.PerformanceScore(
                session_id=sess.id,
                user_id=sess.user_id,
                overall_weighted_score=assigned_marks,
                logical_consistency=85.0,
                argument_quality=85.0,
                rebuttal_effectiveness=85.0,
                evidence_use=85.0,
                communication_skills=85.0,
                ai_feedback="AI feedback archived.",
                created_at=datetime.utcnow()
            )
            db.add(perf)
        perf.coach_grade = assigned_grade
        perf.coach_marks = assigned_marks
        perf.coach_feedback = payload.feedback
        perf.coach_strengths = payload.strengths
        perf.coach_weaknesses = payload.weaknesses
        perf.coach_improvements = payload.improvement_suggestions
        perf.coach_recommendations = payload.recommendations
        perf.feedback_status = "Completed"

    # If specific coaching recommendations were provided, also record in CoachRecommendation
    if payload.recommendations and payload.recommendations.strip():
        rec_entry = models.CoachRecommendation(
            user_id=payload.student_id,
            coach_id=current_user.id,
            title="Coach Directive",
            description=payload.recommendations.strip(),
            skill_category="Coach Assessment",
            priority="High",
            status="Active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(rec_entry)
        
    db.commit()
    
    return {
        "status": "success",
        "feedback_status": "Completed",
        "assigned_grade": assigned_grade,
        "assigned_marks": assigned_marks,
        "evaluator_name": coach_name,
        "target_sessions_evaluated": len(target_sessions),
        "message": f"Official Grade ({assigned_grade}) and coaching directive successfully dispatched to {student.full_name or student.email}!"
    }


@router.get("/coach-grade/me", response_model=schemas.CoachGradeEvaluationResponse)
def get_my_coach_grade(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan_data = get_coaching_plan(current_user.id, current_user, db)
    total_sessions = db.query(models.DebateSession).filter(models.DebateSession.user_id == current_user.id).count()

    return {
        "user_id": current_user.id,
        "student_name": current_user.full_name or current_user.email.split("@")[0],
        "student_email": current_user.email,
        "grade": plan_data.get("assigned_grade") or "Pending",
        "marks": plan_data.get("assigned_marks"),
        "evaluator_name": plan_data.get("evaluator_name"),
        "evaluator_role": plan_data.get("evaluator_role"),
        "coach_feedback": plan_data.get("coach_feedback"),
        "evaluation_status": plan_data.get("evaluation_status") or "Pending Coach Evaluation",
        "standing": plan_data.get("standing") or "Pending Assessment",
        "total_sessions": total_sessions,
        "assessed_at": plan_data.get("last_graded_at")
    }


@router.get("/skill-gap-analysis/{user_id}")
def get_skill_gap_analysis(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Provides a deterministic, multi-source Skill Gap Analysis across 13 core rhetorical competencies."""
    if user_id != current_user.id and current_user.role not in ["Debate Coach", "Educator", "Administrator"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    student = db.query(models.User).filter(models.User.id == user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    scores = db.query(models.PerformanceScore).filter(models.PerformanceScore.user_id == user_id).all()
    metrics = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == user_id).all()
    sim_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.user_id == user_id).all()
    arg_analyses = db.query(models.ArgumentAnalysis).filter(models.ArgumentAnalysis.user_id == user_id).all()
    fallacy_logs = db.query(models.FallacyLog).filter(models.FallacyLog.user_id == user_id).all()
    counterargs = db.query(models.Counterargument).join(models.ArgumentAnalysis).filter(models.ArgumentAnalysis.user_id == user_id).all()

    # Tally fallacies from turns as well
    turn_fallacies_count = 0
    for st in sim_turns:
        try:
            fl = json.loads(st.fallacies_json) if isinstance(st.fallacies_json, str) else st.fallacies_json
            if isinstance(fl, list):
                turn_fallacies_count += len(fl)
        except Exception:
            pass
    total_fallacies = len(fallacy_logs) + turn_fallacies_count

    # 1. Argument Structure
    if arg_analyses:
        arg_struct_val = round(sum(a.persuasiveness_score + a.reasoning_quality for a in arg_analyses) / (2 * len(arg_analyses)), 1)
    elif scores:
        arg_struct_val = round(sum(s.argument_quality for s in scores) / len(scores), 1)
    else:
        arg_struct_val = 82.0

    # 2. Logical Reasoning
    if scores:
        logic_val = round(sum(s.logical_consistency for s in scores) / len(scores), 1)
    elif arg_analyses:
        logic_val = round(sum(a.logical_consistency for a in arg_analyses) / len(arg_analyses), 1)
    else:
        logic_val = max(50.0, 100.0 - total_fallacies * 10.0)

    # 3. Evidence Usage
    if scores:
        evid_val = round(sum(s.evidence_use for s in scores) / len(scores), 1)
    elif arg_analyses:
        evid_val = round(sum(a.evidence_strength for a in arg_analyses) / len(arg_analyses), 1)
    else:
        evid_val = 78.0

    # 4. Rebuttal
    if sim_turns:
        rebut_val = round(sum(st.rebuttal_strength_percent for st in sim_turns) / len(sim_turns), 1)
    elif scores:
        rebut_val = round(sum(s.rebuttal_effectiveness for s in scores) / len(scores), 1)
    else:
        rebut_val = 80.0

    # 5. Counter Argument
    ca_bonus = min(20.0, len(counterargs) * 3.0)
    counter_val = round(min(98.0, 75.0 + ca_bonus), 1) if counterargs else (round(rebut_val * 0.95, 1) if rebut_val else 76.0)

    # 6. Fallacy Awareness
    fallacy_aware_val = max(40.0, round(100.0 - total_fallacies * 8.0, 1))

    # 7. Speaking Pace
    if metrics:
        avg_wpm = sum(m.speech_pace_wpm for m in metrics) / len(metrics)
        if 130 <= avg_wpm <= 155:
            pace_val = 94.0
        elif 115 <= avg_wpm < 130 or 155 < avg_wpm <= 170:
            pace_val = 78.0
        else:
            pace_val = 62.0
    else:
        avg_wpm = 142.0
        pace_val = 88.0

    # 8. Clarity
    if metrics:
        clarity_val = round(sum(m.clarity_score for m in metrics) / len(metrics), 1)
    elif arg_analyses:
        clarity_val = round(sum(a.clarity_score for a in arg_analyses) / len(arg_analyses), 1)
    else:
        clarity_val = 85.0

    # 9. Confidence
    if metrics:
        conf_val = round(sum(m.confidence_score for m in metrics) / len(metrics), 1)
    else:
        conf_val = 84.0

    # 10. Engagement
    if metrics:
        engage_val = round(sum(m.engagement_score for m in metrics) / len(metrics), 1)
    else:
        engage_val = 80.0

    # 11. Delivery
    deliv_val = round((conf_val * 0.4 + clarity_val * 0.4 + pace_val * 0.2), 1)

    # 12. Vocabulary
    if metrics:
        avg_fillers = sum(m.filler_words_count for m in metrics) / len(metrics)
        vocab_val = max(45.0, round(100.0 - avg_fillers * 8.0, 1))
    else:
        avg_fillers = 1.0
        vocab_val = 88.0

    # 13. Overall Communication
    if scores:
        comms_val = round(sum(s.communication_skills for s in scores) / len(scores), 1)
    else:
        comms_val = round((clarity_val + conf_val + engage_val) / 3.0, 1)

    def classify(val):
        if val >= 85.0:
            return "Strong", "Advanced", "#059669"
        elif val >= 72.0:
            return "Moderate", "Proficient", "#3B82F6"
        else:
            return "Needs Improvement", "Developing", "#DC2626"

    categories = [
        {
            "id": "arg_struct",
            "name": "Argument Structure",
            "score": arg_struct_val,
            "status": classify(arg_struct_val)[0],
            "level": classify(arg_struct_val)[1],
            "color": classify(arg_struct_val)[2],
            "historical_basis": f"Calculated from {len(arg_analyses) or len(scores) or 1} recorded syllogism audits (avg rating {arg_struct_val}%).",
            "recommendation": "Formulate 3-tier assertions (Claim, Warrant, Evidence) to ensure watertight structural integrity."
        },
        {
            "id": "logic_reason",
            "name": "Logical Reasoning",
            "score": logic_val,
            "status": classify(logic_val)[0],
            "level": classify(logic_val)[1],
            "color": classify(logic_val)[2],
            "historical_basis": f"Evaluated across debate rounds; {total_fallacies} fallacy trap(s) flagged historically.",
            "recommendation": "Identify and eliminate subtle non-sequitur transitions before delivering concluding claims."
        },
        {
            "id": "evidence_usage",
            "name": "Evidence Usage",
            "score": evid_val,
            "status": classify(evid_val)[0],
            "level": classify(evid_val)[1],
            "color": classify(evid_val)[2],
            "historical_basis": f"Empirical citation score is {evid_val}% across recent practice contentions.",
            "recommendation": "Anchor key contentions with verifiable empirical benchmarks and peer-reviewed statistics."
        },
        {
            "id": "rebuttal",
            "name": "Rebuttal",
            "score": rebut_val,
            "status": classify(rebut_val)[0],
            "level": classify(rebut_val)[1],
            "color": classify(rebut_val)[2],
            "historical_basis": f"Average refutation leverage: {rebut_val}% across {len(sim_turns) or len(scores) or 1} debate turns.",
            "recommendation": "Use 3-part refutation to neutralize the opponent's underlying mechanism rather than just their conclusion."
        },
        {
            "id": "counter_arg",
            "name": "Counter Argument",
            "score": counter_val,
            "status": classify(counter_val)[0],
            "level": classify(counter_val)[1],
            "color": classify(counter_val)[2],
            "historical_basis": f"{len(counterargs)} distinct counterargument patterns generated and addressed.",
            "recommendation": "Anticipate the opponent's strongest 2 objections in advance using preemption frames."
        },
        {
            "id": "fallacy_aware",
            "name": "Fallacy Awareness",
            "score": fallacy_aware_val,
            "status": classify(fallacy_aware_val)[0],
            "level": classify(fallacy_aware_val)[1],
            "color": classify(fallacy_aware_val)[2],
            "historical_basis": f"{total_fallacies} total fallacies flagged across transcripts.",
            "recommendation": "Practice detecting Straw Man and Circular Logic vulnerabilities during cross-examination."
        },
        {
            "id": "speaking_pace",
            "name": "Speaking Pace",
            "score": pace_val,
            "status": classify(pace_val)[0],
            "level": classify(pace_val)[1],
            "color": classify(pace_val)[2],
            "historical_basis": f"Current average speaking pace is {round(avg_wpm)} WPM (ideal benchmark: 130-155 WPM).",
            "recommendation": "Calibrate speech cadence using structured metronome pacing drills."
        },
        {
            "id": "clarity",
            "name": "Clarity",
            "score": clarity_val,
            "status": classify(clarity_val)[0],
            "level": classify(clarity_val)[1],
            "color": classify(clarity_val)[2],
            "historical_basis": f"Acoustic and deductive clarity averaged at {clarity_val}%.",
            "recommendation": "Emphasize pivotal transition signposts to maximize adjudicator comprehension."
        },
        {
            "id": "confidence",
            "name": "Confidence",
            "score": conf_val,
            "status": classify(conf_val)[0],
            "level": classify(conf_val)[1],
            "color": classify(conf_val)[2],
            "historical_basis": f"Vocal presence rating: {conf_val}% across recorded prosody audits.",
            "recommendation": "Maintain firm vocal projection and avoid rising inflection at the end of assertions."
        },
        {
            "id": "engagement",
            "name": "Engagement",
            "score": engage_val,
            "status": classify(engage_val)[0],
            "level": classify(engage_val)[1],
            "color": classify(engage_val)[2],
            "historical_basis": f"Audience engagement index: {engage_val}%.",
            "recommendation": "Incorporate rhetorical questions, varied vocal intonation, and comparative impact weighing."
        },
        {
            "id": "delivery",
            "name": "Delivery",
            "score": deliv_val,
            "status": classify(deliv_val)[0],
            "level": classify(deliv_val)[1],
            "color": classify(deliv_val)[2],
            "historical_basis": f"Composite prosody delivery metric: {deliv_val}%.",
            "recommendation": "Integrate strategic 1.5-second pauses after key warrants to allow arguments to resonate."
        },
        {
            "id": "vocabulary",
            "name": "Vocabulary",
            "score": vocab_val,
            "status": classify(vocab_val)[0],
            "level": classify(vocab_val)[1],
            "color": classify(vocab_val)[2],
            "historical_basis": f"Verbal hesitation density: {round(avg_fillers, 1)} filler word(s) per turn.",
            "recommendation": "Apply the 'Silent Pause Technique' to replace verbal crutches ('um', 'like') with confident pauses."
        },
        {
            "id": "overall_comms",
            "name": "Overall Communication",
            "score": comms_val,
            "status": classify(comms_val)[0],
            "level": classify(comms_val)[1],
            "color": classify(comms_val)[2],
            "historical_basis": f"Holistic communication rating: {comms_val}%.",
            "recommendation": "Synthesize debate mechanics with presentation poise for high-impact advocacy."
        }
    ]

    needs_improvement = [c for c in categories if c["status"] == "Needs Improvement"]
    strong = [c for c in categories if c["status"] == "Strong"]
    moderate = [c for c in categories if c["status"] == "Moderate"]
    avg_total = round(sum(c["score"] for c in categories) / len(categories), 1)

    return {
        "user_id": user_id,
        "student_name": student.full_name or student.email.split("@")[0],
        "student_email": student.email,
        "average_skill_score": avg_total,
        "total_categories": len(categories),
        "needs_improvement_count": len(needs_improvement),
        "moderate_count": len(moderate),
        "strong_count": len(strong),
        "categories": categories,
        "top_gaps": sorted(needs_improvement or moderate, key=lambda x: x["score"])[:3],
        "top_strengths": sorted(strong or moderate, key=lambda x: x["score"], reverse=True)[:3],
        "audit_timestamp": format_ist(datetime.utcnow(), "%Y-%m-%d %H:%M IST")
    }


@router.get("/recommendations/{user_id}")
def get_coaching_recommendations(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetches all coaching recommendations for a student, generating AI suggestions if empty."""
    recs = db.query(models.CoachRecommendation).filter(models.CoachRecommendation.user_id == user_id).order_by(models.CoachRecommendation.created_at.desc()).all()
    
    if not recs:
        p_metrics = db.query(models.PresentationMetric).filter(models.PresentationMetric.user_id == user_id).all()
        avg_wpm = (sum(m.speech_pace_wpm for m in p_metrics) / len(p_metrics)) if p_metrics else 142.0
        
        defaults = [
            models.CoachRecommendation(
                user_id=user_id,
                coach_id=current_user.id,
                title="Improve Rebuttal Skills",
                description="Practice responding to opposing arguments within 30–45 seconds using the Claim-Warrant-Impact refutation model.",
                skill_category="Rebuttal",
                priority="High",
                status="Active"
            ),
            models.CoachRecommendation(
                user_id=user_id,
                coach_id=current_user.id,
                title="Improve Speaking Pace" if avg_wpm > 155 else "Pacing Cadence Maintenance",
                description="Reduce speaking speed to 130–150 WPM and maintain consistent pauses after citing major empirical statistics." if avg_wpm > 155 else "Maintain deliberate 130-155 WPM speaking cadence across complex parliamentary arguments.",
                skill_category="Speaking Pace",
                priority="High" if avg_wpm > 155 else "Medium",
                status="In Progress"
            ),
            models.CoachRecommendation(
                user_id=user_id,
                coach_id=current_user.id,
                title="Improve Evidence Usage",
                description="Support major claims with at least one verifiable example, peer-reviewed statistic, or regulatory benchmark per contention.",
                skill_category="Evidence Usage",
                priority="Medium",
                status="Active"
            )
        ]
        for d in defaults:
            db.add(d)
        db.commit()
        recs = db.query(models.CoachRecommendation).filter(models.CoachRecommendation.user_id == user_id).order_by(models.CoachRecommendation.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "coach_id": r.coach_id,
            "title": r.title,
            "description": r.description,
            "skill_category": r.skill_category,
            "priority": r.priority,
            "status": r.status,
            "created_at": format_ist(r.created_at, "%Y-%m-%d %H:%M"),
            "updated_at": format_ist(r.updated_at, "%Y-%m-%d %H:%M")
        }
        for r in recs
    ]


@router.post("/recommendations")
def create_recommendation(
    payload: RecommendationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    rec = models.CoachRecommendation(
        user_id=payload.user_id,
        coach_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        skill_category=payload.skill_category or "General",
        priority=payload.priority or "Medium",
        status=payload.status or "Active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(rec)
    
    coach_name = current_user.full_name or "Debate Coach"
    notif = models.Notification(
        user_id=payload.user_id,
        category="Coaching",
        title=f"New Recommendation: {payload.title}",
        message=f"Coach {coach_name} assigned a new practice directive: {payload.description}",
        read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(rec)
    
    return {
        "status": "success",
        "message": f"Recommendation '{rec.title}' created and dispatched to student.",
        "recommendation": {
            "id": rec.id,
            "user_id": rec.user_id,
            "title": rec.title,
            "description": rec.description,
            "skill_category": rec.skill_category,
            "priority": rec.priority,
            "status": rec.status,
            "created_at": format_ist(rec.created_at, "%Y-%m-%d %H:%M")
        }
    }


@router.put("/recommendations/{rec_id}")
def update_recommendation(
    rec_id: int,
    payload: RecommendationUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(models.CoachRecommendation).filter(models.CoachRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    
    if payload.title is not None:
        rec.title = payload.title.strip()
    if payload.description is not None:
        rec.description = payload.description.strip()
    if payload.skill_category is not None:
        rec.skill_category = payload.skill_category.strip()
    if payload.priority is not None:
        rec.priority = payload.priority.strip()
    if payload.status is not None:
        rec.status = payload.status.strip()
        
    rec.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    
    return {
        "status": "success",
        "message": f"Recommendation #{rec_id} updated.",
        "recommendation": {
            "id": rec.id,
            "user_id": rec.user_id,
            "title": rec.title,
            "description": rec.description,
            "skill_category": rec.skill_category,
            "priority": rec.priority,
            "status": rec.status,
            "updated_at": format_ist(rec.updated_at, "%Y-%m-%d %H:%M")
        }
    }


@router.delete("/recommendations/{rec_id}")
def delete_recommendation(
    rec_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(models.CoachRecommendation).filter(models.CoachRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    db.delete(rec)
    db.commit()
    return {"status": "success", "message": f"Recommendation #{rec_id} deleted."}


@router.patch("/recommendations/{rec_id}/status")
def update_recommendation_status(
    rec_id: int,
    payload: RecommendationStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(models.CoachRecommendation).filter(models.CoachRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    rec.status = payload.status.strip()
    rec.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return {
        "status": "success",
        "message": f"Status updated to '{rec.status}'.",
        "id": rec.id,
        "new_status": rec.status
    }


@router.get("/coach/evaluations")
def get_coach_evaluations(
    student_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, description="'Pending', 'Completed', or None"),
    session_type: Optional[str] = Query(None, description="'Debate', 'Presentation', or None"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all student sessions for the coach, showing feedback status (Pending vs Completed)."""
    query = db.query(models.DebateSession)
    if student_id:
        query = query.filter(models.DebateSession.user_id == student_id)
    else:
        # Exclude coaches/admins
        query = query.join(models.User).filter(
            models.User.role != "Debate Coach",
            models.User.role != "Administrator"
        )
    
    sessions = query.order_by(models.DebateSession.created_at.desc()).all()
    results = []

    for s in sessions:
        user = db.query(models.User).filter(models.User.id == s.user_id).first()
        perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == s.id).first()
        metric = db.query(models.PresentationMetric).filter(models.PresentationMetric.session_id == s.id).first()
        sim_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == s.id).all()

        fmt = (s.format or "").strip()
        is_pres = bool(
            fmt in ["Vocal Matrix", "Presentation Analysis", "Presentation", "Speech Analysis"] or
            (metric is not None and not sim_turns)
        )
        stype = "Presentation Analysis" if is_pres else "Debate"

        if session_type:
            if session_type.lower() == "debate" and is_pres:
                continue
            if session_type.lower() in ["presentation", "vocal"] and not is_pres:
                continue

        c_grade = perf.coach_grade if (perf and perf.coach_grade and perf.coach_grade.strip().lower() != "pending") else "Pending"
        c_marks = perf.coach_marks if (perf and perf.coach_marks is not None) else None
        c_feedback = perf.coach_feedback if (perf and perf.coach_feedback) else None

        is_completed = bool(
            (perf and perf.feedback_status == "Completed") or
            (c_grade != "Pending") or
            (c_marks is not None) or
            (c_feedback and "Official evaluation pending" not in c_feedback and c_feedback.strip() != "")
        )
        fb_status = "Completed" if is_completed else "Pending"

        if status_filter:
            if status_filter.lower() == "pending" and fb_status != "Pending":
                continue
            if status_filter.lower() == "completed" and fb_status != "Completed":
                continue

        score_val = round(perf.overall_weighted_score, 1) if (perf and perf.overall_weighted_score) else (
            round(metric.confidence_score * 0.5 + metric.clarity_score * 0.5, 1) if metric else 85.0
        )

        results.append({
            "session_id": s.id,
            "student_id": s.user_id,
            "student_name": user.full_name if user else f"Student #{s.user_id}",
            "student_email": user.email if user else "",
            "topic": s.topic,
            "format": s.format,
            "session_type": stype,
            "position": s.assigned_position,
            "score": score_val,
            "feedback_status": fb_status,
            "coach_grade": c_grade,
            "coach_marks": c_marks,
            "coach_feedback": c_feedback,
            "date": format_ist(s.created_at, "%Y-%m-%d %H:%M")
        })

    return results



