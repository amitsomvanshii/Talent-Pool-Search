import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const isGeminiEnabled = apiKey && apiKey !== 'your-gemini-api-key';

export async function parseResumeWithAI(scrubbedText) {
  if (isGeminiEnabled) {
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const prompt = `
        You are an expert recruitment AI. Analyze the following resume text, which has had all PII scrubbed and replaced with placeholders like [EMAIL], [PHONE], [LINKEDIN], [GITHUB].
        
        Extract the following candidate details as a JSON object:
        1. "skills": An array of technical/professional skills found in the text.
           CRITICAL PRIORITY RULE FOR SKILLS:
           - Identify the designated "Skills", "Expertise", "Core Competencies", or "Technologies" section in the resume.
           - Extract the skills listed in that primary skills section FIRST. Place them at the beginning of the "skills" array. These have high priority.
           - Extract secondary skills that are mentioned in the "Projects", "Experience", or "History" sections but are NOT present in the main skills section. Append these secondary skills at the end of the "skills" array.
           - Preserve this relative order in the final JSON array.
        
        2. "experience_years": A number representing the total years of professional experience. 
           CRITICAL RULE FOR EXPERIENCE:
           - Calculate this carefully. Do not just subtract the earliest year from the current year if there are large gaps or if they have only worked a few short terms.
           - Sum the actual duration of each job/role listed.
           - If not explicitly mentioned, sum the durations of employment blocks.
           - DO NOT include academic education periods, degree durations, or certifications in professional work experience.
           - If no experience is found, return 0.
        
        3. "recent_job_title": The candidate's most recent or current job title.
        4. "location": The candidate's location (city and state/country) if listed, or "Remote" or "Unknown".
        5. "career_breaks": An array of objects representing gaps or breaks in work history of more than 1 month. Each object must have "start" (Month Year), "end" (Month Year), and "duration" (e.g. "5 months", "1.2 years"). If none, return [].
        
        Resume text:
        """
        ${scrubbedText}
        """
        
        Return ONLY a JSON object matching this schema:
        {
          "skills": ["highPrioritySkill1", "highPrioritySkill2", "lowPrioritySkillFromProjects1"],
          "experience_years": 4.5,
          "recent_job_title": "Job Title",
          "location": "City, State/Country",
          "career_breaks": [
            {
              "start": "Month Year",
              "end": "Month Year",
              "duration": "5 months"
            }
          ]
        }
      `;

      const response = await model.generateContent(prompt);
      const textResult = response.response.text();
      
      try {
        const parsed = JSON.parse(textResult);
        return {
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          experience_years: typeof parsed.experience_years === 'number' ? parsed.experience_years : parseFloat(parsed.experience_years) || 0,
          recent_job_title: parsed.recent_job_title || 'Software Engineer',
          location: parsed.location || 'Unknown',
          career_breaks: Array.isArray(parsed.career_breaks) ? parsed.career_breaks : []
        };
      } catch (parseErr) {
        console.error('Failed to parse Gemini response as JSON:', textResult, parseErr);
      }
    } catch (err) {
      console.error('Gemini API call failed, falling back to local heuristic:', err.message);
    }
  }

  // Fallback / Mock AI extractor (Smart Heuristics with Skill Prioritization)
  return parseResumeHeuristics(scrubbedText);
}

const monthNames = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

function parseDateStr(str, defaultMonth = 0) {
  str = str.trim().toLowerCase();
  if (str === 'present' || str === 'current') {
    // Current local year is 2026
    return { year: 2026, month: 5 }; // June 2026
  }
  
  // Try matching MM/YYYY or MM-YYYY
  const numMatch = str.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (numMatch) {
    return { year: parseInt(numMatch[2]), month: parseInt(numMatch[1]) - 1 };
  }
  
  // Try matching Month Name YYYY (e.g. June 2026, Feb 2026, Dec 2025)
  const monthWordMatch = str.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s*\b(20\d{2})\b/i);
  if (monthWordMatch) {
    const m = monthNames[monthWordMatch[1].toLowerCase()];
    return { year: parseInt(monthWordMatch[2]), month: m };
  }
  
  // Try matching just Year (4 digits)
  const yearMatch = str.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return { year: parseInt(yearMatch[1]), month: defaultMonth };
  }
  
  return null;
}

function getSections(text) {
  const sections = {};
  const lines = text.split('\n');
  let currentSection = 'summary';
  sections[currentSection] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if line is a header
    if (trimmed.length < 50) {
      const lower = trimmed.toLowerCase();
      
      const isSkills = /skills|expertise|competencies|technologies/i.test(lower);
      const isEducation = /education|academic|training|degree|qualification/i.test(lower);
      const isExperience = /(work|employment|professional|career)\s+history|experience|employment/i.test(lower) && !isEducation;
      const isProjects = /projects/i.test(lower);
      const isSummary = /summary|profile|about\s+me/i.test(lower);
      const isCertifications = /certifications|certificates|licenses/i.test(lower);
      
      if (isSkills || isEducation || isExperience || isProjects || isSummary || isCertifications) {
        if (isExperience) {
          currentSection = 'experience';
        } else if (isProjects) {
          currentSection = 'projects';
        } else if (isEducation) {
          currentSection = 'education';
        } else if (isSkills) {
          currentSection = 'skills';
        } else if (isSummary) {
          currentSection = 'summary';
        } else if (isCertifications) {
          currentSection = 'certifications';
        }
        if (!sections[currentSection]) {
          sections[currentSection] = [];
        }
        continue;
      }
    }
    
    sections[currentSection].push(line);
  }
  
  for (const key in sections) {
    sections[key] = sections[key].join('\n');
  }
  return sections;
}

// Local smart heuristics parser to extract data if Gemini is not configured
function parseResumeHeuristics(text) {
  const lowercaseText = text.toLowerCase();
  const sections = getSections(text);
  
  // 1. Identify primary skills section vs other text
  const skillsSectionText = sections['skills'] || '';
  let otherText = '';
  for (const key in sections) {
    if (key !== 'skills') {
      otherText += '\n' + sections[key];
    }
  }

  const commonSkills = [
    'react', 'next.js', 'vue', 'angular', 'javascript', 'typescript', 'node.js', 'express',
    'python', 'django', 'flask', 'fastapi', 'java', 'spring boot', 'kotlin', 'swift',
    'c++', 'c#', '.net', 'rust', 'go', 'php', 'laravel', 'ruby on rails', 'sql', 'postgresql',
    'mongodb', 'redis', 'aws', 'docker', 'kubernetes', 'ci/cd', 'git', 'figma', 'ui/ux',
    'product management', 'scrum', 'agile', 'jira', 'project management', 'sales', 'marketing',
    'customer success', 'operations', 'financial analysis', 'excel', 'data science', 'machine learning',
    'mysql', 'power bi', 'oracle', 'spring', 'html', 'css', 'c', 'tableau', 'pandas', 'numpy', 
    'matplotlib', 'scikit-learn', 'tensorflow', 'keras', 'pytorch', 'gcp', 'azure'
  ];

  const primarySkills = [];
  const secondarySkills = [];

  // Parse custom skills from skills section first
  const lines = skillsSectionText.split('\n');
  for (const line of lines) {
    const lineWithoutParens = line.replace(/\([^)]*\)/g, '');
    const parts = lineWithoutParens.includes(':') ? lineWithoutParens.split(':').slice(1).join(':') : lineWithoutParens;
    const tokens = parts.split(/[;,•]|\b\s+and\s+\b/i);
    for (let token of tokens) {
      token = token.replace(/^[-•*+]\s*/, '').trim(); // Remove bullet points
      token = token.replace(/^[^\w+#.+]+|[^\w+#.+]+$/g, '').trim(); // Clean trailing/leading symbols
      if (token.endsWith('.') && !token.toLowerCase().endsWith('.net') && !token.toLowerCase().endsWith('.js')) {
        token = token.slice(0, -1).trim();
      }
      if (token.length >= 2 && token.length <= 30) {
        if (/^[a-zA-Z0-9#+.]/.test(token) && !/^(programming|database|tool|core|concept|analytical|ability|skills|development|visualization)/i.test(token)) {
          const formatted = token.split(' ').map(w => {
            if (/[a-z]/.test(w) && /[A-Z]/.test(w)) return w;
            if (/^[A-Z]{2,}$/.test(w)) return w;
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          }).join(' ');
          
          if (formatted && !primarySkills.includes(formatted)) {
            primarySkills.push(formatted);
          }
        }
      }
    }
  }

  // Also check commonSkills against the skills section just in case we missed any
  const lowercaseSkillsText = skillsSectionText.toLowerCase();
  commonSkills.forEach(skill => {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const displaySkill = skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    if (regex.test(lowercaseSkillsText)) {
      if (!primarySkills.includes(displaySkill)) {
        primarySkills.push(displaySkill);
      }
    }
  });

  // Now scan other sections for secondary skills (not already in primarySkills)
  const lowercaseOtherText = otherText.toLowerCase();
  commonSkills.forEach(skill => {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const displaySkill = skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    if (regex.test(lowercaseOtherText)) {
      const alreadyHave = primarySkills.some(ps => ps.toLowerCase() === skill.toLowerCase());
      if (!alreadyHave && !secondarySkills.includes(displaySkill)) {
        secondarySkills.push(displaySkill);
      }
    }
  });

  const orderedSkills = [...primarySkills, ...secondarySkills];

  // 2. Extract Experience Years & Career Breaks
  let experienceYears = 0;
  let careerBreaks = [];
  
  const experienceText = sections['experience'] || '';
  const rangeRegex = /\b([a-z]{3,9}\s+\d{4}|\d{1,2}[-/]\d{4}|\d{4})\s*(?:-|–|—|to)\s*([a-z]{3,9}\s+\d{4}|\d{1,2}[-/]\d{4}|\d{4}|present|current)\b/gi;
  
  const intervals = [];
  let match;
  while ((match = rangeRegex.exec(experienceText)) !== null) {
    const start = parseDateStr(match[1], 0);
    const end = parseDateStr(match[2], 11);
    if (start && end) {
      const startVal = start.year * 12 + start.month;
      const endVal = end.year * 12 + end.month;
      if (startVal <= endVal) {
        intervals.push({ start: startVal, end: endVal, startText: match[1], endText: match[2] });
      }
    }
  }

  if (intervals.length > 0) {
    // Sort intervals by start date ascending
    intervals.sort((a, b) => a.start - b.start);
    
    // Merge intervals for experience years calculation
    const merged = [{ start: intervals[0].start, end: intervals[0].end }];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const last = merged[merged.length - 1];
      if (current.start <= last.end + 1) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ start: current.start, end: current.end });
      }
    }
    
    let totalMonths = 0;
    for (const interval of merged) {
      totalMonths += (interval.end - interval.start + 1);
    }
    experienceYears = Math.round((totalMonths / 12) * 10) / 10;

    // Detect Career Breaks (gaps of > 1 month between sorted intervals)
    // We check the gap between consecutive intervals
    // First, merge intervals to establish actual working periods
    for (let i = 0; i < merged.length - 1; i++) {
      const currentEnd = merged[i].end;
      const nextStart = merged[i+1].start;
      const gapMonths = nextStart - currentEnd - 1;
      
      if (gapMonths > 1) {
        // Calculate gap representation
        let durationText = '';
        if (gapMonths >= 12) {
          const yrs = Math.round((gapMonths / 12) * 10) / 10;
          durationText = `${yrs} year${yrs !== 1 ? 's' : ''}`;
        } else {
          durationText = `${gapMonths} month${gapMonths !== 1 ? 's' : ''}`;
        }
        
        // Format dates
        const startYear = Math.floor((currentEnd + 1) / 12);
        const startMonthNum = (currentEnd + 1) % 12;
        const endYear = Math.floor((nextStart - 1) / 12);
        const endMonthNum = (nextStart - 1) % 12;
        
        const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const startStr = `${monthShortNames[startMonthNum]} ${startYear}`;
        const endStr = `${monthShortNames[endMonthNum]} ${endYear}`;
        
        careerBreaks.push({
          start: startStr,
          end: endStr,
          duration: durationText
        });
      }
    }
  }

  // Fallback to explicit experience statement check ONLY if no intervals were parsed
  if (experienceYears === 0) {
    const expMatch = text.match(/(\d+)\+?\s*years?\s*of\s*(?:[a-zA-Z-\s]{1,15}\s+)?experience/i) || 
                     text.match(/experience\s*:\s*(\d+)\+?\s*years?/i) ||
                     text.match(/(\d+)\+?\s*years?\s*experience/i);
    if (expMatch) {
      experienceYears = parseInt(expMatch[1]);
    }
  }

  // 3. Extract Job Title
  let recentJobTitle = 'Software Engineer';
  const experienceLines = experienceText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let foundTitle = false;
  for (let i = 0; i < Math.min(experienceLines.length, 4); i++) {
    const line = experienceLines[i];
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      continue;
    }
    
    const dateMatch = line.match(/\b(20\d{2}|present|current)\b/i);
    const hasSeparator = /[|–—,-]/.test(line);
    
    if (dateMatch || hasSeparator) {
      const parts = line.split(/[|–—,-]|\bat\b/i);
      let titleCandidate = parts[0].trim();
      
      // Clean up dates and non-alphabetical chars
      titleCandidate = titleCandidate.replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi, '');
      titleCandidate = titleCandidate.replace(/\b(20\d{2}|present|current)\b/gi, '');
      titleCandidate = titleCandidate.replace(/[^a-zA-Z\s]/g, '').trim();
      
      if (titleCandidate.length >= 4 && titleCandidate.length <= 40 && !/^(experience|work|history|employment)/i.test(titleCandidate)) {
        recentJobTitle = titleCandidate.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        foundTitle = true;
        break;
      }
    }
  }
  
  if (!foundTitle) {
    for (const line of experienceLines) {
      if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
        const parts = line.split(/[|–—,]/);
        const clean = parts[0].replace(/[^a-zA-Z\s]/g, '').trim();
        if (clean.length >= 4 && clean.length <= 40) {
          recentJobTitle = clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          foundTitle = true;
          break;
        }
      }
    }
  }

  // Final fallback to common titles if still not found or looks like default
  if (!foundTitle) {
    const commonTitles = [
      'software engineer', 'frontend developer', 'backend developer', 'full stack developer',
      'ui/ux designer', 'product designer', 'product manager', 'project manager',
      'sales manager', 'account executive', 'operations lead', 'operations manager',
      'data analyst', 'data scientist', 'devops engineer', 'marketing specialist'
    ];
    for (const title of commonTitles) {
      const regex = new RegExp(`\\b${title}\\b`, 'i');
      if (regex.test(lowercaseText)) {
        recentJobTitle = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        break;
      }
    }
  }

  // 4. Extract Location
  let location = 'Remote';
  const commonLocations = [
    'san francisco, ca', 'new york, ny', 'seattle, wa', 'austin, tx', 'chicago, il',
    'los angeles, ca', 'boston, ma', 'denver, co', 'london, uk', 'toronto, on', 'berlin, germany',
    'bengaluru, india', 'singapore'
  ];

  for (const loc of commonLocations) {
    const city = loc.split(',')[0];
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(lowercaseText)) {
      location = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  return {
    skills: orderedSkills.length > 0 ? orderedSkills : ['Javascript', 'React', 'HTML/CSS'],
    experience_years: experienceYears,
    recent_job_title: recentJobTitle,
    location: location,
    career_breaks: careerBreaks
  };
}

export function getAiMode() {
  return isGeminiEnabled ? 'Gemini 1.5 Flash API' : 'Local Smart Heuristics (Offline)';
}
