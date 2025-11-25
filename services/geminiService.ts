import { GoogleGenAI, Type } from "@google/genai";
import { ANIMAL_NAMES, BOARD_SIZE, CENTER_INDEX } from "../constants";
import { Cell, Move, PlayerColor } from "../types";

// Initialize Gemini Client
const apiKey = process.env.API_KEY || '';
let genAI: GoogleGenAI | null = null;

if (apiKey) {
  genAI = new GoogleGenAI({ apiKey });
}

const getCoordinates = (index: number) => {
  if (index === CENTER_INDEX) return { x: 'Center', y: 'Center' };
  return { x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) };
};

const serializeBoard = (board: Cell[], aiColor: PlayerColor) => {
  return board.map((cell) => {
    const coords = getCoordinates(cell.index);
    const coordStr = typeof coords.x === 'number' ? `(${coords.x},${coords.y})` : '(CENTER)';
    
    if (!cell.isRevealed) return `Index ${cell.index} ${coordStr}: [HIDDEN CARD]`;
    if (cell.piece) {
      const isMine = cell.piece.color === aiColor;
      return `Index ${cell.index} ${coordStr}: ${cell.piece.color} ${ANIMAL_NAMES[cell.piece.type]} (Rank ${cell.piece.rank})${isMine ? " [YOURS]" : " [OPPONENT]"}`;
    }
    return `Index ${cell.index} ${coordStr}: Empty`;
  }).join('\n');
};

export const getAIMove = async (
  board: Cell[],
  aiColor: PlayerColor,
  validMoves: Move[]
): Promise<{ move: Move; reasoning: string } | null> => {
  if (!genAI) {
    console.error("Gemini API Key missing");
    return null;
  }

  // If no valid moves, return null
  if (validMoves.length === 0) return null;

  // Simple serialization of valid moves for the AI to pick from
  const movesDescription = validMoves.map((m, i) => {
    if (m.isFlip) {
      const coords = getCoordinates(m.toIndex);
      return `ID ${i}: FLIP card at Index ${m.toIndex} (${typeof coords.x === 'number' ? `${coords.x},${coords.y}` : 'CENTER'})`;
    } else {
      const from = getCoordinates(m.fromIndex!);
      const to = getCoordinates(m.toIndex);
      const fromStr = typeof from.x === 'number' ? `${from.x},${from.y}` : 'CENTER';
      const toStr = typeof to.x === 'number' ? `${to.x},${to.y}` : 'CENTER';
      return `ID ${i}: MOVE from ${fromStr} to ${toStr}`;
    }
  }).join('\n');

  const boardState = serializeBoard(board, aiColor);

  const prompt = `
    You are playing a variation of Dou Shou Qi (Animal Chess).
    You are playing as ${aiColor}.
    
    Board Topology:
    - 4x4 Grid of lines (Indices 0-15).
    - Plus a Special Center Point (Index ${CENTER_INDEX}) located in the middle of the board.
    - The Center Point connects to grid points (1,1), (2,1), (1,2), (2,2) [Indices 5, 6, 9, 10].
    - SPECIAL RULE 1: Only the RAT (Rank 1) can enter the Center Point.
    - SPECIAL RULE 2: The Center Point is a SAFE ZONE. If a Rat is already inside, NO piece (including opponent's Rat) can enter or attack it. You can only move to the Center if it is EMPTY.

    Game Rules:
    1. Higher rank eats lower rank. (8 > 7 > ... > 1)
    2. Exception: Rat (1) eats Elephant (8).
    3. Same rank exchange (both removed).
    4. You can Flip a hidden card OR Move a revealed piece to an adjacent intersection.
    5. Unknown hidden cards are dangerous.
    
    Current Board State:
    ${boardState}
    
    Valid Moves:
    ${movesDescription}
    
    Task: Choose the best move ID from the list above. Return the ID and a short reasoning in Simplified Chinese.
  `;

  try {
    const model = genAI.models;
    const response = await model.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            moveId: { type: Type.INTEGER, description: "The ID of the chosen move from the Valid Moves list" },
            reasoning: { type: Type.STRING, description: "Short strategic reason for this move in Simplified Chinese" }
          },
          required: ["moveId", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    const chosenMoveIndex = result.moveId;
    
    if (typeof chosenMoveIndex === 'number' && chosenMoveIndex >= 0 && chosenMoveIndex < validMoves.length) {
      return {
        move: validMoves[chosenMoveIndex],
        reasoning: result.reasoning
      };
    } else {
      console.warn("AI returned invalid move ID, picking random valid move.");
      return {
        move: validMoves[Math.floor(Math.random() * validMoves.length)],
        reasoning: "AI response was invalid, falling back to random."
      };
    }
  } catch (error) {
    console.error("Error fetching AI move:", error);
    // Fallback to random move
    return {
      move: validMoves[Math.floor(Math.random() * validMoves.length)],
      reasoning: "网络连接错误，随机行动。"
    };
  }
};