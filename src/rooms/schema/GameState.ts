// src/rooms/schema/GameState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./Player";

export class GameState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type("string")
  gamePhase: string = "waiting"; // waiting, racing, finished

  @type("string")
  stageDifficulty: "easy" | "medium" | "hard" = "easy"; // easy, medium, hard

  @type("number")
  trackDistance: number = 2000; // Total track distance

  @type("string")
  winner: string = ""; // Winner's name when game finishes

  @type("number")
  gameTime: number = 0; // Game duration in seconds

  @type("number")
  countdown: number = 0; // Countdown timer for game start

  @type("string")
  trackTheme: string = "forest"; // Track visual theme

  @type("boolean")
  isPaused: boolean = false; // Game pause state
}