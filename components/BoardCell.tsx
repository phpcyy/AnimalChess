
import React from 'react';
import { Cell, PlayerColor } from '../types';
import { ANIMAL_EMOJIS } from '../constants';

interface BoardCellProps {
  cell: Cell;
  onClick: () => void;
  isSelected: boolean;
  isValidTarget: boolean;
  disabled: boolean;
  style?: React.CSSProperties;
}

const BoardCell: React.FC<BoardCellProps> = ({ 
  cell, 
  onClick, 
  isSelected, 
  isValidTarget,
  disabled,
  style
}) => {
  const { piece, isRevealed } = cell;

  // Render the card content (front or back)
  const renderContent = () => {
    // 1. Hidden State (Mystery Box)
    if (!isRevealed) {
      return (
        <div className={`
          w-full h-full rounded-xl flex items-center justify-center 
          bg-amber-400 border-b-[6px] border-r-[2px] border-amber-600
          shadow-lg transition-transform duration-200
          ${!disabled ? 'hover:-translate-y-1 hover:brightness-110 active:border-b-0 active:translate-y-1' : ''}
        `}>
          <div className="w-[80%] h-[80%] border-2 border-amber-500/30 rounded-lg flex items-center justify-center">
             <span className="text-4xl font-black text-amber-700/60 drop-shadow-sm">?</span>
          </div>
        </div>
      );
    }

    // 2. Empty Revealed Cell (Empty Spot)
    if (!piece) {
      if (isValidTarget) {
          return (
             <div className="w-full h-full rounded-full border-4 border-dashed border-white/80 bg-white/30 animate-pulse box-border scale-90"></div>
          );
      }
      // Transparent hit target for empty cells
      return <div className="w-full h-full rounded-full transition-colors"></div>;
    }

    // 3. Revealed Piece (Circular 3D Token)
    const isRed = piece.color === PlayerColor.RED;
    
    // Token Colors
    const baseColor = isRed ? 'bg-rose-500' : 'bg-blue-500';
    const borderColor = isRed ? 'border-rose-700' : 'border-blue-700';
    
    return (
      <div className={`
        relative flex items-center justify-center w-full h-full rounded-full
        ${baseColor} border-b-[6px] ${borderColor}
        shadow-xl transition-transform duration-300 z-10
      `}>
        {/* Inner White Circle */}
        <div className="w-[85%] h-[85%] bg-white rounded-full shadow-inner flex items-center justify-center">
            {/* Center Emoji */}
            <div className="text-4xl md:text-5xl select-none filter drop-shadow-sm transform hover:scale-110 transition-transform duration-200 pb-1">
              {ANIMAL_EMOJIS[piece.type]}
            </div>
        </div>
        
        {/* Small Rank Indicator (Optional, maybe too small for this design, leaving out for cleanness like reference) */}
      </div>
    );
  };

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      style={style}
      className={`
        absolute flex items-center justify-center
        w-[15%] aspect-square
        transition-all duration-300
        ${disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
        ${isSelected ? 'z-30 scale-110 -translate-y-4' : 'z-20'}
        ${isValidTarget ? 'z-20' : 'z-10'}
      `}
    >
      <div className={`
        relative w-full h-full
        transition-all duration-200
        ${isSelected ? 'filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]' : ''}
      `}>
         {renderContent()}
      </div>
      
      {/* Selection Ring (Floating above) */}
      {isSelected && (
          <div className="absolute -inset-2 border-4 border-yellow-400 rounded-full animate-pulse pointer-events-none z-40"></div>
      )}
    </div>
  );
};

export default BoardCell;
