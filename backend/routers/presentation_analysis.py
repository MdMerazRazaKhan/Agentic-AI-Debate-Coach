from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user_optional, get_current_user
from routers.notifications import create_notification
from services.speech_engine import speech_engine_service
import models
import schemas
from time_utils import to_ist, format_ist, format_ist_iso, now_ist


router = APIRouter(prefix="/api/v1/presentation-analysis", tags=["Presentation Analysis Engine"])


def build_presentation_insights(
    wpm: float,
    filler_count: int,
    filler_list: str,
    confidence: float,
    clarity: float,
    engagement: float
) -> Dict[str, Any]:
    """Generates standardized, deterministic prosody telemetry, strengths, improvements, and AI summary."""
    if wpm < 110:
        pace_status = "slow"
    elif wpm <= 130:
        pace_status = "moderate"
    elif wpm <= 165:
        pace_status = "optimal"
    else:
        pace_status = "rapid"

    confidence_10 = round(max(1.0, min(10.0, confidence / 10.0)), 1)
    clarity_10 = round(max(1.0, min(10.0, clarity / 10.0)), 1)
    engagement_10 = round(max(1.0, min(10.0, engagement / 10.0)), 1)

    # Build dynamic strengths
    strengths = []
    if filler_count == 0:
        strengths.append("Exceptional verbal discipline with zero filler word interruptions")
    elif filler_count <= 2:
        strengths.append("Controlled vocal delivery with minimal filler hesitation")
    if pace_status == "optimal":
        strengths.append(f"Optimal keynote pacing ({wpm} WPM) ensures maximum listener comprehension")
    elif pace_status == "moderate":
        strengths.append(f"Measured and deliberate speaking cadence ({wpm} WPM)")
    if clarity_10 >= 7.0:
        strengths.append("High deductive clarity with structured sentence transitions")
    if engagement_10 >= 7.0:
        strengths.append("Dynamic vocal variety and engaging rhetorical tone")
    if not strengths:
        strengths.append("Establishes a recognizable presentation premise and core speaking intent")

    # Build dynamic improvements
    improvements = []
    if pace_status == "slow":
        improvements.append(f"Increase speaking rate from {wpm} WPM toward the 130-155 WPM sweet spot")
    elif pace_status == "rapid":
        improvements.append(f"Moderate speaking speed ({wpm} WPM) and integrate 2-second tactical pauses after key claims")
    if filler_count > 0:
        clean_fillers = filler_list if (filler_list and filler_list != "None") else "detected filler phrases"
        improvements.append(f"Substitute detected filler phrases ({clean_fillers}) with silent pauses")
    if clarity_10 < 8.0:
        improvements.append("Strengthen logical transitions between premise, empirical evidence, and concluding impact")
    if engagement_10 < 8.0:
        improvements.append("Incorporate rhetorical questions, vocal inflections, or parallelism to captivate listeners")
    improvements.append("Anchor principal claims with concrete statistics or authoritative evidence")

    # Build dynamic Pros & Cons
    pros = []
    if pace_status == "optimal":
        pros.append(f"Ideal keynote pacing at {wpm} WPM balances information density with audience absorption.")
    elif pace_status == "moderate":
        pros.append(f"Deliberate, steady speech rhythm ({wpm} WPM) aids clarity on complex topics.")
    else:
        pros.append(f"Clear vocal delivery that conveys key premise and main speaking objective.")

    if filler_count == 0:
        pros.append("Flawless verbal discipline with zero distracting filler crutches detected.")
    elif filler_count <= 2:
        pros.append(f"High verbal restraint with only {filler_count} minor filler hesitation(s).")
    else:
        pros.append("Direct articulate delivery with recognizable structural progression.")

    if clarity_10 >= 7.0:
        pros.append("Strong sentence construction and logical flow between speech sections.")
    if confidence_10 >= 7.0:
        pros.append("Assertive tonal presence and command of subject matter.")
    if engagement_10 >= 7.0:
        pros.append("Dynamic vocal inflection that prevents listener fatigue.")
    if not pros:
        pros.append("Identifiable speech structure with a clear central thesis statement.")

    cons = []
    if pace_status == "slow":
        cons.append(f"Pacing ({wpm} WPM) falls below the target 130-155 WPM range, risking listener disengagement.")
    elif pace_status == "rapid":
        cons.append(f"Speaking rate ({wpm} WPM) exceeds 165 WPM, which may overwhelm listener processing speed.")
    if filler_count > 0:
        clean_fillers = filler_list if (filler_list and filler_list != "None") else "detected fillers"
        cons.append(f"Presence of vocal fillers ({clean_fillers}) interrupts rhetorical fluency and executive presence.")
    if clarity_10 < 8.0:
        cons.append("Premise-to-conclusion transitions lack tight deductive connective phrasing.")
    if engagement_10 < 8.0:
        cons.append("Vocal cadence remains relatively monotone without sufficient emphasis on pivotal claims.")
    if not cons:
        cons.append("Minor opportunities to introduce tactical 2-second rhetorical pauses before major assertions.")

    # Dedicated AI Coach Feedback
    if filler_count > 3:
        ai_feedback = 'Practice the "3-Second Silence Rule". Whenever you feel the urge to use filler phrases, take a silent breath instead. Silence projects executive authority and sharpens argument delivery.'
    elif pace_status == "slow":
        ai_feedback = f'Your speaking tempo is currently measured at {wpm} WPM. Accelerate delivery momentum slightly toward 130-155 WPM while sustaining crisp consonant articulation to keep listeners engaged.'
    elif pace_status == "rapid":
        ai_feedback = f'At {wpm} WPM, you are moving quickly through your points. Integrate 2-second tactical pauses after major evidentiary claims to let listeners absorb your points before transitioning.'
    else:
        ai_feedback = f'Superb keynote prosody! Your pace of {wpm} WPM and minimal filler hesitation project executive command. Continue anchoring key points with authoritative evidence.'

    pace_comp = 95.0 if 130 <= wpm <= 160 else (80.0 if (110 <= wpm < 130 or 160 < wpm <= 180) else 70.0)
    calculated_overall_score = round(confidence * 0.35 + clarity * 0.35 + engagement * 0.15 + pace_comp * 0.15, 1)

    summary = f"Your delivery operates at {wpm} WPM with {filler_count} filler words detected. To maximize rhetorical impact, focus on refining speech momentum and supporting core arguments with verified evidence to elevate confidence and audience engagement."

    return {
        "pace_status": pace_status,
        "confidence_score_10": confidence_10,
        "clarity_score_10": clarity_10,
        "engagement_score_10": engagement_10,
        "overall_score": calculated_overall_score,
        "strengths": strengths,
        "improvements": improvements,
        "pros": pros,
        "cons": cons,
        "ai_feedback": ai_feedback,
        "summary": summary
    }


@router.post("/evaluate", response_model=schemas.PresentationMetricResponse)
def evaluate_presentation(
    payload: schemas.SpeechAnalysisSubmit,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    try:
        metric_data = speech_engine_service.analyze_speech(payload.speech_text, payload.audio_duration_seconds or 60.0)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    session_id = payload.session_id
    insights = build_presentation_insights(
        wpm=metric_data["speech_pace_wpm"],
        filler_count=metric_data["filler_words_count"],
        filler_list=metric_data["filler_words_list"],
        confidence=metric_data["confidence_score"],
        clarity=metric_data["clarity_score"],
        engagement=metric_data["engagement_score"],
    )

    pace_status = insights["pace_status"]
    confidence_10 = insights["confidence_score_10"]
    clarity_10 = insights["clarity_score_10"]
    engagement_10 = insights["engagement_score_10"]
    calculated_overall_score = insights["overall_score"]
    strengths = insights["strengths"]
    improvements = insights["improvements"]
    pros = insights["pros"]
    cons = insights["cons"]
    ai_feedback = insights["ai_feedback"]
    summary = insights["summary"]
    wpm = metric_data["speech_pace_wpm"]

    # If authenticated user, automatically persist session, metrics, scores, and notification
    if current_user is not None:
        if session_id is None:
            snippet = payload.speech_text.strip()
            topic_str = payload.topic.strip() if getattr(payload, "topic", None) and payload.topic.strip() else ((snippet[:60] + "...") if len(snippet) > 60 else snippet)
            new_session = models.DebateSession(
                user_id=current_user.id,
                title="Presentation Analysis",
                topic=topic_str or "Live Speech & Presentation Practice",
                format="Presentation Analysis",
                assigned_position="Speaker",
                status="Completed",
                scheduled_at=datetime.utcnow(),
                created_at=datetime.utcnow()
            )
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            session_id = new_session.id

        # Save Presentation Metric record
        metric = models.PresentationMetric(
            session_id=session_id,
            user_id=current_user.id,
            speech_pace_wpm=metric_data["speech_pace_wpm"],
            filler_words_count=metric_data["filler_words_count"],
            filler_words_list=metric_data["filler_words_list"],
            confidence_score=metric_data["confidence_score"],
            clarity_score=metric_data["clarity_score"],
            engagement_score=metric_data["engagement_score"],
            created_at=datetime.utcnow()
        )
        db.add(metric)

        # Save or update Performance Score
        perf_score = models.PerformanceScore(
            session_id=session_id,
            user_id=current_user.id,
            argument_quality=calculated_overall_score,
            evidence_use=metric_data["clarity_score"],
            logical_consistency=metric_data["confidence_score"],
            rebuttal_effectiveness=metric_data["engagement_score"],
            communication_skills=metric_data["clarity_score"],
            overall_weighted_score=calculated_overall_score,
            overall_feedback=summary,
            ai_feedback=ai_feedback,
            created_at=datetime.utcnow()
        )
        db.add(perf_score)

        # Generate real-time Notification
        clarity = metric_data["clarity_score"]
        create_notification(
            db=db,
            user_id=current_user.id,
            category="Presentation",
            title="Presentation Analysis Completed",
            message=f"Pace: {wpm} WPM ({pace_status}) | Fillers: {metric_data['filler_words_count']} | Clarity: {clarity}% | Score: {calculated_overall_score}%."
        )

        db.commit()

    return {
        "session_id": session_id,
        "pace_status": pace_status,
        "confidence_score_10": confidence_10,
        "clarity_score_10": clarity_10,
        "engagement_score_10": engagement_10,
        "overall_score": calculated_overall_score,
        "strengths": strengths,
        "improvements": improvements,
        "pros": pros,
        "cons": cons,
        "ai_feedback": ai_feedback,
        "summary": summary,
        **metric_data
    }


@router.get("/history")
def get_presentation_history(
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Fetches full persistent Presentation Analysis history for the user, including identical metrics, insights, and summary."""
    target_user_id = current_user.id if current_user else (user_id or 1)

    metrics_records = (
        db.query(models.PresentationMetric)
        .filter(models.PresentationMetric.user_id == target_user_id)
        .order_by(models.PresentationMetric.created_at.desc())
        .all()
    )

    history_list = []
    for m in metrics_records:
        session = db.query(models.DebateSession).filter(models.DebateSession.id == m.session_id).first()
        title = session.title if session and session.title else "Presentation Analysis"
        topic = session.topic if session and session.topic else "Live Speech & Presentation Practice"
        
        insights = build_presentation_insights(
            wpm=m.speech_pace_wpm,
            filler_count=m.filler_words_count,
            filler_list=m.filler_words_list or "None",
            confidence=m.confidence_score,
            clarity=m.clarity_score,
            engagement=m.engagement_score
        )

        # Retrieve overall score from PerformanceScore or fallback to calculated
        perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == m.session_id).first()
        if perf and perf.overall_weighted_score:
            overall_score = round(perf.overall_weighted_score, 1)
        else:
            overall_score = insights["overall_score"]

        history_list.append({
            "id": m.id,
            "session_id": m.session_id,
            "title": title,
            "topic": topic,
            "format": "Presentation Analysis",
            "wpm": m.speech_pace_wpm,
            "speech_pace_wpm": m.speech_pace_wpm,
            "pace_status": insights["pace_status"],
            "filler_words_count": m.filler_words_count,
            "filler_words_list": m.filler_words_list,
            "confidence_score": m.confidence_score,
            "confidence_score_10": insights["confidence_score_10"],
            "clarity_score": m.clarity_score,
            "clarity_score_10": insights["clarity_score_10"],
            "engagement_score": m.engagement_score,
            "engagement_score_10": insights["engagement_score_10"],
            "overall_score": overall_score,
            "strengths": insights["strengths"],
            "improvements": insights["improvements"],
            "pros": insights["pros"],
            "cons": insights["cons"],
            "ai_feedback": insights["ai_feedback"],
            "summary": insights["summary"],
            "date": format_ist(m.created_at, "%Y-%m-%d %H:%M"),
            "created_at": format_ist_iso(m.created_at)
        })

    return history_list
