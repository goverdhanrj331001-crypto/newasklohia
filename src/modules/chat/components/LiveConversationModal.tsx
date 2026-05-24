import React from 'react';
import { X, Mic, MessageSquare, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Lottie from 'lottie-react';
import { useLiveAPI } from '../hooks/useLiveAPI';
import lottieAnimation from '../../../../public/lottie-animation.json';

interface LiveConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveConversationModal = ({ isOpen, onClose }: LiveConversationModalProps) => {
  const { isConnected, isSpeaking, transcript, error, startConnection, stopConnection } = useLiveAPI();

  React.useEffect(() => {
    if (isOpen && !isConnected && !error) {
      startConnection();
    }
    if (!isOpen && isConnected) {
      stopConnection();
    }
    return () => {
      stopConnection();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0A0A] text-white flex flex-col font-sans overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-full h-[60vh] bg-gradient-to-bl from-purple-900/40 via-transparent to-transparent pointer-events-none" />
      
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-6 relative z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <div className="bg-white/5 px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/5">
          <span className="text-xs font-medium text-white/80">Lohia AI 1.0</span>
          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded font-bold tracking-wider text-white/60">BETA</span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        
        {/* The Orb / Lottie */}
        <div className="relative w-64 h-64 mb-6 flex items-center justify-center group">
          {error ? (
            <div className="w-32 h-32 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/50">
               <span className="text-red-400 text-xs font-bold px-4 text-center">{error}</span>
            </div>
          ) : (
            <div className={`transition-opacity duration-500 w-full h-full flex items-center justify-center ${isConnected ? 'opacity-100' : 'opacity-40'}`}>
               <Lottie animationData={lottieAnimation} loop={true} autoplay={true} className="w-full h-full scale-[1.5]" />
            </div>
          )}
        </div>

        {/* Text Area */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-md"
        >
          <h2 className="text-[28px] leading-tight font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70 mb-6">
            {error ? "Voice Connection Failed" : "How Can I Help\nYou Today ?"}
          </h2>

          <div className="h-24 overflow-y-auto px-4 custom-scrollbar mask-fade-out">
            <AnimatePresence mode="popLayout">
              {transcript.split('\n').slice(0, 3).map((line, i) => (
                <motion.p 
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1 - (i * 0.3), y: 0 }}
                  className={`text-sm mb-2 font-medium ${line.startsWith('AI:') ? 'text-purple-300' : 'text-white/80'}`}
                >
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 pb-12 pt-6 flex flex-col items-center">
        {!error && (
            <motion.div 
              className="text-xs font-medium text-white/50 mb-6"
            >
              {isConnected ? (isSpeaking ? "Lohia AI is speaking..." : "Listening...") : "Connecting to Live Server..."}
            </motion.div>
        )}

        <div className="flex items-center justify-center gap-8">
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5"
          >
            <MessageSquare className="w-5 h-5 text-white/60" />
          </button>

          <div className="relative">
            <button className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 transition-colors ${isConnected ? 'bg-purple-600/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10'}`}>
              <Mic className={`w-8 h-8 ${isConnected ? 'text-purple-300' : 'text-white/40'}`} />
            </button>
          </div>

          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>
    </div>
  );
};

