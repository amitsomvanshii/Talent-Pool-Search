import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractRawText, extractContactDetails, scrubPII } from '@/lib/parser';
import { parseResumeWithAI } from '@/lib/gemini';
import { addCandidate, saveResumeFile, getCandidates } from '@/lib/db';

export async function POST() {
  try {
    // Check if we already have candidates. If we do, don't duplicate
    const existing = await getCandidates();
    if (existing && existing.length > 5) {
      return NextResponse.json({ 
        success: true, 
        message: 'Database already has candidates. Seeding skipped to prevent duplicates.',
        count: existing.length
      });
    }

    const testResumesDir = path.join(process.cwd(), 'test-resumes');
    if (!fs.existsSync(testResumesDir)) {
      return NextResponse.json({ error: 'Test resumes directory not found. Please run node scripts/generate-resumes.js first.' }, { status: 404 });
    }

    const files = fs.readdirSync(testResumesDir).filter(f => f.endsWith('.pdf'));
    console.log(`Seeding ${files.length} resumes...`);

    const seededCandidates = [];
    
    // Process them sequentially to avoid overloading the AI endpoint or DB
    for (const fileName of files) {
      const filePath = path.join(testResumesDir, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      
      // Extract text
      const rawText = await extractRawText(fileBuffer, 'application/pdf', fileName);
      
      // Extract contact details
      const contactInfo = extractContactDetails(rawText);
      
      // Scrub PII
      const scrubbedText = scrubPII(rawText);
      
      // Parse with AI
      const aiResults = await parseResumeWithAI(scrubbedText);
      
      // Save file
      const resumeUrl = await saveResumeFile(fileName, fileBuffer);
      
      // Add candidate
      const candidateData = {
        name: contactInfo.name,
        email: contactInfo.email || null,
        phone: contactInfo.phone || null,
        linkedin_url: contactInfo.linkedinUrl || null,
        github_url: contactInfo.githubUrl || null,
        resume_url: resumeUrl,
        raw_text: rawText,
        scrubbed_text: scrubbedText,
        skills: aiResults.skills || [],
        experience_years: aiResults.experience_years || 0,
        recent_job_title: aiResults.recent_job_title || 'Software Engineer',
        location: aiResults.location || 'Unknown',
        career_breaks: aiResults.career_breaks || []
      };
      
      const savedCandidate = await addCandidate(candidateData);
      seededCandidates.push(savedCandidate);
      console.log(`Successfully seeded candidate: ${savedCandidate.name}`);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${seededCandidates.length} candidates successfully!`,
      count: seededCandidates.length
    });

  } catch (err) {
    console.error('Seeding database error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
