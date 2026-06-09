import { Play } from "lucide-react";

interface ReplayCardListProps {
  title: string;
  arena: string;
  timestamp: string;
  thumbnail: string;
  status: string;
  onDelete?: () => void;
  onShare?: () => void;
}

export const ReplayCardList = ({ title, arena, timestamp, thumbnail, status }: ReplayCardListProps) => {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[rgba(255,255,255,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="relative w-20 h-14 bg-black rounded-[8px] overflow-hidden flex-shrink-0">
        <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Play size={16} className="text-white" fill="white" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white text-[14px] font-bold truncate">{title}</h4>
        <p className="text-[rgba(255,255,255,0.55)] text-[12px] truncate">{arena} • {timestamp}</p>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {status === 'AO VIVO' && <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            status === 'AO VIVO' 
              ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' 
              : status === 'PRONTO'
              ? 'bg-[rgba(249,115,22,0.15)] text-[#F97316]'
              : 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)]'
          }`}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};
