// JavaScript Document
// script.js
// @ts-check
'use strict';

/** @typedef {'black' | 'white'} Piece */
/** @typedef {'empty' | Piece} CellState */

/** @typedef {CellState[][]} BoardData */

/** @typedef {{r: number, c: number}} Coordinate */

/**
 * @type {{coordinate: Coordinate, piece: Piece}[]}
 */
const INITIAL_PIECES = [
  { coordinate: { r: 3, c: 3 }, piece: 'white' },
  { coordinate: { r: 3, c: 4 }, piece: 'black' },
  { coordinate: { r: 4, c: 3 }, piece: 'black' },
  { coordinate: { r: 4, c: 4 }, piece: 'white' }
];

/**
 * @typedef {{
 *   init(): void;
 *   getCell({ r, c }: Coordinate): CellState | undefined;
 *   setCell({ r, c }: Coordinate, cellState: CellState): void;
 *   flipCells(cellsToFlip: Coordinate[], piece: Piece): void;
 *   readonly current: BoardData;
 *   loadData(newData: BoardData): void;
 * }} boardDataCon
 */

/**
 * 盤面データを管理するコントローラー (の作成)
 * 責務: 現在の盤面の状態管理、石の配置、データの複製提供
 * @param {Object} [options]
 * @param {{coordinate: Coordinate, piece: Piece}[]} [options.initialPieces]
 * @returns {boardDataCon}
 */
const createBoardDataController = ({ initialPieces = INITIAL_PIECES } = {}) => {
  /** @type {BoardData} */
  let boardData = [];

  return {
    init() {
      // 行ごとに新しい配列を作る（参照渡しを防ぐため）
      boardData = Array.from({ length: 8 }, () => Array(8).fill('empty'));

      initialPieces.forEach((obj) => {
        const {
          coordinate: { r, c },
          piece
        } = obj;
        boardData[r][c] = piece;
      });
    },

    getCell({ r, c }) {
      return boardData[r][c];
    },

    setCell({ r, c }, cellState) {
      boardData[r][c] = cellState;
    },

    flipCells(cellsToFlip, piece) {
      cellsToFlip.forEach((coordinate) => {
        boardData[coordinate.r][coordinate.c] = piece;
      });
    },

    // 盤面全体のディープコピーを返す（履歴保存 / レンダリング用）
    get current() {
      return boardData.map((row) => [...row]);
    },

    loadData(newData) {
      boardData = newData.map((row) => [...row]);
    }
  };
};

/**
 * @typedef {{
 *   init(): void;
 *   getData(turn: number): BoardData | null;
 *   pushData(turn: number, data: BoardData): void;
 *   length: number
 * }} historyCon
 */

/**
 * 履歴を管理するコントローラー (の作成)
 * 責務: データの保存、過去データの提供
 * point: 保存するデータの中身（オセロか将棋か、など）には関心を持たせない
 *
 * @returns {historyCon}
 */
const createHistoryController = () => {
  /** @type {BoardData[]} */
  let history = [];

  return {
    init() {
      history = [];
    },

    getData(turn) {
      return history[turn] || null;
    },

    pushData(turn, data) {
      if (history.length > turn) {
        history = history.slice(0, turn);
      }
      history.push(data);
    },

    get length() {
      return history.length;
    }
  };
};

/**
 * @typedef {{
 *   init(): void;
 *   increment(): void;
 *   decrement(): void;
 *   count: number;
 *   currentPlayer: Piece;
 * }} turnCon
 */

/**
 * ターンを管理するコントローラー (の作成)
 * 責務: ターン数の増減、リセット、現在ターン数の提供、
 * および現在どちらのプレイヤーの手番かを知らせる (改修時は分離すべき)
 *
 * @returns {turnCon}
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
 * DOMのレンダリングをおこなうコントローラー (の作成)
 * 責務: 初回のDOM取得と構築及びキャッシュをおこない、Model (= Single Source of Truth たる boardData) から View の生成をする
 * 依存: boardDataCon, turn
 * @param {boardDataCon} boardDataCon
 * @param {turnCon} turnCon
 * @returns {{render(): void} | undefined} renderer
 */
const createRenderer = (boardDataCon, turnCon) => {
  const table = document.getElementById('board-table');
  if (table === null || table instanceof HTMLTableElement !== true) {
    console.log('Error: Not found table on creating renderer!');
    return;
  }

  const turnText = document.getElementById('turn-text');
  if (turnText === null) {
    console.log('Error: Not found turnText on creating renderer!');
    return;
  }

  /**
   * @type {HTMLSpanElement[][]}
   */
  const cellElements = [];

  const buildAndCacheDOM = () => {
    for (let r = 0; r < 8; r++) {
      const tr = document.createElement('tr');
      cellElements[r] = [];
      for (let c = 0; c < 8; c++) {
        const td = document.createElement('td');
        const cellElement = document.createElement('span');
        cellElement.textContent = '●';

        cellElement.className = 'othello__piece empty';
        td.appendChild(cellElement);
        tr.appendChild(td);

        cellElements[r][c] = cellElement;
      }
      table.appendChild(tr);
    }
  }; // --- buildAndCacheDOM

  /**
   * @param {BoardData} boardData
   */
  const renderBoard = (boardData) => {
    boardData.forEach((row, r) => {
      row.forEach((cellState, c) => {
        const cell = cellElements[r][c];
        if (cell === null) {
          console.log('Error: Not found cell to render on rendering board!');
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
    turnText.textContent = `Turn: ${turn} | Player: ${currentPlayer}`;
  }; // --- renderInfo

  // DOM構築及びキャッシュを一度だけ実行
  buildAndCacheDOM();

  return {
    render() {
      const currentBoardData = boardDataCon.current;
      const turn = turnCon.count + 1;
      const currentPlayer = turnCon.currentPlayer;

      renderBoard(currentBoardData);
      renderInfo(turn, currentPlayer);
    }
  };
};

/**
 * オセロのゲーム進行を管理するコントローラー (の作成)
 * 責務:
 * 1) 依存している各種コントローラーをもちいたゲームの進行
 * 2) イベントリスナーをDOM要素に設置してプレイヤーへの操作インターフェイスを提供
 * 依存: boardDataCon, historyCon, turnCon, renderer
 * @param {object} arguments
 * @param {boardDataCon} arguments.boardDataCon
 * @param {historyCon} arguments.historyCon
 * @param {turnCon} arguments.turnCon
 * @param {{render(): void | undefined}} arguments.renderer
 * @returns {{initGame(): void | undefined}} othelloCon
 */
const createOthelloController = ({ boardDataCon, historyCon, turnCon, renderer }) => {
  /** 探査すべき 8 方向 */
  const DIRECTIONS = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: -1, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 }
  ];

  /**
   * 走査範囲を盤上に限定するためのヘルパー関数
   * @param {Coordinate} coordinate
   * @returns {boolean}
   */
  const isOnBoard = ({ r, c }) => r >= 0 && r < 8 && c >= 0 && c < 8;

  /**
   * 特定の方向を走査し、裏返す石の座標を配列として返すヘルパー関数
   * @param {Coordinate} startCoord
   * @param {Piece} pieceToPlace
   * @param {{dr: number, dc: number}} direction
   * @returns {Coordinate[]}
   */
  const checkDirection = (startCoord, pieceToPlace, { dr, dc }) => {
    const opponentPiece = pieceToPlace === 'black' ? 'white' : 'black';
    const candidatesInDir = [];
    let r = startCoord.r + dr;
    let c = startCoord.c + dc;

    // 1. 相手の石が連続しているかチェックして候補に
    while (isOnBoard({ r, c }) && boardDataCon.getCell({ r, c }) === opponentPiece) {
      candidatesInDir.push({ r, c });
      r += dr;
      c += dc;
    }

    // 2. 盤上にあり、かつ終端が自分の石であれば、候補の配列を返す
    if (isOnBoard({ r, c }) && boardDataCon.getCell({ r, c }) === pieceToPlace) {
      return candidatesInDir;
    }

    // 3. 終端が盤外か空の場合、裏返しは不成立、空の配列を返す
    return [];
  };

  /**
   * 指定された座標に対して、そこに指定された色の石を置いたときに裏返す石の座標群を配列の形で返す関数
   * @param {Coordinate} coordinate
   * @param {Piece} pieceToPlace
   * @returns {null | Coordinate[]}
   */
  const getFlipCandidates = ({ r, c }, pieceToPlace) => {
    if (boardDataCon.getCell({ r, c }) !== 'empty') return null;
    /** @type {Coordinate[]} */
    const allCandidates = [];
    DIRECTIONS.forEach((direction) => {
      const candidatesInDir = checkDirection({ r, c }, pieceToPlace, direction);
      allCandidates.push(...candidatesInDir);
    });
    if (allCandidates.length === 0) return null;
    return allCandidates;
  };

  /**
   *
   * @param {Coordinate} clickedCoord
   */
  const handleCellClick = ({ r, c }) => {
    const currentPlayer = turnCon.currentPlayer;
    const cellsToFlip = getFlipCandidates({ r, c }, currentPlayer);
    if (cellsToFlip === null) {
      console.log('Error: Invalid move!');
      return;
    }

    console.log(cellsToFlip); // -> 何かがおかしい

    boardDataCon.flipCells(cellsToFlip, currentPlayer); // success

    boardDataCon.setCell({ r, c }, currentPlayer); // success

    // test ---

    turnCon.increment(); // success
    historyCon.pushData(turnCon.count, boardDataCon.current); // ?
    renderer.render(); // // success?
    // --- test
  };

  const setupEventListeners = () => {
    const table = document.getElementById('board-table');
    if (!table) {
      console.log('Error: Not found table on setting up event listeners');
      return;
    }

    table.addEventListener('click', (e) => {
      // @ts-ignore
      const td = e.target?.closest('td');
      if (!td) return;

      const r = td.parentElement.rowIndex;
      const c = td.cellIndex;

      handleCellClick({ r, c });
    });
  };

  return {
    initGame() {
      boardDataCon.init();
      historyCon.init();
      turnCon.init();

      // 初期状態を履歴配列の0番目に保存
      historyCon.pushData(turnCon.count, boardDataCon.current);

      renderer.render();
      setupEventListeners();
    }
  };
};

document.addEventListener('DOMContentLoaded', () => {
  const boardDataCon = createBoardDataController();
  const historyCon = createHistoryController();
  const turnCon = createTurnController();

  // DI (Dependency Injection 依存性の注入) して使う
  const renderer = createRenderer(boardDataCon, turnCon);
  if (renderer === undefined) {
    console.log('Error: Failed to create renderer!');
    return;
  }

  // DI (Dependency Injection 依存性の注入) して使う
  const othelloCon = createOthelloController({ boardDataCon, historyCon, turnCon, renderer });

  othelloCon.initGame();
});
