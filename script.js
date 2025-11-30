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
 * 盤面データを管理するコントローラー
 * 責務: 現在の盤面の状態管理、石の配置、データの複製提供
 * @param {Object} [options]
 * @param {{row: number, col: number, piece: 'white' | 'black'}[]} [options.initialPieces]
 */
const createBoardDataController = ({ initialPieces = INITIAL_PIECES } = {}) => {
  /** @type {[] | BoardData} */
  let boardData = [];

  const init = () => {
    // 行ごとに新しい配列を作る（参照渡しを防ぐため）
    boardData = Array.from({ length: 8 }, () => Array(8).fill('empty'));

    initialPieces.forEach((obj) => {
      const { row, col, piece } = obj;
      boardData[row][col] = piece;
    });
  };

  /**
   * @param {number} row
   * @param {number} col
   * @returns {CellState | undefined}
   */
  const getCell = (row, col) => boardData[row][col];

  /**
   * @param {number} row
   * @param {number} col
   * @param {CellState} cellState
   */
  const setCell = (row, col, cellState) => {
    boardData[row][col] = cellState;
  };

  // 盤面全体のディープコピーを返す（履歴保存用）
  const clone = () => boardData.map((row) => [...row]);

  // 現在の盤面全体を取得（レンダリング用）
  const getBoard = () => boardData;

  /**
   * @param {BoardData} newData
   */
  const loadData = (newData) => {
    boardData = newData.map((row) => [...row]);
  };

  // 初回実行
  init();
  return { init, getCell, setCell, clone, getBoard, loadData };
};

/**
 * 履歴を管理するコントローラー
 * 責務: データの保存、過去データの提供
 * point: 保存するデータの中身（オセロか将棋か、など）には関心を持たせない
 */
const historyController = () => {
  /** @type {[] | BoardData[]} */
  let history = [];

  const init = () => {
    history = [];
  };

  /**
   * @param {number} turn
   * @returns {BoardData | null}
   */
  const getData = (turn) => history[turn] || null;

  /**
   * @param {number} turn
   * @param {BoardData} data
   */
  const pushData = (turn, data) => {
    if (history.length > turn) {
      history = history.slice(0, turn);
    }
    history[turn] = data;
  };

  const getLength = () => history.length;

  return { init, getData, pushData, getLength };
};

// ===== ここまでリファクタリング済み ======

/**
 * @param {HTMLTableElement} board
 * @param {HTMLElement} turnText
 *
 */
const createOthello = (board, turnText) => {
  // =======================
  // --- 状態管理 (State) ---
  // =======================
  let turn = 0;

  // =============================
  // --- 盤面操作 (Board Utils) ---
  // =============================
  /**
   * @param {number} row
   * @param {number} col
   * @returns {HTMLTableCellElement | undefined}
   */
  const getCell = (row, col) => {
    return board.rows[row]?.cells[col];
  };

  /**
   * @param {HTMLTableCellElement} cell
   * @returns {string}
   */
  const getPieceFromCell = (cell) => {
    return cell.textContent;
  };

  /**
   * @param {HTMLTableCellElement} cell
   * @param {string} text
   */
  const setPieceInCell = (cell, text) => {
    cell.textContent = text;
  };

  /**
   * @param {Piece} piece
   */
  const pieceLabel = (piece) => {
    return piece === blackPiece ? '黒' : '白';
  };

  /**
   * @param {Piece} piece
   */
  const updateTurnText = (piece) => {
    turnText.textContent = `${pieceLabel(piece)}の手番です`;
  };

  /**
   * @param {number} turn
   * @returns {Piece}
   */
  const getPieceByTurn = (turn) => {
    return turn % 2 === 0 ? blackPiece : whitePiece;
  };

  // =========================
  // --- ルール判定 (Rules) ---
  // =========================
  /**
   * 特定のセルに pieceToPlace を置いた場合に裏返る相手の石の配列を取得する関数
   * @param {Object} options
   * @param {number} options.startRow
   * @param {number} options.startCol
   * @param {string} options.pieceToPlace
   * @returns {HTMLTableCellElement[] | []}
   */
  const getFlipCandidates = ({ startRow, startCol, pieceToPlace }) => {
    const opponentPiece = pieceToPlace === blackPiece ? whitePiece : blackPiece;
    const flipCells = []; // 全方向で裏返せるセルを格納

    // 8 方向を走査 [*]
    for (let y = -1; y < 2; y++) {
      for (let x = -1; x < 2; x++) {
        if (x === 0 && y === 0) continue;

        const cellsInDirection = [];

        for (let dist = 1; ; dist++) {
          const checkingCell = getCell(startRow + y * dist, startCol + x * dist);

          // 盤外に出た: 走査終了
          if (checkingCell === undefined) break;

          const pieceInCheckingCell = getPieceFromCell(checkingCell);

          // 空のマスに当たった: 走査終了
          if (pieceInCheckingCell === '') break;

          if (pieceInCheckingCell === opponentPiece) {
            // 相手の石：候補として追加し、さらに奥へ走査継続
            cellsInDirection.push(checkingCell);
          } else if (pieceInCheckingCell === pieceToPlace) {
            // 自分の石：この方向の候補セルを flipCells に追加し、走査終了
            flipCells.push(...cellsInDirection);
            break;
          }
        }
      }
    }

    return flipCells;
  };

  /**
   * 石を裏返す処理。ひとつ以上裏返せる石があればそれを裏返し、ひとつも裏返せなければ何もしない。
   * 戻り値として、石を裏返せたか否かを返す。
   * @param {HTMLTableCellElement} elem
   * @returns {boolean}
   */
  const flipPiece = (elem) => {
    // @ts-ignore
    const rowIndex = elem.parentElement?.rowIndex;
    const cellIndex = elem.cellIndex;

    /** @type {boolean} */
    let result = false;

    const myPiece = getPieceByTurn(turn);

    const cellsToFlip = getFlipCandidates({ startRow: rowIndex, startCol: cellIndex, pieceToPlace: myPiece });

    if (cellsToFlip.length > 0) {
      // 1つでも裏返せる石があるなら
      for (const cell of cellsToFlip) {
        setPieceInCell(cell, myPiece);
      }
      setPieceInCell(elem, myPiece);
      result = true;
    }

    return result;
  };

  /**
   * 手番のプレイヤーが石を置けるマスがひとつでもあるか否かを判別する処理。
   * @param {Piece} pieceToPlace
   * @returns {boolean}
   */
  const hasValideMove = (pieceToPlace) => {
    // 盤面全体を走査
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = getCell(r, c);

        if (cell != null && getPieceFromCell(cell) !== '') continue;
        if (getFlipCandidates({ startRow: r, startCol: c, pieceToPlace }).length > 0) return true;
      }
    }

    return false;
  };

  // =============================
  // --- ゲーム制御 (Game Flow) ---
  // =============================
  const endGame = () => {
    alert('ゲーム終了！');
    const { blackScore, whiteScore } = Array.from(board.getElementsByTagName('td')).reduce(
      (acc, cell) => {
        const pieceInCell = getPieceFromCell(cell);
        if (pieceInCell === blackPiece) acc.blackScore++;
        if (pieceInCell === whitePiece) acc.whiteScore++;
        return acc;
      },
      { blackScore: 0, whiteScore: 0 }
    );

    const appendix = blackScore === whiteScore ? '引き分け！' : blackScore > whiteScore ? '黒の勝ち！' : '白の勝ち！';
    const msg = `黒: ${blackScore}, 白: ${whiteScore}\n` + `${appendix}`;

    turnText.textContent = msg;
  };

  /**
   * @param {PointerEvent} e
   */
  const handleClick = (e) => {
    const target = e.target;
    if (target instanceof HTMLTableCellElement === false || target.tagName !== 'TD' || target.textContent !== '')
      return;

    // ひとつも石を裏返せない手は無効
    if (!flipPiece(target)) return;

    // flipPiece(target) === true i.e. ひとつでも裏返せる石のある手を打ったなら
    // ターンを進める
    turn++;
    const nextPiece = getPieceByTurn(turn);
    const currentPiece = getPieceByTurn(turn - 1);

    // 次のプレイヤーが石を置ける場所があるか？
    // 1. 置ける場所がある: 通常のプレイフローで続行
    if (hasValideMove(nextPiece)) {
      updateTurnText(nextPiece);
      return;
    }

    // 2. 置ける場所がない -> スキップして続行 or ゲーム終了
    // 3. 現在のプレイヤーなら置ける場所がある: スキップして続行
    if (hasValideMove(currentPiece)) {
      alert(`${pieceLabel(nextPiece)}は置ける場所がありません！スキップします。`);
      turn++;
      updateTurnText(currentPiece);
      return;
    }

    // 4. 双方置ける場所がない: ゲーム終了
    endGame();
  };

  const initBoard = () => {
    const cell = '<td></td>';
    const row = `<tr>${cell.repeat(8)}</tr>`;
    board.insertAdjacentHTML('beforeend', row.repeat(8));
  };

  const restart = () => {
    turn = 0;
    board.innerHTML = '';
    initBoard();
    updateTurnText(blackPiece);
  };

  return {
    initBoard,
    handleClick,
    restart
  };
};

document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const turnText = document.getElementById('turn-text');
  const btnRestart = document.getElementById('btn-restart');

  if (
    !(board instanceof HTMLTableElement) ||
    !(turnText instanceof HTMLElement) ||
    !(btnRestart instanceof HTMLElement)
  )
    return;

  const othello = createOthello(board, turnText);
  othello.initBoard();
  board.addEventListener('click', (e) => othello.handleClick(e));
  btnRestart.addEventListener('click', () => othello.restart());
});
