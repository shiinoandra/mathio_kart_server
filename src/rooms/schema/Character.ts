// src/rooms/schema/Character.ts
import { Schema, type } from "@colyseus/schema";

export class Character extends Schema {
  @type("string")
  name: string;

  @type("string")
  desc: string;

  @type("string")
  sprite: string;

  @type("string")
  car: string;

  @type("string")
  trait: string; // optional - for future special abilities
}
