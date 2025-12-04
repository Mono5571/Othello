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
 *   score: { b: number, w: number }
 * }} BoardDataCon
 */

/**
 * 盤面データを管理するコントローラー (の作成)
 * 責務: 現在の盤面の状態管理、石の配置、データの複製提供
 * @param {Object} [options]
 * @param {{coordinate: Coordinate, piece: Piece}[]} [options.initialPieces]
 * @returns {BoardDataCon}
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
      cellsToFlip.forEach(({ r, c }) => {
        boardData[r][c] = piece;
      });
    },

    // 盤面全体のディープコピーを返す（履歴保存 / レンダリング用）
    get current() {
      return boardData.map((row) => [...row]);
    },

    loadData(newData) {
      boardData = newData.map((row) => [...row]);
    },

    get score() {
      return this.current.flat().reduce(
        (acc, cur) => {
          if (cur === 'black') acc.b++;
          if (cur === 'white') acc.w++;
          return acc;
        },
        { b: 0, w: 0 }
      );
    }
  };
};

/**
 * @typedef {{
 *   init(): void;
 *   getData(turn: number): BoardData | null;
 *   pushData(turn: number, data: BoardData): void;
 *   length: number
 * }} HistoryCon
 */

/**
 * 履歴を管理するコントローラー (の作成)
 * 責務: データの保存、過去データの提供
 * point: 保存するデータの中身（オセロか将棋か、など）には関心を持たせない
 *
 * @returns {HistoryCon}
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
 *   current: number;
 *   player: Piece;
 * }} TurnCounter
 */

/**
 * ターンを管理するコントローラー (の作成)
 * 責務: ターン数の増減、リセット、現在ターン数の提供、
 * および現在どちらのプレイヤーの手番かを知らせる (改修時は分離すべき)
 *
 * @returns {TurnCounter}
 */
const createTurnCounter = () => {
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

    get current() {
      return count;
    },

    get player() {
      return count % 2 === 0 ? 'black' : 'white';
    }
  };
};

/**
 * DOMのレンダリングをおこなうコントローラー (の作成)
 * 責務: 初回のDOM取得と構築及びキャッシュをおこない、Model (= Single Source of Truth たる boardData) から View の生成をする
 * 依存: boardDataCon, turn
 * @param {BoardDataCon} boardDataCon
 * @param {TurnCounter} turnCounter
 * @returns {{render(): void} | undefined} renderer
 */
const createRenderer = (boardDataCon, turnCounter) => {
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
      const turn = turnCounter.current + 1;
      const currentPlayer = turnCounter.player;

      renderBoard(currentBoardData);
      renderInfo(turn, currentPlayer);
    }
  };
};

/**
 * @typedef {{
 *   getFlipCandidates(coordinate: Coordinate, pieceToPlace: Piece): null | Coordinate[];
 *   getValidMoves(pieceToPlace: Piece): Coordinate[]
 * }} MoveRules
 */
/**
 * オセロのコアロジックをつかさどるオブジェクト（の生成）
 * 責務: 石を挟んで裏返すというオセロのゲームルールの計算
 * 依存: boardDataCon -> 盤面の状態を参照するため
 * @param {BoardDataCon} boardDataCon
 * @returns {MoveRules}
 */
const createMoveRules = (boardDataCon) => {
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
    /** @type {Coordinate[]} */
    const candidatesInDir = [];

    for (let dist = 1, loop = true; loop === true; dist++) {
      const row = startCoord.r + dr * dist;
      const col = startCoord.c + dc * dist;
      const checkingCell = { r: row, c: col };

      // 盤外に出たら走査中断
      if (!isOnBoard(checkingCell)) break;

      const checkingCellState = boardDataCon.getCell(checkingCell);

      if (checkingCellState === opponentPiece) {
        // 1. 相手の石が連続しているかチェックして候補の配列にいれ、次のループへ
        candidatesInDir.push(checkingCell);
      } else if (checkingCellState === pieceToPlace) {
        // 2. 盤上にあり、かつ終端が自分の石であれば、候補の配列 (要素数 0 以上) を返す
        return candidatesInDir;
      } else {
        // 3. 空のマスが見つかったら裏返し不成立
        break;
      }
    }

    // break をここでキャッチ
    return [];
  };

  return {
    /**
     * 指定された座標に対して、ある色の石を置いたときに裏返せる石の座標群を配列の形で返す関数
     * 裏返せる石がない場合は null を返す
     * @param {Coordinate} coordinate
     * @param {Piece} pieceToPlace
     * @returns {null | Coordinate[]}
     */
    getFlipCandidates({ r, c }, pieceToPlace) {
      if (boardDataCon.getCell({ r, c }) !== 'empty') return null;
      /** @type {Coordinate[]} */
      const allCandidates = [];
      DIRECTIONS.forEach((direction) => {
        const candidatesInDir = checkDirection({ r, c }, pieceToPlace, direction);
        allCandidates.push(...candidatesInDir);
      });
      if (allCandidates.length === 0) return null;
      return allCandidates;
    },

    getValidMoves(pieceToPlace) {
      const allCoords = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ({ r, c }))).flat();
      // [{ r: 0, c: 0 }, { r: 0, c: 1 }, ..., { r: 7, c: 7 }]
      const validMoves = allCoords.filter((coords) => this.getFlipCandidates(coords, pieceToPlace));
      return validMoves;
    }
  };
};

/**
 * オセロのゲーム進行を管理するコントローラー (の作成)
 * 責務:
 * 1) 依存している各種コントローラーをもちいたゲームの進行
 * 2) イベントリスナーをDOM要素に設置してプレイヤーへの操作インターフェイスを提供
 * 依存: boardDataCon, historyCon, turnCounter, renderer, moveRules
 * @param {object} arguments
 * @param {BoardDataCon} arguments.boardDataCon
 * @param {HistoryCon} arguments.historyCon
 * @param {TurnCounter} arguments.turnCounter
 * @param {{render(): void}} arguments.renderer
 * @param {MoveRules} arguments.moveRules
 * @returns {{
 *   initGame(): void,
 *   setupEventListeners(): void
 * }} othelloCon
 */
const createOthelloController = ({ boardDataCon, historyCon, turnCounter, renderer, moveRules }) => {
  /**
   *
   * @param {Coordinate} clickedCoord
   */
  const handleCellClick = ({ r, c }) => {
    const currentPlayer = turnCounter.player;
    const cellsToFlip = moveRules.getFlipCandidates({ r, c }, currentPlayer);
    if (cellsToFlip === null) {
      console.log('Error: Invalid move!');
      return;
    }

    boardDataCon.flipCells(cellsToFlip, currentPlayer);
    boardDataCon.setCell({ r, c }, currentPlayer);

    manageTurnProgression();
  };

  /**
   * 現在の盤面状態を基に、次のターンの状態遷移を管理する。
   * 責務: ターンインクリメント、履歴保存、パス/終了判定、レンダリング。
   */
  const manageTurnProgression = () => {
    const currentTurn = turnCounter.current + 1; // 石を置いた後の仮想的な次のターン

    // 1. 履歴の保存 (次のターン数で保存)
    historyCon.pushData(currentTurn, boardDataCon.current);

    // 2. 次のプレイヤーを判定
    const nextPlayer = currentTurn % 2 === 0 ? 'black' : 'white';
    const validMovesNextPL = moveRules.getValidMoves(nextPlayer);

    // --- 状態遷移の判定ロジック ---

    // --- unDo, reDo の挙動がうまくいかない場合、この辺が原因の可能性あり ---
    if (validMovesNextPL.length === 0) {
      // 次のプレイヤーはパスの可能性がある

      const currentPlayer = currentTurn % 2 === 0 ? 'white' : 'black'; // プレイヤーを戻して再チェック
      const validMovesCurrentPL = moveRules.getValidMoves(currentPlayer);

      if (validMovesCurrentPL.length === 0) {
        // 両者置けない -> ゲーム終了
        turnCounter.increment(); // 最終的なターンを記録
        historyCon.pushData(turnCounter.current, boardDataCon.current);
        endGame();
        return;
      }

      // 次のプレイヤーはパス -> スキップ処理
      historyCon.pushData(turnCounter.current, boardDataCon.current); // 履歴は更新
      skip(nextPlayer);
      renderer.render(); // スキップ表示の更新
      return;
    }

    // 3. 通常のターン進行
    turnCounter.increment(); // 内部ターンカウントを進める
    renderer.render();
  };

  /**
   *
   * @param {Piece} player
   */
  const skip = (player) => {
    alert(`Player ${player} has no valid move. Skipped ${player}'s turn.`);
  };

  const endGame = () => {
    renderer.render();
    alert('Game Over!');

    // 点数計算は boardDataCon の責務であるべき
    const { b, w } = boardDataCon.score;

    const turnText = document.getElementById('turn-text');
    if (turnText === null) {
      console.log('Error: Not found turn text on ending game!');
      return;
    }

    // DOM操作は renderer の責務であるべき
    // e.g renderer.showResult();
    const appendix = b === w ? 'Draw!' : b > w ? 'Winner: black!' : 'Winner: White!';
    const msg = `Turn: ${turnCounter.current + 1}, black: ${b}, white: ${w} ` + `${appendix}`;

    turnText.textContent = msg;
  };

  return {
    initGame() {
      boardDataCon.init();
      historyCon.init();
      turnCounter.init();

      // 初期状態を履歴配列の0番目に保存
      historyCon.pushData(turnCounter.current, boardDataCon.current);

      renderer.render();
    },

    setupEventListeners() {
      const table = document.getElementById('board-table');
      if (table === null) {
        console.log('Error: Not found table on setting up event listeners');
        return;
      }

      const restartButton = document.getElementById('restart-button');
      if (restartButton === null) {
        console.log('Error: Not found restart button on setting up event listeners');
        return;
      }

      // undoButton, redoButton の追加

      table.addEventListener('click', (e) => {
        // @ts-ignore
        const td = e.target?.closest('td');
        if (!td) return;

        const r = td.parentElement.rowIndex;
        const c = td.cellIndex;

        handleCellClick({ r, c });
      });

      restartButton.addEventListener('click', () => this.initGame());
    }
  };
};

document.addEventListener('DOMContentLoaded', () => {
  const boardDataCon = createBoardDataController();
  const historyCon = createHistoryController();
  const turnCounter = createTurnCounter();

  // DI (Dependency Injection 依存性の注入) して使う
  const renderer = createRenderer(boardDataCon, turnCounter);
  if (renderer === undefined) {
    console.log('Error: Failed to create renderer!');
    return;
  }

  const moveRules = createMoveRules(boardDataCon);

  // DI (Dependency Injection 依存性の注入) して使う
  const othelloCon = createOthelloController({ boardDataCon, historyCon, turnCounter, renderer, moveRules });

  othelloCon.initGame();
  othelloCon.setupEventListeners();
});
