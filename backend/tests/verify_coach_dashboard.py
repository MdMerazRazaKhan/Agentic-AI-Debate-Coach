import sys
from pathlib import Path

backend_dir = r"C:\Users\nargi\OneDrive\Pictures\Desktop\MERAZ\Agentic AI Debate Coach\backend"
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import models

client = TestClient(app)

print("=" * 70)
print("DEBATE COACH DASHBOARD — COMPREHENSIVE END-TO-END TEST SUITE")
print("=" * 70)

# 1. LOGIN COACH & LEARNER
print("\n[1] Authenticating Coach & Learner...")
res_coach = client.post("/api/v1/auth/login", json={
    "email": "mdmerazrazakhan@gmail.com",
    "password": "Dayan@123"
})
assert res_coach.status_code == 200, f"Coach login failed: {res_coach.text}"
coach_token = res_coach.json()["access_token"]
coach_id = res_coach.json()["user_id"]
coach_headers = {"Authorization": f"Bearer {coach_token}"}
print(f"-> Coach Logged In: ID={coach_id}, Name='{res_coach.json()['full_name']}'")

res_learner = client.post("/api/v1/auth/login", json={
    "email": "hardwilldayan69@gmail.com",
    "password": "Dayan@123"
})
assert res_learner.status_code == 200, f"Learner login failed: {res_learner.text}"
learner_token = res_learner.json()["access_token"]
learner_id = res_learner.json()["user_id"]
learner_headers = {"Authorization": f"Bearer {learner_token}"}
print(f"-> Learner Logged In: ID={learner_id}, Name='{res_learner.json()['full_name']}'")

# 2. VERIFY COACH OVERVIEW & STUDENT ROSTER
print("\n[2] Testing Coach Overview & Students Roster...")
res_ov = client.get("/api/v1/coaching/coach/overview", headers=coach_headers)
assert res_ov.status_code == 200, f"Coach overview failed: {res_ov.text}"
ov_data = res_ov.json()
print(f"-> Assigned Students: {ov_data.get('assigned_students')}, Pending Evals: {ov_data.get('pending_evaluations')}")

res_roster = client.get("/api/v1/coaching/coach/students", headers=coach_headers)
assert res_roster.status_code == 200, f"Students roster failed: {res_roster.text}"
roster = res_roster.json()
assert len(roster) > 0, "Roster should not be empty!"
learner_entry = next((s for s in roster if s["id"] == learner_id), None)
assert learner_entry is not None, f"Learner ID {learner_id} not found in coach roster!"
print(f"-> Learner Roster Entry: Name='{learner_entry['name']}', Grade='{learner_entry['grade']}', Debates={learner_entry.get('debate_count')}, Presentations={learner_entry.get('presentation_count')}")

# 3. VERIFY COACH CAN ACCESS STUDENT DEBATE HISTORY WITH STRICT FILTERING
print("\n[3] Testing Student Debate History Access by Coach...")
res_deb_hist = client.get(f"/api/v1/sessions/history?user_id={learner_id}&session_type=debate", headers=coach_headers)
assert res_deb_hist.status_code == 200, f"Failed to fetch student debates: {res_deb_hist.text}"
debates = res_deb_hist.json()
print(f"-> Total Debate Sessions for Student: {len(debates)}")
for d in debates:
    fmt = (d.get("format") or "").lower()
    assert "vocal" not in fmt and "presentation" not in fmt, f"Presentation session leaked into Debate History: {d}"
    assert "feedback_status" in d, f"feedback_status missing in debate: {d.get('id')}"
print("-> Zero presentation sessions found in Debate History (100% Strict Separation Verified)!")

# 4. VERIFY COACH CAN ACCESS STUDENT PRESENTATION HISTORY
print("\n[4] Testing Student Presentation History Access by Coach...")
res_pres_hist = client.get(f"/api/v1/presentation-analysis/history?user_id={learner_id}", headers=coach_headers)
assert res_pres_hist.status_code == 200, f"Failed to fetch student presentations: {res_pres_hist.text}"
pres_list = res_pres_hist.json()
print(f"-> Total Presentation Sessions for Student: {len(pres_list)}")
if pres_list:
    sample_p = pres_list[0]
    assert "feedback_status" in sample_p, "feedback_status missing in presentation"
    print(f"-> Sample Presentation: Topic='{sample_p.get('topic')[:40]}...', WPM={sample_p.get('wpm')}, Status='{sample_p.get('feedback_status')}'")

# 5. TEST SKILL GAP ANALYSIS (13 CATEGORIES)
print("\n[5] Testing Skill Gap Analysis (13 Categories)...")
res_gap = client.get(f"/api/v1/coaching/skill-gap-analysis/{learner_id}", headers=coach_headers)
assert res_gap.status_code == 200, f"Skill gap analysis failed: {res_gap.text}"
gap_data = res_gap.json()
cats = gap_data.get("categories", [])
assert len(cats) == 13, f"Expected exactly 13 skill categories, got {len(cats)}"
expected_cat_names = [
    "Argument Structure", "Logical Reasoning", "Evidence Usage", "Rebuttal",
    "Counter Argument", "Fallacy Awareness", "Speaking Pace", "Clarity",
    "Confidence", "Engagement", "Delivery", "Vocabulary", "Overall Communication"
]
for expected_name in expected_cat_names:
    found = any(c["name"] == expected_name for c in cats)
    assert found, f"Missing category: {expected_name}"
print(f"-> All 13 Categories Verified! Avg Score: {gap_data.get('average_skill_score')}%, Needs Improvement: {gap_data.get('needs_improvement_count')}")

# 6. TEST COACHING RECOMMENDATIONS CRUD
print("\n[6] Testing Coaching Recommendations CRUD...")
# 6a. GET recommendations
res_recs_initial = client.get(f"/api/v1/coaching/recommendations/{learner_id}", headers=coach_headers)
assert res_recs_initial.status_code == 200, f"Recommendations fetch failed: {res_recs_initial.text}"
print(f"-> Active Recommendations: {len(res_recs_initial.json())}")

# 6b. POST new recommendation
rec_payload = {
    "user_id": learner_id,
    "title": "Master Toulmin Refutation Drills",
    "description": "Dedicate 15 minutes daily to constructing Toulmin rebuttals under timed parliamentary cross-examination.",
    "skill_category": "Rebuttal",
    "priority": "High",
    "status": "Active"
}
res_create_rec = client.post("/api/v1/coaching/recommendations", headers=coach_headers, json=rec_payload)
assert res_create_rec.status_code == 200, f"Recommendation create failed: {res_create_rec.text}"
created_rec = res_create_rec.json()["recommendation"]
rec_id = created_rec["id"]
print(f"-> Created Recommendation #{rec_id}: '{created_rec['title']}' (Priority: {created_rec['priority']})")

# 6c. PUT update recommendation
res_update_rec = client.put(f"/api/v1/coaching/recommendations/{rec_id}", headers=coach_headers, json={
    "title": "Master Toulmin Refutation Drills (Advanced)",
    "priority": "High"
})
assert res_update_rec.status_code == 200, f"Recommendation update failed: {res_update_rec.text}"
assert res_update_rec.json()["recommendation"]["title"] == "Master Toulmin Refutation Drills (Advanced)"
print(f"-> Updated Recommendation #{rec_id} Title successfully.")

# 6d. PATCH status update
res_status_rec = client.patch(f"/api/v1/coaching/recommendations/{rec_id}/status", headers=coach_headers, json={"status": "Completed"})
assert res_status_rec.status_code == 200, f"Recommendation status update failed: {res_status_rec.text}"
assert res_status_rec.json()["new_status"] == "Completed"
print(f"-> Recommendation #{rec_id} Status transitioned to 'Completed'.")

# 7. TEST END-TO-END COACH FEEDBACK SUBMISSION & SYNCHRONIZATION
print("\n[7] Testing End-to-End Coach Feedback Submission & Synchronization...")
# Create a fresh debate session for the learner
db = SessionLocal()
new_debate = models.DebateSession(
    user_id=learner_id,
    title="Debate Championship Round",
    topic="Carbon taxation must be globally enforced by 2030.",
    format="Oxford Style Debate",
    assigned_position="Affirmative",
    status="Completed"
)
db.add(new_debate)
db.commit()
db.refresh(new_debate)
test_session_id = new_debate.id

# Initial PerformanceScore with Pending feedback
initial_perf = models.PerformanceScore(
    session_id=test_session_id,
    user_id=learner_id,
    overall_weighted_score=83.5,
    logical_consistency=82.0,
    argument_quality=85.0,
    rebuttal_effectiveness=84.0,
    evidence_use=80.0,
    communication_skills=86.0,
    coach_grade="Pending",
    coach_marks=None,
    coach_feedback="Official evaluation pending.",
    feedback_status="Pending"
)
db.add(initial_perf)
db.commit()
db.close()
print(f"-> Created Test Session ID #{test_session_id} with Coach Feedback Status='Pending'")

# Verify it reports as Pending
res_perf_before = client.get(f"/api/v1/sessions/{test_session_id}/performance", headers=learner_headers)
assert res_perf_before.status_code == 200
assert res_perf_before.json()["feedback_status"] == "Pending", "Expected status Pending before feedback!"
print("-> Confirmed Session Status before coach feedback: 'Pending'")

# Coach submits comprehensive feedback
feedback_payload = {
    "student_id": learner_id,
    "session_id": test_session_id,
    "feedback": "Outstanding dialectical poise! Your opening constructive speech established an unassailable warrant.",
    "strengths": "Clear Toulmin structure; robust empirical evidence citations; steady 142 WPM delivery pace.",
    "weaknesses": "Second rebuttal turn conceded the opponent's economic transition timeframe without comparative impact weighing.",
    "improvement_suggestions": "Preempt the economic cost argument during the opening 45 seconds using an Even-If frame.",
    "recommendations": "Run 3 rounds of Oxford rebuttal drills with the Contrarian persona.",
    "grade": "A",
    "marks": 92.5
}
res_submit_fb = client.post("/api/v1/coaching/coach/feedback", headers=coach_headers, json=feedback_payload)
assert res_submit_fb.status_code == 200, f"Feedback submission failed: {res_submit_fb.text}"
print("-> Coach submitted feedback with grade 'A' and marks 92.5%")

# Verify session performance is now Completed and contains all fields
res_perf_after = client.get(f"/api/v1/sessions/{test_session_id}/performance", headers=learner_headers)
assert res_perf_after.status_code == 200
after_data = res_perf_after.json()
assert after_data["feedback_status"] == "Completed", f"Expected Completed status, got {after_data['feedback_status']}"
assert after_data["coach_grade"] == "A", f"Expected grade A, got {after_data['coach_grade']}"
assert after_data["coach_marks"] == 92.5, f"Expected marks 92.5, got {after_data['coach_marks']}"
assert after_data["coach_strengths"] == feedback_payload["strengths"]
assert after_data["coach_weaknesses"] == feedback_payload["weaknesses"]
assert after_data["coach_improvements"] == feedback_payload["improvement_suggestions"]
assert after_data["coach_recommendations"] == feedback_payload["recommendations"]
print("-> Verified in Full Report: feedback_status='Completed' with 100% structured feedback fidelity!")

# Verify in learner debate history
res_learner_debates = client.get(f"/api/v1/sessions/history?session_type=debate", headers=learner_headers)
assert res_learner_debates.status_code == 200
target_in_history = next((s for s in res_learner_debates.json() if s["id"] == test_session_id), None)
assert target_in_history is not None
assert target_in_history["feedback_status"] == "Completed"
print("-> Verified in Learner Debate History: Session status='Completed'!")

# 8. TEST COACH EVALUATIONS LIST FILTERING
print("\n[8] Testing Coach Evaluations List & Filtering...")
res_evals_all = client.get("/api/v1/coaching/coach/evaluations", headers=coach_headers)
assert res_evals_all.status_code == 200, f"Failed to list evaluations: {res_evals_all.text}"
evals_all = res_evals_all.json()
print(f"-> Total Sessions in Coach Evaluations: {len(evals_all)}")

res_evals_pending = client.get("/api/v1/coaching/coach/evaluations?status_filter=Pending", headers=coach_headers)
assert res_evals_pending.status_code == 200
for ev in res_evals_pending.json():
    assert ev["feedback_status"] == "Pending"
print(f"-> Total Pending Evaluations for Coach Review: {len(res_evals_pending.json())}")

res_evals_completed = client.get("/api/v1/coaching/coach/evaluations?status_filter=Completed", headers=coach_headers)
assert res_evals_completed.status_code == 200
for ev in res_evals_completed.json():
    assert ev["feedback_status"] == "Completed"
print(f"-> Total Completed Evaluations: {len(res_evals_completed.json())}")

# 9. CLEANUP TEST RECOMMENDATION
client.delete(f"/api/v1/coaching/recommendations/{rec_id}", headers=coach_headers)
print(f"\n[9] Deleted test recommendation #{rec_id} cleanly.")

print("\n" + "=" * 70)
print("ALL BACKEND TESTS PASSED WITH 100% END-TO-END DATA SYNCHRONIZATION!")
print("=" * 70)
