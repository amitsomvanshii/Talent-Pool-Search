# Talent Pool Search

A modern web application built for recruiters to easily upload, process, and search candidate resumes. Designed with **local PII privacy-first scrubbing** and **AI-powered metadata extraction**.

---

## Key Features

1. **Multi-Resume Upload (PDF & Word)**
   - Upload multiple resumes simultaneously.
   - Real-time status progress indicators (Uploading &rarr; Text Extraction &rarr; PII Isolation &rarr; AI Processing &rarr; Saving).
2. **Local PII Scrubbing**
   - Automatically parses candidate name, email, phone, LinkedIn, and GitHub links before sending anything to AI.
   - Replaces contact details in the resume text with placeholders: `[EMAIL]`, `[PHONE]`, `[LINKEDIN]`, and `[GITHUB]`.
   - Ensures the AI model *only* analyzes professional experience and skills, preserving candidate privacy.
3. **AI-Powered Profile Extraction**
   - Integrates with **Google Gemini 1.5 Flash** (with a smart offline regex-heuristic fallback) to extract skills, experience years, job title, and location.
4. **Rich Candidate Dashboard**
   - Search by specific skills (keyword search).
   - Filter by minimum years of experience.
   - Filter by location.
   - Click cards to inspect full extracted candidate metadata and compare **Scrubbed AI Text** vs **Raw Recruiter Text** side-by-side.
5. **Interactive UI Seeding**
   - Generate and seed 25 distinct test resumes in 1 click from the dashboard header if the database is empty.

---

## Tech Stack

- **Framework**: Next.js 16 (React, Tailwind CSS v4)
- **Database & Storage**: Supabase (PostgreSQL + Storage) with a local JSON File + public uploads fallback.
- **AI Processing**: Google Gemini 1.5 Flash (via `@google/generative-ai`)
- **Text Parsers**: `pdf-parse` (PDF) and `mammoth` (Word/Docx)

---

## Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v20+ recommended).

### 2. Installation
Clone this repository, navigate to the folder, and install dependencies:
```bash
npm install
```

### 3. Generate Test Data Resumes
To generate the 25 realistic, fully-formatted PDF resumes to seed the system, run:
```bash
node scripts/generate-resumes.js
```
This generates PDF files in the `test-resumes/` directory.

### 4. Configuration (Optional)
This application includes a **graceful local fallback mode**. If no API keys are provided, it will:
- Save metadata to a local file (`db.json`)
- Save uploaded resumes to `public/uploads/`
- Extract skills and experience using a local regex-heuristic engine

To connect to live cloud services, rename `.env.example` to `.env.local` and add your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

If utilizing Supabase, create the table by running the SQL in [schema.sql](file:///c:/Users/amits/Desktop/Projects/TechAssist/schema.sql) inside your Supabase SQL Editor.

### 5. Running Locally
Run the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- Click **"Seed 25 Test Resumes"** in the top header to instantly populate the database with the pre-generated resumes.
- Or head to the **"Upload Resumes"** tab to drag and drop your own PDF or Word files!
