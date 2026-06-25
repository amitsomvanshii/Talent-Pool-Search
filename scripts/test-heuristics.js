import fs from 'fs';
import path from 'path';
import { getDocumentProxy, extractText } from 'unpdf';

// Simple mockup of heuristics from gemini.js
function parseResumeHeuristics(text) {
  const lowercaseText = text.toLowerCase();
  let experienceYears = 0;
  
  const expMatch = text.match(/(\d+)\+?\s*years?\s*of\s*experience/i) || 
                   text.match(/experience\s*:\s*(\d+)\+?\s*years?/i);
  if (expMatch) {
    experienceYears = parseInt(expMatch[1]);
  } else {
    const dateRangeRegex = /\b(20\d{2})\s*[-–—]\s*(20\d{2}|present|current)\b/gi;
    let match;
    let ranges = [];
    while ((match = dateRangeRegex.exec(lowercaseText)) !== null) {
      const startYear = parseInt(match[1]);
      const endYearStr = match[2];
      const endYear = (endYearStr === 'present' || endYearStr === 'current') 
        ? 2026 
        : parseInt(endYearStr);
      
      const duration = endYear - startYear;
      if (duration > 0 && duration < 30) {
        ranges.push({ startYear, endYear, duration });
      }
    }

    if (ranges.length > 0) {
      experienceYears = ranges.reduce((sum, r) => sum + r.duration, 0);
    } else {
      const dates = text.match(/\b(20\d{2})\b/g);
      if (dates && dates.length >= 2) {
        const uniqueYears = [...new Set(dates.map(Number))].sort((a, b) => a - b);
        const diff = uniqueYears[uniqueYears.length - 1] - uniqueYears[0];
        if (diff > 0 && diff < 30) {
          experienceYears = diff;
        }
      }
    }
  }

  if (experienceYears === 0) {
    experienceYears = 2;
  }
  return experienceYears;
}

async function testAll() {
  const dir = path.join(process.cwd(), 'test-resumes');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  
  for (const file of files) {
    const buf = fs.readFileSync(path.join(dir, file));
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const res = await extractText(pdf);
    const text = Array.isArray(res.text) ? res.text.join('\n') : (res.text || '');
    const yoe = parseResumeHeuristics(text);
    console.log(`${file}: extracted ${yoe} years`);
  }
}

testAll().catch(console.error);
