import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { Settings } from 'lucide-react';

export const Route = createFileRoute('/mobile/settings')({
  component: () => (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-[100px]">
      <MobileHeader title="Configurações" />
      <div className="flex-1 bg-[#0a0a0a] rounded-t-[24px] -mt-5 relative z-10 px-6 pt-6">
        <div className="flex flex-col gap-2">
          {[
            'Notificações',
            'Privacidade',
            'Qualidade do vídeo',
            'Idioma',
            'Ajuda e Suporte',
            'Sobre o Looplance'
          ].map((item) => (
            <div key={item} className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-[16px] border border-[#2a2a2a] mb-2">
              <span className="text-white text-[14px]">{item}</span>
              <div className="w-5 h-5 rounded-full border border-[rgba(255,255,255,0.2)]" />
            </div>
          ))}
          <button className="text-red-500 font-bold text-[14px] mt-6 px-4">Sair da conta</button>
        </div>
      </div>
    </div>
  )
});
