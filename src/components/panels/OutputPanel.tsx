import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Icons } from '@/components/icons';
import { tokenize } from '@/lib/tokenize';
import type { MockFile } from '@/types';

type CopyKey = 'b64' | 'url' | 'pic' | null;

interface OutputPanelProps {
  file: MockFile;
}

export function OutputPanel({ file }: OutputPanelProps) {
  const [copied, setCopied] = useState<CopyKey>(null);

  const copy = (key: Exclude<CopyKey, null>, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100);
  };

  const targetMime = file.target === 'svg' ? 'svg+xml' : file.target;
  const b64 =
    'data:image/' + targetMime +
    ';base64,iVBORw0KGgoAAAANSUhEUgAAAuwAAAH0CAYAAACGGSAyAAAAGXRFWHRT…';
  const urlEnc =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor'%3E%3Cpath d='M5 12h14'/%3E%3C/svg%3E\")";
  const baseName = file.name.replace(/\.\w+$/, '');
  const picture = `<picture>
  <source type="image/avif"
          srcset="img/${baseName}-800.avif 800w,
                  img/${baseName}-1600.avif 1600w" />
  <source type="image/webp"
          srcset="img/${baseName}-800.webp 800w,
                  img/${baseName}-1600.webp 1600w" />
  <img src="img/${baseName}-1600.jpg"
       width="1600" height="1067"
       sizes="(min-width: 1024px) 50vw, 100vw"
       loading="lazy" decoding="async" alt="" />
</picture>`;

  return (
    <>
      <Section title="Data URI · Base64">
        <div className="code-row">
          <span className="lbl">{'<img src="…">'}</span>
          <button
            className={'copy-btn ' + (copied === 'b64' ? 'ok' : '')}
            onClick={() => copy('b64', b64)}
          >
            {copied === 'b64' ? <Icons.Check size={11} /> : <Icons.Copy size={11} />}
            {copied === 'b64' ? 'copied' : 'copy'}
          </button>
        </div>
        <pre className="code">
          <span className="tok-key">data:image/{file.target}</span>
          ;<span className="tok-attr">base64</span>,
          <span className="tok-str">
            iVBORw0KGgoAAAANSUhEUgAAAuwAAAH0CAYAAACGGSAyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA…
          </span>
        </pre>
      </Section>

      <Section title="Data URI · URL-encoded">
        <div className="code-row">
          <span className="lbl">CSS background</span>
          <button
            className={'copy-btn ' + (copied === 'url' ? 'ok' : '')}
            onClick={() => copy('url', urlEnc)}
          >
            {copied === 'url' ? <Icons.Check size={11} /> : <Icons.Copy size={11} />}
            {copied === 'url' ? 'copied' : 'copy'}
          </button>
        </div>
        <pre className="code">
          background-image: <span className="tok-tag">url</span>(
          <span className="tok-str">
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12h14'/%3E%3C/svg%3E"
          </span>
          );
        </pre>
      </Section>

      <Section title="Responsive <picture>" badge={{ text: 'srcset', acc: true }}>
        <div className="code-row">
          <span className="lbl">HTML snippet</span>
          <button
            className={'copy-btn ' + (copied === 'pic' ? 'ok' : '')}
            onClick={() => copy('pic', picture)}
          >
            {copied === 'pic' ? <Icons.Check size={11} /> : <Icons.Copy size={11} />}
            {copied === 'pic' ? 'copied' : 'copy'}
          </button>
        </div>
        <pre className="code" style={{ maxHeight: 200 }}>
          {picture.split('\n').map((line, i) => (
            <div key={i}>{tokenize(line)}</div>
          ))}
        </pre>
      </Section>
    </>
  );
}
