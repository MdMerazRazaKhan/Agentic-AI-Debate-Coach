import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, get_mongo_db
from routers.auth import get_current_user
from services.ai_engine import SUPPORTED_PERSONAS, ai_engine_service
import models
import schemas


router = APIRouter(prefix="/api/v1/simulation", tags=["AI Debate Simulation Engine"])


@router.post("/turn", response_model=schemas.SimulationTurnResponse)
def run_simulation_turn(
    payload: schemas.SimulationTurnSubmit,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debate_session = (
        db.query(models.DebateSession)
        .filter(models.DebateSession.id == payload.session_id, models.DebateSession.user_id == current_user.id)
        .first()
    )
    if not debate_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate session not found for this user.")

    persona = payload.opponent_persona if payload.opponent_persona in SUPPORTED_PERSONAS else "The Contrarian"
    try:
        simulation_result = ai_engine_service.generate_simulation_response(payload.user_argument, persona)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    prior_turns = db.query(func.count(models.SimulationTurn.id)).filter(models.SimulationTurn.session_id == payload.session_id).scalar() or 0
    turn_index = int(prior_turns) + 1
    turn = models.SimulationTurn(
        session_id=payload.session_id,
        user_id=current_user.id,
        turn_index=turn_index,
        user_argument=payload.user_argument,
        opponent_persona=persona,
        opponent_rebuttal=simulation_result["opponent_rebuttal"],
        fallacies_json=json.dumps(simulation_result["fallacies_detected"]),
        rebuttal_strength_percent=simulation_result["rebuttal_strength_percent"],
        coaching_tip=simulation_result["coaching_tip"],
    )
    db.add(turn)
    db.commit()

    # Calculate and persist live PerformanceScore across all session turns
    all_turns = db.query(models.SimulationTurn).filter(models.SimulationTurn.session_id == payload.session_id).all()
    total_fallacies = 0
    total_rebuttal = 0.0
    for t in all_turns:
        total_rebuttal += float(t.rebuttal_strength_percent or 0.0)
        try:
            fl = json.loads(t.fallacies_json) if isinstance(t.fallacies_json, str) else t.fallacies_json
            if isinstance(fl, list):
                total_fallacies += len(fl)
        except Exception:
            pass

    avg_rebuttal = round(total_rebuttal / max(1, len(all_turns)), 1)
    logical_score = max(30.0, round(100.0 - total_fallacies * 15.0, 1))
    arg_quality = round(avg_rebuttal * 0.95, 1)
    evidence_score = round(max(50.0, min(95.0, avg_rebuttal * 0.88 + 10.0)), 1)
    overall_score = round(arg_quality * 0.30 + evidence_score * 0.20 + logical_score * 0.25 + avg_rebuttal * 0.25, 1)

    perf = db.query(models.PerformanceScore).filter(models.PerformanceScore.session_id == payload.session_id).first()
    if not perf:
        perf = models.PerformanceScore(
            session_id=payload.session_id,
            user_id=current_user.id,
            argument_quality=arg_quality,
            evidence_use=evidence_score,
            logical_consistency=logical_score,
            rebuttal_effectiveness=avg_rebuttal,
            communication_skills=85.0,
            overall_weighted_score=overall_score,
            created_at=datetime.utcnow()
        )
        db.add(perf)
    else:
        perf.argument_quality = arg_quality
        perf.evidence_use = evidence_score
        perf.logical_consistency = logical_score
        perf.rebuttal_effectiveness = avg_rebuttal
        perf.overall_weighted_score = overall_score

    db.commit()

    # Write to MongoDB document store collection
    mongo_db = get_mongo_db()
    if mongo_db is not None:
        try:
            mongo_db.transcripts.insert_one({
                "session_id": payload.session_id,
                "user_id": current_user.id,
                "timestamp": datetime.utcnow(),
                "user_argument": payload.user_argument,
                "opponent_rebuttal": simulation_result["opponent_rebuttal"],
                "fallacies_detected": simulation_result["fallacies_detected"],
                "rebuttal_strength_percent": simulation_result["rebuttal_strength_percent"],
                "coaching_tip": simulation_result["coaching_tip"]
            })
        except Exception as e:
            # Safe catch to ensure app continues working if local Mongo is restarting
            print(f"MongoDB write failed: {e}")

    return {
        "session_id": payload.session_id,
        "turn_index": turn_index,
        "user_argument": payload.user_argument,
        "opponent_persona": persona,
        "opponent_rebuttal": simulation_result["opponent_rebuttal"],
        "fallacies_detected_in_user": simulation_result["fallacies_detected"],
        "rebuttal_strength_percent": simulation_result["rebuttal_strength_percent"],
        "coaching_tip": simulation_result["coaching_tip"],
        "overall_score": overall_score,
        "logical_score": logical_score,
        "cumulative_rebuttal": avg_rebuttal,
    }
