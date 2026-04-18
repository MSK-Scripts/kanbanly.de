import React from 'react';

const MENTION_RE = /(@[a-z0-9_-]{3,20})/gi;

function renderText(text: string, currentUsername: string | null) {
  const parts = text.split(MENTION_RE);
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return part;
    const name = part.slice(1).toLowerCase();
    const isSelf =
      currentUsername !== null && name === currentUsername.toLowerCase();
    return (
      <span
        key={i}
        className={
          isSelf
            ? 'rounded px-1 py-0.5 text-[0.9em] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : 'text-violet-300 font-medium'
        }
      >
        {part}
      </span>
    );
  });
}

export function withMentions(
  children: React.ReactNode,
  currentUsername: string | null
): React.ReactNode {
  if (typeof children === 'string') {
    return renderText(children, currentUsername);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <React.Fragment key={i}>
        {withMentions(c, currentUsername)}
      </React.Fragment>
    ));
  }
  return children;
}
