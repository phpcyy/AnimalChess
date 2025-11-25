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

  // Visual classes based on state
  let ringClass = "ring-slate-700";
  let bgClass = "bg-slate-700";
  let textClass = "text-slate-400";
  
  if (isSelected) {
    ringClass = "ring-yellow-400 ring-offset-2 ring-offset-slate-900";
    bgClass = "bg-slate-600";
  } else if (isValidTarget) {
    ringClass = "ring-green-500 border-dashed border-2 border-green-500";
    bgClass = "bg-green-900/40";
  } else if (isRevealed && piece) {
    if (piece.color === PlayerColor.RED) {
      ringClass = "ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
      bgClass = "bg-gradient-to-br from-red-900 to-slate-900";
      textClass = "text-red-400";
    } else {
      ringClass = "ring-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]";
      bgClass = "bg-gradient-to-br from-blue-900 to-slate-900";
      textClass = "text-blue-400";
    }
  }

  // Render the card content (front or back)
  const renderContent = () => {
    if (!isRevealed) {
      return (
        <div className={`w-full h-full rounded-full flex items-center justify-center bg-slate-800 border-2 border-slate-600 shadow-lg transition-transform duration-300 ${!disabled ? 'hover:scale-105' : ''}`}>
          <div className="text-base md:text-lg opacity-20 select-none">?</div>
        </div>
      );
    }

    if (!piece) {
      // Empty revealed cell (e.g., after capture, or the empty center)
      if (isValidTarget) {
          return (
             <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-green-500/50 animate-pulse box-content border-2 border-transparent bg-clip-padding"></div>
          );
      }
      // Transparent hit target for empty cells
      return <div className="w-full h-full rounded-full hover:bg-white/5 transition-colors"></div>;
    }

    return (
      <div className={`
        flex flex-col items-center justify-center w-full h-full rounded-full 
        border-2 border-opacity-60
        ${piece.color === PlayerColor.RED ? 'border-red-500' : 'border-blue-500'}
        ${bgClass} ${textClass}
        shadow-xl transition-transform duration-300 transform hover:scale-110 z-10
      `}>
        <div className="text-xl md:text-2xl select-none filter drop-shadow-sm leading-none mb-0.5">
          {ANIMAL_EMOJIS[piece.type]}
        </div>
      </div>
    );
  };

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      style={style}
      className={`
        absolute flex items-center justify-center
        w-[13%] h-[13%]
        transition-all duration-300
        ${disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
        ${isSelected ? 'z-30 scale-125' : 'z-20'}
        ${isValidTarget ? 'z-20' : 'z-10'}
      `}
    >
      <div className={`
        relative w-full h-full rounded-full flex items-center justify-center
        transition-all duration-200
        ${isRevealed && piece ? `ring-[1.5px] ${ringClass}` : ''}
      `}>
         {renderContent()}
      </div>
    </div>
  );
};

export default BoardCell;