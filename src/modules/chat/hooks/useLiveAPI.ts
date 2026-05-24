import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { supabase } from '@/lib/supabase';
import { 
  facultySearchTool, principalTool, collegeSectionsTool, 
  meritListTool, mainExamsTool, studyMaterialTool,
  materialsChatSearchTool, alertsChatSearchTool
} from '../services/geminiService';
import { 
  searchFaculty, getPrincipalInfo, getCollegeSections, 
  searchMeritList, searchMainExams, searchStudyMaterial,
  searchMaterialsChat, searchAlertsChat
} from '../services/collegeDataService';


// Utility to convert Float32Array (from getUserMedia) to Int16Array (for Gemini)
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

// Utility to encode Int16Array to Base64
function bufferToBase64(buffer: Int16Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Utility to decode Base64 to Int16Array
function base64ToBuffer(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<any>(null);
  const sessionRef = useRef<any>(null); // To store the live session
  
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);

  const stopAllAudio = useCallback(() => {
    activeSourceNodesRef.current.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Source might have already finished
      }
    });
    activeSourceNodesRef.current = [];
    nextPlayTimeRef.current = 0;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const processAudioQueue = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    while (audioQueueRef.current.length > 0) {
      const pcm16 = audioQueueRef.current.shift()!;
      
      // Convert Int16 back to Float32 for Web Audio API playback
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 0x8000;
      }
      
      const buffer = ctx.createBuffer(1, float32.length, 24000); // Gemini output is 24kHz
      buffer.getChannelData(0).set(float32);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      // Improved Scheduling Logic:
      // 1. If we are starting fresh or lagged behind, start with a tiny 100ms lookahead
      // 2. Otherwise, chain it exactly after the previous buffer
      let startTime = nextPlayTimeRef.current;
      const now = ctx.currentTime;
      
      if (startTime < now) {
        // Either starting fresh or we lagged. Add 100ms buffer to prevent immediate stutter.
        startTime = now + 0.1; 
      }
      
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
      
      activeSourceNodesRef.current.push(source);
      
      isPlayingRef.current = true;
      setIsSpeaking(true);

      source.onended = () => {
        // Remove from active nodes
        activeSourceNodesRef.current = activeSourceNodesRef.current.filter(n => n !== source);
        
        // When a buffer ends, check if there's more to play
        if (audioQueueRef.current.length === 0 && ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          setIsSpeaking(false);
        }
      };
    }
  }, []);

  // Removed processAudioQueueRef.current and useEffect for processAudioQueue
  // since we'll call it directly from onmessage.

  const startConnection = async () => {
    try {
      setError(null);
      setTranscript('');

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Live Voice chat requires a Google Gemini API Key. Please set NEXT_PUBLIC_GEMINI_API_KEY in your .env file.");
      }
      const ai = new GoogleGenAI({ apiKey });

      // Fetch dynamic college comprehensive context
      let contextInfo = "College Name: Lohia College.\n";
      try {
        const res = await fetch('/api/chat/live-context');
        if (res.ok) {
          const data = await res.json();
          if (data.context) {
            contextInfo = data.context;
          }
        }
      } catch (err) {
        console.warn("Could not fetch full college context, using fallback...", err);
      }

      const dynamicSystemInstruction = `You are the Official Lohia College AI Assistant. You are a highly professional, intelligent, and helpful YOUNG INDIAN FEMALE representation of the college.
      
IDENTITY & PERSONA:
1. **Gender**: Strictly FEMALE. Use feminine grammar in Hindi/Hinglish (e.g., "bataungi", "kar sakti hoon").
2. **Tone**: Warm, welcoming, and academic yet approachable. Think of a senior counselor or a top-performing student leader.
3. **Language**: Fluent Hinglish (blend of Hindi and English). Keep responses concise for voice interaction.
4. **Name Protocol**: ALWAYS pronounce "Prof." as "Professor". Address professors and faculty with respect.

MISSION:
- You provide EXACT and ACCURATE information about Lohia College history, faculty, exams, events, and academics.
- Pay EXTRA attention to the difference between departments with similar names (e.g., Zoology vs Sociology).
- When asked for faculty in a department, check EVERY name listed in that department in the knowledge base.
- Always provide the specific qualification (e.g., Ph.D., M.Sc.) if requested, as it is listed for each faculty member.
- You use the COMPREHENSIVE KNOWLEDGE BASE provided below as your absolute source of truth. Do not omit names listed there.

ADVANCED CAPABILITIES:
- **Search & Synthesis**: When asked about a department, list the faculty members one by one clearly.
- **Qualification Expert**: If asked "What is the qualification of [Name]?", look specifically for the "Qualification" field in the faculty data.
- **Principal & Past Principals**: You have a dedicated list of current and past principals. Use it to answer questions about college leadership heritage.
- **History Expert**: Be proud of the college's heritage. Use the foundation details, vision, and founder (Seth Budhmal Lohia) precisely.
- **Toppers & Merit Expert**: You have access to the college's Hall of Fame (merit list from 1945 onwards). If asked about toppers, gold medalists, or merit holders, share their names, years, and achievements with pride.
- **Materials, Folders, & Notices**: Students will ask you about uploaded study materials, PDF/Excel files, PowerPoint slides, folders, or latest announcements, notices, and notifications in Hinglish, Hindi, or English. You MUST call 'search_materials_chat' or 'search_alerts_chat' to fetch them and speak them out. Explain what notice or material was found and read the key details to them.
- **Admission Urgent Alert**: Admission session for 2026-27 is LIVE from May 1 to May 26, 2026. Nodal Officer UG Admission is Dr. Umed Singh Gothwal (9414203821). Stream-wise Course Contacts: B.A. (Mohd Javed Khan: 9785159841), B.Sc. Bio/Math (Dr. Mukesh Kumar Meena: 8005763754), B.Com./BBA (Dr. Mahendra Kumar Khardiya: 9928273463), AEDP (Dr. Madhu Sudan Pardhan: 9782582267). Always guide students to contact these respective stream conveners for specific questions, and Dr. Umed Gothwal as the central Nodal Officer. Mention the documents and the help WhatsApp number 9509932564 if they sound confused.
- **Unknown Information**: If the specific information is NOT in your knowledge base, do NOT hallucinate. Say: "Maaf kijiye, mere paas iski sateek jankari nahi hai. Aap college office mein sampark kar sakte hain ya website check kar sakte hain."

INTERACTION FLOW:
- **Initial Greeting**: You MUST start with this EXACT English greeting: "Hello, I am Lohia College AI Assistant. How can I help you? What is your name sir?" (Do NOT translate this to Hindi or repeat it).
- **Language Strategy**: Greet in English. For the rest of the conversation, use fluent Hinglish unless the user speaks specifically in one language.
- Use "Sir" or "Madam" respectfully when addressing the user if they prefer, or use their name naturally once shared.
- Once you know their name, use it naturally in conversation.
- Use short, spoken-style responses. Avoid lists with more than 3 items; instead, offer to give more details if they want.

--- COMPREHENSIVE KNOWLEDGE BASE ---
${contextInfo}`;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      const source = ctx.createMediaStreamSource(stream);
      
      // Use AudioWorklet to avoid ScriptProcessorNode deprecation warnings
      const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 4096;
          this.buffer = new Float32Array(this.bufferSize);
          this.framesWritten = 0;
        }
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input.length > 0) {
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
              this.buffer[this.framesWritten++] = channelData[i];
              if (this.framesWritten >= this.bufferSize) {
                this.port.postMessage(this.buffer);
                this.buffer = new Float32Array(this.bufferSize);
                this.framesWritten = 0;
              }
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(workletUrl);
      
      const processor = new AudioWorkletNode(ctx, 'pcm-processor');
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(ctx.destination);
      
      // Initialize connection
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          tools: [
            { functionDeclarations: [facultySearchTool, principalTool, collegeSectionsTool, meritListTool, mainExamsTool, studyMaterialTool, materialsChatSearchTool, alertsChatSearchTool] }
          ],
          systemInstruction: dynamicSystemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            
            // Trigger automatic greeting from AI
            setTimeout(() => {
              sessionPromise.then((session) => {
                try {
                  session.sendRealtimeInput({
                    text: "Hello"
                  });
                } catch (e) {}
              });
            }, 500);
            
            processor.port.onmessage = (e) => {
              const inputData = e.data;
              const pcm16 = floatTo16BitPCM(inputData);
              const base64Data = bufferToBase64(pcm16);
              
              sessionPromise.then((session) => {
                try {
                  session.sendRealtimeInput({
                    audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                } catch (err) {
                  // Ignore socket closing errors from residual audio frames
                }
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle interruption
            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }

            // Handle Tool Calls
            if (message.toolCall && message.toolCall.functionCalls) {
              const session = await sessionPromise;
              const toolResponses: any[] = [];

              for (const call of message.toolCall.functionCalls) {
                let result;
                try {
                  switch (call.name) {
                    case 'search_faculty': result = await searchFaculty(call.args as any); break;
                    case 'get_principal_info': result = await getPrincipalInfo(); break;
                    case 'get_college_info_sections': result = await getCollegeSections((call.args as any).key); break;
                    case 'search_merit_list': result = await searchMeritList(call.args as any); break;
                    case 'search_main_exams': result = await searchMainExams(call.args as any); break;
                    case 'get_study_material': result = await searchStudyMaterial(call.args as any); break;
                    case 'search_materials_chat': result = await searchMaterialsChat((call.args as any).query); break;
                    case 'search_alerts_chat': result = await searchAlertsChat((call.args as any).query); break;
                    default: result = { error: "Function not found" };
                  }
                } catch (e) {
                  console.error(`Error in Live API tool ${call.name}:`, e);
                  result = { error: "Failed to execute function" };
                }
                
                toolResponses.push({
                  name: call.name,
                  response: { data: result },
                  id: call.id
                });
              }

              if (toolResponses.length > 0) {
                session.sendToolResponse({
                  functionResponses: toolResponses
                });
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.modelTurn?.parts) {
              const text = message.serverContent.modelTurn.parts
                .filter(p => p.text)
                .map(p => p.text)
                .join('');
              if (text) {
                setTranscript(prev => `AI: ${text}\n${prev}`);
              }
            }
          
            const parts = message.serverContent?.modelTurn?.parts;
            const base64Audio = (parts && parts.length > 0) ? parts.find(p => p.inlineData)?.inlineData?.data : undefined;
            if (base64Audio) {
              const pcm16 = base64ToBuffer(base64Audio);
              audioQueueRef.current.push(pcm16);
              processAudioQueue();
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error with Live API.");
            stopConnection();
          },
          onclose: (e: any) => {
            if (e && e.code !== 1000) {
              console.warn("Live API Closed:", e.code, e.reason);
              if (e.reason && e.reason.toLowerCase().includes("suspended")) {
                setError("Your Gemini API Key has been suspended. Please update it in .env or check Google Cloud Console.");
              } else if (e.reason && e.reason.includes("Permission denied")) {
                setError(`Access denied: ${e.reason}`);
              } else if (e.reason) {
                setError(`Connection closed: ${e.reason}`);
              }
            }
            stopConnection();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      let userErrorMessage = err.message || "Failed to start connection.";
      if (userErrorMessage.includes("Requested device not found")) {
        userErrorMessage = "Microphone nahi mila. Please check your mic connection or open in a new tab.";
      } else if (userErrorMessage.includes("Permission denied")) {
        userErrorMessage = "Microphone access blocked. Please allow mic permission in your browser.";
      }
      setError(userErrorMessage);
      stopConnection();
    }
  };

  const stopConnection = () => {
    setIsConnected(false);
    setIsSpeaking(false);
    stopAllAudio();
    
    if (processorRef.current) {
      if (processorRef.current.port) {
        processorRef.current.port.onmessage = null;
      }
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // We should close the session safely 
    // The google genai SDK might return a closeable object via promise
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        if (typeof session.close === 'function') {
           session.close();
        }
      });
      sessionRef.current = null;
    }
    
    audioQueueRef.current = [];
  };

  return {
    isConnected,
    isSpeaking,
    transcript,
    error,
    startConnection,
    stopConnection
  };
}
