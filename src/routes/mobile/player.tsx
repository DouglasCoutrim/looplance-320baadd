import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { Play, Share2, Download, Camera, Star } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '../../components/mobile/BottomSheet';

export const Route = createFileRoute('/mobile/player')({
  component: ReplayPlayer,
});

function ReplayPlayer() {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [rating, setRating] = useState(0);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-8">
      <MobileHeader title="Lance do Jogo" showBack />
      
      {/* Video Area */}
      <div className="w-full h-[220px] bg-black relative flex items-center justify-center">
        <img 
          src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" 
          className="w-full h-full object-cover opacity-80"
          alt="Video preview"
        />
        
        {/* Overlays */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <Play size={32} className="text-white fill-white ml-1" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div className="w-1/3 h-full bg-[#F97316]" />
        </div>

        <div className="absolute bottom-3 left-4 text-white text-[12px]">
          00:03 / 00:08
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-[#1a1a1a] rounded-t-[24px] -mt-3 relative z-10 p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-white text-[18px] font-bold mb-1">Lance do Jogo</h1>
            <div className="flex items-center gap-2 text-[rgba(255,255,255,0.55)] text-[13px]">
              <Camera size={14} />
              <span>Câmera Principal • Hoje, 14:20</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <span className="bg-[#F97316] text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase">Arena Central</span>
          <span className="bg-[#2a2a2a] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">Quadra 01</span>
        </div>

        <div className="w-full h-[1px] bg-[rgba(255,255,255,0.06)] mb-6" />

        <div className="flex flex-col gap-3 mb-8">
          <button 
            onClick={() => setIsShareOpen(true)}
            className="w-full bg-[#F97316] text-black font-bold h-[52px] rounded-[14px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Share2 size={20} />
            Compartilhar agora
          </button>
          <button className="w-full border border-[rgba(255,255,255,0.3)] text-white font-bold h-[52px] rounded-[14px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Download size={20} />
            Baixar vídeo
          </button>
        </div>

        {/* Rating Section */}
        <div className="text-center">
          <h3 className="text-white text-[15px] font-medium mb-3">Avalie este lance</h3>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}>
                <Star 
                  size={28} 
                  className={s <= rating ? "text-[#F97316] fill-[#F97316]" : "text-[#F97316] opacity-30"} 
                />
              </button>
            ))}
          </div>
          <div className="bg-[#252525] rounded-[12px] p-4 mb-4">
            <textarea 
              placeholder="Deixe um comentário..." 
              className="w-full bg-transparent border-none outline-none text-white text-[14px] resize-none h-20 placeholder:text-[rgba(255,255,255,0.3)]"
            />
          </div>
          <button className="w-full bg-[#F97316] text-black font-bold h-[48px] rounded-[12px] active:scale-95 transition-transform">
            Enviar avaliação
          </button>
        </div>
      </div>

      <BottomSheet 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        title="Compartilhar replay"
      >
        <div className="flex flex-col gap-6">
          <div className="relative w-full h-[160px] rounded-[16px] overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80" 
              className="w-full h-full object-cover"
              alt="Preview"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-y-6 gap-x-4">
            {[
              { label: 'WhatsApp', color: '#25D366' },
              { label: 'Instagram', color: '#E4405F' },
              { label: 'TikTok', color: '#000000' },
              { label: 'Copiar link', color: '#2a2a2a' },
              { label: 'Download', color: '#2a2a2a' },
              { label: 'Mais', color: '#2a2a2a' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center`} style={{ backgroundColor: item.color === '#2a2a2a' ? '#1a1a1a' : item.color }}>
                    <div className="w-5 h-5 bg-white/20 rounded-sm" />
                  </div>
                </div>
                <span className="text-[rgba(255,255,255,0.6)] text-[11px]">{item.label}</span>
              </div>
            ))}
          </div>
          
          <button className="w-full bg-[#F97316] text-black font-bold h-[52px] rounded-[14px] mt-2 active:scale-95 transition-transform">
            Compartilhar
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
