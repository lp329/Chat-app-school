import type {
  MiniGameId,
  MiniGameInvitePayload,
  MiniGameResultPayload,
} from '../types/chat';

export const GAME_INVITE_PREFIX = '__RL_GAME_INVITE__:';
export const GAME_RESULT_PREFIX = '__RL_GAME_RESULT__:';

export interface MiniGameMeta {
  id: MiniGameId;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  accentClass: string;
}

export const MINI_GAME_CATALOG: MiniGameMeta[] = [
  {
    id: 'reaction',
    title: '0.001秒 早押し反射神経バトル',
    shortTitle: '早押しバトル',
    badge: '3本先取',
    description:
      '赤から緑に変わった瞬間をタップ！フライングは即負けのスリリングな反射神経勝負。',
    accentClass:
      'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/35',
  },
  {
    id: 'draw_guess',
    title: 'リアルタイムお絵描き当てっこクイズ',
    shortTitle: 'お絵描きクイズ',
    badge: '全4ラウンド',
    description:
      '描き手と回答者を交互に交代！リアルタイムで浮かび上がるイラストからお題を当てよう。',
    accentClass:
      'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/35',
  },
  {
    id: 'reversi',
    title: 'リアルタイム・リバーシ（オセロ）',
    shortTitle: 'リバーシ',
    badge: '8×8対戦',
    description:
      '合法手ガイド＆自動パス判定付きの本格リバーシ。スマホでも誤タップしにくい快適操作。',
    accentClass:
      'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35',
  },
];

export function getMiniGameMeta(gameId: MiniGameId): MiniGameMeta {
  return (
    MINI_GAME_CATALOG.find((g) => g.id === gameId) || MINI_GAME_CATALOG[0]
  );
}

// --- E2EE-Compatible Structured Chat Card Encoders / Decoders ---

export function encodeGameInviteContent(
  payload: MiniGameInvitePayload
): string {
  return `${GAME_INVITE_PREFIX}${JSON.stringify(payload)}`;
}

export function encodeGameResultContent(
  payload: MiniGameResultPayload
): string {
  return `${GAME_RESULT_PREFIX}${JSON.stringify(payload)}`;
}

export type ParsedMiniGameCard =
  | { kind: 'invite'; data: MiniGameInvitePayload }
  | { kind: 'result'; data: MiniGameResultPayload };

export function parseMiniGameCardContent(
  content: string | null | undefined
): ParsedMiniGameCard | null {
  if (!content || typeof content !== 'string') return null;

  if (content.startsWith(GAME_INVITE_PREFIX)) {
    try {
      const parsed = JSON.parse(
        content.slice(GAME_INVITE_PREFIX.length)
      ) as Partial<MiniGameInvitePayload>;
      if (
        parsed &&
        typeof parsed.matchId === 'string' &&
        (parsed.gameId === 'reaction' ||
          parsed.gameId === 'draw_guess' ||
          parsed.gameId === 'reversi') &&
        parsed.host &&
        typeof parsed.host.userId === 'string'
      ) {
        return {
          kind: 'invite',
          data: {
            matchId: parsed.matchId,
            gameId: parsed.gameId,
            host: {
              userId: parsed.host.userId,
              nickname: parsed.host.nickname || 'ゲスト',
              avatar: parsed.host.avatar ?? null,
              avatarColor: parsed.host.avatarColor ?? null,
            },
            createdAt: parsed.createdAt || new Date().toISOString(),
          },
        };
      }
    } catch {
      return null;
    }
  }

  if (content.startsWith(GAME_RESULT_PREFIX)) {
    try {
      const parsed = JSON.parse(
        content.slice(GAME_RESULT_PREFIX.length)
      ) as Partial<MiniGameResultPayload>;
      if (
        parsed &&
        typeof parsed.matchId === 'string' &&
        (parsed.gameId === 'reaction' ||
          parsed.gameId === 'draw_guess' ||
          parsed.gameId === 'reversi') &&
        typeof parsed.headline === 'string'
      ) {
        return {
          kind: 'result',
          data: {
            matchId: parsed.matchId,
            gameId: parsed.gameId,
            headline: parsed.headline,
            detail: typeof parsed.detail === 'string' ? parsed.detail : '',
            winnerName: parsed.winnerName ?? null,
            createdAt: parsed.createdAt || new Date().toISOString(),
          },
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function getMiniGameCardPreviewText(content: string): string | null {
  const parsed = parseMiniGameCardContent(content);
  if (!parsed) return null;
  if (parsed.kind === 'invite') {
    const meta = getMiniGameMeta(parsed.data.gameId);
    return `🎮 ${meta.shortTitle}の対戦募集`;
  }
  return parsed.data.headline;
}

// --- Draw & Guess Dictionary (55 Intuitive Japanese Prompts) ---

export interface DrawGuessPrompt {
  id: string;
  word: string;
  aliases: string[];
}

export const DRAW_GUESS_PROMPTS: DrawGuessPrompt[] = [
  { id: 'takoyaki', word: 'たこ焼き', aliases: ['たこ焼き', 'たこやき', 'タコヤキ', '蛸焼き'] },
  { id: 'ramen', word: 'ラーメン', aliases: ['ラーメン', 'らーめん', '拉麺'] },
  { id: 'sushi', word: 'お寿司', aliases: ['お寿司', 'すし', 'おすし', '寿司', 'スシ', 'オスシ'] },
  { id: 'hamburger', word: 'ハンバーガー', aliases: ['ハンバーガー', 'はんばーがー', 'バーガー', 'ばーがー'] },
  { id: 'omurice', word: 'オムライス', aliases: ['オムライス', 'おむらいす'] },
  { id: 'curry', word: 'カレーライス', aliases: ['カレーライス', 'かれーらいす', 'カレー', 'かれー'] },
  { id: 'shortcake', word: 'ショートケーキ', aliases: ['ショートケーキ', 'しょーとけーき', 'ケーキ', 'けーき'] },
  { id: 'apple', word: 'りんご', aliases: ['りんご', 'リンゴ', '林檎'] },
  { id: 'banana', word: 'バナナ', aliases: ['バナナ', 'ばなな'] },
  { id: 'watermelon', word: 'スイカ', aliases: ['スイカ', 'すいか', '西瓜'] },
  { id: 'smartphone', word: 'スマホ', aliases: ['スマホ', 'すまほ', 'スマートフォン', 'すまーとふぉん', '携帯', 'けいたい'] },
  { id: 'earphone', word: 'イヤホン', aliases: ['イヤホン', 'いやほん', 'イヤフォン', 'ヘッドホン', 'へっどほん'] },
  { id: 'gameconsole', word: 'ゲーム機', aliases: ['ゲーム機', 'げーむき', 'ゲーム', 'げーむ', 'コントローラー', 'スイッチ'] },
  { id: 'blackboard', word: '黒板', aliases: ['黒板', 'こくばん', 'コクバン'] },
  { id: 'randoseru', word: 'ランドセル', aliases: ['ランドセル', 'らんどせる'] },
  { id: 'pencil', word: '鉛筆', aliases: ['鉛筆', 'えんぴつ', 'エンピツ'] },
  { id: 'scissors', word: 'ハサミ', aliases: ['ハサミ', 'はさみ', '鋏'] },
  { id: 'umbrella', word: '傘', aliases: ['傘', 'かさ', 'カサ'] },
  { id: 'glasses', word: 'メガネ', aliases: ['メガネ', 'めがね', '眼鏡'] },
  { id: 'clock', word: '時計', aliases: ['時計', 'とけい', 'トケイ', '腕時計', 'うでどけい'] },
  { id: 'soccer', word: 'サッカーボール', aliases: ['サッカーボール', 'さっかーぼーる', 'サッカー', 'さっかー'] },
  { id: 'baseball', word: '野球', aliases: ['野球', 'やきゅう', 'ヤキュウ', '野球ボール', 'バット'] },
  { id: 'basketball', word: 'バスケットボール', aliases: ['バスケットボール', 'ばすけっとぼーる', 'バスケ', 'ばすけ'] },
  { id: 'tennis', word: 'テニス', aliases: ['テニス', 'てにす', 'テニスラケット'] },
  { id: 'bicycle', word: '自転車', aliases: ['自転車', 'じてんしゃ', 'ジテンシャ', 'チャリ', 'ちゃり'] },
  { id: 'shinkansen', word: '新幹線', aliases: ['新幹線', 'しんかんせん', 'シンカンセン', '電車', 'でんしゃ'] },
  { id: 'airplane', word: '飛行機', aliases: ['飛行機', 'ひこうき', 'ヒコウキ'] },
  { id: 'policecar', word: 'パトカー', aliases: ['パトカー', 'ぱとかー', '警察車両'] },
  { id: 'ambulance', word: '救急車', aliases: ['救急車', 'きゅうきゅうしゃ', 'キュウキュウシャ'] },
  { id: 'rocket', word: 'ロケット', aliases: ['ロケット', 'ろけっと', '宇宙船'] },
  { id: 'panda', word: 'パンダ', aliases: ['パンダ', 'ぱんだ'] },
  { id: 'cat', word: 'ねこ', aliases: ['ねこ', 'ネコ', '猫'] },
  { id: 'dog', word: 'いぬ', aliases: ['いぬ', 'イヌ', '犬'] },
  { id: 'penguin', word: 'ペンギン', aliases: ['ペンギン', 'ぺんぎん'] },
  { id: 'rabbit', word: 'うさぎ', aliases: ['うさぎ', 'ウサギ', '兎'] },
  { id: 'lion', word: 'ライオン', aliases: ['ライオン', 'らいおん'] },
  { id: 'giraffe', word: 'キリン', aliases: ['キリン', 'きりん', '麒麟'] },
  { id: 'shark', word: 'サメ', aliases: ['サメ', 'さめ', '鮫'] },
  { id: 'octopus', word: 'タコ', aliases: ['タコ', 'たこ', '蛸'] },
  { id: 'beetle', word: 'カブトムシ', aliases: ['カブトムシ', 'かぶとむし', '兜虫', 'かぶと虫'] },
  { id: 'mtfuji', word: '富士山', aliases: ['富士山', 'ふじさん', 'フジサン', 'ふじ山'] },
  { id: 'sun', word: '太陽', aliases: ['太陽', 'たいよう', 'タイヨウ', 'おひさま'] },
  { id: 'shootingstar', word: '流れ星', aliases: ['流れ星', 'ながれぼし', 'ナガレボシ', '流星', 'ほし', '星'] },
  { id: 'snowman', word: '雪だるま', aliases: ['雪だるま', 'ゆきだるま', 'ユキダルマ', '雪ダルマ'] },
  { id: 'ghost', word: 'おばけ', aliases: ['おばけ', 'オバケ', 'お化け', '幽霊', 'ゆうれい'] },
  { id: 'santa', word: 'サンタクロース', aliases: ['サンタクロース', 'さんたくろーす', 'サンタ', 'さんた'] },
  { id: 'guitar', word: 'ギター', aliases: ['ギター', 'ぎたー'] },
  { id: 'piano', word: 'ピアノ', aliases: ['ピアノ', 'ぴあの'] },
  { id: 'microphone', word: 'マイク', aliases: ['マイク', 'まいく'] },
  { id: 'crown', word: '王冠', aliases: ['王冠', 'おうかん', 'オウカン', 'クラウン'] },
  { id: 'pizza', word: 'ピザ', aliases: ['ピザ', 'ぴざ'] },
  { id: 'icecream', word: 'アイスクリーム', aliases: ['アイスクリーム', 'あいすくりーむ', 'アイス', 'あいす', 'ソフトクリーム'] },
  { id: 'rainbow', word: '虹', aliases: ['虹', 'にじ', 'ニジ'] },
  { id: 'fireworks', word: '花火', aliases: ['花火', 'はなび', 'ハナビ'] },
  { id: 'grapes', word: 'ぶどう', aliases: ['ぶどう', 'ブドウ', '葡萄'] },
];

/**
 * Normalizes Japanese text (Katakana -> Hiragana, strips spaces/punctuation/lowercase)
 * so variations like 「ねこ」「ネコ」「猫」 match accurately.
 */
export function normalizeJapaneseAnswer(input: string): string {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/[\s　!！?？。、.,・「」『』()（）\-ー_]/g, '');

  let result = '';
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    // Katakana (ァ-ヶ: 0x30A1..0x30F6) -> Hiragana (ぁ-ゖ: 0x3041..0x3096)
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCharCode(code - 0x60);
    } else {
      result += trimmed[i];
    }
  }
  return result;
}

export function isDrawGuessCorrect(
  guess: string,
  prompt: DrawGuessPrompt
): boolean {
  const normGuess = normalizeJapaneseAnswer(guess);
  if (!normGuess) return false;
  if (normGuess === normalizeJapaneseAnswer(prompt.word)) return true;
  return prompt.aliases.some(
    (alias) => normalizeJapaneseAnswer(alias) === normGuess
  );
}

export function pickRandomDrawPrompt(excludeIds: string[]): DrawGuessPrompt {
  const pool = DRAW_GUESS_PROMPTS.filter((p) => !excludeIds.includes(p.id));
  const list = pool.length > 0 ? pool : DRAW_GUESS_PROMPTS;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

export function findDrawPromptById(id?: string): DrawGuessPrompt | undefined {
  if (!id) return undefined;
  return DRAW_GUESS_PROMPTS.find((p) => p.id === id);
}

// --- Complete 8x8 Reversi (Othello) Engine ---

export type ReversiCell = 0 | 1 | 2; // 0 = empty, 1 = Black (Host), 2 = White (Guest)

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function createInitialReversiBoard(): ReversiCell[] {
  const board: ReversiCell[] = new Array<ReversiCell>(64).fill(0);
  // Standard center 4 discs
  board[3 * 8 + 3] = 2; // D4 White
  board[3 * 8 + 4] = 1; // E4 Black
  board[4 * 8 + 3] = 1; // D5 Black
  board[4 * 8 + 4] = 2; // E5 White
  return board;
}

export function countReversiDiscs(board: number[]): {
  black: number;
  white: number;
} {
  let black = 0;
  let white = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === 1) black++;
    else if (board[i] === 2) white++;
  }
  return { black, white };
}

export function getFlippableIndices(
  board: number[],
  index: number,
  player: 1 | 2
): number[] {
  if (index < 0 || index >= 64 || board[index] !== 0) return [];
  const opponent: 1 | 2 = player === 1 ? 2 : 1;
  const startRow = Math.floor(index / 8);
  const startCol = index % 8;
  const flipped: number[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let r = startRow + dr;
    let c = startCol + dc;
    const line: number[] = [];

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const idx = r * 8 + c;
      const cell = board[idx];
      if (cell === opponent) {
        line.push(idx);
      } else if (cell === player) {
        if (line.length > 0) {
          flipped.push(...line);
        }
        break;
      } else {
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return flipped;
}

export function getValidReversiMoves(
  board: number[],
  player: 1 | 2
): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === 0 && getFlippableIndices(board, i, player).length > 0) {
      moves.push(i);
    }
  }
  return moves;
}

export interface ReversiMoveOutcome {
  board: ReversiCell[];
  flipped: number[];
  nextTurn: 1 | 2;
  passedPlayer: 1 | 2 | null;
  gameOver: boolean;
  blackCount: number;
  whiteCount: number;
  winnerSide: 0 | 1 | 2;
}

export function applyReversiMove(
  board: number[],
  index: number,
  player: 1 | 2
): ReversiMoveOutcome | null {
  const flipped = getFlippableIndices(board, index, player);
  if (flipped.length === 0) return null;

  const nextBoard = board.slice() as ReversiCell[];
  nextBoard[index] = player;
  for (const idx of flipped) {
    nextBoard[idx] = player;
  }

  const opponent: 1 | 2 = player === 1 ? 2 : 1;
  const opponentMoves = getValidReversiMoves(nextBoard, opponent);
  const selfMoves = getValidReversiMoves(nextBoard, player);

  let nextTurn: 1 | 2 = opponent;
  let passedPlayer: 1 | 2 | null = null;
  let gameOver = false;

  if (opponentMoves.length > 0) {
    nextTurn = opponent;
  } else if (selfMoves.length > 0) {
    nextTurn = player;
    passedPlayer = opponent;
  } else {
    gameOver = true;
    nextTurn = opponent;
  }

  const { black, white } = countReversiDiscs(nextBoard);
  const winnerSide: 0 | 1 | 2 =
    black > white ? 1 : white > black ? 2 : 0;

  return {
    board: nextBoard,
    flipped,
    nextTurn,
    passedPlayer,
    gameOver,
    blackCount: black,
    whiteCount: white,
    winnerSide,
  };
}
