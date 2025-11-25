export enum AnimalType {
  ELEPHANT = 'ELEPHANT',
  LION = 'LION',
  TIGER = 'TIGER',
  LEOPARD = 'LEOPARD',
  WOLF = 'WOLF',
  DOG = 'DOG',
  CAT = 'CAT',
  RAT = 'RAT',
}

export enum PlayerColor {
  RED = 'RED',
  BLUE = 'BLUE',
}

export interface Piece {
  id: string;
  type: AnimalType;
  color: PlayerColor;
  rank: number;
}

export interface Cell {
  index: number;
  piece: Piece | null;
  isRevealed: boolean;
}

export interface GameState {
  board: Cell[];
  turn: PlayerColor; // Whose turn is it currently
  winner: PlayerColor | 'DRAW' | null;
  redPlayer: 'HUMAN' | 'AI' | null; // Who controls Red
  bluePlayer: 'HUMAN' | 'AI' | null; // Who controls Blue
  userColor: PlayerColor | null; // Which color belongs to the starting user (assigned on first flip)
  history: string[];
}

export interface Move {
  fromIndex: number | null; // null if flipping
  toIndex: number; // index to move to or flip
  isFlip: boolean;
}

export interface AIAnalysisResult {
  move: Move;
  reasoning: string;
}
