import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { Camera, Edit2, SlidersHorizontal, User, Shield, CreditCard, LogOut } from 'lucide-react';

export const Route = createFileRoute('/mobile/profile')({
  component: MobileProfile,
});

interface ProfileFieldProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

const ProfileField = ({ label, value, icon }: ProfileFieldProps) => (
  <div className="flex items-center gap-4 p-5 bg-white rounded-[24px] mb-4 border border-gray-100 shadow-sm">
    <div className="w-12 h-12 bg-[#FDF2E9] rounded-2xl flex items-center justify-center text-[#F97316]">
      {icon}
    </div>
    <div className="flex-1">
      <label className="text-gray-400 text-[11px] font-black uppercase tracking-widest leading-none mb-1 block">{label}</label>
      <div className="text-[#2D3436] text-[16px] font-black">{value}</div>
    </div>
    <Edit2 size={16} className="text-gray-300" />
  </div>
);

function MobileProfile() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFB347] pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
      <MobileHeader title="Perfil" />
      
      <div className="flex-1 bg-white rounded-t-[48px] -mt-5 relative z-10 px-6 pt-10">
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <div className="w-[110px] h-[110px] rounded-[40px] border-[4px] border-[#F97316]/10 p-1 bg-white shadow-xl overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80" 
                className="w-full h-full rounded-[32px] object-cover"
                alt="Profile"
              />
            </div>
            <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#F97316] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#F97316]/40 border-4 border-white">
              <Camera size={18} strokeWidth={3} />
            </button>
          </div>
          
          <h2 className="text-[#2D3436] text-[24px] font-black mt-6">Cristiano Ronaldo</h2>
          <p className="text-[#F97316] text-[14px] font-black uppercase tracking-widest mt-1">Arena Central • Atleta Pro</p>
        </div>

        {/* Menu Sections */}
        <div className="flex flex-col mb-6">
          <ProfileField label="Nome completo" value="Cristiano Ronaldo" icon={<User size={20} />} />
          <ProfileField label="Modalidade" value="Basquete" icon={<SlidersHorizontal size={20} />} />
          <ProfileField label="Privacidade" value="Perfil Público" icon={<Shield size={20} />} />
          <ProfileField label="Assinatura" value="Plano Mensal" icon={<CreditCard size={20} />} />
        </div>

        <button className="w-full bg-[#FF4757]/10 text-[#FF4757] font-black h-[64px] rounded-[24px] flex items-center justify-center gap-3 active:scale-95 transition-all">
          <LogOut size={20} strokeWidth={3} />
          Sair da Conta
        </button>
      </div>
    </div>
  );
}