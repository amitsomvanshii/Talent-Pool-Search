import { NextResponse } from 'next/server';
import { extractRawText, extractContactDetails, scrubPII } from '@/lib/parser';
import { parseResumeWithAI } from '@/lib/gemini';
import { addCandidate, saveResumeFile } from '@/lib/db';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const mimeType = file.type;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    console.log(`Processing file: ${fileName} (${mimeType}), size: ${fileBuffer.length} bytes`);

    // 1. Extract raw text from file locally
    let rawText = '';
    try {
      rawText = await extractRawText(fileBuffer, mimeType, fileName);
    } catch (extractErr) {
      console.error(`Text extraction failed for ${fileName}:`, extractErr);
      return NextResponse.json({ 
        error: `Could not extract text from file. Please ensure it is a valid PDF or Word document.` 
      }, { status: 422 });
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ 
        error: `Extracted text from ${fileName} is empty.` 
      }, { status: 422 });
    }

    // 2. Extract contact details (regex on raw text before scrubbing)
    const contactInfo = extractContactDetails(rawText);

    // Check for duplicate candidate (by email or phone)
    const { getCandidates } = require('@/lib/db');
    const existingCandidates = await getCandidates();
    const isDuplicate = existingCandidates.some(c => {
      const emailMatch = contactInfo.email && c.email && c.email.toLowerCase().trim() === contactInfo.email.toLowerCase().trim();
      const phoneMatch = contactInfo.phone && c.phone && c.phone.replace(/\D/g, '') === contactInfo.phone.replace(/\D/g, '');
      return emailMatch || phoneMatch;
    });

    if (isDuplicate) {
      return NextResponse.json({ 
        error: `Candidate with email '${contactInfo.email}' or phone number already exists in the talent pool.` 
      }, { status: 409 });
    }

    // 3. Scrub PII from the raw text (replace with placeholders)
    const scrubbedText = scrubPII(rawText);

    // 4. Send scrubbed text to AI model (Gemini or Local Heuristic fallback)
    const aiResults = await parseResumeWithAI(scrubbedText);

    // 5. Store file in storage (Supabase or Local uploads/)
    const resumeUrl = await saveResumeFile(fileName, fileBuffer);

    // 6. Save candidate record in database
    const candidateData = {
      name: contactInfo.name || fileName.split('.')[0] || 'Unknown',
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

    return NextResponse.json({
      success: true,
      candidate: savedCandidate
    });

  } catch (err) {
    console.error('API upload handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
