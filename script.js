// JavaScript Document
// script.js
// @ts-check
'use strict';

/** @typedef {'black' | 'white'} Piece */
/** @typedef {'empty' | Piece} CellState */

/** @typedef {CellState[][]} Board */

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
 * 盤面データを管理するコントローラー
 * 責務: 現在の盤面の状態管理、石の配置、データの複製提供
 * @param {Object} [options]
 * @param {{row: number, col: number, piece: 'white' | 'black'}[]} [options.initialPieces]
 */
const createBoardController = ({ initialPieces = INITIAL_PIECES } = {}) => {
  /** @type {[] | Board} */
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
     * @returns {Board}
     */
    // 現在の盤面全体を取得（レンダリング用）
    getBoard() {
      return board;
    },

    /**
     * @returns {Board}
     */
    // 盤面全体のディープコピーを返す（履歴保存用）
    clone() {
      return board.map((row) => [...row]);
    },

    /**
     * @param {Board} newData
     */
    loadData(newData) {
      board = newData.map((row) => [...row]);
    }
  };
};

/**
 * 履歴を管理するコントローラー
 * 責務: データの保存、過去データの提供
 * point: 保存するデータの中身（オセロか将棋か、など）には関心を持たせない
 */
const historyController = () => {
  /** @type {[] | Board[]} */
  let history = [];

  return {
    init() {
      history = [];
    },

    /**
     * @param {number} turn
     * @returns {Board | null}
     */ getData(turn) {
      return history[turn] || null;
    },

    /**
     * @param {number} turn
     * @param {Board} data
     */
    pushData(turn, data) {
      if (history.length > turn) {
        history = history.slice(0, turn);
      }
      history[turn] = data;
    },

    getLength() {
      return history.length;
    }
  };
};

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

    get() {
      return count;
    },

    getCurrentPlayer() {
      return count % 2 === 0 ? 'black' : 'white';
    }
  };
};
