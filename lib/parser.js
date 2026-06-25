import { getDocumentProxy, extractText } from 'unpdf';
import mammoth from 'mammoth';

// Helper to extract text from PDF
export async function extractPdfText(fileBuffer) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
    const result = await extractText(pdf);
    return Array.isArray(result.text) ? result.text.join('\n') : (result.text || '');
  } catch (err) {
    console.error('Error parsing PDF:', err);
    throw new Error('Failed to parse PDF resume');
  }
}

// Helper to extract text from Docx (Word)
export async function extractDocxText(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
  } catch (err) {
    console.error('Error parsing Word document:', err);
    throw new Error('Failed to parse Word resume');
  }
}

// Core function to extract raw text based on mimetype
export async function extractRawText(fileBuffer, mimeType, fileName = '') {
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return await extractPdfText(fileBuffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    fileName.toLowerCase().endsWith('.docx') ||
    fileName.toLowerCase().endsWith('.doc')
  ) {
    return await extractDocxText(fileBuffer);
  } else {
    // Treat as plain text
    return fileBuffer.toString('utf8');
  }
}

// Regex definitions
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{3,6}\b|(?:\+91|0)?[6-9]\d{9}\b/g;
const LINKEDIN_REGEX = /(https?:\/\/)?(www\.)?linkedin\.com\/(in|pub)\/[a-zA-Z0-9_-]+\/?/gi;
const GITHUB_REGEX = /(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/gi;

// Clean URLs helper
function cleanUrl(url) {
  if (!url) return '';
  let clean = url.trim();
  // Ensure it has https:// if it doesn't
  if (!/^https?:\/\//i.test(clean)) {
    clean = 'https://' + clean;
  }
  return clean;
}

function extractPhone(rawText) {
  // Pattern 1: standard phone numbers
  const p1 = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{3,6}\b/g;
  const matches1 = rawText.match(p1);
  if (matches1) {
    for (const m of matches1) {
      const digits = m.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) return m.trim();
    }
  }

  // Pattern 2: Indian mobile numbers
  const p2 = /(?:\+91|0)?[6-9]\d{9}\b/g;
  const matches2 = rawText.match(p2);
  if (matches2) return matches2[0].trim();

  // Pattern 3: context-based
  const p3 = /(?:phone|mobile|mob|contact|m|t|tel|ph|cell)[:.\s-]*(\+?[0-9\s.-]{8,15})/gi;
  let match;
  while ((match = p3.exec(rawText)) !== null) {
    const num = match[1].trim();
    const digits = num.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return num;
    }
  }

  return '';
}

// Separate extraction of contact details from raw text using regex
export function extractContactDetails(rawText) {
  const emails = rawText.match(EMAIL_REGEX) || [];
  const linkedins = rawText.match(LINKEDIN_REGEX) || [];
  const githubs = rawText.match(GITHUB_REGEX) || [];

  const email = emails[0] || '';
  const phone = extractPhone(rawText) || '';
  const linkedinUrl = linkedins[0] ? cleanUrl(linkedins[0]) : '';
  const githubUrl = githubs[0] ? cleanUrl(githubs[0]) : '';

  // Name extraction heuristic:
  // Usually, the candidate's name is in the first 5 non-empty lines of the resume.
  // We clean them up and attempt to identify the first line that is strictly a name.
  let name = '';
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 60);

  // We look specifically at the first 5 lines
  const candidateLines = lines.slice(0, 5);

  for (const line of candidateLines) {
    // Skip if it contains email, phone, url, or common resume titles / section headers
    if (
      EMAIL_REGEX.test(line) ||
      PHONE_REGEX.test(line) ||
      LINKEDIN_REGEX.test(line) ||
      GITHUB_REGEX.test(line) ||
      /resume|curriculum|cv|contact|profile|summary|education|experience|skills|work|projects|projects:|personal|professional|history|about|details|address/i.test(line)
    ) {
      continue;
    }
    
    // Check if it looks like a typical name: 2-3 capitalized words (e.g. "John Doe", "Jane A. Smith")
    // Avoid lines containing typical verbs, common nouns, lower case words, or long descriptions.
    // Ensure all words (or initials) are capitalized.
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const isNamePattern = words.every(word => /^[A-Z][a-zA-Z'.&-]*$/.test(word));
      // Also filter out common job titles or qualifications
      const isCommonJobTitleOrSkill = /developer|engineer|designer|manager|architect|lead|analyst|scrum|phd|mtech|btech|mca|bca|senior|junior|intern/i.test(line);
      if (isNamePattern && !isCommonJobTitleOrSkill) {
        name = line;
        break;
      }
    }
  }

  // Fallback if no matching name line is found: clean up the first line if possible
  if (!name && lines.length > 0) {
    // Filter out common header words if lines[0] is one
    const firstLine = lines[0];
    if (!/resume|curriculum|cv|contact|profile|summary|education|experience|skills|work/i.test(firstLine) && firstLine.length < 40) {
      name = firstLine;
    }
  }

  return {
    name: name || 'Unknown Candidate',
    email,
    phone,
    linkedinUrl,
    githubUrl
  };
}

// Scrub PII from the resume text before sending to AI
export function scrubPII(rawText) {
  if (!rawText) return '';

  let scrubbed = rawText;

  // Replace emails
  scrubbed = scrubbed.replace(EMAIL_REGEX, '[EMAIL]');

  // Replace phone numbers
  scrubbed = scrubbed.replace(PHONE_REGEX, '[PHONE]');

  // Replace LinkedIn URLs
  scrubbed = scrubbed.replace(LINKEDIN_REGEX, '[LINKEDIN]');

  // Replace GitHub URLs
  scrubbed = scrubbed.replace(GITHUB_REGEX, '[GITHUB]');

  return scrubbed;
}
