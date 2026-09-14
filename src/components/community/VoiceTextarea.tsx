import { Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

export function VoiceTextarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  const [listening,setListening]=useState(false);
  const recognition=useRef<SpeechRecognitionLike | null>(null);
  function toggleVoice() {
    if(listening) { recognition.current?.stop(); setListening(false); return; }
    const speechWindow=window as unknown as { SpeechRecognition?: new()=>SpeechRecognitionLike; webkitSpeechRecognition?: new()=>SpeechRecognitionLike };
    const SpeechRecognition=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!SpeechRecognition) { toast.error("O reconhecimento de voz não está disponível neste navegador. Você ainda pode digitar normalmente."); return; }
    const instance=new SpeechRecognition();
    instance.lang="pt-BR"; instance.interimResults=false; instance.continuous=true;
    instance.onresult=(event)=>{const transcript=Array.from(event.results).filter(item=>item.isFinal).map(item=>item[0].transcript).join(" ");if(transcript) onChange([value,transcript].filter(Boolean).join(" ").trim());};
    instance.onend=()=>setListening(false);
    instance.onerror=()=>{setListening(false);toast.error("Não consegui ouvir. Tente novamente ou digite sua resposta.");};
    recognition.current=instance; instance.start(); setListening(true);
  }
  return <div className="relative"><textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-none rounded-2xl border border-[#ddc9bb] bg-white p-4 pr-14 outline-none focus:border-[#9f3d25] focus:ring-2 focus:ring-[#9f3d25]/10"/><button type="button" onClick={toggleVoice} className={`absolute bottom-3 right-3 grid size-10 place-items-center rounded-full ${listening?"animate-pulse bg-red-600 text-white":"bg-[#f4e6d7] text-[#9f3d25]"}`} aria-label={listening?"Parar gravação":"Responder por voz"}>{listening?<MicOff className="size-5"/>:<Mic className="size-5"/>}</button></div>;
}
