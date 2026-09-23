import os
import urllib.parse
from sqlalchemy import create_engine, text
import pymongo
from config import settings

print("=" * 60)
print("LOGOS.AI -- CLOUD DATABASE LIVE HEALTH & AUDIT CHECK")
print("=" * 60)

# 1. Supabase PostgreSQL Check
print("\n[1] Checking Primary PostgreSQL Database (Supabase)...")
try:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        db_info = conn.execute(text("SELECT current_database(), current_user")).fetchone()
        print("-> Status: CONNECTED")
        print(f"-> Database: {db_info[0]} | User: {db_info[1]}")
        
        # Query Users
        users = conn.execute(text("SELECT id, email, full_name, role, created_at FROM users ORDER BY id ASC")).fetchall()
        print(f"\n--- Registered Users ({len(users)}) ---")
        if not users:
            print("  (No users registered yet)")
        for u in users:
            print(f"  [ID {u[0]}] {u[1]} | Name: {u[2]} | Role: {u[3]} | Joined: {u[4]}")

        # Query Sessions
        sessions = conn.execute(text("SELECT id, user_id, title, format, status, created_at FROM debate_sessions ORDER BY id DESC LIMIT 10")).fetchall()
        print(f"\n--- Recent Debate Sessions ({len(sessions)}) ---")
        if not sessions:
            print("  (No debate sessions recorded yet)")
        for s in sessions:
            print(f"  [Session #{s[0]}] User #{s[1]} | {s[2]} | Format: {s[3]} | Status: {s[4]}")

        # Query Scores
        scores = conn.execute(text("SELECT id, session_id, user_id, overall_weighted_score, feedback_status FROM performance_scores ORDER BY id DESC LIMIT 5")).fetchall()
        print(f"\n--- Performance Scores ({len(scores)}) ---")
        if not scores:
            print("  (No scores recorded yet)")
        for sc in scores:
            print(f"  [Score #{sc[0]}] Session #{sc[1]} | User #{sc[2]} | Score: {sc[3]}% | Feedback: {sc[4]}")

except Exception as e:
    print(f"-> PostgreSQL Check Failed: {e}")

# 2. MongoDB Atlas Check
print("\n[2] Checking Secondary Document Database (MongoDB Atlas)...")
try:
    client = pymongo.MongoClient(
        settings.MONGO_URI, 
        serverSelectionTimeoutMS=5000, 
        tlsAllowInvalidCertificates=True
    )
    client.admin.command("ping")
    db = client[settings.MONGO_DB]
    collections = db.list_collection_names()
    print("-> Status: CONNECTED")
    print(f"-> Database: {settings.MONGO_DB}")
    colls_str = str(collections) if collections else "(empty - will populate as debates are run)"
    print(f"-> Collections found: {colls_str}")
    for coll_name in collections:
        count = db[coll_name].count_documents({})
        print(f"   * {coll_name}: {count} documents")
except Exception as e:
    print(f"-> MongoDB Check Failed: {e}")

print("\n" + "=" * 60)
print("DATABASE AUDIT COMPLETE")
print("=" * 60)
