
import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_DECK, BOARD_SIZE, TOTAL_CELLS, CENTER_INDEX, ANIMAL_NAMES, ANIMAL_RANKS, ANIMAL_EMOJIS } from './constants';
import { GameState, Cell, PlayerColor, Move, AnimalType } from './types';
import BoardCell from './components/BoardCell';
import { RefreshCw, Info, Shield, Trophy, Users, Star, Swords, Circle } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    turn: PlayerColor.RED,
    winner: null,
    redPlayer: null,
    bluePlayer: null,
    userColor: null,
    history: [],
  });
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  // --- Initialization ---
  const initGame = useCallback(() => {
    // Shuffle deck
    const deck = [...INITIAL_DECK].sort(() => Math.random() - 0.5);
    
    // Create board cells
    // Indices 0-15: Grid points (Hold pieces initially)
    // Index 16: Center Special Point (Starts empty)
    const newBoard: Cell[] = Array.from({ length: TOTAL_CELLS }).map((_, index) => {
      if (index === CENTER_INDEX) {
        return { index, piece: null, isRevealed: true }; // Center is open and empty
      }
      return {
        index,
        piece: deck[index], // Assign shuffled piece
        isRevealed: false,
      };
    });

    setGameState({
      board: newBoard,
      turn: PlayerColor.RED,
      winner: null,
      redPlayer: null,
      bluePlayer: null,
      userColor: null,
      history: ["游戏开始。请翻开一张牌！"],
    });
    setSelectedIndex(null);
  }, []);

  // Re-init game on mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  // --- Topology Helpers ---
  const isAdjacent = useCallback((idx1: number, idx2: number) => {
    // Check connection to Center (16)
    // Center (16) connects to 5, 6, 9, 10
    if (idx1 === CENTER_INDEX) {
      return [5, 6, 9, 10].includes(idx2);
    }
    if (idx2 === CENTER_INDEX) {
      return [5, 6, 9, 10].includes(idx1);
    }

    // Standard Grid Adjacency for 0-15
    const x1 = idx1 % BOARD_SIZE;
    const y1 = Math.floor(idx1 / BOARD_SIZE);
    const x2 = idx2 % BOARD_SIZE;
    const y2 = Math.floor(idx2 / BOARD_SIZE);
    
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }, []);

  const getValidMoves = useCallback((board: Cell[], playerColor: PlayerColor): Move[] => {
    const moves: Move[] = [];

    board.forEach((cell) => {
      // 1. Flip Moves (valid for hidden grid points)
      if (!cell.isRevealed) {
        moves.push({ fromIndex: null, toIndex: cell.index, isFlip: true });
        return;
      }

      // 2. Movement Moves
      if (cell.piece && cell.piece.color === playerColor) {
        // Potential neighbors
        const neighbors: number[] = [];
        
        // Add grid neighbors
        if (cell.index !== CENTER_INDEX) {
          const x = cell.index % BOARD_SIZE;
          const y = Math.floor(cell.index / BOARD_SIZE);
          if (x > 0) neighbors.push(cell.index - 1);
          if (x < 3) neighbors.push(cell.index + 1);
          if (y > 0) neighbors.push(cell.index - 4);
          if (y < 3) neighbors.push(cell.index + 4);
          
          // Add center if applicable
          if ([5, 6, 9, 10].includes(cell.index)) {
             neighbors.push(CENTER_INDEX);
          }
        } else {
          // From center
          neighbors.push(5, 6, 9, 10);
        }

        neighbors.forEach(targetIdx => {
          const targetCell = board[targetIdx];

          // Rat Constraint for Center
          if (targetIdx === CENTER_INDEX) {
             // Only RAT can enter
             if (cell.piece!.type !== AnimalType.RAT) return; 
             
             // SAFE ZONE RULE:
             // If Center is occupied (by a Rat, since only rats enter), NO ONE can enter.
             // This means you cannot capture a Rat in the center.
             if (targetCell.piece) return;
          }
          
          // Cannot move onto hidden card
          if (!targetCell.isRevealed) return; 
          
          if (!targetCell.piece) {
            // Empty spot
            moves.push({ fromIndex: cell.index, toIndex: targetIdx, isFlip: false });
          } else if (targetCell.piece.color !== playerColor) {
            // Attack logic
            const myRank = cell.piece!.rank;
            const targetRank = targetCell.piece.rank;
            
            let canAttack = false;
            if (myRank >= targetRank) canAttack = true;
            if (cell.piece!.type === AnimalType.RAT && targetCell.piece.type === AnimalType.ELEPHANT) canAttack = true;
            if (cell.piece!.type === AnimalType.ELEPHANT && targetCell.piece.type === AnimalType.RAT) canAttack = false;
            
            if (canAttack) {
               moves.push({ fromIndex: cell.index, toIndex: targetIdx, isFlip: false });
            }
          }
        });
      }
    });

    return moves;
  }, []);

  const getColorName = (color: PlayerColor) => color === PlayerColor.RED ? "红方" : "蓝方";

  // --- Core Game Logic ---
  const handleMove = async (move: Move) => {
    if (gameState.winner) return;

    // Deep copy board
    const nextBoard = [...gameState.board];
    const currentCell = move.fromIndex !== null ? nextBoard[move.fromIndex] : null;
    const targetCell = nextBoard[move.toIndex];
    let logMessage = "";
    
    // Logic for First Turn Color Assignment
    let nextUserColor = gameState.userColor;
    let nextRedPlayer = gameState.redPlayer;
    let nextBluePlayer = gameState.bluePlayer;

    if (move.isFlip) {
      targetCell.isRevealed = true;
      const piece = targetCell.piece!;
      logMessage = `翻出了 ${getColorName(piece.color)} ${ANIMAL_NAMES[piece.type]}`;

      // Assign Colors if not yet assigned
      if (gameState.userColor === null) {
          // PvP Mode: Both are HUMAN
          // First revealed color is Current Player's color
          nextRedPlayer = 'HUMAN';
          nextBluePlayer = 'HUMAN';
          nextUserColor = piece.color; 
      }
    } else {
      // Moving
      if (!currentCell || !currentCell.piece) return;
      
      const attacker = currentCell.piece;
      const defender = targetCell.piece;

      nextBoard[move.toIndex] = {
        ...targetCell,
        piece: attacker,
      };
      nextBoard[move.fromIndex!] = {
        ...currentCell,
        piece: null,
      };

      if (defender) {
        if (attacker.rank === defender.rank) {
          nextBoard[move.toIndex].piece = null;
          logMessage = `${ANIMAL_NAMES[attacker.type]} 与 ${ANIMAL_NAMES[defender.type]} 同归于尽`;
        } else {
          logMessage = `${ANIMAL_NAMES[attacker.type]} 吃掉了 ${ANIMAL_NAMES[defender.type]}`;
        }
      } else {
        logMessage = `${ANIMAL_NAMES[attacker.type]} 移动了`;
      }
    }

    // Check Win Condition
    let nextWinner: PlayerColor | null = null;
    
    // Win Logic: Game does not end if unrevealed cards exist
    const unrevealedCount = nextBoard.filter(c => !c.isRevealed).length;
    
    if (unrevealedCount === 0) {
        const realRedCount = nextBoard.filter(c => c.piece?.color === PlayerColor.RED).length;
        const realBlueCount = nextBoard.filter(c => c.piece?.color === PlayerColor.BLUE).length;

        if (realRedCount === 0 && realBlueCount === 0) nextWinner = null; 
        else if (realRedCount === 0) nextWinner = PlayerColor.BLUE;
        else if (realBlueCount === 0) nextWinner = PlayerColor.RED;
    }

    if (nextWinner) {
      logMessage += ` 游戏结束! ${getColorName(nextWinner)} 获胜!`;
    }

    setGameState(prev => ({
      ...prev,
      board: nextBoard,
      turn: prev.turn === PlayerColor.RED ? PlayerColor.BLUE : PlayerColor.RED,
      history: [logMessage, ...prev.history].slice(0, 50),
      userColor: nextUserColor,
      redPlayer: nextRedPlayer,
      bluePlayer: nextBluePlayer,
      winner: nextWinner
    }));

    setSelectedIndex(null);
  };

  // --- Interaction ---
  const handleCellClick = async (index: number) => {
    if (gameState.winner) return;

    const cell = gameState.board[index];

    // 1. Hidden Card -> Flip
    if (!cell.isRevealed) {
      if (selectedIndex !== null) {
        setSelectedIndex(null);
        return;
      }
      await handleMove({ fromIndex: null, toIndex: index, isFlip: true });
      return;
    }

    // 2. Revealed Card -> Select or Move
    if (selectedIndex === null) {
      // Select
      if (!cell.piece) return;
      if (cell.piece.color !== gameState.turn) return; // Must pick own color
      setSelectedIndex(index);
    } else {
      // Move to target
      if (index === selectedIndex) {
        setSelectedIndex(null);
        return;
      }
      
      const validMoves = getValidMoves(gameState.board, gameState.turn);
      const move = validMoves.find(m => m.fromIndex === selectedIndex && m.toIndex === index);

      if (move) {
        await handleMove(move);
      } else {
        // If clicking another own piece, switch selection
        if (cell.piece && cell.piece.color === gameState.turn) {
          setSelectedIndex(index);
        } else {
          setSelectedIndex(null);
        }
      }
    }
  };

  // --- Rendering Helpers ---
  
  // Calculate style for a given board index
  const getPositionStyle = (index: number): React.CSSProperties => {
    if (index === CENTER_INDEX) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const col = index % BOARD_SIZE;
    const row = Math.floor(index / BOARD_SIZE);
    
    // Grid lines are 0, 1, 2, 3. 
    // We want 0 to be 0%, 3 to be 100%
    const pct = 100 / 3;
    return {
      top: `${row * pct}%`,
      left: `${col * pct}%`,
      transform: 'translate(-50%, -50%)'
    };
  };

  // Render Green Pads at grid intersections
  const renderPads = () => {
    const points = [];
    for (let i = 0; i < 16; i++) {
        const style = getPositionStyle(i);
        points.push(
            <div key={`pad-${i}`} 
              className="absolute w-[15%] aspect-square bg-[#a6e67e] rounded-xl border-b-4 border-[#8bc965]" 
              style={style}>
            </div>
        );
    }
    return points;
  };

  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-between p-4 bg-[#8cd65e] overflow-hidden">
      
      {/* 1. Header: Player Stats (Wooden Panels) */}
      <div className="w-full max-w-lg mt-2 flex items-center justify-between gap-2 relative z-20">
         {/* Red Player (Left) */}
         <div className={`flex items-center gap-2 pr-4 pl-2 py-2 rounded-2xl border-2 border-[#b45309] bg-[#d97706] shadow-lg text-white transition-all duration-300 relative wood-pattern ${gameState.turn === PlayerColor.RED ? 'scale-105 ring-4 ring-yellow-400 z-10' : 'opacity-90 scale-95'}`}>
             <div className="w-12 h-12 rounded-full border-2 border-white/50 bg-rose-500 flex items-center justify-center text-2xl shadow-inner relative">
                 🧑
                 {/* Turn Indicator */}
                 {gameState.turn === PlayerColor.RED && !gameState.winner && (
                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white animate-pulse shadow-md z-20"></div>
                 )}
             </div>
             <div className="flex flex-col">
                 <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Red Team</span>
                 <span className="text-lg font-black leading-none drop-shadow-sm">
                    玩家
                 </span>
             </div>
         </div>

         {/* VS Badge */}
         <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
             <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                 <Swords className="text-white fill-white" size={28} />
             </div>
             {gameState.winner && (
                 <div className="absolute top-14 whitespace-nowrap bg-white text-orange-600 px-3 py-1 rounded-full text-xs font-black shadow-lg animate-bounce">
                     {gameState.winner === 'DRAW' ? '平局' : (gameState.winner === PlayerColor.RED ? '红方胜' : '蓝方胜')}
                 </div>
             )}
         </div>

         {/* Blue Player (Right) */}
         <div className={`flex flex-row-reverse items-center gap-2 pl-4 pr-2 py-2 rounded-2xl border-2 border-[#b45309] bg-[#d97706] shadow-lg text-white transition-all duration-300 relative wood-pattern ${gameState.turn === PlayerColor.BLUE ? 'scale-105 ring-4 ring-yellow-400 z-10' : 'opacity-90 scale-95'}`}>
             <div className="w-12 h-12 rounded-full border-2 border-white/50 bg-blue-500 flex items-center justify-center text-2xl shadow-inner relative">
                 🧑
                 {/* Turn Indicator */}
                 {gameState.turn === PlayerColor.BLUE && !gameState.winner && (
                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white animate-pulse shadow-md z-20"></div>
                 )}
             </div>
             <div className="flex flex-col items-end">
                 <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Blue Team</span>
                 <span className="text-lg font-black leading-none drop-shadow-sm">
                    玩家
                 </span>
             </div>
         </div>
      </div>

      {/* Control Strip */}
      <div className="flex gap-4 mt-4 relative z-10">
         <div className="bg-white/90 p-2 rounded-full shadow-lg text-green-700 flex items-center gap-2 px-4 font-bold text-sm">
            <Users size={20} />
            双人对战
         </div>
         <button onClick={() => setShowRules(true)} className="bg-white/90 p-2 rounded-full shadow-lg text-amber-600 hover:scale-110 transition-transform">
             <Info size={20} />
         </button>
         <button onClick={initGame} className="bg-white/90 p-2 rounded-full shadow-lg text-blue-600 hover:scale-110 transition-transform">
             <RefreshCw size={20} />
         </button>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#fffbeb] rounded-3xl p-6 max-w-sm w-full border-4 border-amber-500 shadow-2xl relative">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2 text-amber-800">
              <Shield size={28} className="text-amber-500"/> 规则说明
            </h2>
            <div className="space-y-3 text-amber-900/80 text-sm">
               <ul className="space-y-2 list-disc pl-4 marker:text-amber-500">
                  <li><strong>棋盘:</strong> 翻开神秘盒子，寻找你的伙伴。</li>
                  <li><strong>中心鼠洞:</strong> 只有 <span className="font-bold text-amber-700">老鼠 🐭</span> 能进，进去后无敌！</li>
                  <li><strong>等级压制:</strong> 🐘 > 🦁 > 🐯 > 🐆 > 🐺 > 🐶 > 🐱 > 🐭</li>
                  <li><strong>逆袭:</strong> 小老鼠 🐭 可以吃掉 大象 🐘！</li>
               </ul>
            </div>
            <button onClick={() => setShowRules(false)} className="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-lg rounded-xl shadow-lg border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all">
              明白了!
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      {/* 
        Changes for Alignment:
        1. Outer container defines max-width and aspect ratio (Square).
        2. Inner container (Play Area) uses a percentage inset (e.g. 10%) to create padding.
        3. All board elements (SVG, Pads, Pieces) use absolute positioning relative to this Inner Container.
           Since they share the same parent bounds (0% to 100%), coordinates will align perfectly.
      */}
      <div className="relative w-full max-w-xl aspect-square mx-auto my-4 select-none">
        
        {/* Play Area: Inset by 10% to prevent pieces from clipping at edges (Zoomed In) */}
        <div className="absolute top-[10%] left-[10%] right-[10%] bottom-[10%]">
            
            {/* 1. Paths (SVG Lines) */}
            <svg width="100%" height="100%" className="absolute inset-0 overflow-visible z-0">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#3f6212" floodOpacity="0.5"/>
                  </filter>
                </defs>
                
                {/* Grid Lines (Vines) */}
                <g className="stroke-[#5a9e36] stroke-[8px] stroke-linecap-round" filter="url(#shadow)">
                    {/* Vertical Lines */}
                    <line x1="0%" y1="0%" x2="0%" y2="100%" />
                    <line x1="33.33%" y1="0%" x2="33.33%" y2="100%" />
                    <line x1="66.66%" y1="0%" x2="66.66%" y2="100%" />
                    <line x1="100%" y1="0%" x2="100%" y2="100%" />
                    
                    {/* Horizontal Lines */}
                    <line x1="0%" y1="0%" x2="100%" y2="0%" />
                    <line x1="0%" y1="33.33%" x2="100%" y2="33.33%" />
                    <line x1="0%" y1="66.66%" x2="100%" y2="66.66%" />
                    <line x1="0%" y1="100%" x2="100%" y2="100%" />
                </g>

                {/* Diagonal Connections to Center */}
                <g className="stroke-[#5a9e36] stroke-[6px]" strokeDasharray="8 8">
                    <line x1="33.33%" y1="33.33%" x2="66.66%" y2="66.66%" />
                    <line x1="66.66%" y1="33.33%" x2="33.33%" y2="66.66%" />
                </g>
            </svg>

            {/* 2. Intersection Pads (Grass Mounds) */}
            <div className="absolute inset-0 z-0">
                {renderPads()}
            </div>

            {/* 3. Center Burrow */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[11%] aspect-square rounded-full bg-[#5a493e] border-4 border-[#45362e] shadow-inner flex items-center justify-center z-0">
                <div className="text-xl md:text-2xl opacity-50 grayscale brightness-50">🐭</div>
            </div>

            {/* 4. Pieces Layer */}
            <div className="absolute inset-0 z-10">
                {gameState.board.map((cell) => {
                    // Logic for visual highlighting
                    let isValidTarget = false;
                    
                    if (selectedIndex !== null && cell.index !== selectedIndex && isAdjacent(selectedIndex, cell.index)) {
                        const fromCell = gameState.board[selectedIndex];
                        
                        let canEnter = true;
                        // Center Checks
                        if (cell.index === CENTER_INDEX) {
                            if (fromCell.piece?.type !== AnimalType.RAT) canEnter = false;
                            if (cell.piece) canEnter = false;
                        }

                        if (!canEnter) {
                            isValidTarget = false;
                        } else if (!cell.isRevealed) {
                            isValidTarget = false;
                        } else {
                            if (!cell.piece) {
                                isValidTarget = true;
                            } else if (cell.piece.color !== gameState.turn) {
                                const myRank = fromCell.piece!.rank;
                                const enemyRank = cell.piece.rank;
                                let canAttack = myRank >= enemyRank;
                                if (fromCell.piece!.type === AnimalType.RAT && cell.piece.type === AnimalType.ELEPHANT) canAttack = true;
                                if (fromCell.piece!.type === AnimalType.ELEPHANT && cell.piece.type === AnimalType.RAT) canAttack = false;
                                
                                if (canAttack) isValidTarget = true;
                            }
                        }
                    }

                    return (
                    <BoardCell
                        key={cell.index}
                        cell={cell}
                        style={getPositionStyle(cell.index)}
                        isSelected={selectedIndex === cell.index}
                        isValidTarget={isValidTarget}
                        disabled={gameState.winner !== null}
                        onClick={() => handleCellClick(cell.index)}
                    />
                    );
                })}
            </div>
        </div>
      </div>

      {/* Footer: Rank Bar */}
      <div className="w-full max-w-lg mb-4">
         <div className="bg-[#fffbeb] rounded-xl border-b-4 border-amber-200 p-2 flex items-center justify-between shadow-sm">
             <div className="flex gap-1 overflow-x-auto no-scrollbar w-full justify-between px-2">
                {[
                  AnimalType.ELEPHANT, AnimalType.LION, AnimalType.TIGER, AnimalType.LEOPARD,
                  AnimalType.WOLF, AnimalType.DOG, AnimalType.CAT, AnimalType.RAT
                ].map((type) => (
                  <div key={type} className="flex flex-col items-center">
                     <span className="text-xl md:text-2xl filter drop-shadow-sm">{ANIMAL_EMOJIS[type]}</span>
                     <span className="text-[10px] text-amber-800 font-bold scale-75">{ANIMAL_RANKS[type]}</span>
                  </div>
                ))}
             </div>
         </div>
      </div>

    </div>
  );
};

export default App;
