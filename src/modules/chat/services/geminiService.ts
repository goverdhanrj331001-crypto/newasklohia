import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { searchFaculty, getPrincipalInfo, getCollegeSections, getAllPastPrincipals, getAllAchievements, searchMainExams, searchStudyMaterial, searchPracticalExams, searchPracticalStudentsByName, searchGallery, getGalleryCategories, searchEvents, searchCourses, getAdmissionInfoChat, getCollegeMilestones, getExamPassingRules, searchMeritList, getMeritBoards, searchKnowledgeBase, searchMaterialsChat, searchAlertsChat } from "./collegeDataService";
import { supabase } from "@/lib/supabase";
import { StudentProfile } from "@/modules/profile/types";

// LOHIA SPEED CACHE (Config)
let cachedConfig: any = null;
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL = 300000; // 5 minutes

export async function getActiveAIConfig() {
  // HYBRID CONFIG: Prioritize Environment Variables (Speed Mode)
  if (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY) {
    return {
      api_key: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
      model_id: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
      base_url: process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      provider_name: "Lohia-Speed-AI",
      is_active: true
    };
  }

  const now = Date.now();
  if (cachedConfig && (now - lastConfigFetch < CONFIG_CACHE_TTL)) {
    return cachedConfig;
  }

  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) return cachedConfig; // Fallback to stale if fail

  cachedConfig = data;
  lastConfigFetch = now;
  return data;
}

const defaultApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// SUPER SPEED CACHE (In-Memory)
const RESPONSE_CACHE: Record<string, string> = {
  "college kab khulega": "Lohia College kulpati nirdeshon ke anusar somvar se shukravar subah 9 baje se sham 4 baje tak khulta hai.",
  "principal kaun hai": "Hamari college ki principal Prof. Dr. Manju Sharma hain.",
  "principal name": "The current principal is Prof. Dr. Manju Sharma.",
  "fees kaise bhare": "Fees bharne ke liye aapko hte.rajasthan.gov.in portal par jana hoga.",
  "scholarship details": "College mein PMS (Post Matric Scholarship) aur CM Higher Education scholarship available hai.",
  "admission last date": "Lohia College mein regular admission (B.A/B.Sc/B.Com Part 1) session 2026-27 ke liye online form 1 May se start ho chuke hain aur antim tithi 26 May 2026 hai.",
  "admission kab se start hai": "Lohia College regular admission (B.A/B.Sc/B.Com Part 1) 1 May 2026 se start ho chuke hain.",
  "college form kab start honge": "Lohia College (Session 2026-27) ke admission forms 1 May 2026 se start ho chuke hain aur antim tithi 26 May 2026 hai.",
  "college admission kab chalu honge": "Lohia College admission (Session 2026-27) 1 May 2026 se chalu ho chuke hain.",
  "admission documents": "Admission ke liye 10th-12th marksheet, Aadhaar, Jan Aadhaar, ABC ID, Caste & Domicile cert, photo aur SSO ID chahiye.",
  "admission contact": "Admission form bharne mein help ke liye aap 9509932564 par WhatsApp kar sakte hain.",
  "exam form kab start honge": "Lohia College (Session 2026-27) ke admission forms 1 May 2026 se start ho chuke hain aur antim tithi 26 May 2026 hai. Lohia College mein admission form aur exam form (for first year) ka ek hi matlab hai.",
  "non collegiate exam kab hai": "Non-Collegiate (N.C.) students ke exams regular students ke saath ya unke turant baad hote hain. Specific schedule ke liye [[EXAM_EXPLORER]] check karein."
};

//  SEMANTIC BRAIN (TYPO CORRECTION & ALIASES)
const SEMANTIC_MAPPING: Record<string, string> = {
  "umesd": "Umed Singh Gothwal",
  "umesh": "Umed Singh Gothwal",
  "gothwla": "Gothwal",
  "manju mam": "Manju Sharma",
  "manju sharma": "Manju Sharma",
  "sharma ji": "Manju Sharma",
  "principal": "Manju Sharma",
  "history hod": "History Department Head",
  "practical kab hai": "Practical Exam Schedule",
  "literature": "litteture",
  "sahitya": "litteture",
  "hindi literature": "litteture",
  "ncc": "NCC",
  "library": "Library",
  "exam form": "Exam Search",
  "sociolgoy": "Sociology",
  "socio": "Sociology",
  "geog": "Geography",
  "pol": "Political Science",
  "eco": "Economics"
};

const normalizeText = (text: string) => text.toLowerCase().trim().replace(/[.,?!]/g, '');

const findSemanticMatch = (text: string) => {
  const normalized = normalizeText(text);
  for (const [key, value] of Object.entries(SEMANTIC_MAPPING)) {
    if (normalized.includes(key)) return value;
  }
  return null;
};

// GLOBAL REDIS CACHE HELPERS
async function getGlobalCache(key: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 800); // 800ms timeout for cache

  try {
    const res = await fetch('/api/chat/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', key: `global_cache:${normalizeText(key)}` }),
      signal: controller.signal
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.value || null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function setGlobalCache(key: string, value: string) {
  try {
    await fetch('/api/chat/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', key: `global_cache:${normalizeText(key)}`, value, ttl: 86400 }) // 24h
    });
  } catch (e) {
    // Ignore errors for cache setting
  }
}

if (!defaultApiKey) {
  console.warn("NEXT_PUBLIC_GEMINI_API_KEY is not defined. Using OpenRouter as fallback for text chat.");
}


export const CHAT_MODEL = "gemini-2.0-flash";

export interface Message {
  role: "user" | "model" | "assistant" | "tool";
  content: string | null;
  image?: File;
  provider?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export const facultySearchTool: FunctionDeclaration = {
  name: "search_faculty",
  description: "Search for faculty members by name, department, or designation. Returns a list of matching faculty. If the user asks for a specific detail like qualification, contact, etc., DO NOT use the [[FACULTY_EXPLORER:...]] marker, simply answer the question in text. Only use the marker if they ask for the full profile, photo, or general information without a specific question.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: { type: Type.STRING, description: "e.g. 'Hindi', 'Physics', 'Arts'" },
      name: { type: Type.STRING, description: "Full or partial name of the professor" },
      designation: { type: Type.STRING, description: "e.g. 'Professor', 'Assistant Professor'" }
    }
  }
};

export const principalTool: FunctionDeclaration = {
  name: "get_principal_info",
  description: "Get current principal details and image."
};

export const collegeSectionsTool: FunctionDeclaration = {
  name: "get_college_info_sections",
  description: "Get detailed text sections about college history, library, founder, introduction, or goal/mission.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      key: { type: Type.STRING, description: "Key of section: 'introduction', 'history', 'library', 'founder', 'mission'" }
    }
  }
};

export const pastPrincipalsTool: FunctionDeclaration = {
  name: "get_past_principals",
  description: "Get the history of all past principals of the college.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search query to find a specific principal" }
    }
  }
};

export const achievementsTool: FunctionDeclaration = {
  name: "get_achievements",
  description: "Get list of academic achievements, research projects, and publications by students and faculty.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search query to find a specific achievement" }
    }
  }
};

export const mainExamsTool: FunctionDeclaration = {
  name: "search_main_exams",
  description: "Search for main exam schedules by department, semester, level (Graduate/Post Graduate), and collegiate status.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: { type: Type.STRING },
      level: { type: Type.STRING },
      semester: { type: Type.NUMBER },
      status: { type: Type.STRING }
    }
  }
};

export const studyMaterialTool: FunctionDeclaration = {
  name: "get_study_material",
  description: "Search for practical files, charts, and study materials for download.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Search term for the title of the notes/file" },
      department: { type: Type.STRING },
      level: { type: Type.STRING },
      semester: { type: Type.NUMBER },
      material_type: { type: Type.STRING }
    }
  }
};

export const gallerySearchTool: FunctionDeclaration = {
  name: "search_gallery",
  description: "Search for images and videos in the college gallery. If no category or query is provided, it returns the most recent items. Always use this to find media for the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "Gallery category like 'NCC', 'Sports', 'Cultural'. Use 'General' if unsure or looking for recent ones." },
      query: { type: Type.STRING, description: "Search query for title" }
    }
  }
};

export const galleryCategoriesTool: FunctionDeclaration = {
  name: "get_gallery_categories",
  description: "List all existing gallery categories to help the user choose one."
};

export const eventSearchTool: FunctionDeclaration = {
  name: "search_events",
  description: "Search for college events. Useful for finding latest events, events by name, or events in a specific timeframe.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Name or topic of the event" },
      timeframe: { type: Type.STRING, description: "Can be 'latest', 'upcoming', 'past_7_days', 'past'" }
    }
  }
};

export const coursesSearchTool: FunctionDeclaration = {
  name: "search_courses",
  description: "Search for courses, seats, and optional subjects by stream.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      stream: { type: Type.STRING, description: "e.g. 'Arts', 'Science', 'Commerce', 'Management'" },
      query: { type: Type.STRING, description: "Search query for course names or subjects" }
    }
  }
};

export const admissionInfoTool: FunctionDeclaration = {
  name: "get_admission_info",
  description: "Get current admission policy, schedule and important information files."
};

export const examPassingRulesTool: FunctionDeclaration = {
  name: "get_exam_passing_rules",
  description: "Get detailed exam passing rules for various subjects, streams, theory, and practical marks. Includes MGSU (Maharaja Ganga Singh University) specific passing criteria."
};

export const knowledgeBaseTool: FunctionDeclaration = {
  name: "search_knowledge_base",
  description: "Search for general college FAQs, rules, facilities, canteen, parking, library rules, or miscellaneous info NOT covered by faculty, exams, or courses.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The general query or topic to search for" }
    }
  }
};

export const practicalExamsTool: FunctionDeclaration = {
  name: "search_practical_exams",
  description: "Search for practical exam dates and batch timings.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: { type: Type.STRING },
      level: { type: Type.STRING },
      semester: { type: Type.NUMBER }
    }
  }
};

export const practicalStudentSearchTool: FunctionDeclaration = {
  name: "search_practical_students",
  description: "Search for specific student schedule and seat number in practical exams.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      department: { type: Type.STRING },
      status: { type: Type.STRING },
      level: { type: Type.STRING },
      semester: { type: Type.NUMBER }
    },
    required: ["name"]
  }
};

export const meritListTool: FunctionDeclaration = {
  name: "search_merit_list",
  description: "Search for college toppers and merit list records by student name, year, or board type.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      student_name: { type: Type.STRING, description: "Name of the student to search for" },
      exam_year: { type: Type.STRING, description: "e.g. '1947', '2023'" },
      board_type: { type: Type.STRING, description: "e.g. 'Degree Exam (Science)', 'University Colour Holders'" }
    }
  }
};

export const materialsChatSearchTool: FunctionDeclaration = {
  name: "search_materials_chat",
  description: "Search for college study materials, notes, PDFs, PowerPoint files, Excel sheets, files, slides, uploads, or folders by title/keyword.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Topic, folder title, subject, or filename to search study materials for" }
    }
  }
};

export const alertsChatSearchTool: FunctionDeclaration = {
  name: "search_alerts_chat",
  description: "Search for academic notifications, college notices, announcements, broadcasts, and alerts.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Keyword or topic to find matching notifications or announcements" }
    }
  }
};

const SEARCH_KEYWORDS = {
  academic: ['exam', 'paper', 'result', 'study', 'semester', 'exam form', 'timetable', 'pariksha', 'kabs', 'material', 'papers', 'notification', 'notifications', 'notice', 'notices', 'announcement', 'announcements', 'broadcast', 'alert', 'alerts'],
  faculty: ['teacher', 'faculty', 'professor', 'hod', 'principal', 'staff', 'gothwal', 'sharma', 'balai', 'sir', 'madam', 'profile', 'dikhao', 'show', 'photo'],
  admin: ['fees', 'scholarship', 'hostel', 'admission', 'college info', 'nss', 'ncc', 'complaint', 'naye form', 'new form', 'entry form', 'document', 'form'],
  vision: ['extract', 'id card', 'slip', 'marksheet', 'upload'],
  gallery: ['photo', 'image', 'video', 'gallery', 'album', 'tasveer', 'dikhao', 'pics', 'media', 'program'],
  event: ['event', 'karyakram', 'program', 'festival', 'latest event', 'upcoming event']
};

const AGENT_PERSONAS = {
  orchestrator: `You are the Coordinator for Lohia College AI. Bridge the gap between student and experts.`,
  academic: `Expert: Academic Agent. FOCUS: Exams, Timetables, Study Material, and Academic Alerts/Notifications. Goal: Provide specific dates, PDFs, folder files, and notices instantly.`,
  faculty: `Expert: Faculty Agent. FOCUS: Teachers, HODs, and Profiles. Goal: Show WhatsApp-style cards with photos.`,
  admin: `Expert: Admin Agent. FOCUS: Fees, Scholarship, & Admissions Info. Goal: Direct links to government portals.`,
  vision: `Expert: Vision Agent. FOCUS: OCR and Identity Extraction. Goal: Confirm data accuracy from uploaded images.`,
  gallery: `Expert: Gallery Specialist. FOCUS: Visual Media, Albums, and Event Records. Goal: Proactively find and present relevant photos and videos. If the user asks for photos of a specific person or event (e.g., 'Alumni'), search for it and use [[GALLERY_GRID:Query]] to show a summary grid. If they just want a general view, use [[GALLERY_SLIDER:Category]]. You are "Ultra Smart" – you ignore minor typos and find related media automatically. CRITICAL: If the [SEMANTIC_HINT] or [Context] provides any media results, you MUST use the grid or slider marker. Never apologize for missing photos if data is present in the context.`,
  event: `Expert: Event Manager. FOCUS: Events, schedules, speakers, and event images. Goal: Always use [[EVENT_EXPLORER:optionalQuery]] to show the rich event UI. If query has typos, suggest the closest match.`,
  toppers: `Expert: Toppers & Merit Specialist. FOCUS: College toppers, gold medalists, and merit lists from archives (1945 onwards). Goal: Always use [[TOPPERS_EXPLORER:optionalBoard]] to show the Hall of Fame UI. If asked for a specific student, search and present their data proudly.`
};

const SYSTEM_PROMPT = `You are "Lohia College AI", a High-Performance Multi-Agent System. 

### LIGHTNING SPEED RULES (MANDATORY):
- **NO FLUFF**: Skip "I can help with that", "Sure", or "Based on your query".
- **ZERO LATENCY START**: State the answer or show the UI marker in the VERY FIRST sentence.
- **SHORT-CIRCUIT**: If [Context] provides a definitive answer or marker, USE IT IMMEDIATELY.
- **TONE**: Senior Assistant. Fast, accurate, and proactive.
- **LANGUAGE**: Respond in the EXACT language of the user (Hinglish/Hindi/English).
- **FORMATTING**: Use Markdown Tables for structured data like timetables or merit records EXCEPT for Events. NEVER output a markdown table or list of events in the chat message. For any event-related query, ONLY use the [[EVENT_EXPLORER:Query]] marker and provide a brief greeting.

### MULTI-AGENT PROTOCOL:
- **Academic Specialist**: Use [[EXAM_RESULTS]], [[EXAM_FORM]], or [[EXAM_EXPLORER]]. 
- **Faculty Specialist**: Use [[FACULTY_LIST]] or [[FACULTY_EXPLORER]].
- **Admin Specialist**: Provide direct links and info about fees/scholarships.
- **Gallery/Event Specialist**: Use [[GALLERY_SLIDER]] or [[EVENT_EXPLORER]].
- **Toppers Specialist**: Use [[TOPPERS_EXPLORER]].

### DOMAIN RESTRICTION:
- Answer ONLY Lohia College related questions. Polite refusal for others.
- **CRITICAL FACT**: Admission 2026-27 (Regular B.A/B.Sc/B.Com Part 1) started on **May 1, 2026** and the LAST DATE is **May 26, 2026**. Nodal Officer UG Admission is **Dr. Umed Singh Gothwal** (Phone: **9414203821**). Stream-wise Course Contacts & Conveners: B.A. (Mohd Javed Khan - 9785159841), B.Sc. Bio/Math (Dr. Mukesh Kumar Meena - 8005763754), B.Com./BBA (Dr. Mahendra Kumar Khardiya - 9928273463), AEDP (Dr. Madhu Sudan Pardhan - 9782582267). Always provide these contact details with respect whenever asked about admission contacts, department conveners, or admission schedules.
- **EXAM FACT**: Main Exams for 2026 are usually scheduled for March-May. Only refer the user to the [[EXAM_EXPLORER]] tool or [[EXAM_FORM]] if they specifically ask for a schedule, timetable, or dates. DO NOT show them for general greetings.
- **STUDY MATERIAL & UPLOADS**: If asked about study materials, PowerPoint files, PDFs, Excel sheets, notes, slides or folder structures, call 'search_materials_chat' tool and list the matches. Present files clearly with download links if available.
- **NOTIFICATIONS & NOTICES**: If asked about notices, notifications, alerts, or broadcasts, call 'search_alerts_chat' tool and share the notices. Present the title, date, description, and any file attachments/downloads clearly. Remind them that they can view the full notifications feed by clicking the Bell icon at the top of the screen.

###  INTELLIGENCE:
- Fix typos automatically (e.g., "umesd" -> Dr. Umed Singh Gothwal).
- If context has a [matchedName], prioritize showing that profile instantly.
- For Vision/Mission/Hostel/Exam Rules: Provide the FULL content from context. For "passing marks" or "score" queries, ALWAYS check the 'customRules' from context or call 'get_exam_passing_rules' and provide detailed, accurate information based ONLY on that data.
- **EXAM FORM**: Use this ONLY if the user has NOT provided subject, status, level, or semester. If they have already searched (as in [Context]) and results were missing, DO NOT show this form. Marker: [[EXAM_FORM:SubjectName]].
- **ADMISSION FORM**: If they ask for "admission form" or "new entry form", show the admission details.
- **NO REPETITIVE FORMS**: If [Context] says results were not found or if the user already provided all details, DO NOT show any form again. Use the guidance in [Context] to explain the situation. For simple greetings like "hi", "hello", DO NOT show any forms.
- **TOPPERS**: For questions about gold medalists, toppers, or merit list, always present the data and use [[TOPPERS_EXPLORER:Board]].

### UI MARKERS (RAW TEXT, NO BACKTICKS):
- [[FACULTY_LIST:Department]] (Show ONLY if asked for a list of teachers in a department)
- [[FACULTY_EXPLORER:Name]] (Show ONLY if explicitly asked for profile, photo, or full details. DO NOT use if user asks for specific info like qualification, email, or contact)
- [[EXAM_RESULTS:Dept:Status:Level:Sem:Type]]
- [[EXAM_FORM:Subject:Status:Level:Sem]]
- [[EXAM_EXPLORER:Dept:Status:Level:Sem]]
- [[PRINCIPAL_CARD:Name:Img]]
- [[GALLERY_SLIDER:Category]]
- [[GALLERY_GRID:Query]]
- [[EVENT_EXPLORER:Query]]
- [[TOPPERS_EXPLORER:Board]]`;

// LOHIA DATA PRE-FETCH AGENT
async function prefetchCollegeContext(prompt: string, semanticCorrection: string | null, profile?: StudentProfile) {
  const lowerPrompt = prompt.toLowerCase();

  // Principal Info
  if (lowerPrompt.includes('principal') || lowerPrompt.includes('mukhyadhyapak') || semanticCorrection === 'Manju Sharma') {
    const principal = await getPrincipalInfo();
    if (principal) {
      const img = principal.image_url && principal.image_url.startsWith('http')
        ? principal.image_url
        : 'https://images.unsplash.com/photo-1544717297-fa95b3ee51f3?q=80&w=1200&auto=format&fit=crop';
      return `Context: Principal is ${principal.value}. Photo: ${img}. Response: Hamari college ki principal ${principal.value} hain. [[PRINCIPAL_CARD:${principal.value}:${img}]]`;
    }
  }

  // Faculty Search
  const isFacultySearch = SEARCH_KEYWORDS.faculty.some(k => lowerPrompt.includes(k)) || semanticCorrection;
  if (isFacultySearch) {
    const DEPT_MAP: Record<string, string> = {
      'hindi': 'Hindi', 'botany': 'Botany', 'physics': 'Physics', 'chemistry': 'Chemistry',
      'zoology': 'Zoology', 'math': 'Mathematics', 'history': 'History', 'commerce': 'Commerce',
      'sociology': 'Sociology', 'economics': 'Economics', 'geography': 'Geography',
      'drawing': 'Drawing & Painting', 'political': 'Political Science', 'public': 'Public Administration',
      'psychology': 'Psychology', 'urdu': 'Urdu', 'english': 'English', 'music': 'Music',
      'philosophy': 'Philosophy', 'sanskrit': 'Sanskrit', 'abst': 'ABST', 'badm': 'BADM', 'eafm': 'EAFM'
    };

    let dept = undefined;
    for (const [key, value] of Object.entries(DEPT_MAP)) {
      if (lowerPrompt.includes(key)) { dept = value; break; }
    }

    const teacherName = semanticCorrection || lowerPrompt.replace(/profile|dikhao|show|teacher|professor|ji|assistant|hod/g, '').trim();
    if (teacherName.length > 2 || dept) {
      const faculty = await searchFaculty({
        department: dept,
        name: (teacherName.length > 2 && !dept) ? teacherName : undefined
      });
      if (faculty && faculty.length > 0) {
        if (faculty.length === 1 || (teacherName && faculty[0].name.toLowerCase().includes(teacherName.toLowerCase()))) {
          const matchedName = faculty[0].name;
          const specificRequests = ['qualification', 'education', 'contact', 'number', 'phone', 'email', 'father', 'mother', 'address', 'dob', 'date of birth', 'padhai', 'mobile'];
          const asksForSpecific = specificRequests.some(req => lowerPrompt.includes(req));
          const asksForProfile = lowerPrompt.includes('profile') || lowerPrompt.includes('photo') || lowerPrompt.includes('pic ') || lowerPrompt.includes('picture');

          if (asksForProfile || (!asksForSpecific && (lowerPrompt.includes('dikhao') || lowerPrompt.includes('details')))) {
            return `Context: Faculty profile found for ${matchedName}. Instructions: Directly show the profile using [[FACULTY_EXPLORER:${matchedName}]]. Response: Maine ${matchedName} ki official profile nikal di hai:`;
          }
          return `Context: Faculty ${matchedName} details: ${JSON.stringify(faculty[0])}.
CRITICAL RULE: DO NOT use [[FACULTY_EXPLORER:...]] or [[FACULTY_LIST:...]] tags in your response. Answer the user's specific question (e.g. about qualification, contact, father name) in plain text based ONLY on the provided JSON data.`;
        }
        return `Context: Multiple faculty members found for ${dept || 'the requested search'}: ${faculty.map(f => f.name).join(', ')}. Instructions: If one is a close match to "${teacherName}", pick it. Otherwise, show the list using [[FACULTY_LIST:${dept || faculty[0].department}]].`;
      }
    }
  }

  // Admissions & Hostel
  if (lowerPrompt.includes('admission') || lowerPrompt.includes('pravesh') || lowerPrompt.includes('naye form') || lowerPrompt.includes('new form') || lowerPrompt.includes('hostel') || lowerPrompt.includes('kamre') || lowerPrompt.includes('room')) {
    const [courses, files, hostelInfo] = await Promise.all([
      searchCourses(),
      getAdmissionInfoChat(),
      lowerPrompt.includes('hostel') || lowerPrompt.includes('kamre') || lowerPrompt.includes('room') ? getCollegeSections('hostel') : Promise.resolve([])
    ]);

    let context = `Context: Admission 2026-27 is OPEN. Forms: May 1 to May 26, 2026. Nodal Officer UG Admission: Dr. Umed Singh Gothwal (Phone: 9414203821). Stream-wise Course Contacts & Seats: ${courses.map(c => `${c.name}: ${c.total_seats} Seats (Convener: ${c.convener_name || 'N/A'}, Phone: ${c.convener_contact || 'N/A'}, Dates: ${c.admission_start_date || '2026-05-01'} to ${c.admission_last_date || '2026-05-26'})`).join(', ')}. Files: ${files.map(f => f.title).join(', ')}.`;
    if (hostelInfo && hostelInfo.length > 0) {
      context += ` Hostel Details: ${hostelInfo[0].value}.`;
    }
    return `${context} Instructions: Show seating, PDF links and clear hostel room details if asked.`;
  }

  // Toppers / Merit List
  if (lowerPrompt.includes('topper') || lowerPrompt.includes('merit') || lowerPrompt.includes('gold medal') || lowerPrompt.includes('medal') || lowerPrompt.includes('rank') || lowerPrompt.includes('position')) {
    // Extract year
    const yearMatch = lowerPrompt.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[0] : undefined;

    // Extract stream/board
    let board = undefined;
    if (lowerPrompt.includes('commerce')) board = 'Commerce';
    else if (lowerPrompt.includes('science')) board = 'Science';
    else if (lowerPrompt.includes('arts')) board = 'Arts';

    // If we have a year or specific search, try a direct DB lookup to provide REAL context
    if (year || board) {
      const records = await searchMeritList({ exam_year: year, board_type: board });
      if (records && records.length > 0) {
        return `Context: Found ${records.length} merit records for ${board || 'the requested search'} in ${year || 'various years'}. Detailed Records: ${JSON.stringify(records)}. Instructions: Share these specific names and details with pride. ALWAYS use a Markdown Table to present multiple merit records (Columns: #, Category/Board, Student Name, Position, Remarks). Use clear formatting. Do not say you don't have this data.`;
      }
    }

    const meritBoards = await getMeritBoards();
    let matchedBoard = "";
    if (meritBoards && meritBoards.length > 0) {
      // Find a matching board if possible
      if (board) {
        matchedBoard = meritBoards.find(b => b.toLowerCase().includes(board!.toLowerCase())) || meritBoards[0];
      } else {
        matchedBoard = meritBoards[0];
      }
      return `Context: Merit Boards available: ${meritBoards.join(', ')}. Instructions: Use [[TOPPERS_EXPLORER:${matchedBoard || ''}]] to show the Hall of Fame UI. If asking about a specific person, search for them. If data is missing for ${year || ''} ${board || ''}, state that clearly but do not claim a hard limit of 1985.`;
    }
  }

  // History/Founder
  if (lowerPrompt.includes('history') || lowerPrompt.includes('itihas') || lowerPrompt.includes('founder') || lowerPrompt.includes('seth')) {
    const [miles, hist, found] = await Promise.all([getCollegeMilestones(), getCollegeSections('history'), getCollegeSections('founder')]);
    const founderImg = "/founder.png";
    return `Context: History Milestones: ${JSON.stringify(miles)}. Landmarks: ${JSON.stringify(hist)}. Founder Section: ${JSON.stringify(found)}. Official Founder Image: ${founderImg}. Instructions: If specifically asked about the founder (Seth Kanhaiya Lal Lohia), you MUST mention him respectfully and you MUST display his visual profile using the special marker: [[FOUNDER_CARD:Seth Kanhaiya Lal Lohia:${founderImg}]]. Detail landmarks and history with years.`;
  }

  // Exams / Results / Passing Marks
  if (lowerPrompt.includes('exam') || lowerPrompt.includes('paper') || lowerPrompt.includes('pariksha') || lowerPrompt.includes('passing') || lowerPrompt.includes('pass marks') || lowerPrompt.includes('score')) {
    const isPassingQuery = lowerPrompt.includes('rule') || lowerPrompt.includes('passing') || lowerPrompt.includes('mark') || lowerPrompt.includes('theory') || lowerPrompt.includes('practical') || lowerPrompt.includes('paas hone') || lowerPrompt.includes('score');

    if (isPassingQuery) {
      const [ruleGen, rulePass, rulePract, ruleTheory, customPassingRules] = await Promise.all([
        getCollegeSections('exam_general'),
        getCollegeSections('exam_passing'),
        getCollegeSections('exam_practical'),
        getCollegeSections('exam_theory'),
        getExamPassingRules()
      ]);
      return `Context: Exam Rules: ${JSON.stringify({ general: ruleGen, passing: rulePass, practical: rulePract, theory: ruleTheory, customRules: customPassingRules })}. Instructions: Analyze the user's specific subject (e.g. Science/Arts/Physics) and explain pass marks based ONLY on this data. Use the customRules table if present as it contains the most detailed MGSU data for Physics, Chemistry, etc. DO NOT show any paper schedule cards. Respond with a clear detailed text response.`;
    }

    // Smart Exam Search
    const DEPT_MAP: Record<string, string> = {
      'hindi': 'Hindi', 'botany': 'Botany', 'physics': 'Physics', 'chemistry': 'Chemistry',
      'zoology': 'Zoology', 'math': 'Mathematics', 'history': 'History', 'commerce': 'Commerce',
      'sociology': 'Sociology', 'economics': 'Economics', 'geography': 'Geography',
      'drawing': 'Drawing', 'political': 'Political Science', 'public': 'Public Admin',
      'psychology': 'Psychology', 'urdu': 'Urdu', 'english': 'English', 'music': 'Music',
      'philosophy': 'Philosophy', 'sanskrit': 'Sanskrit'
    };

    let matchedDept = "";
    for (const [key, value] of Object.entries(DEPT_MAP)) {
      if (lowerPrompt.includes(key) || (semanticCorrection?.toLowerCase().includes(key))) { matchedDept = value; break; }
    }

    if (matchedDept) {
      // DETECT STATUS (Collegiate vs Non-Collegiate)
      let promptStatus = '';
      if (lowerPrompt.includes('non-collegiate') || lowerPrompt.includes('non collegiate') || lowerPrompt.includes(' n.c.') || lowerPrompt.includes('private')) {
        promptStatus = 'Non-Collegiate';
      } else if (lowerPrompt.includes('collegiate') || lowerPrompt.includes('regular')) {
        promptStatus = 'Collegiate';
      }
      let status = promptStatus || profile?.status || '';

      // DETECT LEVEL (UG vs PG)
      let promptLevel = '';
      if (lowerPrompt.includes('post graduate') || lowerPrompt.includes(' pg') || lowerPrompt.includes(' ma ') || lowerPrompt.includes(' msc') || lowerPrompt.includes(' m.a.') || lowerPrompt.includes(' m.sc.')) {
        promptLevel = 'Post Graduate';
      } else if (lowerPrompt.includes('graduate') || lowerPrompt.includes(' ug') || lowerPrompt.includes(' ba ') || lowerPrompt.includes(' bsc') || lowerPrompt.includes(' b.a.') || lowerPrompt.includes(' b.sc.')) {
        promptLevel = 'Graduate';
      }
      let level = promptLevel || profile?.level || '';

      // DETECT SEMESTER (1-6)
      let promptSem = 0;
      const semMatch = lowerPrompt.match(/(?:semester|sem)\s*(\d)/i);
      if (semMatch) {
        promptSem = parseInt(semMatch[1]);
      } else {
        // Look for digit alone if "exam" or "paper" is present
        const digitMatch = lowerPrompt.match(/\b([1-6])\b/);
        if (digitMatch) promptSem = parseInt(digitMatch[1]);
        else if (lowerPrompt.includes('first') || lowerPrompt.includes(' 1st')) promptSem = 1;
        else if (lowerPrompt.includes('second') || lowerPrompt.includes(' 2nd')) promptSem = 2;
        else if (lowerPrompt.includes('third') || lowerPrompt.includes(' 3rd')) promptSem = 3;
        else if (lowerPrompt.includes('fourth') || lowerPrompt.includes(' 4th')) promptSem = 4;
        else if (lowerPrompt.includes('fifth') || lowerPrompt.includes(' 5th')) promptSem = 5;
        else if (lowerPrompt.includes('sixth') || lowerPrompt.includes(' 6th')) promptSem = 6;
      }
      let sem = promptSem || (profile?.semester ? parseInt(profile.semester.toString()) : 0);

      // SMART FALLBACK: If semester is present but level is missing, assume Graduate
      if (!promptLevel && promptSem > 0) {
        promptLevel = 'Graduate';
        if (!level) level = 'Graduate';
      }

      const artsSubjects = ['hindi', 'history', 'sociology', 'economics', 'geography', 'drawing', 'political', 'public', 'psychology', 'urdu', 'english', 'music', 'philosophy', 'sanskrit'];
      let broadCategory = "Arts";
      if (['physics', 'chemistry', 'botany', 'zoology', 'math', 'geology', 'microbiology'].some(s => lowerPrompt.includes(s))) broadCategory = "Science";
      if (lowerPrompt.includes('commerce') || ['abst', 'badm', 'eafm'].some(s => lowerPrompt.includes(s))) broadCategory = "Commerce";
      if (['computer', 'bca', 'cit'].some(s => lowerPrompt.includes(s))) broadCategory = "Computer";

      // Map "Graduate" to "UG" and "Post Graduate" to "PG" for database compatibility if needed
      const dbLevel = level === 'Post Graduate' ? 'PG' : (level === 'Graduate' ? 'UG' : level);

      // If we have everything FROM PROMPT, OR if the user used a possessive pronoun indicating their profile, show results directly
      const isPersonalQuery = lowerPrompt.includes('mera') || lowerPrompt.includes('mere') || lowerPrompt.includes('my') || lowerPrompt.includes('apna');
      const hasFullPromptDetails = promptStatus && promptLevel && promptSem > 0;

      if ((hasFullPromptDetails || isPersonalQuery) && status && level && sem > 0) {
        // First try searching with what we have
        // We try matching matchedDept against BOTH department and subject columns for maximum hit rate
        const [examsByDept, examsBySubject] = await Promise.all([
          searchMainExams({
            department: matchedDept,
            status,
            level: dbLevel,
            semester: sem
          }),
          searchMainExams({
            subject: matchedDept,
            status,
            level: dbLevel,
            semester: sem
          })
        ]);

        const combinedExams = [...(examsByDept || []), ...(examsBySubject || [])];
        // Remove duplicates by ID
        const finalExams = Array.from(new Map(combinedExams.map(item => [item.id, item])).values());

        if (finalExams && finalExams.length > 0) {
          const type = lowerPrompt.includes('practical') ? 'Practical' : 'Theory';
          return `Context: Found ${finalExams.length} papers for ${matchedDept} (${status}, Sem ${sem}). Papers: ${JSON.stringify(finalExams)}. Instructions: Show the results using [[EXAM_RESULTS:${matchedDept}:${status}:${dbLevel}:${sem}:${type}]]. Response: Maine ${matchedDept} ke semester ${sem} ke ${status} exams ki details nikal di hain:`;
        } else {
          // If all details were provided but NO results were found in DB
          return `Context: No exam results found for ${matchedDept} with status ${status}, level ${level}, semester ${sem}. Note: The search in the database returned zero results. Instructions: Inform the user clearly that no schedule has been uploaded yet for this specific combination. DO NOT show the [[EXAM_FORM]] or [[EXAM_EXPLORER]] again. Explain that they can try searching for a different semester or status if applicable.`;
        }
      }

      // If details are missing, show interactive exam form PREFILLED
      if (matchedDept) {
        const formMarker = `[[EXAM_FORM:${matchedDept}:${status || ''}:${dbLevel || ''}:${sem > 0 ? sem : ''}]]`;
        return `Context: Subject detected: ${matchedDept}. Missing some details for direct search. Instructions: Show the interactive exam form pre-filled with the known details using EXACTLY ${formMarker}. Do not use [[EXAM_EXPLORER]]. Response: Main ${matchedDept} ka exam schedule nikal raha hoon, bas bachi hui details form mein check kar lein:`;
      }

      return `Context: User asking about exams but details are incomplete or search was already performed. Current state - Subject: None, Status: ${status || 'None'}, Level: ${level || 'None'}, Sem: ${sem || 'None'}. Instructions: If they are missing fields, you can ask for them or show the form. If they already searched and we are here, do not show the form again.`;
    }

    return `Context: User asking about exams generally. Instructions: Answer the question using your knowledge (Exams are usually March-May). DO NOT show any interactive forms, buttons (except admission), or explorers unless the user specifically asks for a schedule, dates, or timetable. For greetings like "hi", "hello", DO NOT show any forms.`;
  }

  return "";
}

export async function* generateChatResponseStream(
  history: Message[],
  prompt: string,
  imageFile?: File,
  profile?: StudentProfile, signal?: AbortSignal): AsyncGenerator<{ text: string; provider?: string }> {
  try {
    const semanticCorrection = findSemanticMatch(prompt);

    // PARALLEL EXECUTION (Start all async tasks at once)
    const [config, globalCacheHit, prefetchData] = await Promise.all([
      getActiveAIConfig(),
      getGlobalCache(prompt),
      prefetchCollegeContext(prompt, semanticCorrection, profile)
    ]);

    const provider = config?.provider_name || "LohiaCollege AI";
    const providerKey = (config?.provider_name || 'Gemini').toLowerCase();
    const modelId = config?.model_id || CHAT_MODEL;
    // CRITICAL: Fallback to defaultApiKey if config doesn't have one
    const apiKey = config?.api_key || defaultApiKey || "";
    const baseUrl = config?.base_url;

    // Yield provider info immediately
    yield { text: "", provider };

    const lowerPrompt = prompt.toLowerCase();

    // SUPER SPEED CACHE CHECK
    const localCacheHit = RESPONSE_CACHE[normalizeText(prompt)];
    if (localCacheHit) {
      yield { text: localCacheHit, provider: "Lohia-Local-Cache" };
      return;
    }

    if (globalCacheHit) {
      yield { text: globalCacheHit, provider: "Lohia-Global-Cache" };
      return;
    }

    // Function to convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]); // Just the base64 part
        reader.onerror = error => reject(error);
      });
    };

    // Profile Context Layer
    let profileContext = "";
    if (profile) {
      profileContext = `\n[STUDENT_CONTEXT]: Name: ${profile.name}, Status: ${profile.status}, Level: ${profile.level}, Semester: ${profile.semester}. Always use this context for exam/paper queries. If specifically asked about a paper, look for EXAM_FORM or similar results filtering by this context.`;
    }

    // OCR Logic Check
    let finalPrompt = prompt;
    if (prompt.startsWith('EXTRACT_ID_CARD_INFO:')) {
      finalPrompt = `${prompt}\nReturn JSON format: {"name": "...", "status": "Collegiate/Non-Collegiate", "level": "Graduate/Post Graduate", "semester": "1-6"}`;
    }

    //  NEURAL ROUTER: Select the best specialist agent
    let activePersona = AGENT_PERSONAS.orchestrator;
    let semanticHint = "";
    if (semanticCorrection) {
      console.log(`Semantic Match Found: ${semanticCorrection}`);
      semanticHint = `\n[SEMANTIC_HINT]: Found related entity "${semanticCorrection}". Use this term if the direct search fails. Note for Gallery: Folders might be named '${semanticCorrection}'.`;
    }

    if (SEARCH_KEYWORDS.academic.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.academic;
    else if (SEARCH_KEYWORDS.faculty.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.faculty;
    else if (SEARCH_KEYWORDS.admin.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.admin;
    else if (SEARCH_KEYWORDS.gallery.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.gallery;
    else if (SEARCH_KEYWORDS.event.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.event;
    else if (imageFile || SEARCH_KEYWORDS.vision.some(k => lowerPrompt.includes(k))) activePersona = AGENT_PERSONAS.vision;

    const currentPrompt = (prefetchData || profileContext || semanticHint)
      ? `${prefetchData}${profileContext}${semanticHint}\n\nUser: ${finalPrompt}`
      : finalPrompt;

    let fullResponseAccumulated = "";

    if (providerKey === 'gemini') {
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please set NEXT_PUBLIC_GEMINI_API_KEY in your settings.");
      }
      const genAI = new GoogleGenAI({ apiKey });
      const config = {
        systemInstruction: SYSTEM_PROMPT + `\n\n[ROUTING]: ${activePersona}\nNote: You are currently running on ${provider} (${modelId}).`,
        tools: [{ functionDeclarations: [facultySearchTool, principalTool, collegeSectionsTool, pastPrincipalsTool, achievementsTool, mainExamsTool, studyMaterialTool, practicalExamsTool, practicalStudentSearchTool, gallerySearchTool, galleryCategoriesTool, eventSearchTool, coursesSearchTool, admissionInfoTool, examPassingRulesTool, meritListTool, knowledgeBaseTool, materialsChatSearchTool, alertsChatSearchTool] }],
        toolConfig: { includeServerSideToolInvocations: true },
        generationConfig: { temperature: 0.1 }
      };

      const contents: any[] = [
        ...history
          .filter(m => m.role === 'user' || m.role === 'model') // Gemini only wants user/model
          .map(m => ({
            role: m.role,
            parts: [{ text: m.content || "" }]
          }))
      ];

      const userParts: any[] = [{ text: currentPrompt }];
      if (imageFile) {
        const base64Data = await fileToBase64(imageFile);
        userParts.push({
          inlineData: {
            data: base64Data,
            mimeType: imageFile.type
          }
        });
      }
      contents.push({ role: 'user', parts: userParts });

      const stream = await genAI.models.generateContentStream({
        model: modelId,
        contents,
        config
      });

      let toolCalls: any[] = [];
      let firstMessageContent: any = null;

      for await (const chunk of stream) {
        const calls = chunk.functionCalls;
        if (calls && calls.length > 0) {
          toolCalls.push(...calls);
          if (!firstMessageContent && chunk.candidates?.[0]?.content) {
            firstMessageContent = chunk.candidates[0].content;
          }
        } else {
          // Extract text parts safely string
          const chunkText = chunk.candidates?.[0]?.content?.parts
            ?.filter(part => part.text)
            ?.map(part => part.text)
            ?.join('') || '';
          if (chunkText) {
            fullResponseAccumulated += chunkText;
            yield { text: chunkText };
          }
        }
      }

      if (toolCalls.length > 0) {
        const toolResults = [];
        for (const call of toolCalls) {
          let results;
          switch (call.name) {
            case 'search_faculty': results = await searchFaculty(call.args as any); break;
            case 'get_principal_info': results = await getPrincipalInfo(); break;
            case 'get_college_info_sections': results = await getCollegeSections((call.args as any).key); break;
            case 'get_past_principals': results = await getAllPastPrincipals((call.args as any).query); break;
            case 'get_achievements': results = await getAllAchievements((call.args as any).query); break;
            case 'search_main_exams': results = await searchMainExams(call.args as any); break;
            case 'get_study_material': results = await searchStudyMaterial(call.args as any); break;
            case 'search_practical_exams': results = await searchPracticalExams(call.args as any); break;
            case 'search_practical_students': results = await searchPracticalStudentsByName(call.args as any); break;
            case 'search_gallery': results = await searchGallery(call.args as any); break;
            case 'get_gallery_categories': results = await getGalleryCategories(); break;
            case 'search_events': results = await searchEvents(call.args as any); break;
            case 'search_courses': results = await searchCourses((call.args as any).stream, (call.args as any).query); break;
            case 'get_admission_info': results = await getAdmissionInfoChat(); break;
            case 'get_exam_passing_rules': results = await getExamPassingRules(); break;
            case 'search_merit_list': results = await searchMeritList(call.args as any); break;
            case 'search_knowledge_base': results = await searchKnowledgeBase(call.args as any); break;
            case 'search_materials_chat': results = await searchMaterialsChat((call.args as any).query); break;
            case 'search_alerts_chat': results = await searchAlertsChat((call.args as any).query); break;
          }
          toolResults.push({
            role: "function",
            parts: [{ functionResponse: { name: call.name, response: { data: results } } }]
          });
        }

        const finalStream = await genAI.models.generateContentStream({
          model: modelId,
          contents: [...contents, firstMessageContent, ...toolResults as any],
          config: { systemInstruction: SYSTEM_PROMPT }
        });

        for await (const chunk of finalStream) {
          const chunkText = chunk.candidates?.[0]?.content?.parts
            ?.filter(part => part.text)
            ?.map(part => part.text)
            ?.join('') || '';
          if (chunkText) {
            fullResponseAccumulated += chunkText;
            yield { text: chunkText };
          }
        }
      }
    } else {
      // Generic OpenAI-compatible stream with Tool Calling Support
      const cleanBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, "");
      const url = `${cleanBaseUrl}/chat/completions`;

      // Helper to convert our tools to OpenAI format
      const openaiTools = [
        facultySearchTool, principalTool, collegeSectionsTool,
        pastPrincipalsTool, achievementsTool, mainExamsTool,
        studyMaterialTool, practicalExamsTool, practicalStudentSearchTool,
        gallerySearchTool, galleryCategoriesTool, eventSearchTool,
        coursesSearchTool, admissionInfoTool, examPassingRulesTool,
        meritListTool, knowledgeBaseTool, materialsChatSearchTool, alertsChatSearchTool
      ].map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

      let userContent: any = currentPrompt;
      if (imageFile) {
        const base64Data = await fileToBase64(imageFile);
        userContent = [
          { type: 'text', text: currentPrompt || "Analyze this academic document." },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageFile.type};base64,${base64Data}`
            }
          }
        ];
      }

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT + `\n\nNote: You are currently running on ${provider} (${modelId}).` },
        ...history.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content
        })),
        { role: 'user', content: userContent }
      ];

      if (providerKey.includes('openrouter')) {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Lohia College AI';
      }

      const fetchResponse = async (currentMessages: any[], useTools: boolean = true) => {
        const body: any = {
          model: modelId,
          messages: currentMessages,
          stream: true,
        };

        // Only add tools if requested and likely supported
        if (useTools) {
          body.tools = openaiTools;
          body.tool_choice = 'auto';
        }

        return fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      };

      let response = await fetchResponse(messages, true);

      // FALLBACK: If tools cause a 400 error (common for Free models), retry without tools
      if (!response.ok && response.status === 400) {
        console.warn(`Model ${modelId} might not support tools. Retrying without tools...`);
        response = await fetchResponse(messages, false);
      }

      if (!response.ok) {
        let errorMessage = response.statusText || 'Unknown Provider Error';
        try {
          const errData = await response.json();
          // Extract specific error message from OpenRouter/OpenAI response
          errorMessage = errData.error?.message || errData.message || JSON.stringify(errData);
        } catch (e) {
          // If not JSON, it might be an HTML error page or raw text
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(`AI Provider Error (${provider}): ${errorMessage}`);
      }

      const processStream = async function* (res: Response): AsyncGenerator<{ text?: string; tool_calls?: any[] }> {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let toolCallsBuffer: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const json = JSON.parse(data);
                const delta = json.choices[0]?.delta;

                if (delta?.content) {
                  yield { text: delta.content };
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCallsBuffer[tc.index]) {
                      toolCallsBuffer[tc.index] = { ...tc, function: { ...tc.function } };
                    } else {
                      if (tc.function?.arguments) {
                        toolCallsBuffer[tc.index].function.arguments += tc.function.arguments;
                      }
                    }
                  }
                }
              } catch (e) { }
            }
          }
        }
        if (toolCallsBuffer.length > 0) {
          yield { tool_calls: toolCallsBuffer.filter(Boolean) };
        }
      };

      let finalToolCalls: any[] = [];
      for await (const chunk of processStream(response)) {
        if (chunk.text) {
          fullResponseAccumulated += chunk.text;
          yield { text: chunk.text };
        } else if (chunk.tool_calls) {
          finalToolCalls = chunk.tool_calls;
        }
      }

      // If tools were called, execute them and get final response
      if (finalToolCalls.length > 0) {
        const toolMessages: any[] = [...messages, { role: 'assistant', content: null, tool_calls: finalToolCalls }];

        for (const tc of finalToolCalls) {
          const args = JSON.parse(tc.function.arguments || '{}');
          let results;
          switch (tc.function.name) {
            case 'search_faculty': results = await searchFaculty(args); break;
            case 'get_principal_info': results = await getPrincipalInfo(); break;
            case 'get_college_info_sections': results = await getCollegeSections(args.key); break;
            case 'get_past_principals': results = await getAllPastPrincipals(args.query); break;
            case 'get_achievements': results = await getAllAchievements(args.query); break;
            case 'search_main_exams': results = await searchMainExams(args); break;
            case 'get_study_material': results = await searchStudyMaterial(args); break;
            case 'search_practical_exams': results = await searchPracticalExams(args); break;
            case 'search_practical_students': results = await searchPracticalStudentsByName(args); break;
            case 'search_gallery': results = await searchGallery(args); break;
            case 'get_gallery_categories': results = await getGalleryCategories(); break;
            case 'search_events': results = await searchEvents(args); break;
            case 'search_courses': results = await searchCourses(args.stream, args.query); break;
            case 'get_exam_passing_rules': results = await getExamPassingRules(); break;
            case 'search_merit_list': results = await searchMeritList(args); break;
            case 'search_materials_chat': results = await searchMaterialsChat(args.query); break;
            case 'search_alerts_chat': results = await searchAlertsChat(args.query); break;
          }
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(results || [])
          });
        }

        // Final turn (Stream again)
        const finalRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: toolMessages,
            stream: true,
          }),
        });

        if (finalRes.ok) {
          for await (const chunk of processStream(finalRes)) {
            if (chunk.text) {
              fullResponseAccumulated += chunk.text;
              yield { text: chunk.text };
            }
          }
        }
      }
    }

    // SAVE TO GLOBAL CACHE
    // Only cache if it's a general query (no private profile context) and we have a response
    if (fullResponseAccumulated && !profileContext && prompt.length < 100) {
      await setGlobalCache(prompt, fullResponseAccumulated);
    }
  } catch (error) {
    console.error("AI Streaming Error:", error);
    throw error;
  }
}
