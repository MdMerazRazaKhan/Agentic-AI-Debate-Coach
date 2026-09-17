from datetime import datetime
import json
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user_optional, get_current_user
from routers.notifications import create_notification
import models
import schemas


router = APIRouter(prefix="/api/v1/sessions", tags=["Debate Session Management"])


@router.post("/create", response_model=schemas.DebateSessionResponse)
def create_debate_session(
    session_data: schemas.DebateSessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debate_session = models.DebateSession(
        user_id=current_user.id,
        title=session_data.title.strip(),
        topic=session_data.topic.strip(),
        format=session_data.format or "AI Simulation",
        assigned_position=session_data.assigned_position or "Affirmative",
        status=session_data.status or "Active",
        scheduled_at=session_data.scheduled_at or datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(debate_session)
    db.commit()
    db.refresh(debate_session)

    if debate_session.status == "Scheduled":
        create_notification(
            db=db,
            user_id=current_user.id,
            category="Debate",
            title="Debate Practice Scheduled",
            message=f"Session on '{debate_session.topic[:50]}' scheduled for {debate_session.scheduled_at.strftime('%b %d, %Y at %H:%M')}."
        )

    return debate_session


@router.post("/{session_id}/complete")
def complete_debate_session(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debate_session = (
        db.query(models.DebateSession)
        .filter(models.DebateSession.id == session_id, models.DebateSession.user_id == current_user.id)
        .first()
    )
    if not debate_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate session not found.")

    debate_session.status = "Completed"
    sim_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == session_id).all()
    fallacies_list = []
    total_rebuttal = 0.0
    for t in sim_turns:
        total_rebuttal += float(t.rebuttal_strength_percent or 0.0)
        try:
            fl = json.loads(t.fallacies_json) if isinstance(t.fallacies_json, str) else t.fallacies_json
            if isinstance(fl, list):
                for item in fl:
                    name = item.get("fallacy_type", "Fallacy") if isinstance(item, dict) else str(item)
                    fallacies_list.append(name)
        except Exception:
            pass

    avg_rebuttal = round(total_rebuttal / max(1, len(sim_turns)), 1) if sim_turns else 84.5
    logic_score = max(30.0, round(100.0 - len(fallacies_list) * 15.0, 1)) if sim_turns else 89.0

    existing_score = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == session_id).first()
    if not existing_score:
        analyses = db.query(models.ArgumentAnalysis).filter(models.ArgumentAnalysis.session_id == session_id).all()
        metrics = db.query(models.PresentationMetric).filter(models.PresentationMetric.session_id == session_id).all()
        latest_analysis = analyses[-1] if analyses else None
        latest_metric = metrics[-1] if metrics else None

        if sim_turns:
            argument_quality = round(avg_rebuttal * 0.95, 1)
            evidence_use = round(max(50.0, min(95.0, avg_rebuttal * 0.88 + 10.0)), 1)
            logic = logic_score
            rebuttal = avg_rebuttal
            communication = 85.0
        else:
            argument_quality = latest_analysis.persuasiveness_score if latest_analysis else 82.0
            evidence_use = latest_analysis.evidence_strength if latest_analysis else 80.0
            logic = latest_analysis.logical_consistency if latest_analysis else 85.0
            rebuttal = argument_quality
            communication = (
                (latest_metric.confidence_score + latest_metric.clarity_score + latest_metric.engagement_score) / 3.0
                if latest_metric
                else 84.0
            )

        calculated_score = round(
            argument_quality * 0.30 + evidence_use * 0.20 + logic * 0.25 + rebuttal * 0.25, 1
        )
        existing_score = models.PerformanceScore(
            session_id=session_id,
            user_id=current_user.id,
            argument_quality=argument_quality,
            evidence_use=evidence_use,
            logical_consistency=logic,
            rebuttal_effectiveness=rebuttal,
            communication_skills=communication,
            overall_weighted_score=calculated_score,
            created_at=datetime.utcnow()
        )
        db.add(existing_score)
    else:
        calculated_score = round(existing_score.overall_weighted_score, 1)
        logic = round(existing_score.logical_consistency, 1)
        rebuttal = round(existing_score.rebuttal_effectiveness, 1)

    # Dynamic AI Feedback beside each score
    if len(fallacies_list) == 0:
        logical_feedback = "Exemplary Deductive Integrity: Clean reasoning with 0 fallacy traps detected. Syllogistic transitions remained robust under cross-examination."
    elif len(fallacies_list) == 1:
        logical_feedback = f"Minor Logic Vulnerability: 1 fallacy identified ({fallacies_list[0]}). Ground premises in verifiable empirical evidence to prevent syllogistic drift."
    else:
        distinct_fallacies = ", ".join(list(dict.fromkeys(fallacies_list))[:2])
        logical_feedback = f"Fallacy Traps Detected ({len(fallacies_list)} flagged: {distinct_fallacies}): Reinforce causal premise links and avoid over-generalization under cross-fire."

    if rebuttal >= 85:
        rebuttal_feedback = "High Tactical Leverage: Counterarguments directly dismantled the opponent's core contentions with structured multi-point refutation."
    elif rebuttal >= 70:
        rebuttal_feedback = "Solid Counter-Positioning: Effective responses to opponent challenges. Deepen comparative impact calculus to gain persuasive leverage."
    else:
        rebuttal_feedback = "Refutation Needs Reinforcement: Opponent points were partially unaddressed. Apply the 'Turn-the-Tables' refutation framework."

    if calculated_score >= 88:
        overall_feedback = "Mastery Level Oratory: Outstanding debate execution with disciplined dialectical command and persuasive authority."
    elif calculated_score >= 75:
        overall_feedback = "Proficient Competitive Delivery: Strong reasoning flow. Continue eliminating rhetorical friction and fortifying warrants."
    else:
        overall_feedback = "Developing Rhetorician: Good foundational stance. Focus on active refutation and tighter syllogism coherence."

    last_tip = sim_turns[-1].coaching_tip if sim_turns else "Anchor every claim with concrete evidence and maintain an even vocal cadence."

    # Generate structured error diagnostics
    error_diagnostics = []
    if fallacies_list:
        distinct = list(dict.fromkeys(fallacies_list))
        for f in distinct:
            error_diagnostics.append({
                "area": "Logical Deductive Integrity",
                "severity": "High Risk",
                "title": f"Flagged Fallacy: {f}",
                "description": f"A '{f}' was detected in your debate turns. Drawing conclusions without bridging the causal premise gives your opponent an easy point of refutation.",
                "why_it_weakened": "Allows the opposing debater to invalidate the core claim and attack your premise as an unproven generalization.",
                "correction": "Ground premises in empirical benchmarks and state qualifying conditions instead of universal absolutes."
            })
    else:
        error_diagnostics.append({
            "area": "Empirical Verification",
            "severity": "Medium Risk",
            "title": "Unanchored Empirical Claims",
            "description": "Your premises were logically consistent, but relied predominantly on normative assertions without citing concrete peer-reviewed data, regulatory benchmarks, or historical precedents.",
            "why_it_weakened": "An opponent can reject your premise as a subjective viewpoint rather than an established reality.",
            "correction": "Cite at least one specific statistical metric, legal precedent, or published study per contention."
        })

    if rebuttal < 85:
        error_diagnostics.append({
            "area": "Counter-Rebuttal Scope",
            "severity": "Medium Risk",
            "title": "Incomplete Warrant Neutralization",
            "description": f"When facing counterarguments on '{debate_session.topic[:40]}...', your response tackled the opponent's conclusion rather than neutralizing their underlying warrant.",
            "why_it_weakened": "Leaves the opponent's offensive impact intact on the adjudicator's ballot.",
            "correction": "Apply the 'Turn-the-Tables' method: show why the opponent's mechanism actually supports your side."
        })
    else:
        error_diagnostics.append({
            "area": "Impact Weighing Calculus",
            "severity": "Optimization",
            "title": "Comparative Impact Articulation",
            "description": "While refutation was sharp, comparative impact calculus (Magnitude vs. Probability vs. Timeframe) was not explicitly weighed in the final summary.",
            "why_it_weakened": "Forces the judge to use their own subjective metric to weigh conflicting claims.",
            "correction": "Conclude with an explicit comparative weighing statement proving why your impact is irreversible."
        })

    # Structured Improvement Areas
    improvement_areas = [
        {
            "step": "1. Syllogism & Warrant Fortification (CWDI Model)",
            "action": "Structure every speech turn around Claim -> Warrant -> Data -> Impact.",
            "how_to_fix": f"For '{debate_session.topic[:50]}...', state your claim, provide a peer-reviewed or regulatory warrant, cite concrete metrics, and explain the tangible societal impact."
        },
        {
            "step": "2. The 'Even-If' (Concede & Transcend) Rebuttal",
            "action": "Neutralize the opponent's strongest argument without conceding the debate round.",
            "how_to_fix": "State: 'Even if the opponent is correct about short-term friction, our position addresses a catastrophic, irreversible impact that decisively outweighs their concern.'"
        },
        {
            "step": "3. Comparative Impact Weighing (Magnitude, Probability, Timeframe)",
            "action": "Directly instruct the adjudicator how to weigh the debate.",
            "how_to_fix": "Explicitly compare: 1) Magnitude (scale of harm), 2) Probability (likelihood), and 3) Timeframe (urgency). Show why your position is paramount."
        }
    ]

    # Action Directives
    action_directives = [
        f"Preemptively neutralize the opponent's core challenge regarding '{debate_session.topic[:45]}' within your opening 45 seconds.",
        "Anchor each contention in at least one verifiable empirical benchmark, legal precedent, or statistical data point.",
        "Maintain a deliberate, authoritative delivery pace of 140–150 WPM, taking a 1.5-second pause immediately following your core warrant for rhetorical impact."
    ]

    # Determine Category based on format
    category = "Agent Simulation" if "Simulation" in debate_session.format else "Debate"
    create_notification(
        db=db,
        user_id=current_user.id,
        category=category,
        title=f"{category} Session Completed",
        message=f"Session '{debate_session.topic[:45]}' completed. Performance score: {round(calculated_score, 1)}%."
    )

    # Persist feedback and coach evaluation directly into PerformanceScore
    existing_score.overall_feedback = overall_feedback
    existing_score.logical_feedback = logical_feedback
    existing_score.rebuttal_feedback = rebuttal_feedback
    existing_score.ai_feedback = f"{overall_feedback} • {logical_feedback} • {rebuttal_feedback}"

    # Newly completed practice debate sessions strictly start with Coach Evaluation as Pending
    existing_score.coach_grade = "Pending"
    existing_score.coach_marks = None
    existing_score.coach_feedback = "Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here."

    db.commit()
    return {
        "message": "Debate session successfully completed and performance scores recorded.",
        "status": "Completed",
        "session_id": session_id,
        "score": round(calculated_score, 1),
        "overall_score": round(calculated_score, 1),
        "logical_score": round(logic, 1),
        "rebuttal_score": round(rebuttal, 1),
        "overall_feedback": overall_feedback,
        "logical_feedback": logical_feedback,
        "rebuttal_feedback": rebuttal_feedback,
        "coaching_summary": " • ".join(action_directives),
        "error_diagnostics": error_diagnostics,
        "improvement_areas": improvement_areas,
        "action_directives": action_directives
    }


@router.get("/history")
def get_unified_session_history(
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Retrieves all sessions across Debate, Speech Analysis, Vocal Matrix, and Agent Simulation."""
    target_user_id = current_user.id if current_user else (user_id or 1)

    sessions = (
        db.query(models.DebateSession)
        .filter(models.DebateSession.user_id == target_user_id)
        .order_by(models.DebateSession.created_at.desc())
        .all()
    )

    history = []
    user_plan = db.query(models.CoachingPlan).filter(models.CoachingPlan.user_id == target_user_id).first()
    has_coach_plan_grade = bool(user_plan and user_plan.assigned_grade and user_plan.assigned_grade.strip().lower() != "pending")

    for s in sessions:
        perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == s.id).first()
        metric = db.query(models.PresentationMetric).filter(models.PresentationMetric.session_id == s.id).first()
        sim_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == s.id).all()
        
        # Categorize session type cleanly
        fmt = (s.format or "").strip()
        if "Vocal" in fmt:
            session_type = "Vocal Matrix"
        elif "Speech" in fmt:
            session_type = "Speech Analysis"
        elif "Simulation" in fmt:
            session_type = "Agent Simulation"
        else:
            session_type = "Debate"

        # Tally fallacies and turn metrics if any
        fallacies_count = 0
        if sim_turns:
            for st in sim_turns:
                try:
                    fl = json.loads(st.fallacies_json) if isinstance(st.fallacies_json, str) else st.fallacies_json
                    if isinstance(fl, list):
                        fallacies_count += len(fl)
                except Exception:
                    pass

        score_val = round(perf.overall_weighted_score, 1) if perf and perf.overall_weighted_score else (
            round(metric.confidence_score * 0.5 + metric.clarity_score * 0.5, 1) if metric else (
                round(sum(st.rebuttal_strength_percent for st in sim_turns) / len(sim_turns), 1) if sim_turns else 85.0
            )
        )

        logic_val = round(perf.logical_consistency, 1) if perf and perf.logical_consistency else (
            max(30.0, 100.0 - fallacies_count * 15.0) if sim_turns else 88.0
        )
        rebut_val = round(perf.rebuttal_effectiveness, 1) if perf and perf.rebuttal_effectiveness else (
            round(sum(st.rebuttal_strength_percent for st in sim_turns) / len(sim_turns), 1) if sim_turns else 84.0
        )
        arg_val = round(perf.argument_quality, 1) if perf and perf.argument_quality else 86.0
        evid_val = round(perf.evidence_use, 1) if perf and perf.evidence_use else 82.0
        comms_val = round(perf.communication_skills, 1) if perf and perf.communication_skills else (
            round(metric.clarity_score, 1) if metric else 85.0
        )

        # Dynamic AI Feedback fallback if not persisted
        if perf and perf.overall_feedback:
            ov_fb = perf.overall_feedback
        else:
            ov_fb = "Mastery Level Oratory: Outstanding debate execution with disciplined dialectical command and persuasive authority." if score_val >= 88 else (
                "Proficient Competitive Delivery: Strong reasoning flow. Continue eliminating rhetorical friction and fortifying warrants." if score_val >= 75 else
                "Developing Rhetorician: Good foundational stance. Focus on active refutation and tighter syllogism coherence."
            )

        if perf and perf.logical_feedback:
            lg_fb = perf.logical_feedback
        else:
            lg_fb = "Exemplary Deductive Integrity: Clean reasoning with 0 fallacy traps detected. Syllogistic transitions remained robust under cross-examination." if fallacies_count == 0 else (
                f"Minor Logic Vulnerability: {fallacies_count} fallacy trap(s) flagged. Ground premises in verifiable empirical evidence."
            )

        if perf and perf.rebuttal_feedback:
            rb_fb = perf.rebuttal_feedback
        else:
            rb_fb = "High Tactical Leverage: Counterarguments directly dismantled the opponent's core contentions with structured multi-point refutation." if rebut_val >= 85 else (
                "Solid Counter-Positioning: Effective responses to opponent challenges. Deepen comparative impact calculus to gain persuasive leverage."
            )

        combined_ai_fb = perf.ai_feedback if perf and perf.ai_feedback else f"{ov_fb} • {lg_fb} • {rb_fb}"

        # Resolve Coach Evaluation specifically for this session
        if perf and perf.coach_grade and perf.coach_grade.strip().lower() != "pending":
            c_grade = perf.coach_grade
            c_marks = perf.coach_marks
            c_feedback = perf.coach_feedback
        else:
            c_grade = "Pending"
            c_marks = None
            c_feedback = "Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here."

        eval_name = user_plan.evaluator_name if user_plan and user_plan.evaluator_name else "Debate Coach"

        history.append({
            "id": s.id,
            "title": s.title,
            "topic": s.topic,
            "format": s.format,
            "session_type": session_type,
            "position": s.assigned_position,
            "status": s.status,
            "score": score_val,
            "overall_score": score_val,
            "logical_score": logic_val,
            "logical_consistency": logic_val,
            "argument_quality": arg_val,
            "rebuttal_score": rebut_val,
            "rebuttal_effectiveness": rebut_val,
            "evidence_use": evid_val,
            "communication_skills": comms_val,
            "overall_feedback": ov_fb,
            "logical_feedback": lg_fb,
            "rebuttal_feedback": rb_fb,
            "ai_feedback": combined_ai_fb,
            "coach_grade": c_grade,
            "coach_marks": c_marks,
            "coach_feedback": c_feedback,
            "evaluator_name": eval_name,
            "fallacies_count": fallacies_count,
            "turns_count": len(sim_turns),
            "date": s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "Recent",
            "created_at": s.created_at.isoformat() if s.created_at else datetime.utcnow().isoformat(),
            "metrics": {
                "wpm": metric.speech_pace_wpm if metric else 142.0,
                "filler_words": metric.filler_words_count if metric else 0,
                "confidence": metric.confidence_score if metric else 88.0,
                "clarity": metric.clarity_score if metric else 85.0
            } if metric else None
        })

    return history


@router.get("/{session_id}/performance")
def get_session_performance_detail(
    session_id: int,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Returns the comprehensive performance scorecard and report details for a specific debate session."""
    s = db.query(models.DebateSession).filter(models.DebateSession.id == session_id).first()
    if not s:
        # Fallback: check if session_id is a PresentationMetric id
        metric_rec = db.query(models.PresentationMetric).filter(models.PresentationMetric.id == session_id).first()
        if metric_rec and metric_rec.session_id:
            s = db.query(models.DebateSession).filter(models.DebateSession.id == metric_rec.session_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Session not found.")

    perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == s.id).first()
    metric = db.query(models.PresentationMetric).filter(models.PresentationMetric.session_id == s.id).first()
    sim_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == s.id).all()
    user_plan = db.query(models.CoachingPlan).filter(models.CoachingPlan.user_id == s.user_id).first()

    fallacies_count = 0
    if sim_turns:
        for st in sim_turns:
            try:
                fl = json.loads(st.fallacies_json) if isinstance(st.fallacies_json, str) else st.fallacies_json
                if isinstance(fl, list):
                    fallacies_count += len(fl)
            except Exception:
                pass

    score_val = round(perf.overall_weighted_score, 1) if perf and perf.overall_weighted_score else (
        round(metric.confidence_score * 0.5 + metric.clarity_score * 0.5, 1) if metric else (
            round(sum(st.rebuttal_strength_percent for st in sim_turns) / len(sim_turns), 1) if sim_turns else 85.0
        )
    )
    logic_val = round(perf.logical_consistency, 1) if perf and perf.logical_consistency else (
        max(30.0, 100.0 - fallacies_count * 15.0) if sim_turns else 88.0
    )
    rebut_val = round(perf.rebuttal_effectiveness, 1) if perf and perf.rebuttal_effectiveness else (
        round(sum(st.rebuttal_strength_percent for st in sim_turns) / len(sim_turns), 1) if sim_turns else 84.0
    )
    arg_val = round(perf.argument_quality, 1) if perf and perf.argument_quality else 86.0
    evid_val = round(perf.evidence_use, 1) if perf and perf.evidence_use else 82.0
    comms_val = round(perf.communication_skills, 1) if perf and perf.communication_skills else (
        round(metric.clarity_score, 1) if metric else 85.0
    )

    if perf and perf.overall_feedback:
        ov_fb = perf.overall_feedback
    else:
        ov_fb = "Mastery Level Oratory: Outstanding debate execution with disciplined dialectical command and persuasive authority." if score_val >= 88 else (
            "Proficient Competitive Delivery: Strong reasoning flow. Continue eliminating rhetorical friction and fortifying warrants." if score_val >= 75 else
            "Developing Rhetorician: Good foundational stance. Focus on active refutation and tighter syllogism coherence."
        )

    if perf and perf.logical_feedback:
        lg_fb = perf.logical_feedback
    else:
        lg_fb = "Exemplary Deductive Integrity: Clean reasoning with 0 fallacy traps detected. Syllogistic transitions remained robust under cross-examination." if fallacies_count == 0 else (
            f"Minor Logic Vulnerability: {fallacies_count} fallacy trap(s) flagged. Ground premises in verifiable empirical evidence."
        )

    if perf and perf.rebuttal_feedback:
        rb_fb = perf.rebuttal_feedback
    else:
        rb_fb = "High Tactical Leverage: Counterarguments directly dismantled the opponent's core contentions with structured multi-point refutation." if rebut_val >= 85 else (
            "Solid Counter-Positioning: Effective responses to opponent challenges. Deepen comparative impact calculus to gain persuasive leverage."
        )

    # Resolve Coach Evaluation specifically for this session
    if perf and perf.coach_grade and perf.coach_grade.strip().lower() != "pending":
        c_grade = perf.coach_grade
        c_marks = perf.coach_marks
        c_feedback = perf.coach_feedback
    else:
        c_grade = "Pending"
        c_marks = None
        c_feedback = "Official evaluation pending. Your debate coach will review your practice sessions and assign your performance grade and tactical directives here."

    eval_name = user_plan.evaluator_name if user_plan and user_plan.evaluator_name else "Debate Coach"

    return {
        "session_id": s.id,
        "title": s.title,
        "topic": s.topic,
        "format": s.format,
        "position": s.assigned_position,
        "status": s.status,
        "date": s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "Recent",
        "performance_score": score_val,
        "overall_score": score_val,
        "logical_integrity": logic_val,
        "rebuttal_leverage": rebut_val,
        "argument_quality": arg_val,
        "evidence_use": evid_val,
        "communication_skills": comms_val,
        "overall_feedback": ov_fb,
        "logical_feedback": lg_fb,
        "rebuttal_feedback": rb_fb,
        "ai_feedback": perf.ai_feedback if perf and perf.ai_feedback else f"{ov_fb} • {lg_fb} • {rb_fb}",
        "coach_grade": c_grade,
        "coach_marks": c_marks,
        "coach_feedback": c_feedback,
        "evaluator_name": eval_name,
        "is_vocal_matrix": bool(s.format == "Vocal Matrix" or (metric is not None and not sim_turns)),
        "metrics": {
            "wpm": metric.speech_pace_wpm if metric else 142.0,
            "speech_pace_wpm": metric.speech_pace_wpm if metric else 142.0,
            "filler_words": metric.filler_words_count if metric else 0,
            "filler_words_count": metric.filler_words_count if metric else 0,
            "filler_words_list": metric.filler_words_list if metric else "",
            "confidence": metric.confidence_score if metric else 88.0,
            "confidence_score": metric.confidence_score if metric else 88.0,
            "clarity": metric.clarity_score if metric else 85.0,
            "clarity_score": metric.clarity_score if metric else 85.0,
            "engagement_score": metric.engagement_score if metric else 75.0
        } if metric else None,
        "vocal_metrics": {
            "speech_pace_wpm": metric.speech_pace_wpm if metric else 142.0,
            "filler_words_count": metric.filler_words_count if metric else 0,
            "filler_words_list": metric.filler_words_list if metric else "None detected",
            "confidence_score": metric.confidence_score if metric else 88.0,
            "clarity_score": metric.clarity_score if metric else 85.0,
            "engagement_score": metric.engagement_score if metric else 75.0,
            "ai_coach_feedback": (
                'Practice the "3-Second Silence Rule". Whenever you feel the urge to say "um" or "like", take a silent breath instead. Silence projects executive presence.'
                if (metric and metric.filler_words_count > 3)
                else ('Incorporate rhythmic cadence changes to emphasize rhetorical pivots.' if (metric and metric.speech_pace_wpm < 120)
                else 'Superb prosody balance! Your pacing and minimal filler density project command over the debate motion.')
            ) if metric else "Superb prosody balance! Your pacing and minimal filler density project command over the debate motion."
        } if metric else None,
        "reports": {
            "pdf_url": f"http://localhost:8000/api/v1/reports/export/pdf/{s.id}",
            "excel_url": f"http://localhost:8000/api/v1/reports/export/excel/{s.id}",
            "coaching_url": f"http://localhost:8000/api/v1/reports/export/coaching/pdf/{s.user_id}"
        }
    }


@router.get("/user/me", response_model=List[schemas.DebateSessionResponse])
def get_my_sessions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.DebateSession).filter(models.DebateSession.user_id == current_user.id).order_by(models.DebateSession.created_at.desc()).all()


@router.get("/user/{user_id}", response_model=List[schemas.DebateSessionResponse])
def get_user_sessions(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your own sessions.")
    return db.query(models.DebateSession).filter(models.DebateSession.user_id == current_user.id).order_by(models.DebateSession.created_at.desc()).all()


@router.get("/{session_id}", response_model=schemas.DebateSessionResponse)
def get_session_by_id(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debate_session = (
        db.query(models.DebateSession)
        .filter(models.DebateSession.id == session_id, models.DebateSession.user_id == current_user.id)
        .first()
    )
    if not debate_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate session not found.")
    return debate_session
