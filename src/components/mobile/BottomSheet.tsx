import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BottomSheet = ({ isOpen, onClose, title, children }: BottomSheetProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative w-full max-w-[390px] bg-[#111111] rounded-t-[32px] animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto pb-safe pointer-events-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-6">
          <div className="w-10 h-1 bg-[#2a2a2a] rounded-full" />
        </div>
        
        <div className="px-6 pb-8">
          <h2 className="text-white text-[17px] font-bold mb-6">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
};
