import React from 'react';
import { Settings } from 'lucide-react';
import { DecryptedText } from './reactbits/DecryptedText';
import { ClickSpark } from './reactbits/ClickSpark';
import SpecularButton from './reactbits/SpecularButton';

interface HeaderProps {
  serialConnected: boolean;
  onSerialToggle: () => void;
  onExportClick: () => void;
  onSettingsOpen: () => void;
  hasMedia: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  serialConnected,
  onSerialToggle,
  onExportClick,
  onSettingsOpen,
  hasMedia,
}) => {
  return (
    <header className="w-full h-14 px-6 bg-white border-b-2 border-[#1A1A1A] flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center">
        <h1 className="text-base font-bold tracking-wider font-mono text-[#1A1A1A] flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-[#E85D2A]">▲</span>
          <DecryptedText
            text="OLED_STUDIO"
            speed={35}
            characters="0123456789ABCDEF_~<>[]"
            animateOn="hover"
            className="font-mono tracking-widest font-bold"
          />
        </h1>
      </div>
      
      <div className="flex items-center space-x-3">
        <button 
          onClick={onSettingsOpen}
          className="p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors duration-150 rounded-none cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <ClickSpark
          sparkColor="#E85D2A"
          sparkCount={8}
          sparkSize={6}
          sparkRadius={18}
          duration={300}
        >
          <button
            onClick={onSerialToggle}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-[#1A1A1A] text-xs font-mono font-medium text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors duration-150 rounded-none cursor-pointer"
          >
            <span
              className={`w-[6px] h-[6px] shrink-0 ${
                serialConnected ? 'bg-[#E85D2A]' : 'bg-[#6B6B6B]'
              }`}
            />
            <span className="font-mono">
              <DecryptedText
                key={serialConnected ? 'connected' : 'disconnected'}
                text={serialConnected ? 'Connected' : 'Connect USB'}
                speed={30}
                characters="0123456789ABCDEF"
                animateOn="view"
              />
            </span>
          </button>
        </ClickSpark>

        <ClickSpark
          sparkColor="#E85D2A"
          sparkSize={7}
          sparkRadius={22}
          sparkCount={12}
          duration={350}
        >
          <SpecularButton
            onClick={onExportClick}
            disabled={!hasMedia}
            size="sm"
            baseColor={hasMedia ? "#E85D2A" : "#F5F0EB"}
            lineColor="#1A1A1A"
            textColor={hasMedia ? "#FFFFFF" : "#6B6B6B"}
            radius={0}
            className={`text-xs font-mono font-bold tracking-wider rounded-none border-2 border-[#1A1A1A] ${!hasMedia ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            COMPILE
          </SpecularButton>
        </ClickSpark>
      </div>
    </header>
  );
};
