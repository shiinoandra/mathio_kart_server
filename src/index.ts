import express from "express";
import { Server } from "colyseus";
import { createServer } from "http";
import { GameRoom } from "./rooms/gameRoom"

const port = Number(process.env.PORT) || 3001;
const app = express();
const server = createServer(app);

const gameServer = new Server({
  server,
});

gameServer.define("game_room", GameRoom);

server.listen(port, () => {
  console.log(`Colyseus server listening on ws://localhost:${port}`);
});
