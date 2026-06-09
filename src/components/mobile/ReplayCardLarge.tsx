import { Play, Share2, Camera } from "lucide-react";

interface ReplayCardLargeProps {
  title: string;
  duration: string;
  arena: string;
  timestamp: string;
  thumbnail: string;
  status?: string;
}

export const ReplayCardLarge = ({ title, duration, arena, timestamp, thumbnail, status }: ReplayCardLargeProps) => {
  return (
    <div className="bg-[#1a1a1a] rounded-[16px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="relative w-full h-[160px]">
        <img 
          src={thumbnail} 
          alt={title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 bg-[#F97316] p-1.5 rounded-lg shadow-lg">
          <Play size={16} fill="black" className="text-black ml-0.5" />
        </div>
      </div>
      
      <div className="p-[14px] flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h3 className="text-white text-[15px] font-bold truncate">{title}</h3>
          <span className="text-[#F97316] text-[14px] font-bold">{duration}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Camera size={14} className="text-[rgba(255,255,255,0.6)]" />
          <span className="text-[rgba(255,255,255,0.6)] text-[13px]">{arena}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-[rgba(255,255,255,0.35)] text-[12px]">{timestamp}</span>
          {status && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              status === 'AO VIVO' 
                ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' 
                : 'bg-[rgba(249,115,22,0.15)] text-[#F97316]'
            }`}>
              {status}
            </span>
          )}
        </div>
        
        <div className="flex flex-col gap-2 mt-2">
          <button className="w-full bg-[#F97316] text-black font-bold h-[40px] rounded-[10px] active:scale-95 transition-transform">
            Assistir
          </button>
          <button className="w-full border border-[rgba(255,255,255,0.3)] text-white font-medium h-[40px] rounded-[10px] active:scale-95 transition-transform">
            Compartilhar
          </button>
        </div>
      </div>
    </div>
  );
};
