import type { MouseEvent } from 'react';

const URL_REGEX = /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export function LinkifiedText({ text }: { text: string }): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index!;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={start}
        href={url}
        className="linkified"
        onClick={handleLinkClick}
        title={url}
      >
        {url}
      </a>
    );

    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

function handleLinkClick(e: MouseEvent<HTMLAnchorElement>): void {
  e.preventDefault();
  e.stopPropagation();
  const url = e.currentTarget.href;
  window.kanbanApi.openExternal(url);
}
