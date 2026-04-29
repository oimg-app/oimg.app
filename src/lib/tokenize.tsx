// Minimal HTML tokenizer for the <picture> snippet display.
// Returns React nodes (string fragments + spans with CSS class).

import { Fragment, type ReactNode } from 'react';

const TOKEN_RE = /(&lt;\/?[\w-]+|<\/?[\w-]+|\/?>|[\w-]+="[^"]*")/g;

export function tokenize(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let i = 0;
  let match: RegExpExecArray | null;
  let last = 0;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > last) parts.push(<Fragment key={`t${i++}`}>{line.slice(last, match.index)}</Fragment>);
    const tk = match[0];
    if (/^<\/?[\w-]+/.test(tk) || tk === '/>' || tk === '>') {
      parts.push(<span key={`t${i++}`} className="tok-tag">{tk}</span>);
    } else if (/^[\w-]+="[^"]*"/.test(tk)) {
      const eq = tk.indexOf('=');
      parts.push(<span key={`t${i++}`} className="tok-attr">{tk.slice(0, eq)}</span>);
      parts.push(<Fragment key={`t${i++}`}>=</Fragment>);
      parts.push(<span key={`t${i++}`} className="tok-str">{tk.slice(eq + 1)}</span>);
    } else {
      parts.push(<Fragment key={`t${i++}`}>{tk}</Fragment>);
    }
    last = match.index + tk.length;
  }
  // Reset lastIndex for next call (since the regex is module-level + global flag)
  TOKEN_RE.lastIndex = 0;
  if (last < line.length) parts.push(<Fragment key={`t${i++}`}>{line.slice(last)}</Fragment>);
  return parts;
}
