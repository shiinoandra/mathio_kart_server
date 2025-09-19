// src/rooms/gameRoom.ts
import { Room, Client } from "colyseus";
import { GameState } from "./schema/GameState";
import { Player } from "./schema/Player";
import { Character } from "./schema/Character";

interface QuestionData {
  question: string;
  answer: number;
  difficulty: "easy" | "medium" | "hard";
  type: "regular" | "special" | "attack";
}

export class GameRoom extends Room<GameState> {
  maxClients = 4;
  private questionInterval: NodeJS.Timeout;
  private gameStartTime: number;

  onCreate(options: any) {
    this.setState(new GameState());
    this.setPatchRate(60); // 60 FPS for smooth racing
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    // Initialize game settings
    const difficulty = options.difficulty || "easy";
    if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
      this.state.stageDifficulty = difficulty;
    } else {
      this.state.stageDifficulty = "easy"; // fallback
    }
    this.state.trackDistance = 2000;
    this.state.gamePhase = "waiting";

    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    // Handle regular answers
    this.onMessage("answer", (client, message: { answer: number, questionId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.gamePhase !== "racing") return;

      if (!player) return;
      
 

      const isCorrect = this.checkAnswer(player, message.answer);
      
      if (isCorrect) {
        // Speed boost based on question difficulty
        const boost = this.getSpeedBoost(player.currentQuestionDifficulty);
        player.speed += boost;
        player.score += this.getScorePoints(player.currentQuestionDifficulty);
        
        // Build up special meter
        player.specialMeter = Math.min(100, player.specialMeter + 15);
        
        // Generate new question
        this.generateQuestionForPlayer(player);
        
        this.broadcast("playerAnswered", {
          playerId: client.sessionId,
          correct: true,
          newSpeed: player.speed,
          newScore: player.score
        });
      } else {
        // Wrong answer - slight speed reduction
        player.speed = Math.max(30, player.speed - 10);
        
        this.broadcast("playerAnswered", {
          playerId: client.sessionId,
          correct: false,
          newSpeed: player.speed
        });
      }
    });

    this.onMessage("playerReady", (client, message: {type: "isReady",isReady:boolean }) => {
      const player = this.state.players.get(client.sessionId);

      player.isReady = message.isReady;
      
      this.broadcast("playerReady", {
          playerId: client.sessionId,
          isReady: message.isReady
      });
    });
      // Handle special abilities
    this.onMessage("useSpecial", (client, message: { type: "boost" | "attack", targetId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.specialMeter < 100) return;

      if (message.type === "boost") {
        // Self speed boost
        this.generateSpecialQuestion(player, "boost");
      } else if (message.type === "attack" && message.targetId) {
        const target = this.state.players.get(message.targetId);
        if (target && target.id !== player.id) {
          // Attack another player
          this.generateSpecialQuestion(target, "attack");
          player.specialMeter = 0; // Consume special meter
        }
      }
    });

    // Start game when enough players
    this.onMessage("startGame", (client) => {
      if (this.state.players.size >= 2 && this.state.gamePhase === "waiting") {
        this.startGame();
      }
    });
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    console.log(options)
    player.id = client.sessionId;
    player.name = options.name || `Player ${client.sessionId.substring(0, 4)}`;
    player.color = this.getRandomColor();
    player.x = 0;
    player.y = 100 + (this.state.players.size * 120); // Vertical spacing
    

    if (options.character) {
      console.log("with character")
      player.character = new Character();
      player.character.name = options.character.name;
      player.character.desc = options.character.desc;
      player.character.sprite = options.character.sprite;
      player.character.car = options.character.car;
      player.character.trait = options.character.trait || "";
    }

    
    this.state.players.set(client.sessionId, player);
    this.generateQuestionForPlayer(player);
    
    console.log(`${player.name} joined the race as ${player.character?.name || "No Character"}`);
        
    // Auto-start if we have enough players
    if (this.state.players.size >= 2 && this.state.gamePhase === "waiting") {
      this.broadcast("canStart", { playersNeeded: Math.max(0, 2 - this.state.players.size) });
    }
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    console.log(client.sessionId, "left the race!");
  }

  onDispose() {
    if (this.questionInterval) {
      clearInterval(this.questionInterval);
    }
    console.log("Game room disposed");
  }

  private startGame() {
    this.state.gamePhase = "racing";
    this.gameStartTime = Date.now();
    
    // Start question generation interval
    this.questionInterval = setInterval(() => {
      this.state.players.forEach(player => {
        if (!player.currentQuestion) {
          this.generateQuestionForPlayer(player);
        }
      });
    }, 0); // New question every 3 seconds if not answered

    this.broadcast("gameStarted", { 
      trackDistance: this.state.trackDistance,
      stageDifficulty: this.state.stageDifficulty 
    });
  }

  update(deltaTime: number) {
    if (this.state.gamePhase !== "racing") return;

    this.state.players.forEach(player => {
      // Apply speed decay over time (makes answering questions more important)
      player.speed = Math.max(30, player.speed - (deltaTime / 1000) * 2);
      
      // Move player
      player.x += player.speed * (deltaTime / 1000);

      // Check for winner
      if (player.x >= this.state.trackDistance) {
        this.finishGame(player);
        return;
      }

      // Update question timer
      if (player.questionTimer > 0) {
        player.questionTimer -= deltaTime;
        if (player.questionTimer <= 0) {
          // Time's up - generate new question and apply penalty
          player.speed = Math.max(20, player.speed - 15);
          this.generateQuestionForPlayer(player);
        }
      }
    });
  }

  private finishGame(winner: Player) {
    this.state.gamePhase = "finished";
    this.state.winner = winner.name;
    
    if (this.questionInterval) {
      clearInterval(this.questionInterval);
    }
    
    // Calculate final standings
    const standings = Array.from(this.state.players.values())
      .sort((a, b) => b.x - a.x)
      .map((player, index) => ({
        position: index + 1,
        name: player.name,
        score: player.score,
        distance: player.x
      }));

    this.broadcast("gameFinished", { winner: winner.name, standings });
    this.lock(); // Prevent new players from joining
  }

  private generateQuestionForPlayer(player: Player, questionType: "regular" | "special" | "attack" = "regular") {
    const baseOperation = Math.random() < 0.7 ? "addition" : "subtraction";
    let difficulty = this.getQuestionDifficulty(player, questionType);
    
    const questionData = this.createQuestion(baseOperation, difficulty);
    
    player.currentQuestion = questionData.question;
    player.currentQuestionAnswer = questionData.answer;
    player.currentQuestionDifficulty = questionData.difficulty;
    player.questionTimer = questionType === "attack" ? 8000 : 8000; // 8s for attack, 12s for regular
  }

  private generateSpecialQuestion(player: Player, type: "boost" | "attack") {
    if (type === "boost") {
      this.generateQuestionForPlayer(player, "special");
    } else {
      this.generateQuestionForPlayer(player, "attack");
    }
  }

  private getQuestionDifficulty(player: Player, questionType: string): "easy" | "medium" | "hard" {
    let baseDifficulty: "easy" | "medium" | "hard" = "easy";
    
    // Set base difficulty from stage difficulty
    if (this.state.stageDifficulty === "easy" || this.state.stageDifficulty === "medium" || this.state.stageDifficulty === "hard") {
      baseDifficulty = this.state.stageDifficulty as "easy" | "medium" | "hard";
    }
    
    // Increase difficulty based on player progress
    const progress = player.x / this.state.trackDistance;
    if (progress > 0.7) baseDifficulty = "hard";
    else if (progress > 0.4) baseDifficulty = "medium";

    // Special questions are always harder
    if (questionType === "special" || questionType === "attack") {
      return baseDifficulty === "easy" ? "medium" : "hard";
    }

    return baseDifficulty;
  }

  private createQuestion(operation: string, difficulty: "easy" | "medium" | "hard"): QuestionData {
    let num1: number, num2: number, answer: number, question: string;

    const ranges = {
      easy: { min: 1, max: 10 },
      medium: { min: 10, max: 50 },
      hard: { min: 20, max: 100 }
    };

    const range = ranges[difficulty];

    if (operation === "addition") {
      num1 = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      num2 = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
    } else {
      // Subtraction - ensure positive result
      num1 = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      question = `${num1} - ${num2}`;
    }

    return { question, answer, difficulty, type: "regular" };
  }

  private checkAnswer(player: Player, answer: number): boolean {
    return answer === player.currentQuestionAnswer;
  }

  private getSpeedBoost(difficulty: "easy" | "medium" | "hard"): number {
    const boosts = { easy: 15, medium: 25, hard: 40 };
    return boosts[difficulty];
  }

  private getScorePoints(difficulty: "easy" | "medium" | "hard"): number {
    const points = { easy: 10, medium: 20, hard: 35 };
    return points[difficulty];
  }

  private getRandomColor(): string {
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", "#FF9FF3", "#54A0FF"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}