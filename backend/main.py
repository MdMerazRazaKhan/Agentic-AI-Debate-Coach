from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import engine, Base
import models

from routers import (
    auth,
    sessions,
    argument_analysis,
    fallacy_detection,
    counterarguments,
    presentation_analysis,
    simulation,
    scoring,
    coaching,
    dashboards,
    reports,
    notifications
)

# Initialize DB tables
Base.metadata.create_all(bind=engine)

def _migrate_database_schema():
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        cols = [c['name'] for c in inspector.get_columns('performance_scores')]
        with engine.connect() as conn:
            if 'coach_strengths' not in cols:
                conn.execute(text("ALTER TABLE performance_scores ADD COLUMN coach_strengths TEXT"))
            if 'coach_weaknesses' not in cols:
                conn.execute(text("ALTER TABLE performance_scores ADD COLUMN coach_weaknesses TEXT"))
            if 'coach_improvements' not in cols:
                conn.execute(text("ALTER TABLE performance_scores ADD COLUMN coach_improvements TEXT"))
            if 'coach_recommendations' not in cols:
                conn.execute(text("ALTER TABLE performance_scores ADD COLUMN coach_recommendations TEXT"))
            if 'feedback_status' not in cols:
                conn.execute(text("ALTER TABLE performance_scores ADD COLUMN feedback_status VARCHAR DEFAULT 'Pending'"))
                conn.execute(text("UPDATE performance_scores SET feedback_status = 'Completed' WHERE coach_grade IS NOT NULL AND coach_grade != 'Pending' AND coach_grade != ''"))
                conn.execute(text("UPDATE performance_scores SET feedback_status = 'Pending' WHERE feedback_status IS NULL OR feedback_status = ''"))
            conn.commit()
    except Exception as e:
        print(f"Warning: Database migration notice ({e})")

_migrate_database_schema()

def _ensure_core_accounts():
    from database import SessionLocal
    from routers.auth import hash_password
    db = SessionLocal()
    try:
        coach = db.query(models.User).filter(models.User.email == "mdmerazrazakhan@gmail.com").first()
        if not coach:
            coach = models.User(
                email="mdmerazrazakhan@gmail.com",
                hashed_password=hash_password("CoachPassword123!"),
                full_name="Khan",
                role="Debate Coach",
                experience_level="Expert",
                preferred_topics="Oxford, Parliamentary, Policy Debate",
                presentation_domains="Executive Coaching, Debate Adjudication",
                learning_goals="Mentor debaters, Assign official grades",
                coaching_preferences="Real-time alerts, Post-session audits"
            )
            db.add(coach)
            db.commit()
        elif coach.role != "Debate Coach":
            coach.role = "Debate Coach"
            db.commit()
    except Exception as e:
        print(f"Warning: Core accounts seeding notice ({e})")
    finally:
        db.close()

_ensure_core_accounts()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register All Microservices Routers
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(argument_analysis.router)
app.include_router(fallacy_detection.router)
app.include_router(counterarguments.router)
app.include_router(presentation_analysis.router)
app.include_router(simulation.router)
app.include_router(scoring.router)
app.include_router(coaching.router)
app.include_router(dashboards.router)
app.include_router(reports.router)
app.include_router(notifications.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Operations"])
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME, "version": settings.VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
