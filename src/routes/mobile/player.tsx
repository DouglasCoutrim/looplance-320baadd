import { createFileRoute } from '@tanstack/react-router';
import { Play, Share2, Download, Camera, Star, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/mobile/player')({
  component: ReplayPlayer,
});

function ReplayPlayer() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);

  return (
    <div className="flex flex-col min-h-screen bg-[#FFB347] pb-[env(safe-area-inset-bottom,24px)]">
      {/* Custom Header */}
      <div className="px-6 pt-[env(safe-area-inset-top,44px)] pb-6 flex items-center justify-between">
        <button 
          onClick={() => navigate({ to: '/mobile' })}
          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-white text-[18px] font-black">REPLAY</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>
      
      {/* Video Area */}
      <div className="px-6 mb-8">
        <div className="w-full h-[240px] bg-black rounded-[40px] relative overflow-hidden shadow-2xl">
          <img 
            src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" 
            className="w-full h-full object-cover opacity-90"
            alt="Video preview"
          />
          
          {/* Overlays */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button className="w-20 h-20 bg-[#F97316] rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl">
              <Play size={40} className="text-white fill-white ml-1" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="absolute bottom-6 left-8 right-8 h-1.5 bg-white/20 rounded-full">
            <div className="w-1/3 h-full bg-[#F97316] rounded-full" />
          </div>

          <div className="absolute bottom-10 left-8 text-white text-[11px] font-black">
            00:03 / 00:08
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="flex-1 bg-white rounded-t-[48px] p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-[#2D3436] text-[24px] font-black leading-tight">Mexican Appetizer</h1>
              <div className="flex items-center gap-1 bg-[#FDF2E9] px-2 py-0.5 rounded-full border border-[#F97316]/20">
                <span className="text-[#F97316] text-[12px] font-black">5.0</span>
                <Star size={10} fill="#F97316" className="text-[#F97316]" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-[14px] font-medium">
              <Camera size={16} />
              <span>Câmera Principal • Hoje, 14:20</span>
            </div>
          </div>
          <div className="text-[24px] font-black text-[#F97316]">$15.00</div>
        </div>

        <div className="flex gap-2 mb-8">
          <span className="bg-[#FDF2E9] text-[#F97316] text-[11px] font-black px-4 py-1.5 rounded-full border border-[#F97316]/20 uppercase tracking-wider">Arena Central</span>
          <span className="bg-gray-100 text-gray-400 text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider">Quadra 01</span>
        </div>

        <div className="flex flex-col gap-4 mb-10">
          <button 
            className="w-full bg-[#F97316] text-white font-black h-[64px] rounded-[24px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-[#F97316]/20"
          >
            <Share2 size={24} />
            Compartilhar agora
          </button>
          <button className="w-full bg-[#FDF2E9] text-[#F97316] font-black h-[64px] rounded-[24px] flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Download size={24} />
            Baixar vídeo
          </button>
        </div>

        {/* Rating Section */}
        <div className="text-center pt-4 border-t border-gray-100">
          <h3 className="text-[#2D3436] text-[16px] font-black mb-4 uppercase tracking-widest">Avalie este lance</h3>
          <div className="flex justify-center gap-3 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}>
                <Star 
                  size={32} 
                  className={s <= rating ? "text-[#F97316] fill-[#F97316]" : "text-gray-200"} 
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}