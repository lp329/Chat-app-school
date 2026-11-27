import { useCallback, useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Delete } from 'lucide-react';

interface CamouflageCalculatorProps {
  onExit: () => void;
}

type Operator = '+' | '-' | '×' | '÷' | null;

interface HistoryEntry {
  expr: string;
  result: string;
}

function formatNumberDisplay(value: string): string {
  if (value === 'エラー') return value;
  const [intPart, decPart] = value.split('.');
  const isNeg = intPart.startsWith('-');
  const absInt = isNeg ? intPart.slice(1) : intPart;
  const formattedInt = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNeg ? '-' : '';
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
}

export function CamouflageCalculator({ onExit }: CamouflageCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([
    { expr: '12,800 × 1.1', result: '14,080' },
    { expr: '45,000 ÷ 12', result: '3,750' },
  ]);

  const lastAcClickRef = useRef<number>(0);

  const compute = (a: number, b: number, op: Operator): number | null => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? null : a / b;
    return b;
  };

  const inputDigit = useCallback(
    (digit: string) => {
      if (display === 'エラー') {
        setDisplay(digit);
        setWaitingForOperand(false);
        return;
      }
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay((prev) =>
          prev === '0' ? digit : prev.length >= 12 ? prev : prev + digit
        );
      }
    },
    [display, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand || display === 'エラー') {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay((prev) => `${prev}.`);
    }
  }, [display, waitingForOperand]);

  const handleClear = useCallback(() => {
    const now = Date.now();
    if (now - lastAcClickRef.current < 650) {
      lastAcClickRef.current = 0;
      onExit();
      return;
    }
    lastAcClickRef.current = now;
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression('');
  }, [onExit]);

  const handleToggleSign = useCallback(() => {
    if (display === '0' || display === 'エラー') return;
    setDisplay((prev) => (prev.startsWith('-') ? prev.slice(1) : `-${prev}`));
  }, [display]);

  const handlePercent = useCallback(() => {
    const num = parseFloat(display);
    if (Number.isNaN(num)) return;
    const res = Number((num / 100).toPrecision(10));
    setDisplay(String(res));
  }, [display]);

  const handleBackspace = useCallback(() => {
    if (waitingForOperand || display === 'エラー') return;
    setDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [display, waitingForOperand]);

  const performOperation = useCallback(
    (nextOp: Operator) => {
      const inputValue = parseFloat(display);
      if (Number.isNaN(inputValue)) return;

      if (storedValue === null) {
        setStoredValue(inputValue);
        setExpression(`${formatNumberDisplay(display)} ${nextOp}`);
      } else if (operator && !waitingForOperand) {
        const result = compute(storedValue, inputValue, operator);
        if (result === null || !Number.isFinite(result)) {
          setDisplay('エラー');
          setStoredValue(null);
          setOperator(null);
          setExpression('');
          setWaitingForOperand(true);
          return;
        }
        const rounded = String(Number(result.toPrecision(10)));
        setDisplay(rounded);
        setStoredValue(Number(rounded));
        setExpression(`${formatNumberDisplay(rounded)} ${nextOp}`);
      } else {
        setExpression(`${formatNumberDisplay(String(storedValue))} ${nextOp}`);
      }

      setWaitingForOperand(true);
      setOperator(nextOp);
    },
    [display, operator, storedValue, waitingForOperand]
  );

  const handleEquals = useCallback(() => {
    if (operator === null || storedValue === null) return;
    const inputValue = parseFloat(display);
    if (Number.isNaN(inputValue)) return;

    const result = compute(storedValue, inputValue, operator);
    if (result === null || !Number.isFinite(result)) {
      setDisplay('エラー');
      setStoredValue(null);
      setOperator(null);
      setExpression('');
      setWaitingForOperand(true);
      return;
    }

    const rounded = String(Number(result.toPrecision(10)));
    const fullExpr = `${formatNumberDisplay(String(storedValue))} ${operator} ${formatNumberDisplay(display)}`;
    setHistory((prev) =>
      [{ expr: fullExpr, result: formatNumberDisplay(rounded) }, ...prev].slice(0, 8)
    );
    setDisplay(rounded);
    setStoredValue(null);
    setOperator(null);
    setExpression(`${fullExpr} =`);
    setWaitingForOperand(true);
  }, [display, operator, storedValue]);

  // Keyboard support for realistic calculator behavior
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        inputDigit(e.key);
      } else if (e.key === '.') {
        inputDecimal();
      } else if (e.key === '+') {
        performOperation('+');
      } else if (e.key === '-') {
        performOperation('-');
      } else if (e.key === '*') {
        performOperation('×');
      } else if (e.key === '/') {
        e.preventDefault();
        performOperation('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleBackspace,
    handleClear,
    handleEquals,
    inputDecimal,
    inputDigit,
    performOperation,
  ]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#F2F2F7] dark:bg-[#141519] text-slate-900 dark:text-neutral-100 flex flex-col select-none">
      {/* Minimalist Standard Calculator Top Bar */}
      <header className="h-12 px-4 sm:px-6 bg-white/80 dark:bg-transparent border-b border-slate-200/90 dark:border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400">
          <span className="font-semibold text-slate-800 dark:text-neutral-200">標準電卓</span>
          <span aria-hidden="true">·</span>
          <span>計算メモ</span>
        </div>

        {/* Discreet return trigger in top-right */}
        <button
          type="button"
          onClick={onExit}
          title="元の画面に戻る（ACを2回連続クリックでも復帰）"
          aria-label="元の画面に戻る"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:text-neutral-600 dark:hover:text-neutral-300 dark:hover:bg-white/5 transition-colors"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Calculator Layout */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Calculator Keypad Unit */}
          <div className="md:col-span-7 rounded-3xl bg-white dark:bg-[#1c1e24] border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 shadow-xl shadow-slate-900/5 dark:shadow-2xl flex flex-col justify-between">
            {/* Screen */}
            <div className="mb-5 px-2 pt-2 pb-4 border-b border-slate-200/80 dark:border-white/5 text-right space-y-1.5">
              <div className="h-5 text-xs font-mono text-slate-400 dark:text-neutral-500 truncate">
                {expression || '\u00A0'}
              </div>
              <div className="text-4xl sm:text-5xl font-light font-mono tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
                {formatNumberDisplay(display)}
              </div>
            </div>

            {/* Keys Grid */}
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleClear}
                className="h-14 sm:h-15 rounded-2xl bg-[#E5E5EA] hover:bg-[#D8D8DF] dark:bg-[#2c303a] dark:hover:bg-[#353a46] active:scale-95 text-slate-900 dark:text-neutral-100 text-lg font-medium transition-all"
              >
                AC
              </button>
              <button
                type="button"
                onClick={handleToggleSign}
                className="h-14 sm:h-15 rounded-2xl bg-[#E5E5EA] hover:bg-[#D8D8DF] dark:bg-[#2c303a] dark:hover:bg-[#353a46] active:scale-95 text-slate-900 dark:text-neutral-100 text-lg font-medium transition-all"
              >
                +/-
              </button>
              <button
                type="button"
                onClick={handlePercent}
                className="h-14 sm:h-15 rounded-2xl bg-[#E5E5EA] hover:bg-[#D8D8DF] dark:bg-[#2c303a] dark:hover:bg-[#353a46] active:scale-95 text-slate-900 dark:text-neutral-100 text-lg font-medium transition-all"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => performOperation('÷')}
                className={`h-14 sm:h-15 rounded-2xl active:scale-95 text-xl font-medium transition-all ${
                  operator === '÷' && waitingForOperand
                    ? 'bg-amber-100 dark:bg-white text-amber-600 ring-1 ring-amber-400/60 dark:ring-0'
                    : 'bg-amber-500 hover:bg-amber-400 text-white'
                }`}
              >
                ÷
              </button>

              {['7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => inputDigit(d)}
                  className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-900 dark:text-white text-xl font-normal font-mono transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation('×')}
                className={`h-14 sm:h-15 rounded-2xl active:scale-95 text-xl font-medium transition-all ${
                  operator === '×' && waitingForOperand
                    ? 'bg-amber-100 dark:bg-white text-amber-600 ring-1 ring-amber-400/60 dark:ring-0'
                    : 'bg-amber-500 hover:bg-amber-400 text-white'
                }`}
              >
                ×
              </button>

              {['4', '5', '6'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => inputDigit(d)}
                  className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-900 dark:text-white text-xl font-normal font-mono transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation('-')}
                className={`h-14 sm:h-15 rounded-2xl active:scale-95 text-xl font-medium transition-all ${
                  operator === '-' && waitingForOperand
                    ? 'bg-amber-100 dark:bg-white text-amber-600 ring-1 ring-amber-400/60 dark:ring-0'
                    : 'bg-amber-500 hover:bg-amber-400 text-white'
                }`}
              >
                −
              </button>

              {['1', '2', '3'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => inputDigit(d)}
                  className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-900 dark:text-white text-xl font-normal font-mono transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation('+')}
                className={`h-14 sm:h-15 rounded-2xl active:scale-95 text-xl font-medium transition-all ${
                  operator === '+' && waitingForOperand
                    ? 'bg-amber-100 dark:bg-white text-amber-600 ring-1 ring-amber-400/60 dark:ring-0'
                    : 'bg-amber-500 hover:bg-amber-400 text-white'
                }`}
              >
                +
              </button>

              <button
                type="button"
                onClick={() => inputDigit('0')}
                className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-900 dark:text-white text-xl font-normal font-mono transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={inputDecimal}
                className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-900 dark:text-white text-xl font-normal font-mono transition-all"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="1文字削除"
                className="h-14 sm:h-15 rounded-2xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/80 dark:border-transparent dark:bg-[#242730] dark:hover:bg-[#2e323d] active:scale-95 text-slate-600 dark:text-neutral-300 flex items-center justify-center transition-all"
              >
                <Delete className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleEquals}
                className="h-14 sm:h-15 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white text-xl font-semibold transition-all"
              >
                =
              </button>
            </div>
          </div>

          {/* Calculation Tape Panel (Desktop) */}
          <aside className="hidden md:flex md:col-span-5 rounded-3xl bg-white/90 dark:bg-[#191b20] border border-slate-200/90 dark:border-white/5 shadow-sm dark:shadow-none p-5 flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/5 pb-3">
                <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">計算履歴</span>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                >
                  消去
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-neutral-600 py-8 text-center">
                  履歴はありません
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((item, idx) => (
                    <button
                      key={`${item.expr}_${idx}`}
                      type="button"
                      onClick={() => {
                        setDisplay(item.result.replace(/,/g, ''));
                        setWaitingForOperand(false);
                      }}
                      className="w-full text-right p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="text-[11px] font-mono text-slate-400 dark:text-neutral-500 truncate">
                        {item.expr} =
                      </div>
                      <div className="text-base font-mono tabular-nums text-slate-800 dark:text-neutral-200">
                        {item.result}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200/80 dark:border-white/5 text-[11px] text-slate-400 dark:text-neutral-600 leading-relaxed">
              標準電卓モード
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
