import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  placeholder?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, placeholder = 'Voice Entry' }) => {
  const [listening, setListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition API is not supported in this browser environment.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={startListening}
      title={placeholder}
      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
        listening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
      }`}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
};
