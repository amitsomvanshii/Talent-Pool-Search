const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const candidates = [
  {
    name: "Alex Mercer",
    email: "alex.mercer.dev@gmail.com",
    phone: "415-555-0192",
    linkedin: "linkedin.com/in/alexmercer-dev",
    github: "github.com/alexmercer",
    location: "San Francisco, CA",
    title: "Senior Frontend Engineer",
    experience: 7,
    skills: ["React", "TypeScript", "Next.js", "Redux", "Tailwind CSS", "GraphQL", "Web Performance"],
    history: [
      { role: "Senior Frontend Engineer", company: "WebScale Corp", years: "2023 - Present", desc: "Led frontend architecture migration to Next.js, improving page load speeds by 40%. Managed team of 4 engineers." },
      { role: "Software Engineer III", company: "AppSymphony", years: "2020 - 2023", desc: "Designed and implemented reusable React design system component library used across 12 product lines." }
    ]
  },
  {
    name: "Sarah Jenkins",
    email: "sarah.jenkins.design@outlook.com",
    phone: "206-555-0143",
    linkedin: "linkedin.com/in/sjenkins-design",
    github: "github.com/sjenkins-ux",
    location: "Remote",
    title: "UI/UX Designer",
    experience: 4,
    skills: ["Figma", "Adobe Creative Suite", "Design Systems", "Prototyping", "User Research", "Wireframing", "CSS"],
    history: [
      { role: "Lead Product Designer", company: "Zenith SaaS", years: "2022 - Present", desc: "Redesigned core checkout funnel, resulting in a 14% increase in user conversion. Conducted 50+ user interviews." },
      { role: "UI Designer", company: "PixelCraft Agency", years: "2020 - 2022", desc: "Delivered beautiful high-fidelity wireframes and mockups for Fortune 500 client projects." }
    ]
  },
  {
    name: "Rajesh Kumar",
    email: "rajesh.kumar@techworks.in",
    phone: "+91 98765 43210",
    linkedin: "linkedin.com/in/rajeshkumar-dev",
    github: "github.com/rajesh-k",
    location: "Bengaluru, India",
    title: "Backend Engineer",
    experience: 5,
    skills: ["Python", "Django", "FastAPI", "PostgreSQL", "Docker", "Redis", "REST APIs", "AWS"],
    history: [
      { role: "Backend Developer", company: "CloudCart Systems", years: "2022 - Present", desc: "Built and optimized high-throughput order processing backend, scaling to 10k requests per minute." },
      { role: "Associate Developer", company: "InfyTech Solutions", years: "2021 - 2022", desc: "Developed microservices in Python Django and maintained database schemas and queries." }
    ]
  },
  {
    name: "Emily Chen",
    email: "emily.chen.pm@yahoo.com",
    phone: "512-555-0187",
    linkedin: "linkedin.com/in/emily-chen-pm",
    github: "",
    location: "Austin, TX",
    title: "Product Manager",
    experience: 6,
    skills: ["Product Strategy", "Agile Roadmap", "Scrum", "JIRA", "A/B Testing", "SQL", "Market Research"],
    history: [
      { role: "Product Manager", company: "DataFlow LLC", years: "2021 - Present", desc: "Launched self-serve developer analytics portal, capturing $1.2M ARR in first 6 months. Wrote detailed PRDs." },
      { role: "Associate PM", company: "InnoTech Corp", years: "2019 - 2021", desc: "Managed feature backlog for mobile application, coordinating daily standups and sprint planning." }
    ]
  },
  {
    name: "Marcus Vance",
    email: "marcus.vance.sales@gmail.com",
    phone: "617-555-0112",
    linkedin: "linkedin.com/in/marcusvance-sales",
    github: "",
    location: "Boston, MA",
    title: "Sales Development Representative",
    experience: 2,
    skills: ["Lead Generation", "Salesforce CRM", "Cold Outreach", "B2B Negotiations", "Communication", "Product Demos"],
    history: [
      { role: "SDR", company: "SaaSify Inc", years: "2024 - Present", desc: "Exceeded outbound sourcing quota by 125% for four consecutive quarters. Qualified high-value enterprise leads." },
      { role: "Sales Associate", company: "TechRetailers", years: "2022 - 2024", desc: "Provided consulting on consumer hardware packages and managed point of sale terminal transactions." }
    ]
  },
  {
    name: "Chloe Dupont",
    email: "chloe.dupont.ops@gmail.com",
    phone: "312-555-0165",
    linkedin: "linkedin.com/in/chloe-dupont-ops",
    github: "",
    location: "Chicago, IL",
    title: "Operations Coordinator",
    experience: 3,
    skills: ["Process Optimization", "Logistics", "Advanced Excel", "Vendor Management", "Budgeting", "Scheduling"],
    history: [
      { role: "Operations Lead", company: "LogiShip Systems", years: "2023 - Present", desc: "Reduced supply chain bottleneck delays by 22% through implementation of automated inventory notifications." },
      { role: "Ops Coordinator", company: "PrimeDelivery", years: "2021 - 2023", desc: "Managed fleet scheduling and resolved driver/client logistics issues under tight timelines." }
    ]
  },
  {
    name: "David Miller",
    email: "david.miller.devops@outlook.com",
    phone: "+49 30 5550188",
    linkedin: "linkedin.com/in/david-miller-ops",
    github: "github.com/dmiller-devops",
    location: "Berlin, Germany",
    title: "DevOps Engineer",
    experience: 8,
    skills: ["AWS", "Terraform", "Kubernetes", "Docker", "CI/CD", "Linux", "Bash", "Prometheus"],
    history: [
      { role: "Senior DevOps Engineer", company: "FinTech Hub GmbH", years: "2021 - Present", desc: "Designed secure multi-region AWS cloud infra using Terraform. Reduced deployment failure rates by 35%." },
      { role: "Cloud Administrator", company: "SafeData Solutions", years: "2018 - 2021", desc: "Maintained Jenkins deployment pipelines and monitored container health metrics." }
    ]
  },
  {
    name: "Jessica Taylor",
    email: "jess.taylor.writer@gmail.com",
    phone: "303-555-0177",
    linkedin: "linkedin.com/in/jesstaylor-writer",
    github: "",
    location: "Denver, CO",
    title: "UX Writer / Content Designer",
    experience: 5,
    skills: ["UX Writing", "Microcopy", "Content Strategy", "Information Architecture", "User Research", "SEO"],
    history: [
      { role: "Senior UX Writer", company: "HealthTech Apps", years: "2022 - Present", desc: "Wrote microcopy for patient portal onboarding flow, decreasing dropoff rates by 18%." },
      { role: "Content Designer", company: "FinPay", years: "2019 - 2022", desc: "Collaborated with product designers to establish unified tone of voice and style guidelines for digital wallet." }
    ]
  },
  {
    name: "Viktor Petrov",
    email: "v.petrov.ds@gmail.com",
    phone: "206-555-0129",
    linkedin: "linkedin.com/in/vpetrov-data",
    github: "github.com/vpetrov-ds",
    location: "Seattle, WA",
    title: "Data Scientist",
    experience: 6,
    skills: ["Python", "Machine Learning", "SQL", "Pandas", "Scikit-Learn", "TensorFlow", "Tableau", "Statistics"],
    history: [
      { role: "Data Scientist", company: "RetailAnalytics", years: "2022 - Present", desc: "Built churn prediction models with 85% accuracy, enabling proactive sales outreach that saved $500k in renewals." },
      { role: "Data Analyst", company: "MarketInsights", years: "2020 - 2022", desc: "Queried large databases to create interactive executive dashboards and reports." }
    ]
  },
  {
    name: "Leila Al-Sabah",
    email: "leila.alsabah@success.com",
    phone: "212-555-0105",
    linkedin: "linkedin.com/in/leila-alsabah",
    github: "",
    location: "New York, NY",
    title: "Customer Success Manager",
    experience: 4,
    skills: ["Client Onboarding", "Customer Retention", "Zendesk", "CRM Systems", "Negotiation", "Technical Training"],
    history: [
      { role: "Customer Success Manager", company: "HRCloud Inc", years: "2023 - Present", desc: "Managed portfolio of 40 enterprise clients worth $2.5M ARR. Maintained 96% retention rate." },
      { role: "Account Specialist", company: "EduConnect", years: "2021 - 2023", desc: "Assisted school districts during software onboarding phases and troubleshot user account permissions." }
    ]
  },
];

// Helper data generators to pad up to 25 resumes
const names = [
  "Kenji Sato", "Sofia Rodriguez", "Michael Chang", "Amina Diop", "Oliver Hansen",
  "Chloe Bennett", "Daniel Kim", "Isabella Rossi", "James Wilson", "Maya Patel",
  "Lucas Silva", "Emma Watson", "Arthur Pendragon", "Diana Prince", "Bruce Wayne"
];
const emails = [
  "kenji.sato@sato-consulting.jp", "sofia.rod.designs@gmail.com", "mchang.code@gmail.com", "amina.diop@diop-ops.org", "oliver.h@hansensystems.dk",
  "chloe.b@creativecorp.com", "daniel.kim@k-tech.io", "i.rossi@milan-analytics.it", "j.wilson@salespro.com", "mpatel.data@outlook.com",
  "lsilva.operations@gmail.com", "ewatson.writer@gmail.com", "arthur.p@camelot-solutions.co.uk", "diana.prince@justice-hr.org", "bruce.wayne@waynecorp.com"
];
const phones = [
  "+81 90 5555 0122", "+1 305 555 0147", "+1 415 555 0199", "+221 77 555 0134", "+45 35 55 01 22",
  "+1 212 555 0176", "+1 408 555 0113", "+39 02 555 0193", "+1 678 555 0142", "+1 972 555 0161",
  "+55 11 95555-0188", "+1 310 555 0107", "+44 20 7946 0918", "+1 202 555 0153", "+1  Gotham 555 0100"
];
const linkedins = [
  "linkedin.com/in/kenjisato-dev", "linkedin.com/in/sofiarodriguez-designs", "linkedin.com/in/mchang-backend", "linkedin.com/in/aminadiop-ops", "linkedin.com/in/oliverhansen-systems",
  "linkedin.com/in/chloebennett-agency", "linkedin.com/in/danielkim-eng", "linkedin.com/in/isabellarossi-data", "linkedin.com/in/jwilson-sales", "linkedin.com/in/mayapatel-data",
  "linkedin.com/in/lucassilva-ops", "linkedin.com/in/emmawatson-writer", "linkedin.com/in/arthurpendragon-consulting", "linkedin.com/in/dianaprince-hr", "linkedin.com/in/brucewayne"
];
const githubs = [
  "github.com/kenji-sato", "github.com/sofiarod-design", "github.com/mchang-code", "", "github.com/oliver-hansen",
  "", "github.com/dkim-dev", "github.com/i-rossi", "", "github.com/mayapatel",
  "", "", "github.com/roundtable-boss", "", "github.com/batman"
];
const locations = [
  "Tokyo, Japan", "Miami, FL", "San Francisco, CA", "Dakar, Senegal", "Copenhagen, Denmark",
  "New York, NY", "San Jose, CA", "Milan, Italy", "Atlanta, GA", "Dallas, TX",
  "Sao Paulo, Brazil", "Los Angeles, CA", "London, UK", "Washington, DC", "Remote"
];
const titles = [
  "Senior Backend Engineer", "UI Designer", "Full Stack Engineer", "Operations Specialist", "Systems Administrator",
  "Graphic Designer", "Software Engineer II", "Data Analyst", "Enterprise Account Executive", "Data Scientist",
  "Operations Manager", "Copywriter", "Management Consultant", "HR Generalist", "Venture Capital Partner"
];
const experienceYears = [9, 3, 5, 2, 6, 4, 3, 2, 7, 3, 8, 4, 10, 5, 12];
const skillsPool = [
  ["Go", "Docker", "PostgreSQL", "Redis", "gRPC", "Kubernetes", "AWS"],
  ["Figma", "Sketch", "Illustrator", "UI/UX", "Visual Design", "Typography"],
  ["JavaScript", "React", "Node.js", "Express", "MongoDB", "SQL", "Git"],
  ["Process Mapping", "Excel", "Project Management", "JIRA", "Budgeting"],
  ["Linux", "Bash", "Active Directory", "Networking", "Security", "AWS"],
  ["Photoshop", "Illustrator", "Branding", "Layouts", "Print Design"],
  ["Java", "Spring Boot", "React", "SQL", "Docker", "Git"],
  ["SQL", "Python", "Tableau", "Excel", "Data Modeling", "Business Intelligence"],
  ["B2B Sales", "Salesforce", "Strategic Partnerships", "Negotiation", "Presenting"],
  ["Python", "Pandas", "Scikit-Learn", "R", "SQL", "Machine Learning"],
  ["Agile Operations", "Leadership", "Supply Chain", "Vendor Relations", "Excel"],
  ["Copywriting", "SEO", "Content Strategy", "Creative Writing", "Editing"],
  ["Business Strategy", "Financial Modeling", "Excel", "Project Management"],
  ["Onboarding", "Employee Relations", "HRIS", "Compliance", "Recruiting"],
  ["Investment Strategy", "Financial Modeling", "Portfolio Management", "Leadership"]
];
const historyPool = [
  [{ role: "Senior Backend Developer", company: "CyberSystems", years: "2020 - Present", desc: "Designed Go-based API microservices handling millions of users. Reduced database load by 30% via Redis caching." }],
  [{ role: "UI Designer", company: "Splash Media", years: "2022 - Present", desc: "Designed interactive prototypes for e-commerce clients. Managed client asset handoff pipeline." }],
  [{ role: "Full Stack Developer", company: "CodeLabs", years: "2021 - Present", desc: "Created React dashboard for asset tracking. Configured Node/Express backend database sync." }],
  [{ role: "Ops Specialist", company: "FastLogistic", years: "2023 - Present", desc: "Tracked cross-border shipments and generated cost optimization models in Microsoft Excel." }],
  [{ role: "Systems Administrator", company: "NordicTech", years: "2020 - Present", desc: "Managed on-prem and AWS network security policies. Scripted server automation in Bash." }]
];

// Fill the rest of the candidates up to 25
for (let i = 0; i < 15; i++) {
  candidates.push({
    name: names[i],
    email: emails[i],
    phone: phones[i],
    linkedin: linkedins[i],
    github: githubs[i],
    location: locations[i],
    title: titles[i],
    experience: experienceYears[i],
    skills: skillsPool[i],
    history: historyPool[i % historyPool.length]
  });
}

// Generate PDF Resumes
const targetDir = path.join(__dirname, '..', 'test-resumes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log(`Generating ${candidates.length} PDF resumes...`);

function generatePdf(cand, filename) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const filePath = path.join(targetDir, filename);
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);
    
    // Header Name
    doc.fontSize(22).fillColor('#1f2937').font('Helvetica-Bold').text(cand.name);
    doc.fontSize(11).fillColor('#6366f1').font('Helvetica').text(cand.title, { paragraphGap: 10 });
    
    // Contact details line
    const contactText = `${cand.email}  |  ${cand.phone}  |  ${cand.location}`;
    doc.fontSize(9).fillColor('#4b5563').text(contactText);
    
    // Social links
    let socialText = '';
    if (cand.linkedin) socialText += `LinkedIn: ${cand.linkedin}  `;
    if (cand.github) socialText += `GitHub: ${cand.github}`;
    if (socialText) {
      doc.fontSize(9).text(socialText, { paragraphGap: 15 });
    }
    
    doc.moveDown(0.5);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
    
    // Summary/Title section
    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Professional Summary');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').font('Helvetica')
       .text(`Ambitious and goal-driven professional specializing in ${cand.title}. Offering over ${cand.experience} years of hands-on experience developing projects, designing solutions, and achieving key metrics in diverse workplace settings.`, { paragraphGap: 15 });
    
    // Skills section
    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Core Skills & Expertise');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(cand.skills.join('  •  '), { paragraphGap: 15 });
    
    // Experience History section
    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Professional Work History');
    doc.moveDown(0.4);
    
    cand.history.forEach((hist) => {
      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(`${hist.role}  —  ${hist.company}`);
      doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Oblique').text(hist.years);
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(`• ${hist.desc}`, { paragraphGap: 10 });
      doc.moveDown(0.5);
    });
    
    // Education section
    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Education & Certifications');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').font('Helvetica')
       .text('Bachelor of Science in Computer Science & Professional Development Certifications', { paragraphGap: 5 });
    
    doc.end();
    
    stream.on('finish', () => {
      resolve();
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

async function generateAll() {
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const filename = `${cand.name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`;
    await generatePdf(cand, filename);
    console.log(`[${i + 1}/${candidates.length}] Generated ${filename}`);
  }
  console.log('Test resumes generated successfully!');
}

generateAll().catch(console.error);
