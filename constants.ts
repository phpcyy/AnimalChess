import { AnimalType, Piece, PlayerColor } from './types';

export const BOARD_SIZE = 4; // 4x4 grid (visual reference for rows/cols)
export const TOTAL_CELLS = 17; // 0-15 (grid) + 16 (center special)
export const CENTER_INDEX = 16;

export const ANIMAL_RANKS: Record<AnimalType, number> = {
  [AnimalType.ELEPHANT]: 8,
  [AnimalType.LION]: 7,
  [AnimalType.TIGER]: 6,
  [AnimalType.LEOPARD]: 5,
  [AnimalType.WOLF]: 4,
  [AnimalType.DOG]: 3,
  [AnimalType.CAT]: 2,
  [AnimalType.RAT]: 1,
};

export const ANIMAL_EMOJIS: Record<AnimalType, string> = {
  [AnimalType.ELEPHANT]: '🐘',
  [AnimalType.LION]: '🦁',
  [AnimalType.TIGER]: '🐯',
  [AnimalType.LEOPARD]: '🐆',
  [AnimalType.WOLF]: '🐺',
  [AnimalType.DOG]: '🐶',
  [AnimalType.CAT]: '🐱',
  [AnimalType.RAT]: '🐭',
};

export const ANIMAL_NAMES: Record<AnimalType, string> = {
  [AnimalType.ELEPHANT]: '大象',
  [AnimalType.LION]: '狮子',
  [AnimalType.TIGER]: '老虎',
  [AnimalType.LEOPARD]: '豹',
  [AnimalType.WOLF]: '狼',
  [AnimalType.DOG]: '狗',
  [AnimalType.CAT]: '猫',
  [AnimalType.RAT]: '老鼠',
};

// Generate initial deck
export const INITIAL_DECK: Piece[] = [];

const types = Object.values(AnimalType);
let idCounter = 0;

types.forEach((type) => {
  INITIAL_DECK.push({
    id: `red-${type}-${idCounter++}`,
    type,
    color: PlayerColor.RED,
    rank: ANIMAL_RANKS[type],
  });
  INITIAL_DECK.push({
    id: `blue-${type}-${idCounter++}`,
    type,
    color: PlayerColor.BLUE,
    rank: ANIMAL_RANKS[type],
  });
});
