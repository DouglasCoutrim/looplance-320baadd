interface TabOption {
  id: string;
  label: string;
}

interface TabsPillProps {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
}

export const TabsPill = ({ options, activeId, onChange }: TabsPillProps) => {
  return (
    <div className="bg-[#1a1a1a] rounded-full p-1 flex items-center w-full max-w-md mx-auto h-[44px]">
      {options.map((option) => {
        const isActive = activeId === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`flex-1 h-[36px] rounded-full text-[14px] font-bold transition-all duration-200 ease-in-out ${
              isActive 
                ? 'bg-[#F97316] text-[#000]' 
                : 'bg-transparent text-[rgba(255,255,255,0.5)] hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
