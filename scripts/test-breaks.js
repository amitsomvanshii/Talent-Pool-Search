const text = `Experience
Associate Developer | InfyTech Solutions July 2021 – December 2023
• Worked on python django schemas
Backend Developer | CloudCart Systems June 2024 – Present
• Built Order Processing backend`;

const monthNames = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

function parseDateStr(str, defaultMonth = 0) {
  str = str.trim().toLowerCase();
  if (str === 'present' || str === 'current') {
    return { year: 2026, month: 5 }; // June 2026
  }
  const numMatch = str.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (numMatch) {
    return { year: parseInt(numMatch[2]), month: parseInt(numMatch[1]) - 1 };
  }
  const monthWordMatch = str.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s*\b(20\d{2})\b/i);
  if (monthWordMatch) {
    const m = monthNames[monthWordMatch[1].toLowerCase()];
    return { year: parseInt(monthWordMatch[2]), month: m };
  }
  const yearMatch = str.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return { year: parseInt(yearMatch[1]), month: defaultMonth };
  }
  return null;
}

const monthNamesList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatMonthVal(val) {
  const year = Math.floor(val / 12);
  const month = val % 12;
  return `${monthNamesList[month]} ${year}`;
}

function parseExperienceAndBreaks(text) {
  // Only look at the experience section
  const experienceText = text;
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
        intervals.push({ start: startVal, end: endVal });
      }
    }
  }

  let experienceYears = 0;
  const careerBreaks = [];

  if (intervals.length > 0) {
    intervals.sort((a, b) => a.start - b.start);
    
    // Calculate gaps/breaks first
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i-1];
      const curr = intervals[i];
      if (curr.start > prev.end + 2) { // gap of more than 1 month
        const breakStart = prev.end + 1;
        const breakEnd = curr.start - 1;
        const breakMonths = breakEnd - breakStart + 1;
        const breakYears = Math.round((breakMonths / 12) * 10) / 10;
        const durationText = breakMonths >= 12 
          ? `${breakYears} year${breakYears > 1 ? 's' : ''}` 
          : `${breakMonths} month${breakMonths > 1 ? 's' : ''}`;
        
        careerBreaks.push({
          start: formatMonthVal(breakStart),
          end: formatMonthVal(breakEnd),
          duration: durationText
        });
      }
    }

    // Merge intervals to calculate total experience
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const last = merged[merged.length - 1];
      if (current.start <= last.end + 1) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    
    let totalMonths = 0;
    for (const interval of merged) {
      totalMonths += (interval.end - interval.start + 1);
    }
    experienceYears = Math.round((totalMonths / 12) * 10) / 10;
  }

  return { experienceYears, careerBreaks };
}

console.log(parseExperienceAndBreaks(text));
