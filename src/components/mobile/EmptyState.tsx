import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export const EmptyState = ({ icon: Icon, title, subtitle }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-20 h-20 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-6">
        <Icon size={48} className="text-[rgba(255,255,255,0.15)]" />
      </div>
      <h3 className="text-[rgba(255,255,255,0.5)] text-[15px] mb-2">{title}</h3>
      <p className="text-[rgba(255,255,255,0.3)] text-[13px] max-w-[220px]">
        {subtitle}
      </p>
    </div>
  );
};
