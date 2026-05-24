import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const [infoRes, facultyRes, sectionsRes, eventsRes, examsRes, practicalRes, pastPrincipalsRes, achievementsRes, coursesRes, admissionInfoRes, milestonesRes, eligibilityRes, meritRes, kbRes, materialsRes, alertsRes] = await Promise.all([
      supabase.from('college_info').select('*'),
      supabase.from('faculty').select('*'),
      supabase.from('college_sections').select('*'),
      supabase.from('events').select('*').order('date', { ascending: false }).limit(20),
      supabase.from('main_exams').select('*').order('exam_date', { ascending: true }),
      supabase.from('practical_batches').select('*').order('exam_date', { ascending: true }),
      supabase.from('past_principals').select('*').order('order_index', { ascending: true }),
      supabase.from('achievements').select('*'),
      supabase.from('courses').select('*').order('stream', { ascending: true }),
      supabase.from('admission_info').select('*'),
      supabase.from('college_milestones').select('*').order('order_index', { ascending: true }),
      supabase.from('eligibility_criteria').select('*'),
      supabase.from('college_merit_list').select('*').order('exam_year', { ascending: false }).limit(100),
      supabase.from('college_kb').select('*'),
      supabase.from('materials').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('academic_alerts').select('*').order('created_at', { ascending: false }).limit(20)
    ]);

    // Calculate Merit metadata for context
    let meritSummary = "";
    if (meritRes.data && meritRes.data.length > 0) {
      const years = meritRes.data.map((m: any) => parseInt(m.exam_year)).filter((y: any) => !isNaN(y));
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const boards = Array.from(new Set(meritRes.data.map((m: any) => m.board_type))).slice(0, 10);
      meritSummary = `Hall of Fame Archive: Records available from ${minYear} to ${maxYear}. Boards: ${boards.join(', ')}. Total mapped records in active buffer: ${meritRes.data.length}.`;
    } else {
      meritSummary = "Archive Status: Historical toppers records are available via the search_merit_list tool starting from 1945.";
    }

    let context = '--- LOHIA COLLEGE COMPREHENSIVE KNOWLEDGE BASE ---\n\n';

    // SEED CORE FACTS (Fallback/Always Present)
    context += '## CORE COLLEGE FACTS\n';
    context += '- College Name: Lohia College, Churu (Rajasthan)\n';
    context += '- Established: 1945 (as Intermediate College), upgraded to Degree College in 1951.\n';
    context += '- Founder: Seth Budhmal Lohia.\n';
    context += '- Affiliation: Maharaja Ganga Singh University (MGSU), Bikaner.\n';
    context += '- Motto: Vidya Dharmena Shobhate (Knowledge is adorned by righteousness).\n';
    context += '- Departments: Science, Commerce, Arts, Computer Science, Geography, Sociology, Hindi, Urdu, Political Science, Economics, etc.\n';
    context += '- Infrastructure: Information Center, Smart Classrooms, Library, Sports Ground, NCC & NSS units, Hostel Facility.\n';
    context += `- Merit History: ${meritSummary}\n`;
    context += '- IMPORTANT: If the user asks for toppers from a specific year or board (like 1952 Commerce), YOU MUST USE THE search_merit_list tool to get the accurate historical data. Do not say you do not have it. The merit list date goes back to 1945.\n';
    
    context += '\n## URGENT: ADMISSION 2026-27 (IMPORTANT)\n';
    context += '- Topic: Regular Admission for B.A / B.Sc / B.Com 1st Year (Session 2026-27).\n';
    context += '- Start Date: 1 May 2026.\n';
    context += '- Last Date (Antim Tithi): 26 May 2026.\n';
    context += '- Nodal Officer UG Admission: Dr. Umed Singh Gothwal (Phone: 9414203821).\n';
    
    if (milestonesRes.data && milestonesRes.data.length > 0) {
      context += '## HISTORY TIMELINE (MILESTONES)\n';
      milestonesRes.data.forEach((m: any) => {
        context += `- ${m.year}: ${m.event_description}\n`;
      });
      context += '\n';
    }

    if (eligibilityRes.data && eligibilityRes.data.length > 0) {
      context += '## ELIGIBILITY CRITERIA (ADMISSION RULES)\n';
      eligibilityRes.data.forEach((e: any) => {
        context += `- ${e.faculty} (${e.level}): ${e.min_percentage}% min marks. ${e.requirements}. Relaxation: ${e.category_relaxation}\n`;
      });
      context += '\n';
    }

    if (admissionInfoRes.data && admissionInfoRes.data.length > 0) {
      context += '\n## ADMISSION RESOURCES & LINKS\n';
      admissionInfoRes.data.forEach((ai: any) => {
        context += `- ${ai.title}: ${ai.description || ''} (Link: ${ai.file_url})\n`;
      });
    }
    
    context += '\n- Required Documents for Application:\n';
    context += '  1. 10th & 12th Marksheets\n';
    context += '  2. Caste Certificate (Jati Praman Patra)\n';
    context += '  3. Domicile Certificate (Mool Niwas)\n';
    context += '  4. ABC ID / APAAR ID\n';
    context += '  5. Aadhaar Card & Jan Aadhaar Card\n';
    context += '  6. Passport Size Photo & Signature\n';
    context += '  7. Active E-mail ID & Mobile Number\n';
    context += '  8. SSO ID\n';
    context += '- Application Mode: Online (htedu.rajasthan.gov.in)\n';
    context += '- Help Desk / Form Filling WhatsApp: 9509932564\n\n';

    if (coursesRes.data && coursesRes.data.length > 0) {
      context += '## STREAM-WISE COURSES, SEATS & CONVENER DETAILS\n';
      coursesRes.data.forEach((c: any) => {
        context += `- ${c.name} (${c.stream}): ${c.total_seats} Total Seats. Convener: ${c.convener_name || 'Not Assigned'} (Phone: ${c.convener_contact || 'N/A'}). Admission: ${c.admission_start_date || '1 May 2026'} to ${c.admission_last_date || '26 May 2026'}.\n`;
      });
      context += '\n';
    }

    if (infoRes.data && infoRes.data.length > 0) {
      context += '## GENERAL INFO & PRINCIPAL\n';
      infoRes.data.forEach((i: any) => {
        context += `- ${i.key}: ${i.value}\n`;
      });
      context += '\n';
    }

    if (sectionsRes.data && sectionsRes.data.length > 0) {
      context += '## COLLEGE HISTORY, VISION, FOUNDER & DETAILS\n';
      sectionsRes.data.forEach((s: any) => {
        context += `### ${s.title || s.key.toUpperCase()}\n${s.content || s.value || 'No content available'}\n\n`;
      });
    }

    if (facultyRes.data && facultyRes.data.length > 0) {
      context += '## FACULTY MEMBERS (By Department - Very Important for accurate names and qualifications)\n';
      const depts: Record<string, string[]> = {};
      facultyRes.data.forEach((f: any) => {
        if (!depts[f.department]) depts[f.department] = [];
        
        let details = `${f.name} (${f.designation})`;
        if (f.qualification) details += `, Qualification: ${f.qualification}`;
        if (f.subject) details += `, Subject: ${f.subject}`;
        if (f.specialization) details += `, Specialization: ${f.specialization}`;
        if (f.father_name) details += `, Father's Name: ${f.father_name}`;
        if (f.mobile_no) details += `, Contact: ${f.mobile_no}`;
        if (f.email) details += `, Email: ${f.email}`;
        
        depts[f.department].push(details);
      });
      for (const dept in depts) {
        context += `**${dept} Department**:\n`;
        depts[dept].forEach(p => context += `- ${p}\n`);
      }
      context += '\n';
    }

    if (pastPrincipalsRes.data && pastPrincipalsRes.data.length > 0) {
      context += '## PAST PRINCIPALS\n';
      pastPrincipalsRes.data.forEach((p: any) => {
        context += `- ${p.name} (${p.from_date || ''} to ${p.to_date || 'Present'})\n`;
      });
      context += '\n';
    }

    if (achievementsRes.data && achievementsRes.data.length > 0) {
      context += '## ACHIEVEMENTS AND RESEARCH\n';
      achievementsRes.data.forEach((a: any) => {
        context += `- ${a.title} (${a.year || ''}): ${a.description} [Category: ${a.category}]\n`;
      });
      context += '\n';
    }

    if (eventsRes.data && eventsRes.data.length > 0) {
      context += '## UPCOMING & PAST EVENTS\n';
      eventsRes.data.forEach((e: any) => {
        context += `- ${e.title} on ${e.date}: ${e.description} (Category: ${e.category || 'General'}) - Status: ${e.status || 'Scheduled'}\n`;
      });
      context += '\n';
    }

    if (examsRes.data && examsRes.data.length > 0) {
      context += '## MAIN EXAM SCHEDULE\n';
      examsRes.data.forEach((ex: any) => {
        context += `- ${ex.subject} (${ex.paper || 'Unknown'} Paper): ${ex.exam_date} at ${ex.exam_time} for ${ex.level} ${ex.semester ? "Sem " + ex.semester : ""}, Dept: ${ex.department}, Category: ${ex.status}\n`;
      });
      context += '\n';
    }

    if (practicalRes.data && practicalRes.data.length > 0) {
      context += '## PRACTICAL EXAM BATCHES\n';
      practicalRes.data.forEach((pb: any) => {
        context += `- Batch ${pb.batch_no} on ${pb.exam_date} at ${pb.exam_time} for ${pb.level} Sem ${pb.semester} (${pb.department} - ${pb.status})\n`;
      });
      context += '\n';
    }
    
    if (meritRes.data && meritRes.data.length > 0) {
      context += '## COLLEGE TOPPERS & MERIT LIST (HALL OF FAME)\n';
      meritRes.data.forEach((m: any) => {
        context += `- ${m.student_name} (${m.exam_year}): ${m.board_type}. Position: ${m.position_in_college || 'N/A'}. Remarks: ${m.remarks || 'N/A'}\n`;
      });
      context += '\n';
    }

    if (kbRes.data && kbRes.data.length > 0) {
      context += '## GENERAL COLLEGE KNOWLEDGE BASE & FAQs\n';
      kbRes.data.forEach((kb: any) => {
        context += `- Category: ${kb.category || 'General'}. Q: ${kb.question}. A: ${kb.answer}\n`;
      });
      context += '\n';
    }

    if (materialsRes.data && materialsRes.data.length > 0) {
      context += '## LATEST UPLOADED STUDY MATERIALS & FILES\n';
      materialsRes.data.forEach((m: any) => {
        const fileNames = m.files ? (Array.isArray(m.files) ? m.files : JSON.parse(m.files as string)).map((f: any) => f.name).join(', ') : 'None';
        context += `- Folder Title: ${m.title}. Files/Attachments: ${fileNames}. Uploaded on: ${new Date(m.created_at).toLocaleDateString()}\n`;
      });
      context += '\n';
    }

    const activeAlerts = (alertsRes.data || []).filter((al: any) => al.is_active !== false).slice(0, 5);
    if (activeAlerts.length > 0) {
      context += '## LATEST ACADEMIC ALERTS & NOTICES\n';
      activeAlerts.forEach((al: any) => {
        const attachmentNames = al.attachments ? (Array.isArray(al.attachments) ? al.attachments : JSON.parse(al.attachments as string)).map((f: any) => f.name).join(', ') : 'None';
        context += `- Notice Title: ${al.title}. Description: ${al.description}. Target Stream: ${al.target_stream}. Attachments: ${attachmentNames}. Published on: ${new Date(al.created_at).toLocaleDateString()}\n`;
      });
      context += '\n';
    }

    return NextResponse.json({ context });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
