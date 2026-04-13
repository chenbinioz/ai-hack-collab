# Cohort Connect

An intelligent peer-matching and collaboration platform for Imperial STEM. Features: AI matching (scikit-learn), real-time team coaching (Gemini 1.5 Pro), and accountability tracking. Built with Next.js, FastAPI, and Supabase for the Grand Challenge 2 2026.

Language Python, API framework FastAPI, Database SQLite, AI matching Claude API, Hosting next.js, Version control GitHub Required by brief

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# [AI-HACK-COLLAB]
### Team: [Cohort Connect]

## 🌍 Grand Challenge Addressed
**Challenge:** Enhancing Collaborative Learning in Higher Education.
This project addresses the difficulty of forming effective, balanced student study groups or project pairs. By reducing "team friction" and maximizing "skill diversity," we aim to improve student retention and performance in complex subjects.

## 💡 Problem Statement & Solution Overview
**Problem:** Students often pair up based on friendship rather than complementary skills, or are paired randomly by instructors, leading to imbalanced workloads and personality clashes.
**Solution:** A data-driven peer-matching platform. Using a multi-page survey, we capture student confidence across various domains and their preferred working styles. Our matching engine uses **Cosine Similarity** to ensure students share a "working vibe" while maintaining a **Skill Gap** to encourage peer-to-peer teaching.

## 🛠 Technology Stack & Architecture
### Frontend 
- **Next.js (React):** A modern framework for the user dashboard and onboarding survey.
- **Tailwind CSS:** For a clean, responsive, and accessible interface.

### Backend & Data 
- **Supabase (PostgreSQL):** Handles data storage, user authentication, and secure row-level access.
- **FastAPI (Python):** Orchestrates the matching logic and communicates between the UI and the DB.
- **NumPy & Scikit-learn:** Performs the mathematical vectorization for the matching algorithm.

### Architecture Diagram

1. **User Auth:** Managed via Supabase Auth.
2. **Database:** Automated profile creation via PostgreSQL Triggers.
3. **Logic:** FastAPI pulls student vectors, calculates compatibility, and pushes match IDs back to Supabase.

## 🚀 Installation and Setup Instructions

### 1. Database Setup (Supabase)
1. Create a new project in [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** and run the provided `schema.sql` script (this creates the `student_profiles` table, triggers, and RLS policies).
3. Disable "Email Confirmation" in **Authentication > Providers** for easier testing during development.

### 2. Backend Setup (FastAPI)
1. Navigate to the `/backend` folder.
2. Install dependencies: `pip install fastapi uvicorn supabase python-dotenv numpy scikit-learn`.
3. Create a `.env` file and add your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run the server: `uvicorn main:app --reload`.

### 3. Frontend Setup (Next.js)
1. Navigate to the `/frontend` folder.
2. Install dependencies: `npm install`.
3. Create a `.env.local` file with your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run the app: `npm run dev`.

## 📖 Usage Guide
1. **Sign Up:** Create a student account.
2. **Onboarding Survey:** Complete the 3-page survey covering demographics, confidence levels, and approach to work.
3. **Dashboard:** Once submitted, your profile is "Locked" and the matching engine pairs you with a classmate.
4. **View Match:** See your partner’s contact info and the "Match Reason" explaining why you were paired.

## 🎥 Demo Video
[Link to your YouTube/Loom/Drive Video Demo]

## 👥 Team Member Details and Contributions
- **[Your Name] (Data Lead):** Database architecture, SQL trigger automation, RLS security policies, and data schema design.
- **[Teammate 1] (Frontend Lead):** Next.js UI development, survey form logic, and API integration.
- **[Teammate 2] (Backend Lead):** FastAPI matching engine, algorithm implementation, and server-side logic.

## 📜 License Information
This project is licensed under the **MIT License** - see the LICENSE file for details.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
