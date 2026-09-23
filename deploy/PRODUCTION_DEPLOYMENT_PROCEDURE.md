# LOGOS.AI — End-to-End Production Deployment Procedure Guide

This document provides complete, production-tested instructions for deploying the **LOGOS.AI** platform (Agentic AI Debate Coach & Presentation Analysis Platform).

---

## 1. System Architecture Overview

The platform consists of four decoupled layers:
1. **Frontend Client**: Next.js 14 Responsive Web App (`frontend/`) running on port `3000`.
2. **Backend Core Engine**: FastAPI + SQLAlchemy + Uvicorn (`backend/`) running on port `8000`.
3. **Primary Relational Database**: PostgreSQL 16 (manages users, authentication, debate sessions, performance scores, coaching plans).
4. **Document Store Database**: MongoDB 7.0 (stores multi-turn debate transcripts, speech acoustic logs, audit trails).

---

## 2. Deployment Option 1: Docker Compose (Recommended for VPS / Cloud VMs)

This is the fastest, cleanest deployment method for AWS EC2, DigitalOcean Droplets, Linode, Hetzner, or any Linux server with Docker.

### Prerequisites
- A Linux VPS (Ubuntu 22.04 LTS or 24.04 LTS recommended, min 2 vCPU / 4GB RAM)
- Docker & Docker Compose installed:
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  ```

### Step-by-Step Instructions

#### Step 1: Clone the Codebase
```bash
git clone https://github.com/springboardmentor0702-lgtm/Agentic-AI-Debate-Coach-Presentation-Analysis-Platform.git logos-ai
cd logos-ai
```

#### Step 2: Configure Environment Variables
Create the root `.env` or set variables inside `backend/.env`:
```bash
cat << 'EOF' > backend/.env
PROJECT_NAME="LOGOS.AI - Agentic Debate Coach & Presentation Analysis Platform"
SECRET_KEY="generate-a-strong-random-64-character-secret-key"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# PostgreSQL (Docker internal service name: postgres_db)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YourStrongDbPassword2026!
POSTGRES_HOST=postgres_db
POSTGRES_PORT=5432
POSTGRES_DB=logos_ai_db
DATABASE_URL=postgresql://postgres:YourStrongDbPassword2026!@postgres_db:5432/logos_ai_db

# MongoDB (Docker internal service name: mongo_db)
MONGO_URI=mongodb://mongo_db:27017
MONGO_DB=logos_ai_transcripts

# External LLM Engine API Keys (Optional - built-in local English reasoning engine activates if omitted)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-2.0-flash

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
EOF
```

Also configure `docker-compose.yml` passwords matching `backend/.env`.

#### Step 3: Build and Launch All 4 Services
```bash
docker compose up --build -d
```

#### Step 4: Verify Deployment Health
```bash
# Check container status
docker compose ps

# Check backend logs
docker compose logs -f backend

# Check frontend logs
docker compose logs -f frontend
```

#### Step 5: Test Endpoints
- **Frontend App**: `http://<YOUR_SERVER_IP>:3000`
- **Backend API Docs**: `http://<YOUR_SERVER_IP>:8000/docs`

---

## 3. Deployment Option 2: Managed Cloud (Vercel + Railway / Render)

This option offers zero server maintenance and automatic scaling.

### Part A: Managed Cloud Databases (Free Tier Compatible)
1. **PostgreSQL**: Create a free PostgreSQL instance on **[Neon.tech](https://neon.tech)** or **[Supabase](https://supabase.com)**.
   - Copy the connection string: `postgresql://user:pass@ep-xyz.neon.tech/logos_ai_db?sslmode=require`
2. **MongoDB**: Create a free M0 cluster on **[MongoDB Atlas](https://www.mongodb.com/atlas)**.
   - Whitelist `0.0.0.0/0` (or Railway/Render IPs).
   - Copy the connection URI: `mongodb+srv://user:pass@cluster0.mongodb.net/logos_ai_transcripts?retryWrites=true&w=majority`

### Part B: Backend Deployment on Railway or Render
1. Create a new service from your GitHub repository.
2. Set **Root Directory**: `backend` (or use repository root with Dockerfile).
3. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set Environment Variables:
   - `DATABASE_URL`: Your Neon/Supabase PostgreSQL connection string.
   - `MONGO_URI`: Your MongoDB Atlas URI.
   - `MONGO_DB`: `logos_ai_transcripts`
   - `SECRET_KEY`: Random 64-character string.
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`
   - `GROQ_API_KEY`: (Optional) Your Groq API key.
   - `GEMINI_API_KEY`: (Optional) Your Gemini API key.
5. Deploy! Railway / Render will generate a public URL, e.g., `https://logos-backend.up.railway.app`.

### Part C: Frontend Deployment on Vercel
1. Import your GitHub repository into **[Vercel](https://vercel.com)**.
2. Select **Framework Preset**: `Next.js`.
3. Set **Root Directory**: `frontend`.
4. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://logos-backend.up.railway.app`
   - `NEXT_PUBLIC_BACKEND_URL`: `https://logos-backend.up.railway.app`
5. Click **Deploy**. Vercel will automatically build the Next.js static and serverless assets.

---

## 4. Deployment Option 3: Ubuntu Linux VPS with Nginx & Let's Encrypt SSL

For a production custom domain (e.g. `logos-ai.com` and `api.logos-ai.com`) on an Ubuntu server.

### Step 1: Install Dependencies
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

### Step 2: Setup Backend Service
```bash
cd /var/www/logos-ai/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create systemd service `/etc/systemd/system/logos-backend.service`:
```ini
[Unit]
Description=LOGOS.AI FastAPI Backend Daemon
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/logos-ai/backend
Environment="PATH=/var/www/logos-ai/backend/venv/bin"
EnvironmentFile=/var/www/logos-ai/backend/.env
ExecStart=/var/www/logos-ai/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable logos-backend
sudo systemctl start logos-backend
```

### Step 3: Build & Launch Frontend with PM2
```bash
cd /var/www/logos-ai/frontend
npm install
npm run build
pm2 start npm --name "logos-frontend" -- start -- -p 3000
pm2 save
pm2 startup
```

### Step 4: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/logos-ai`:
```nginx
# Frontend Web App
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/logos-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Enable Free HTTPS SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```
Certbot will automatically renew your certificates via cron.

---

## 5. Production Environment Variables Reference

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `SECRET_KEY` | **Yes** | `64-char-hex-random` | Signs JWT authentication tokens securely. |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db` | Primary PostgreSQL database connection. |
| `MONGO_URI` | **Yes** | `mongodb://localhost:27017` | MongoDB transcript connection string. |
| `MONGO_DB` | No | `logos_ai_transcripts` | Target MongoDB database name. |
| `CORS_ORIGINS` | **Yes** | `https://yourdomain.com` | Allowed domains for browser CORS security. |
| `GROQ_API_KEY` | Optional | `gsk_...` | High-speed LLM inference (Llama 3.3 70B). |
| `GEMINI_API_KEY` | Optional | `AIza...` | Google Gemini 2.0 Flash reasoning engine. |
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://api.yourdomain.com` | Public backend URL consumed by Next.js client. |

---

## 6. Post-Deployment Verification Checklist

Once deployed, run this 5-point verification:
1. **Frontend Landing Page**: Visit `https://yourdomain.com` and ensure styles, icons, and hero sections render.
2. **User Registration (Sign Up)**: Click **Sign Up**, choose a role (e.g. `Debate Coach`), and register.
3. **User Authentication (Login)**: Log out, click **Login**, enter email and password. Verify you are automatically identified with your role.
4. **Debate Simulation**: Run a turn in `/simulation` to verify WebSocket/REST communication and AI response generation.
5. **PDF Report Export**: Open any completed session report and click **Export PDF** to verify ReportLab canvas generation.
