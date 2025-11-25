import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_DECK, BOARD_SIZE, TOTAL_CELLS, CENTER_INDEX, ANIMAL_NAMES } from './constants';
import { GameState, Cell, PlayerColor, Move, AnimalType } from './types';
import BoardCell from './components/BoardCell';
import { getAIMove } from './services/geminiService';
import { RefreshCw, User, Cpu, Info, Shield, Trophy, Users, Bot } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [gameMode, setGameMode] = useState<'PVE' | 'PVP'>('PVE');
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

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
    setAiThinking(false);
    setAiReasoning(null);
  }, []);

  // Re-init game when mode changes (optional, but cleaner)
  useEffect(() => {
    initGame();
  }, [initGame, gameMode]);

  const toggleGameMode = () => {
    setGameMode(prev => prev === 'PVE' ? 'PVP' : 'PVE');
  };

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
        if (gameMode === 'PVP') {
            // PvP Mode: Both are HUMAN
            // First revealed color is Current Player's color (conceptually, though we track turn separately)
            nextRedPlayer = 'HUMAN';
            nextBluePlayer = 'HUMAN';
            nextUserColor = piece.color; 
        } else {
            // PvE Mode Logic
            const isUserTurn = !aiThinking;
            if (isUserTurn) {
                // Human flipped
                if (piece.color === PlayerColor.RED) {
                    nextUserColor = PlayerColor.RED;
                    nextRedPlayer = 'HUMAN';
                    nextBluePlayer = 'AI';
                } else {
                    nextUserColor = PlayerColor.BLUE;
                    nextBluePlayer = 'HUMAN';
                    nextRedPlayer = 'AI';
                }
            } else {
                 // AI flipped first
                if (piece.color === PlayerColor.RED) {
                    nextUserColor = PlayerColor.BLUE;
                    nextRedPlayer = 'AI';
                    nextBluePlayer = 'HUMAN';
                } else {
                    nextUserColor = PlayerColor.RED;
                    nextBluePlayer = 'AI';
                    nextRedPlayer = 'HUMAN';
                }
            }
        }
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
    
    // NEW RULE: Do not judge winner if there are still hidden cards on the board
    // Exception: Center index is always revealed/empty, so ignore it in check (it's initialized revealed anyway)
    const unrevealedCount = nextBoard.filter(c => !c.isRevealed).length;
    
    if (unrevealedCount === 0) {
        const realRedCount = nextBoard.filter(c => c.piece?.color === PlayerColor.RED).length;
        const realBlueCount = nextBoard.filter(c => c.piece?.color === PlayerColor.BLUE).length;

        if (realRedCount === 0 && realBlueCount === 0) nextWinner = null; // Theoretically possible if last two die together? Or Draw?
        else if (realRedCount === 0) nextWinner = PlayerColor.BLUE;
        else if (realBlueCount === 0) nextWinner = PlayerColor.RED;
    }

    if (nextWinner) {
      logMessage += ` 游戏结束! ${getColorName(nextWinner)} 获胜!`;
    } else if (unrevealedCount > 0 && nextBoard.filter(c => c.piece?.color === PlayerColor.RED).length === 0) {
       // Optional: Add hint that Red is wiped out but game continues? 
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
    if (gameState.winner || isProcessing || aiThinking) return;

    // Turn check
    // In PvP, always Human turn (if game not over)
    const isHumanTurn = 
      (gameState.turn === PlayerColor.RED && gameState.redPlayer === 'HUMAN') ||
      (gameState.turn === PlayerColor.BLUE && gameState.bluePlayer === 'HUMAN') ||
      (gameState.redPlayer === null && gameMode === 'PVP') || // PvP start
      (gameState.redPlayer === null && gameMode === 'PVE');   // PvE start (Human goes first typically or handled by AI effect)

    // For PvE specifically:
    if (gameMode === 'PVE') {
        const isMyTurn = (gameState.turn === PlayerColor.RED && gameState.redPlayer !== 'AI') ||
                         (gameState.turn === PlayerColor.BLUE && gameState.bluePlayer !== 'AI') ||
                         (gameState.redPlayer === null);
        if (!isMyTurn) return;
    }

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

  // --- AI Loop ---
  useEffect(() => {
    const runAITurn = async () => {
      if (gameState.winner || gameMode === 'PVP') return; // No AI in PvP
      
      const isRedAI = gameState.turn === PlayerColor.RED && gameState.redPlayer === 'AI';
      const isBlueAI = gameState.turn === PlayerColor.BLUE && gameState.bluePlayer === 'AI';
      
      if (isRedAI || isBlueAI) {
        setAiThinking(true);
        setIsProcessing(true);
        
        await new Promise(r => setTimeout(r, 800));

        const validMoves = getValidMoves(gameState.board, gameState.turn);
        const result = await getAIMove(gameState.board, gameState.turn, validMoves);
        
        if (result) {
            setAiReasoning(result.reasoning);
            await new Promise(r => setTimeout(r, 600)); 
            await handleMove(result.move);
        } else {
            console.warn("AI has no moves");
        }

        setIsProcessing(false);
        setAiThinking(false);
      }
    };

    runAITurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turn, gameState.redPlayer, gameState.bluePlayer, gameState.winner, gameMode]);

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

  const renderGridPoints = () => {
    const points = [];
    for (let i = 0; i < 16; i++) {
        const style = getPositionStyle(i);
        points.push(
            <div key={`pt-${i}`} className="absolute w-2 h-2 bg-slate-600 rounded-full" style={style}></div>
        );
    }
    return points;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center p-4">
      
      {/* Header */}
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <div>
           <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
            斗兽棋
          </h1>
          <p className="text-slate-400 text-xs">迷雾丛林 (连线版)</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={toggleGameMode} 
             className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition-colors"
             title="切换游戏模式"
           >
             {gameMode === 'PVE' ? <Bot size={14} className="text-purple-400"/> : <Users size={14} className="text-blue-400"/>}
             {gameMode === 'PVE' ? '人机对战中' : '双人对战中'}
           </button>
           <button onClick={() => setShowRules(!showRules)} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700">
             <Info size={20} className="text-slate-300"/>
           </button>
           <button onClick={initGame} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700">
             <RefreshCw size={20} className="text-slate-300"/>
           </button>
        </div>
      </header>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-600 shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-teal-400">
              <Shield size={24}/> 游戏规则
            </h2>
            <ul className="space-y-3 text-slate-300 text-sm list-disc pl-4">
              <li><strong>目标:</strong> 吃掉对手所有棋子。</li>
              <li><strong>棋盘:</strong> 棋子在4x4的交叉点上移动。16个普通点 + 1个中心兽穴。</li>
              <li><strong>中心兽穴:</strong> 
                <ul className="list-circle pl-4 mt-1 text-slate-400">
                  <li>只有<strong>老鼠 (等级1)</strong> 可以进出。</li>
                  <li><strong>安全区域:</strong> 一旦有老鼠进入，任何棋子（包括对方老鼠）不可进入/攻击。</li>
                </ul>
              </li>
              <li><strong>玩法:</strong> 
                  <ul className="list-circle pl-4 mt-1 text-slate-400">
                      <li>轮到你时，可以<strong>翻牌</strong>（翻开暗棋）或<strong>移动</strong>（已翻开的棋子）。</li>
                      <li>第一个翻出的颜色即为你的颜色。</li>
                  </ul>
              </li>
              <li><strong>战斗:</strong> 等级高的吃等级低的。（大象8 > 狮子7 ...）</li>
              <li><strong>例外:</strong>
                  <ul className="list-circle pl-4 mt-1 text-slate-400">
                      <li><strong>老鼠 (1)</strong> 可以吃 <strong>大象 (8)</strong>。</li>
                      <li>等级相同则<strong>同归于尽</strong>（双双移除）。</li>
                  </ul>
              </li>
              <li><strong>胜负:</strong> 当所有暗牌都被翻开，且一方失去所有棋子时判负。</li>
            </ul>
            <button onClick={() => setShowRules(false)} className="mt-6 w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors">明白了</button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="w-full max-w-lg flex items-center justify-between bg-slate-800/80 rounded-xl p-3 mb-6 border border-slate-700 backdrop-blur-sm shadow-lg">
        <div className={`flex items-center gap-2 ${gameState.turn === PlayerColor.RED ? 'opacity-100' : 'opacity-40 grayscale'} transition-all duration-300`}>
           <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-red-900 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]`}>
              {gameState.redPlayer === 'AI' ? <Cpu size={16} className="text-red-400"/> : <User size={16} className="text-red-400"/>}
           </div>
           <div className="leading-tight">
             <span className="block text-xs font-bold text-red-400">红方</span>
             <span className="text-[10px] text-slate-400 block">
               {gameState.redPlayer === 'HUMAN' ? '玩家' : (gameState.redPlayer === 'AI' ? '电脑' : '等待中...')}
             </span>
           </div>
        </div>

        <div className="flex-1 px-4 text-center">
             {gameState.winner ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-900/30 border border-yellow-600/50 rounded-full text-yellow-400 animate-pulse font-bold text-sm">
                    <Trophy size={14} /> 
                    {gameState.winner === 'DRAW' ? '平局!' : `${getColorName(gameState.winner)} 获胜!`}
                </div>
            ) : (
                 <div className="text-sm font-medium text-slate-300">
                    {!gameState.userColor && gameMode === 'PVE' ? "请翻牌" : 
                     (gameState.turn === gameState.userColor && gameMode === 'PVE' ? "你的回合" : 
                     (gameMode === 'PVP' ? `${getColorName(gameState.turn)}回合` : "电脑思考中..."))}
                 </div>
            )}
        </div>

        <div className={`flex items-center gap-2 flex-row-reverse ${gameState.turn === PlayerColor.BLUE ? 'opacity-100' : 'opacity-40 grayscale'} transition-all duration-300`}>
           <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-blue-900 border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]`}>
              {gameState.bluePlayer === 'AI' ? <Cpu size={16} className="text-blue-400"/> : <User size={16} className="text-blue-400"/>}
           </div>
           <div className="text-right leading-tight">
             <span className="block text-xs font-bold text-blue-400">蓝方</span>
             <span className="text-[10px] text-slate-400 block">
               {gameState.bluePlayer === 'HUMAN' ? '玩家' : (gameState.bluePlayer === 'AI' ? '电脑' : '等待中...')}
             </span>
           </div>
        </div>
      </div>

      {/* AI Reason */}
      {aiReasoning && !gameState.winner && gameMode === 'PVE' && (
        <div className="mb-4 text-xs text-center text-emerald-300 bg-emerald-900/30 px-4 py-2 rounded-full border border-emerald-500/30 animate-in fade-in slide-in-from-top-2">
           Gemini: {aiReasoning}
        </div>
      )}

      {/* GAME BOARD */}
      <div className="relative w-full max-w-[340px] md:max-w-[400px] aspect-square mx-auto mb-8 select-none p-6 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
        
        {/* Inner Container defining the playing field padding */}
        <div className="relative w-full h-full">
            
            {/* The Grid Lines Container - Inset by 10% to allow pieces on edges to sit comfortably */}
            <div className="absolute top-[10%] left-[10%] right-[10%] bottom-[10%]">
                
               {/* SVG Lines */}
               <svg width="100%" height="100%" className="overflow-visible">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="50%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <g className="stroke-slate-600 stroke-2">
                      <line x1="0%" y1="0%" x2="0%" y2="100%" />
                      <line x1="33.33%" y1="0%" x2="33.33%" y2="100%" />
                      <line x1="66.66%" y1="0%" x2="66.66%" y2="100%" />
                      <line x1="100%" y1="0%" x2="100%" y2="100%" />
                      
                      <line x1="0%" y1="0%" x2="100%" y2="0%" />
                      <line x1="0%" y1="33.33%" x2="100%" y2="33.33%" />
                      <line x1="0%" y1="66.66%" x2="100%" y2="66.66%" />
                      <line x1="0%" y1="100%" x2="100%" y2="100%" />
                  </g>

                  {/* Diagonal Connections to Center */}
                  <g className="stroke-slate-700 stroke-[1.5px]" strokeDasharray="4 4">
                      <line x1="33.33%" y1="33.33%" x2="66.66%" y2="66.66%" />
                      <line x1="66.66%" y1="33.33%" x2="33.33%" y2="66.66%" />
                  </g>
               </svg>
               
               {/* Intersection Dots */}
               {renderGridPoints()}

               {/* Center Burrow Marker */}
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-slate-600 bg-slate-800 flex items-center justify-center z-0">
                   <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
               </div>

                {/* Pieces Layer */}
                <div className="absolute inset-0 z-10">
                    {gameState.board.map((cell) => {
                        // Logic for visual highlighting
                        let isValidTarget = false;
                        
                        if (selectedIndex !== null && cell.index !== selectedIndex && isAdjacent(selectedIndex, cell.index)) {
                            const fromCell = gameState.board[selectedIndex];
                            
                            let canEnter = true;
                            // Center Checks
                            if (cell.index === CENTER_INDEX) {
                                // 1. Only Rat can enter
                                if (fromCell.piece?.type !== AnimalType.RAT) canEnter = false;
                                // 2. Safe Zone: If occupied, cannot enter (no attacks allowed)
                                if (cell.piece) canEnter = false;
                            }

                            if (!canEnter) {
                                isValidTarget = false;
                            } else if (!cell.isRevealed) {
                                isValidTarget = false; // Cannot move onto hidden
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
                            disabled={gameState.winner !== null || (aiThinking && gameMode === 'PVE')}
                            onClick={() => handleCellClick(cell.index)}
                        />
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* History Log */}
      <div className="w-full max-w-lg mt-auto bg-slate-800/40 rounded-xl p-3 h-32 overflow-y-auto border border-slate-700/30 text-xs custom-scrollbar">
         {gameState.history.map((log, i) => (
             <div key={i} className="mb-1.5 text-slate-400 border-b border-slate-700/50 pb-1.5 last:border-0 flex gap-2">
               <span className="text-slate-600 font-mono opacity-50">#{gameState.history.length - i}</span>
               <span>{log}</span>
             </div>
           ))}
      </div>

    </div>
  );
};

export default App;