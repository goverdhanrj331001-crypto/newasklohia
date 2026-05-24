import { supabase } from '@/lib/supabase';

export interface Faculty {
  id: string;
  name: string;
  father_name?: string;
  designation: string;
  subject?: string;
  qualification?: string;
  dob?: string;
  seniority_no?: string;
  email?: string;
  mobile_no?: string;
  specialization?: string;
  department: string;
  service_start_date?: string;
  college_join_date?: string;
  image_url?: string;
}

export interface CollegeEvent {
  id: string;
  title: string;
  date: string;
  description: string;
}

export interface CollegeInfo {
  key: string;
  value: string;
  image_url?: string;
}

import Fuse from 'fuse.js';

export const searchFaculty = async (params: { department?: string, subject?: string, designation?: string, name?: string }) => {
  try {
    let query = supabase.from('faculty').select('*');
    
    // Apply full text search using search_vector if any search term exists
    const searchTerms = [params.name, params.department, params.designation, params.subject]
      .filter(Boolean)
      .map(term => typeof term === 'string' ? term.trim() : '')
      .filter(term => term.length > 0)
      .join(' ');

    if (searchTerms) {
      const formattedSearchQuery = searchTerms
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0)
        .join(' | ');

      if (formattedSearchQuery) {
        query = query.textSearch('search_vector', formattedSearchQuery);
      }
    } else {
      // Fallback to basic filtering if no text provided but maybe some other params
      if (params.department) query = query.ilike('department', `%${params.department}%`);
      if (params.designation) query = query.ilike('designation', `%${params.designation}%`);
    }

    const { data: faculty, error } = await query.limit(100);
    if (error) throw error;
    if (!faculty) return [];

    let results = faculty;

    if (params.name) {
      const fuse = new Fuse(results, { keys: ['name', 'department', 'subject'], threshold: 0.4, distance: 100 });
      results = fuse.search(params.name).map(r => r.item);
    }
    
    if (params.subject && results.length > 0) {
      results = results.filter(f => 
        (f.subject || '').toLowerCase().includes(params.subject!.toLowerCase())
      );
    }

    return results;
  } catch (error) {
    console.error("Error searching faculty:", error);
    return [];
  }
};

export const getDepartments = async () => {
  try {
    const { data, error } = await supabase.from('faculty').select('department');
    if (error) throw error;
    
    // Extract unique departments
    const uniqueDepartments = Array.from(new Set(data.map(item => item.department)));
    return uniqueDepartments.sort() || [];
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
};

export const getPrincipalInfo = async () => {
  try {
    const { data, error } = await supabase.from('college_info').select('*').eq('key', 'principal').maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching principal info:", error);
    return null;
  }
};

export const getCollegeSections = async (key?: string) => {
  try {
    let query = supabase.from('college_sections').select('*');
    if (key) query = query.eq('key', key);
    const { data, error } = await query.limit(5); // Safety limit
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching sections:", error);
    return [];
  }
};

export const getAllPastPrincipals = async (searchQuery?: string) => {
  try {
    let queryBuilder = supabase.from('past_principals').select('*');
    
    if (searchQuery && searchQuery.trim().length > 0) {
      const formattedSearchQuery = searchQuery.trim().split(/\s+/).filter(Boolean).join(' | ');
      if (formattedSearchQuery) {
        queryBuilder = queryBuilder.textSearch('search_vector', formattedSearchQuery);
      }
    }
    
    const { data, error } = await queryBuilder.order('order_index', { ascending: true }).limit(50);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching past principals:", error);
    return [];
  }
};

export const getAllAchievements = async (searchQuery?: string) => {
  try {
    let queryBuilder = supabase.from('achievements').select('*');
    
    if (searchQuery && searchQuery.trim().length > 0) {
      const formattedSearchQuery = searchQuery.trim().split(/\s+/).filter(Boolean).join(' | ');
      if (formattedSearchQuery) {
        queryBuilder = queryBuilder.textSearch('search_vector', formattedSearchQuery);
      }
    }
    
    const { data, error } = await queryBuilder.order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return [];
  }
};

export const searchMainExams = async (params: any) => {
  try {
    let query = supabase.from('main_exams').select('*');
    
    if (params.department) {
      // If department is provided, it might be the broad category (Arts/Science) or the specific subject (Sociology)
      // So we use an OR filter if possible, but Supabase doesn't easily do OR across columns with ilike in a simple chain
      // Instead, we'll fetch then filter or just use a more inclusive query
      query = query.or(`department.ilike.%${params.department}%,subject.ilike.%${params.department}%`);
    }
    
    if (params.level) query = query.eq('level', params.level);
    if (params.semester) query = query.eq('semester', params.semester);
    if (params.status) query = query.eq('status', params.status);
    if (params.subject && !params.department) query = query.ilike('subject', `%${params.subject}%`);
    else if (params.subject && params.department) {
      // If both provided, refine by subject specifically
      query = query.ilike('subject', `%${params.subject}%`);
    }

    const { data: exams, error } = await query.order('exam_date', { ascending: true }).limit(50);
    if (error) throw error;
    return exams || [];
  } catch (error) {
    console.error("Error fetching main exams:", error);
    return [];
  }
};

export const searchStudyMaterial = async (params: any) => {
  try {
    let query = supabase.from('study_materials').select('*');
    
    // Normalize stream to department if provided
    const searchParams = { ...params };
    if (searchParams.stream && !searchParams.department) {
      searchParams.department = searchParams.stream;
      delete searchParams.stream;
    }

    const { title, department, ...otherParams } = searchParams;
    const searchTerms = [title, department].filter(Boolean).map(s => s.toString().trim()).join(' ').trim();

    if (searchTerms.length > 0) {
      const formattedSearchQuery = searchTerms
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0)
        .join(' | ');
      
      if (formattedSearchQuery) {
        query = query.textSearch('search_vector', formattedSearchQuery);
      }
    }

    Object.keys(otherParams).forEach(key => {
      if (otherParams[key]) {
        if (['title', 'department'].includes(key)) {
           // handled
        } else {
          query = query.eq(key, otherParams[key]);
        }
      }
    });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching study materials:", error);
    return [];
  }
};

export const searchPracticalExams = async (params: any) => {
  try {
    let query = supabase.from('practical_batches').select('*');
    Object.keys(params).forEach(key => {
      if (params[key]) {
        if (['department'].includes(key)) {
          query = query.ilike(key, `%${params[key]}%`);
        } else {
          query = query.eq(key, params[key]);
        }
      }
    });
    const { data, error } = await query.order('exam_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching practical exams:", error);
    return [];
  }
};

export const searchPracticalStudentsByName = async (params: { 
  name: string, 
  department?: string, 
  status?: string, 
  level?: string, 
  semester?: number 
}) => {
  try {
    // Join logic: We need to find students but also their batch info (date, time)
    let query = supabase
      .from('practical_students')
      .select(`
        *,
        practical_batches!inner (*)
      `)
      .ilike('name', `%${params.name}%`);

    if (params.department) query = query.eq('practical_batches.department', params.department);
    if (params.status) query = query.eq('practical_batches.status', params.status);
    if (params.level) query = query.eq('practical_batches.level', params.level);
    if (params.semester) query = query.eq('practical_batches.semester', params.semester);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error searching practical students:", error);
    return [];
  }
};

export interface CollegeEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  category?: string;
  speakers?: string;
  image_url?: string;
  description: string;
  created_at?: string;
}

export const searchEvents = async (filters: { query?: string; timeframe?: string }) => {
  try {
    let queryBuilder = supabase.from('events').select('*');
    const today = new Date().toISOString().split('T')[0];
    
    let timeframe = filters.timeframe;
    const cleanQuery = filters.query?.trim().toLowerCase() || '';

    // Intent detection for future/upcoming events
    const futureKeywords = ['upcoming', 'future', 'aage', 'next', 'hone wale', 'aanewale'];
    const pastKeywords = ['past', 'purane', 'ho gaye', 'history'];
    
    const hasFutureIntent = futureKeywords.some(kw => cleanQuery.includes(kw));
    const hasPastIntent = pastKeywords.some(kw => cleanQuery.includes(kw));

    if (!timeframe) {
      if (hasFutureIntent) {
        timeframe = 'upcoming';
      } else if (hasPastIntent) {
        timeframe = 'past';
      }
    }

    // Timeframe filter implementation
    if (timeframe === 'latest' || timeframe === 'upcoming') {
      queryBuilder = queryBuilder.gte('date', today).order('date', { ascending: true });
    } else if (timeframe === 'past_7_days') {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      queryBuilder = queryBuilder.gte('date', pastDate.toISOString().split('T')[0]).lte('date', today).order('date', { ascending: false });
    } else if (timeframe === 'past') {
      queryBuilder = queryBuilder.lt('date', today).order('date', { ascending: false });
    } else {
      // Default: If a year is mentioned like "2026" and it's current/future, and no past intent, default to upcoming if current date is in that year
      const yearMatch = cleanQuery.match(/\b(20\d{2})\b/);
      const currentYear = new Date().getFullYear();
      if (yearMatch && parseInt(yearMatch[0]) >= currentYear && !hasPastIntent) {
        // If they ask for "2026" specifically, they might want all events in 2026, 
        // but if they said "upcoming", we already handled it.
        // To be safe and follow user request, if it's the current year or future, default to showing from today onwards if they didn't specify "past"
        queryBuilder = queryBuilder.gte('date', today).order('date', { ascending: true });
      } else {
        queryBuilder = queryBuilder.order('date', { ascending: false });
      }
    }

    if (cleanQuery) {
      // Remove intent keywords from the structural search to get better matches for the actual event title/desc
      let searchQuery = cleanQuery;
      
      const stopWords = ['lohia', 'college', 'me', 'aaj', 'ke', 'baad', 'event', 'events', 'batao', 'show', 'tell', 'about', 'the', 'in', 'of', 'happening', 'kya', 'hai', 'dikhao', 'dikhaiye', 'list', 'all', 'any', '2024', '2025', '2026', '2027', '2028', 'after', 'today', 'tomorrow', 'yesterday', 'now', 'current'];
      [...futureKeywords, ...pastKeywords, ...stopWords].forEach(kw => {
        // Replace as whole words only to avoid replacing parts of actual words
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        searchQuery = searchQuery.replace(regex, '');
      });
      searchQuery = searchQuery.trim();

      if (searchQuery) {
        const formattedSearchQuery = searchQuery
          .split(/\s+/)
          .map(word => word.trim())
          .filter(word => word.length > 0)
          .join(' | ');
          
        if (formattedSearchQuery) {
          queryBuilder = queryBuilder.textSearch('search_vector', formattedSearchQuery);
        }
      }
    }

    const { data: allEvents, error } = await queryBuilder.limit(40);
    if (error) throw error;
    if (!allEvents) return [];

    let results = allEvents;
    
    // We clean the query for Fuse as well to avoid matching the metadata keywords
    let fuseQuery = cleanQuery;
    const stopWordsForFuse = ['lohia', 'college', 'me', 'aaj', 'ke', 'baad', 'event', 'events', 'batao', 'show', 'tell', 'about', 'the', 'in', 'of', 'happening', 'kya', 'hai', 'dikhao', 'dikhaiye', 'list', 'all', 'any', '2024', '2025', '2026', '2027', '2028', 'after', 'today', 'tomorrow', 'yesterday', 'now', 'current'];
    [...futureKeywords, ...pastKeywords, ...stopWordsForFuse].forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      fuseQuery = fuseQuery.replace(regex, '');
    });
    fuseQuery = fuseQuery.trim();

    if (fuseQuery.length > 2) {
      const fuse = new Fuse(results, { keys: ['title', 'description', 'category'], threshold: 0.5 });
      results = fuse.search(fuseQuery).map(r => r.item);
    }
    
    return results.slice(0, 20);
  } catch (error) {
    console.error("Error searching events:", error);
    return [];
  }
};

export const getCollegeContext = async (query: string) => {
  // Existing context fetcher for general fallback
  // ... (keeping for backward compatibility if needed, but Gemini will prefer tools)
  try {
    // This is a simple context fetcher. In a real app, you might use vector search (pgvector)
    // but for now, we'll fetch general info based on keywords.
    
    let context = "Information about Lohia College:\n";

    if (query.toLowerCase().includes('principal')) {
      const { data } = await supabase.from('college_info').select('*').eq('key', 'principal').single();
      if (data) {
        context += `Principal: ${data.value}. Image: ${data.image_url || 'N/A'}\n`;
      }
    }

    if (query.toLowerCase().includes('faculty') || query.toLowerCase().includes('professor') || query.toLowerCase().includes('hindi')) {
      const { data: faculty } = await supabase.from('faculty').select('*');
      if (faculty && faculty.length > 0) {
        context += "Faculty Members:\n" + faculty.map(f => `- ${f.name} (${f.designation}) in ${f.department} department.`).join('\n') + '\n';
      }
    }

    if (query.toLowerCase().includes('event') || query.toLowerCase().includes('events') || query.toLowerCase().includes('karyakram')) {
      context += "For events, do NOT list them as text. ALWAYS use the marker [[EVENT_EXPLORER:Query]].\n";
    }

    return context;
  } catch (error) {
    console.error("Error fetching college context:", error);
    return ""; // Fallback to no local context
  }
};

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  type?: string;
  media_urls: string[];
  created_at: string;
  event_date: string | null;
}

export const getGalleryCategories = async () => {
  const { data, error } = await supabase
    .from('gallery')
    .select('category')
    .order('category');
  
  if (error) {
    console.error('Error fetching gallery categories:', error);
    return [];
  }
  
  const uniqueCategories = Array.from(new Set(data.map(item => item.category)));
  return uniqueCategories;
};

export const searchGallery = async (filters: { category?: string; query?: string }) => {
  // If searching for something specific like "alumni", we want more diversity
  const limit = 40; 
  
  let { data: allItems, error } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }).limit(limit);

  if (error) {
    console.error('Error searching gallery:', error);
    return [];
  }
  if (!allItems) return [];

  let results = allItems as GalleryItem[];
  
  const cleanCategory = filters.category?.trim();
  const cleanQuery = filters.query?.trim();

  // Combine query and category for fuzzy search
  let searchWord = "";
  if (cleanCategory && cleanCategory.toLowerCase() !== 'general') {
    searchWord = cleanCategory;
  } else if (cleanQuery) {
    searchWord = cleanQuery;
  }

  if (searchWord) {
    // Increased threshold slightly to be more inclusive of related terms
    const fuse = new Fuse(results, { 
      keys: ['category', 'title'], 
      threshold: 0.6, 
      distance: 100,
      ignoreLocation: true 
    });
    results = fuse.search(searchWord).map(r => r.item);
  }

  // If we have a specific query, we want to return a healthy amount for the grid/slider
  return results.slice(0, 15);
};

export const searchCourses = async (stream?: string, queryStr?: string) => {
  try {
    let query = supabase.from('courses').select('*');
    
    let searchTerms = [];
    if (stream) searchTerms.push(stream);
    if (queryStr) searchTerms.push(queryStr);
    
    const combinedSearchStr = searchTerms.join(' ').trim();
    if (combinedSearchStr.length > 0) {
      const formattedSearchQuery = combinedSearchStr
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0)
        .join(' | ');
      
      if (formattedSearchQuery) {
        query = query.textSearch('search_vector', formattedSearchQuery);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error searching courses:", error);
    return [];
  }
};

export const getAdmissionInfoChat = async () => {
  try {
    const { data, error } = await supabase.from('admission_info').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching admission info:", error);
    return [];
  }
};

export const getCollegeMilestones = async () => {
  try {
    const { data, error } = await supabase.from('college_milestones').select('*').order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return [];
  }
};

export interface MeritRecord {
  id: number;
  board_type: string;
  exam_year: string;
  student_name: string;
  division?: string;
  position_in_college?: string;
  remarks?: string;
  created_at?: string;
}

export const getMeritBoards = async () => {
  try {
    const { data, error } = await supabase
      .from('college_merit_list')
      .select('board_type')
      .order('board_type');
    
    if (error) throw error;
    
    const uniqueBoards = Array.from(new Set(data.map(item => item.board_type)));
    return uniqueBoards;
  } catch (error) {
    console.error("Error fetching merit boards:", error);
    return [];
  }
};

export const searchMeritList = async (params: { board_type?: string; exam_year?: string; student_name?: string }) => {
  try {
    let query = supabase.from('college_merit_list').select('*');

    if (params.board_type) {
      query = query.ilike('board_type', `%${params.board_type}%`);
    }
    
    // If student_name looks like a year, move it to exam_year if not already provided
    let searchName = params.student_name;
    let searchYear = params.exam_year;

    if (searchName && !searchYear) {
      const yearMatch = searchName.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        searchYear = yearMatch[0];
        searchName = searchName.replace(yearMatch[0], '').trim();
      }
    }

    if (searchYear) {
      query = query.eq('exam_year', searchYear);
    }

    const filteredSearchName = (searchName || '').trim();

    if (filteredSearchName.length > 0) {
      // Create a formatted query for textSearch (e.g. "gopal | commerce")
      // We will match ANY of the words to be more forgiving, similar to how AI might search
      const formattedSearchQuery = filteredSearchName
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0)
        .join(' | ');
        
      if (formattedSearchQuery) {
        query = query.textSearch('search_vector', formattedSearchQuery);
      }
    }

    const { data, error } = await query.order('exam_year', { ascending: false }).order('id', { ascending: true }).limit(100);
    if (error) throw error;
    
    let results = data || [];
    
    // Use Fuse as a secondary ranker to bubble up the closest exact matches if textSearch matched widely
    if (searchName && searchName.length > 0 && results.length > 0) {
      const fuse = new Fuse(results, { keys: ['student_name', 'board_type', 'remarks'], threshold: 0.6 });
      results = fuse.search(searchName).map(r => r.item);
    }

    return results;
  } catch (error) {
    console.error("Error searching merit list:", error);
    return [];
  }
};

export const getExamPassingRules = async () => {
  try {
    const { data, error } = await supabase.from('exam_passing_rules').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching passing rules:", error);
    return [];
  }
};

export const searchKnowledgeBase = async (params: { query?: string }) => {
  try {
    let query = supabase.from('college_kb').select('*');
    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim();
      query = query.or(`question.ilike.%${q}%,answer.ilike.%${q}%,category.ilike.%${q}%`);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    return [];
  }
};

export const getMaterialsChat = async () => {
  try {
    const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching materials for chat:", error);
    return [];
  }
};

export const searchMaterialsChat = async (query?: string) => {
  try {
    let queryBuilder = supabase.from('materials').select('*');
    if (query && query.trim().length > 0) {
      const q = query.trim();
      queryBuilder = queryBuilder.ilike('title', `%${q}%`);
    }
    const { data, error } = await queryBuilder.order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error searching materials for chat:", error);
    return [];
  }
};

export const searchAlertsChat = async (query?: string) => {
  try {
    const { data, error } = await supabase
      .from('academic_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data) return [];

    // Filter in-memory for active status to prevent 400 Bad Request if is_active column doesn't exist
    const activeAlerts = data.filter(item => item.is_active !== false);

    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      return activeAlerts.filter(item => 
        item.title?.toLowerCase().includes(q) || 
        item.description?.toLowerCase().includes(q)
      );
    }
    return activeAlerts;
  } catch (error) {
    console.error("Error searching alerts for chat:", error);
    return [];
  }
};

