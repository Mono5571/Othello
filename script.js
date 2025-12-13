// JavaScript Document
// script.js
// @ts-check
'use strict';

/** @typedef {'black' | 'white'} Piece */
/** @typedef {'empty' | Piece} CellState */

/** @typedef {CellState[][]} BoardData */
/** @typedef {{ player: Piece, boardData: BoardData }} PlayerAndBoardData */

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
 *   isData(turn: number): boolean;
 *   getData(turn: number): PlayerAndBoardData | null;
 *   pushData(turn: number, player: Piece, boarddata: BoardData): void;
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
  /** @type {PlayerAndBoardData[]} */
  let history = [];

  return {
    init() {
      history = [];
    },

    isData(turn) {
      if (turn < 0) return false;
      return history.length > turn;
    },

    getData(turn) {
      if (!this.isData(turn)) return null;
      return history[turn] || null;
    },

    pushData(turn, player, boardData) {
      if (history.length > turn) {
        history = history.slice(0, turn);
      }

      const turnData = { player, boardData };
      history.push(turnData);
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
 * }} TurnCounter
 */

/**
 * ターンを管理するコントローラー (の作成)
 * 責務: ターン数の増減、リセット、現在ターン数の提供
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
    }
  };
};

/**
 * @typedef {{
 *   resetSkip(): void,
 *   skip(): void,
 *   setPlayer(player: Piece): void,
 *   currentPlayer: Piece,
 *   nextPlayer: Piece
 * }} PlayerM
 */
/**
 * ターンカウントに基づき、スキップ回数を考慮したそのターンのプレイヤーを決定するモジュール
 * 依存: turnCounter
 * @param {TurnCounter} turnCounter
 * @param {object} options
 * @param {Piece[]} [options.playerOrder]
 * @returns {PlayerM}
 */
const createPlayerManager = (turnCounter, { playerOrder = ['black', 'white'] } = {}) => {
  let skipCount = 0;
  const orderLength = playerOrder.length;

  return {
    resetSkip() {
      skipCount = 0;
    },

    skip() {
      skipCount++;
    },

    setPlayer(player) {
      const index = playerOrder.indexOf(player);
      if (index === -1) return;

      const currentTurn = turnCounter.current;
      const remainder = currentTurn % orderLength;

      // 負の数にならないように length を足してから剰余を取る一般的なテクニック
      skipCount = (index - remainder + orderLength) % orderLength;
    },

    get currentPlayer() {
      const index = (turnCounter.current + skipCount) % orderLength;
      return playerOrder[index];
    },

    get nextPlayer() {
      const index = (turnCounter.current + 1 + skipCount) % orderLength;
      return playerOrder[index];
    }
  };
};

/**
 * @typedef {{render(): void, renderSkip(player: Piece): void, renderResult(): void, renderInteractive(isInteractive: boolean): void} | undefined} Renderer
 */
/**
 * DOMのレンダリングをおこなうコントローラー (の作成)
 * 責務: 初回のDOM取得と構築及びキャッシュをおこない、Model (= Single Source of Truth たる boardData) から View の生成をする
 * 依存: boardDataCon, turn
 * @param {object} arguments
 * @param {BoardDataCon} arguments.boardDataCon
 * @param {TurnCounter} arguments.turnCounter
 * @param {HistoryCon} arguments.historyCon
 * @param {PlayerM} arguments.playerM
 * @returns {Renderer}
 */
const createRenderer = ({ boardDataCon, turnCounter, historyCon, playerM }) => {
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

  const undoButton = document.getElementById('undo-button');
  const redoButton = document.getElementById('redo-button');
  if (undoButton === null || redoButton === null) {
    console.log('Error: Not found undo or redo button on creating renderer!');
    return;
  }

  if (undoButton instanceof HTMLButtonElement === false || redoButton instanceof HTMLButtonElement === false) {
    console.log('Error: undo or redo button is not a button.');
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

  /**
   * @param {number} currentTurn
   */
  const renderUndoButton = (currentTurn) => {
    const isPreviousData = historyCon.isData(currentTurn - 1);
    if (isPreviousData) {
      undoButton.disabled = false;
    } else {
      undoButton.disabled = true;
    }
  };

  /**
   * @param {number} currentTurn
   */
  const renderRedoButton = (currentTurn) => {
    const isNextData = historyCon.isData(currentTurn + 1);
    if (isNextData) {
      redoButton.disabled = false;
    } else {
      redoButton.disabled = true;
    }
  };

  // DOM構築及びキャッシュを一度だけ実行
  buildAndCacheDOM();

  return {
    render() {
      const currentBoardData = boardDataCon.current;
      const currentTurn = turnCounter.current;
      const currentPlayer = playerM.currentPlayer;

      const turnOnText = currentTurn + 1;

      renderBoard(currentBoardData);
      renderInfo(turnOnText, currentPlayer);
      renderUndoButton(currentTurn);
      renderRedoButton(currentTurn);
    },

    /**
     *
     * @param {Piece} player
     */
    renderSkip(player) {
      alert(`Player ${player} has no valid move. Skipped ${player}'s turn.`);
    },

    renderResult() {
      alert('Game Over!');

      // 点数計算は boardDataCon の責務であるべき
      const { b, w } = boardDataCon.score;

      const appendix = b === w ? 'Draw!' : b > w ? 'Winner: black!' : 'Winner: White!';
      const msg = `Turn: ${turnCounter.current}, black: ${b}, white: ${w} ` + `${appendix}`;

      turnText.textContent = msg;
    },

    renderInteractive(isInteractive) {
      if (isInteractive === false) {
        undoButton.disabled = true;
        redoButton.disabled = true;
      } else {
        const currentTurn = turnCounter.current;
        renderUndoButton(currentTurn);
        renderRedoButton(currentTurn);
      }
    }
  };
};

/**
 * @typedef {{coordinate: Coordinate, flipCandidates: Coordinate[]}[]} MovesAndFlips
 */

/**
 * @typedef {{
 *   getFlipCandidates(coordinate: Coordinate, pieceToPlace: Piece): null | Coordinate[];
 *   getValidMoves(pieceToPlace: Piece): Coordinate[];
 *   getMovesAndFlips(pieceToPlace: Piece): MovesAndFlips
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

  /**
   * 指定された座標に対して、ある色の石を置いたときに裏返せる石の座標群を配列の形で返す関数
   * 裏返せる石がない場合は null を返す
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

  const allCoords = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ({ r, c }))).flat();
  // [{ r: 0, c: 0 }, { r: 0, c: 1 }, ..., { r: 7, c: 7 }]

  /**
   *
   * @param {Piece} pieceToPlace
   * @returns {Coordinate[]}
   */
  const getValidMoves = (pieceToPlace) => {
    const validMoves = allCoords.filter((coords) => getFlipCandidates(coords, pieceToPlace));
    return validMoves;
  };

  /**
   *
   * @param {Piece} pieceToPlace
   * @returns {MovesAndFlips}
   */
  const getMovesAndFlips = (pieceToPlace) => {
    /** @type {MovesAndFlips} */
    const movesAndFlips = [];
    allCoords.forEach((coordinate) => {
      const flipCandidates = getFlipCandidates(coordinate, pieceToPlace);
      if (flipCandidates !== null) movesAndFlips.push({ coordinate, flipCandidates });
    });
    return movesAndFlips;
  };

  return { getFlipCandidates, getValidMoves, getMovesAndFlips };
};

// ----- BOT -----
// Strategy Pattern をもちいて書き換え

const strategies = {
  random: (/** @type {MovesAndFlips} */ movesAndFlips) => {
    const randomInt = Math.trunc(Math.random() * movesAndFlips.length);
    return movesAndFlips[randomInt];
  },

  greedy: (/** @type {MovesAndFlips} */ movesAndFlips) => {
    return movesAndFlips.reduce((pre, cur) => {
      const preFlipsAmount = pre.flipCandidates.length;
      const curFlipsAmount = cur.flipCandidates.length;

      // 既存の値の方が大きければ維持
      if (preFlipsAmount > curFlipsAmount) return pre;
      // 現在の値の方が大きければ更新
      if (preFlipsAmount < curFlipsAmount) return cur;

      return Math.random() < 0.5 ? pre : cur;
    });
  },

  focusOnCorner: (/** @type {MovesAndFlips} */ movesAndFlips) => {
    const corners = [
      { r: 0, c: 0 },
      { r: 0, c: 7 },
      { r: 7, c: 0 },
      { r: 7, c: 7 }
    ];

    /**
     * @type {MovesAndFlips}
     */
    const cornerMoves = movesAndFlips.filter((m) =>
      corners.some((corner) => corner.r === m.coordinate.r && corner.c === m.coordinate.c)
    );

    if (cornerMoves.length === 0) return strategies.greedy(movesAndFlips);

    return strategies.random(cornerMoves);
  }
};

/**
 * @typedef {'random' | 'greedy' | 'focusOnCorner'} StrategyType
 */

/**
 * @typedef {{
 *   piece: Piece | null,
 *   strategy: StrategyType,
 *   move(): null | {coordinate: Coordinate, flipCandidates: Coordinate[]}
 * }} Bot
 */
/**
 * Bot の思考ルーチン
 * @param {MoveRules} moveRules
 * @param {object} options
 * @param {Piece | null} [options.piece]
 * @param {StrategyType} [options.strategyType]
 * @returns {Bot}
 */
const createBot = (moveRules, { piece = 'white', strategyType = 'focusOnCorner' } = {}) => {
  /** @type {Piece | null} */
  let botPiece = piece;
  // 設定から石を決定する処理をのちほど追加
  let strategy = strategyType;

  const move = () => {
    if (botPiece === null) return null;
    const movesAndFlips = moveRules.getMovesAndFlips(botPiece);

    if (movesAndFlips.length === 0) {
      console.log('Error: No valid move for bot on bot thinking!');
      return null;
    }

    return strategies[strategy](movesAndFlips);
    // 石を置くセルの座標とそれによって裏返せる石の配列を返す
    // -> handleCellClick (must be renamed) に渡す
  };

  return {
    set piece(piece) {
      botPiece = piece;
    },

    get piece() {
      return botPiece;
    },

    /**
     * @param {StrategyType} strategyType
     */
    set strategy(strategyType) {
      strategy = strategyType;
    },

    move
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
 * @param {Renderer} arguments.renderer
 * @param {MoveRules} arguments.moveRules
 * @param {PlayerM} arguments.playerM
 * @param {Bot} arguments.bot
 * @returns {{
 *   initGame(): void,
 *   setupEventListeners(): void
 * } | undefined} othelloCon
 */
const createOthelloController = ({ boardDataCon, historyCon, turnCounter, renderer, moveRules, playerM, bot }) => {
  if (renderer == null) return;
  let isInteractive = true;

  /** @param {boolean} boolean */
  const setInteractive = (boolean) => {
    isInteractive = boolean;
    // CSSクラスの付与やボタンのdisabled化など、見た目も同期させる
    renderer.renderInteractive(boolean);
  };

  /**
   * UIイベント用ラッパー関数（デコレーター）
   * インタラクティブモード時のみ関数を実行する
   * @param {(...args: any) => any} func - 実行したい関数
   * @returns {(...args: any) => any} - ガード付き関数
   */
  const runIfInteractive = (func) => {
    return (...args) => {
      // シンプルにフラグだけをチェック
      if (isInteractive === false) {
        console.log('Ignore input: currently processing bot turn.');
        return;
      }
      return func(...args);
    };
  };

  /**
   *
   * @param {Coordinate} clickedCoord
   * @param {Coordinate[] | null} [cellsToFlip]
   */
  const handleMove = ({ r, c }, cellsToFlip = null) => {
    const currentPlayer = playerM.currentPlayer;

    cellsToFlip = cellsToFlip ?? moveRules.getFlipCandidates({ r, c }, currentPlayer);
    if (cellsToFlip === null) {
      console.log('Error: Invalid move!');
      return;
    }

    boardDataCon.flipCells(cellsToFlip, currentPlayer);
    boardDataCon.setCell({ r, c }, currentPlayer);

    manageGameProgression();
  };

  /**
   * プレイヤーに valid move があるかを判定してゲーム進行を決めるヘルパー関数
   * @returns {'usual' | 'skip' | 'gameOver'}
   */
  const decideProgressionKey = () => {
    // 次のプレイヤーに石を置ける場所があるかを判定
    const validMovesNextPL = moveRules.getValidMoves(playerM.nextPlayer);
    // 次のプレイヤーに石を置ける場所がある -> 通常のゲーム進行
    if (validMovesNextPL.length > 0) return 'usual';

    // 次のプレイヤーに石を置ける場所がない -> スキップまたはゲームオーバー
    // プレイヤーを戻して再チェック
    const validMovesCurrentPL = moveRules.getValidMoves(playerM.currentPlayer);
    // 次の次の（現在の）プレイヤーに石を置ける場所がある -> スキップ
    if (validMovesCurrentPL.length > 0) return 'skip';

    // 次の次の（現在の）プレイヤーに石を置ける場所がない -> ゲームオーバー
    return 'gameOver';
  };

  const proceedUsualTurn = () => {
    // 通常のターン進行
    turnCounter.increment();
    historyCon.pushData(turnCounter.current, playerM.currentPlayer, boardDataCon.current);
    renderer.render();
  };

  /** @type {{usual(): void; skip(): void; gameOver(): void}} */
  const progressionKeyMap = {
    usual: proceedUsualTurn,
    skip() {
      // スキップ処理
      renderer.renderSkip(playerM.nextPlayer);
      playerM.skip();
      // ターンを進める
      proceedUsualTurn();
    },
    gameOver() {
      // 両者置けない -> ゲーム終了
      turnCounter.increment();
      historyCon.pushData(turnCounter.current, playerM.currentPlayer, boardDataCon.current);
      renderer.render();
      renderer.renderResult();
    }
  };

  const manageGameProgression = () => {
    const progressionKey = decideProgressionKey();
    progressionKeyMap[progressionKey]();

    const nextPlayer = playerM.currentPlayer;

    // 次ターンのプレイヤーが bot の場合
    if (nextPlayer === bot.piece) proceedBotMove();
  };

  // async にすることで wait しやすくしておく
  const proceedBotMove = async () => {
    // 1. UI をロックして操作を受け付けないようにしておく
    setInteractive(false);

    // 2. 演出として bot のシンキングタイムをもうける
    await new Promise((r) => setTimeout(r, 700));

    // 待っている間に状況が変わっていないか最終確認（念のため）
    if (playerM.currentPlayer !== bot.piece) {
      setInteractive(true);
      return;
    }

    // 3. bot に考えさせる
    const botMove = bot.move();

    // bot の valid な手がない例外のガード
    if (botMove == null) {
      console.log('Error: Unintended case occured, No bot move!');
      return;
    }

    // 4. bot の考えた手をプレイヤーの入力と同じ関数で処理
    handleMove(botMove.coordinate, botMove.flipCandidates);

    // 5. UI のロックを解除
    setInteractive(true);
  };

  /**
   * Botの手番である限り、指定されたアクション(Undo/Redo)を繰り返すヘルパー
   * @param {() => boolean} actionFunc performUndo, performRedo
   */
  const skipBotTurns = (actionFunc) => {
    let turnPlayer = playerM.currentPlayer;

    while (bot.piece && turnPlayer === bot.piece) {
      const success = actionFunc();
      if (!success) break; // 履歴の端に達したら終了
      turnPlayer = playerM.currentPlayer;
    }
  };

  /**
   * 1ターン分のUndoを実行する内部関数
   * @returns {boolean} 成功したかどうか
   */
  const performUndo = () => {
    turnCounter.decrement();
    const dataToLoad = historyCon.getData(turnCounter.current);

    if (dataToLoad === null) {
      turnCounter.increment();
      console.log('Error: Faild to load data!');
      return false; // 失敗したら false を返す
    }

    boardDataCon.loadData(dataToLoad.boardData);
    playerM.setPlayer(dataToLoad.player);
    return true;
  };

  const onUndo = () => {
    // まず1回戻す
    if (!performUndo()) return;

    skipBotTurns(performUndo);

    renderer.render();
  };

  /**
   * 1ターン分のRedoを実行する内部関数
   * @returns {boolean} 成功したかどうか
   */
  const performRedo = () => {
    turnCounter.increment();
    const dataToLoad = historyCon.getData(turnCounter.current);

    if (dataToLoad === null) {
      turnCounter.decrement();
      console.log('Error: Faild to load data!');
      return false; // 失敗したら false を返す
    }

    boardDataCon.loadData(dataToLoad.boardData);
    playerM.setPlayer(dataToLoad.player);
    return true;
  };

  const onRedo = async () => {
    if (!performRedo()) return;

    skipBotTurns(performRedo);

    renderer.render();

    const progressionKey = decideProgressionKey();
    if (progressionKey === 'gameOver') {
      renderer.renderResult();
    }

    // Redoの結果、履歴が尽きて「Botの手番」で止まった場合のケア
    // (プレイヤーが打った直後の状態までRedoした場合など)
    const currentPlayer = playerM.currentPlayer;
    if (bot.piece && currentPlayer === bot.piece) {
      // Botの思考ルーチンをキックする
      await proceedBotMove();
    }
  };

  const initGame = () => {
    boardDataCon.init();
    historyCon.init();
    turnCounter.init();
    playerM.resetSkip();

    // 初期状態を履歴配列の0番目に保存
    historyCon.pushData(turnCounter.current, playerM.currentPlayer, boardDataCon.current);

    renderer.render();
  };

  return {
    initGame,

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

      const undoButton = document.getElementById('undo-button');
      const redoButton = document.getElementById('redo-button');
      if (undoButton === null || redoButton === null) {
        console.log('Error: Not found undo or redo button on setting up event listener');
        return;
      }

      table.addEventListener('click', (e) => {
        if (isInteractive === false) {
          console.log('Ignored input: currently processing bot turn.');
          return;
        }

        const target = e.target;
        if (target == null || target instanceof HTMLElement === false) return;

        const td = target.closest('td');
        if (td == null) return;

        const tr = td.parentElement;
        if (tr == null || tr instanceof HTMLTableRowElement === false) return;

        const r = tr.rowIndex;
        const c = td.cellIndex;

        handleMove({ r, c });
      });

      restartButton.addEventListener('click', runIfInteractive(initGame));
      undoButton.addEventListener('click', runIfInteractive(onUndo));
      redoButton.addEventListener('click', runIfInteractive(onRedo));
    }
  };
};

document.addEventListener('DOMContentLoaded', () => {
  const boardDataCon = createBoardDataController();
  const historyCon = createHistoryController();
  const turnCounter = createTurnCounter();

  // DI (Dependency Injection 依存性の注入) して使う
  const playerM = createPlayerManager(turnCounter);

  // DI (Dependency Injection 依存性の注入) して使う
  const renderer = createRenderer({ boardDataCon, turnCounter, historyCon, playerM });
  if (renderer === undefined) {
    console.log('Error: Failed to create renderer!');
    return;
  }

  // DI (Dependency Injection 依存性の注入) して使う
  const moveRules = createMoveRules(boardDataCon);

  const bot = createBot(moveRules);

  // DI (Dependency Injection 依存性の注入) して使う
  const othelloCon = createOthelloController({
    boardDataCon,
    historyCon,
    turnCounter,
    renderer,
    moveRules,
    playerM,
    bot
  });

  if (othelloCon == null) {
    console.log('Error: Failed to construct Othello controller!');
    return;
  }

  othelloCon.initGame();
  othelloCon.setupEventListeners();
});
