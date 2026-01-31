
export enum GameState {
  HOME = 'HOME',
  SETUP_HOST = 'SETUP_HOST',
  ADD_PLAYERS = 'ADD_PLAYERS',
  CREATE_QUESTION = 'CREATE_QUESTION',
  ANSWER_ROUND = 'ANSWER_ROUND',
  WAIT_HOST = 'WAIT_HOST',
  JUDGMENT = 'JUDGMENT',
  REVEAL = 'REVEAL',
  VICTORY = 'VICTORY'
}

export interface Player {
  name: string;
  score: number;
}

export interface Answer {
  playerId: number;
  texts: string[];
}

export interface Question {
  text: string;
  slots: number;
}
