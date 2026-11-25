import React from 'react';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  showWordmark = true,
  size = 'md',
}) => {
  const iconDim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <div
        className={`${iconDim} rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center`}
      >
        <img
          src="/assets/aistudio/Gemini_Generated_Image_puw6hepuw6hepuw6_3a46cb28.jpeg"
          alt="Logo PinjamKuy"
          className="w-full h-full object-cover scale-[1.35]"
        />
      </div>
      {showWordmark && (
        <span className={`${textSize} font-extrabold tracking-tight text-slate-900 whitespace-nowrap`}>
          Pinjam<span className="text-blue-600">Kuy</span>
        </span>
      )}
    </div>
  );
};
