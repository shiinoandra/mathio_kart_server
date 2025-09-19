// src/rooms/schema/Player.ts
import { Schema, type } from "@colyseus/schema";
import { Character } from "./Character";

export class Player extends Schema {
  @type("string")
  id: string;

  @type("string")
  name: string;

  @type("string")
  color: string = "#FF6B6B"; // Player color for visual distinction

  @type("number")
  x: number = 0; // Horizontal position on track

  @type("number")
  y: number = 100; // Vertical position (lane)

  @type("number")
  speed: number = 50; // Current speed in pixels per second

  @type("number")
  score: number = 0; // Player's current score

  @type("number")
  specialMeter: number = 0; // Special ability meter (0-100)

  @type("string")
  currentQuestion: string = ""; // Current math question

  @type("number")
  currentQuestionAnswer: number = 0; // Answer to current question (not sent to client)

  @type("string")
  currentQuestionDifficulty: "easy" | "medium" | "hard" = "easy"; // Difficulty of current question

  @type("number")
  questionTimer: number = 0; // Time left to answer question (in milliseconds)

  @type("boolean")
  isActive: boolean = true; // Whether player is still in the game

  @type("boolean")
  isReady: boolean = false; // Whether player is ready in the room

  @type("number")
  position: number = 0; // Current race position (1st, 2nd, etc.)

  @type("number")
  lapProgress: number = 0; // Progress percentage (0-1)

  @type(Character )
  character: Character = null;
}