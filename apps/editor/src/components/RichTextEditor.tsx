import { useEffect, useRef } from 'react';
import { richToHtml, type Block, type Mark, type RichText, type Span } from '@studio/core';

interface Props {
  value: RichText | undefined;
  onChange: (value: RichText) => void;
  placeholder?: string;
}

/**
 * A small structured-text engine: the DOM is only a view. Every edit is parsed
 * back into blocks + spans with marks, which is what the document stores.
 */
export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const json = JSON.stringify(value ?? { blocks: [] });
    if (json === lastEmitted.current) return;
    lastEmitted.current = json;
    if (document.activeElement === el) return; // don't clobber the caret while typing
    el.innerHTML = richToHtml(value) || '<p><br></p>';
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const rt = parseDom(el);
    const json = JSON.stringify(rt);
    if (json === lastEmitted.current) return;
    lastEmitted.current = json;
    onChange(rt);
  };

  const onInput = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(emit, 250);
  };

  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onInput();
  };

  const link = () => {
    const url = window.prompt('Link URL');
    if (url) cmd('createLink', url);
  };

  return (
    <div className="rte">
      <div className="rte-bar" onMouseDown={(e) => e.preventDefault()}>
        <button onClick={() => cmd('formatBlock', 'p')}>P</button>
        <button onClick={() => cmd('formatBlock', 'h1')}>H1</button>
        <button onClick={() => cmd('formatBlock', 'h2')}>H2</button>
        <button onClick={() => cmd('formatBlock', 'h3')}>H3</button>
        <button onClick={() => cmd('bold')}>
          <b>B</b>
        </button>
        <button onClick={() => cmd('italic')}>
          <i>I</i>
        </button>
        <button onClick={() => cmd('underline')}>
          <u>U</u>
        </button>
        <button onClick={() => cmd('insertUnorderedList')}>• List</button>
        <button onClick={link}>Link</button>
      </div>
      <div
        ref={ref}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={onInput}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          onInput();
        }}
      />
    </div>
  );
}

function parseDom(root: HTMLElement): RichText {
  const blocks: Block[] = [];
  const pushText = (spans: Span[], text: string, marks: Mark) => {
    if (!text) return;
    const last = spans[spans.length - 1];
    if (last && sameMarks(last.marks, marks)) last.text += text;
    else spans.push(Object.keys(marks).length ? { text, marks: { ...marks } } : { text });
  };
  const inline = (node: Node, spans: Span[], marks: Mark) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(spans, node.textContent ?? '', marks);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      pushText(spans, '\n', marks);
      return;
    }
    const next: Mark = { ...marks };
    if (tag === 'B' || tag === 'STRONG' || (el.style.fontWeight && Number(el.style.fontWeight) >= 600)) next.bold = true;
    if (tag === 'I' || tag === 'EM' || el.style.fontStyle === 'italic') next.italic = true;
    if (tag === 'U' || el.style.textDecoration.includes('underline')) next.underline = true;
    if (tag === 'CODE') next.code = true;
    if (tag === 'A') next.link = el.getAttribute('href') ?? undefined;
    for (const child of Array.from(el.childNodes)) inline(child, spans, next);
  };
  const block = (el: HTMLElement) => {
    const tag = el.tagName;
    let type: Block['type'] = 'paragraph';
    let level: Block['level'];
    if (/^H[1-4]$/.test(tag)) {
      type = 'heading';
      level = Number(tag[1]) as Block['level'];
    } else if (tag === 'LI') type = 'list-item';
    const spans: Span[] = [];
    for (const child of Array.from(el.childNodes)) inline(child, spans, {});
    blocks.push({ type, level, spans: spans.length ? spans : [{ text: '' }] });
  };
  const loose: Span[] = [];
  const flushLoose = () => {
    if (loose.length) {
      blocks.push({ type: 'paragraph', spans: [...loose] });
      loose.length = 0;
    }
  };
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        flushLoose();
        for (const li of Array.from(el.children)) block(li as HTMLElement);
        continue;
      }
      if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/.test(el.tagName)) {
        flushLoose();
        block(el);
        continue;
      }
    }
    inline(child, loose, {});
  }
  flushLoose();
  if (!blocks.length) blocks.push({ type: 'paragraph', spans: [{ text: '' }] });
  return { blocks: blocks.map((b) => ({ ...b, spans: b.spans.map((s) => ({ ...s, text: s.text.replace(/ /g, ' ') })) })) };
}

function sameMarks(a: Mark | undefined, b: Mark): boolean {
  const x = a ?? {};
  return !!x.bold === !!b.bold && !!x.italic === !!b.italic && !!x.underline === !!b.underline && !!x.code === !!b.code && (x.link ?? '') === (b.link ?? '');
}
