// JavaScript Document
// script.js
// @ts-check
'use strict';

/** @typedef {'black' | 'white'} Piece */
/** @typedef {'empty' | Piece} CellState */

/** @typedef {CellState[][]} BoardData */

/**
 * @type {{row: number, col: number, piece: Piece}[]}
 */
const INITIAL_PIECES = [
  { row: 3, col: 3, piece: 'white' },
  { row: 3, col: 4, piece: 'black' },
  { row: 4, col: 3, piece: 'black' },
  { row: 4, col: 4, piece: 'white' }
];

/**
 * 盤面データを管理するコントローラー (の作成)
 * 責務: 現在の盤面の状態管理、石の配置、データの複製提供
 * @param {Object} [options]
 * @param {{row: number, col: number, piece: 'white' | 'black'}[]} [options.initialPieces]
 * @returns {{
 *   init(): void;
 *   getCell(row: number, col: number): CellState | undefined;
 *   setCell(row: number, col: number, cellState: CellState): void;
 *   readonly current: BoardData;
 *   loadData(newData: BoardData): void;
 * }} boardDataCon
 */
const createBoardDataController = ({ initialPieces = INITIAL_PIECES } = {}) => {
  /** @type {[] | BoardData} */
  let board = [];

  return {
    init() {
      // 行ごとに新しい配列を作る（参照渡しを防ぐため）
      board = Array.from({ length: 8 }, () => Array(8).fill('empty'));

      initialPieces.forEach((obj) => {
        const { row, col, piece } = obj;
        board[row][col] = piece;
      });
    },

    /**
     * @param {number} row
     * @param {number} col
     * @returns {CellState | undefined}
     */
    getCell(row, col) {
      return board[row][col];
    },

    /**
     * @param {number} row
     * @param {number} col
     * @param {CellState} cellState
     */
    setCell(row, col, cellState) {
      board[row][col] = cellState;
    },

    /**
     * @returns {BoardData}
     */
    // 盤面全体のディープコピーを返す（履歴保存 / レンダリング用）
    get current() {
      return board.map((row) => [...row]);
    },

    /**
     * @param {BoardData} newData
     */
    loadData(newData) {
      board = newData.map((row) => [...row]);
    }
  };
};

/**
 * 履歴を管理するコントローラー (の作成)
 * 責務: データの保存、過去データの提供
 * point: 保存するデータの中身（オセロか将棋か、など）には関心を持たせない
 *
 * @returns {{
 *   init(): void;
 *   getData(turn: number): BoardData | null;
 *   pushData(turn: number, data: BoardData): void;
 *   length: number
 * }} historyCon
 */
const historyController = () => {
  /** @type {[] | BoardData[]} */
  let history = [];

  return {
    init() {
      history = [];
    },

    /**
     * @param {number} turn
     * @returns {BoardData | null}
     */
    getData(turn) {
      return history[turn] || null;
    },

    /**
     * @param {number} turn
     * @param {BoardData} data
     */
    pushData(turn, data) {
      if (history.length > turn) {
        history = history.slice(0, turn);
      }
      history[turn] = data;
    },

    get length() {
      return history.length;
    }
  };
};

/**
 * ターンを管理するコントローラー (の作成)
 * 責務: ターン数の増減、リセット、現在ターン数の提供、
 * および現在どちらのプレイヤーの手番かを知らせる (改修時は分離すべき)
 *
 * @returns {{
 *   init(): void;
 *   increment(): void;
 *   decrement(): void;
 *   count: number;
 *   currentPlayer: Piece;
 * }} turnCon
 */
const createTurnController = () => {
  let count = 0;

  return {
    init() {
      count = 0;
    },

    increment() {
      count++;
    },

    decrement() {
      if (count > 0) count--;
    },

    get count() {
      return count;
    },

    get currentPlayer() {
      return count % 2 === 0 ? 'black' : 'white';
    }
  };
};

/**
 * DOMのレンダー機能を責務とするコントローラー (の作成)
 * 依存: boardDataCon, turn
 * @param {{
 *   init(): void;
 *   getCell(row: number, col: number): CellState | undefined;
 *   setCell(row: number, col: number, cellState: CellState): void;
 *   readonly current: BoardData;
 *   loadData(newData: BoardData): void;
 * }} boardDataCon
 * @param {{
 *   init(): void;
 *   increment(): void;
 *   decrement(): void;
 *   count: number;
 *   currentPlayer: Piece;
 * }} turnCon
 * @returns {{render(): void}} renderer
 */
const createRenderer = (boardDataCon, turnCon) => {
  /**
   * @param {BoardData} boardData
   */
  const renderBoard = (boardData) => {
    const table = document.getElementById('board-table');
    if (table === null || table instanceof HTMLTableElement !== true) return;
    table.innerHTML = '';

    boardData.forEach((row, r) => {
      row.forEach((cellState, c) => {
        const cell = table.rows[r].cells[c].querySelector('.othello__piece');
        if (cell === null) {
          console.log('Error: Cannot render null cell!');
          return;
        }

        cell.className = 'othello__piece ' + cellState;
      });
    });
  }; // --- renderBoard

  /**
   * @param {number} turn
   * @param {Piece} currentPlayer
   */
  const renderInfo = (turn, currentPlayer) => {
    const turnText = document.getElementById('turn-text');
    if (turnText === null) return;
    turnText.textContent = `Turn: ${turn} | Player: ${currentPlayer}`;
  }; // --- renderInfo

  return {
    render() {
      const currentBoardData = boardDataCon.current;
      const turn = turnCon.count;
      const currentPlayer = turnCon.currentPlayer;

      renderBoard(currentBoardData);
      renderInfo(turn, currentPlayer);
    }
  };
};
