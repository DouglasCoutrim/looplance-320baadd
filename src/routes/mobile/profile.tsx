import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { Camera, Edit2 } from 'lucide-react';

export const Route = createFileRoute('/mobile/profile')({
  component: MobileProfile,
});

interface ProfileFieldProps {
  label: string;
  value: string;
  placeholder: string;
}

const ProfileField = ({ label, value, placeholder }: ProfileFieldProps) => (
  <div className="flex flex-col gap-1.5 mb-5 w-full">
    <label className="text-[rgba(255,255,255,0.6)] text-[12px] px-1">{label}</label>
    <div className="bg-[#252525] border border-[#2a2a2a] rounded-[12px] h-[48px] px-4 flex items-center">
      <input 
        type="text" 
        defaultValue={value}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-white text-[14px] w-full"
      />
    </div>
  </div>
);

function MobileProfile() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-[100px]">
      <MobileHeader title="Meu Perfil" />
      
      <div className="flex-1 bg-[#0a0a0a] rounded-t-[24px] -mt-5 relative z-10 px-6 pt-10">
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <div className="w-[80px] h-[80px] rounded-full border-[3px] border-[#F97316] p-0.5 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80" 
                className="w-full h-full rounded-full object-cover"
                alt="Profile"
              />
            </div>
            <button className="absolute bottom-0 right-0 w-6 h-6 bg-[#F97316] rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
              <Edit2 size={12} className="text-black" />
            </button>
          </div>
          
          <h2 className="text-white text-[18px] font-bold mt-4">Cristiano Ronaldo</h2>
          <p className="text-[rgba(255,255,255,0.55)] text-[13px]">Arena Central • Atleta Pro</p>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col">
          <ProfileField label="Nome completo" value="Cristiano Ronaldo" placeholder="Seu nome" />
          <ProfileField label="Modalidade esportiva" value="Basquete" placeholder="Sua modalidade" />
          <ProfileField label="Arena" value="Arena Central" placeholder="Sua arena principal" />
          <ProfileField label="Telefone" value="(11) 98888-7777" placeholder="Seu contato" />
        </div>

        <button className="w-full bg-[#F97316] text-black font-bold h-[52px] rounded-[14px] mt-4 shadow-lg active:scale-95 transition-transform">
          Atualizar perfil
        </button>
      </div>
    </div>
  );
}
