'use client';

import { useLayoutEffect, useState } from 'react';

type Link = { id: string; x1: number; y1: number; x2: number; y2: number };

export default function CombatLines({
  revision,
  blocks,
}: {
  revision: number;
  blocks: { defender: string; attacker: string }[];
}) {
  const [links, setLinks] = useState<Link[]>([]);
  useLayoutEffect(() => {
    const update = () => {
      const root = document.querySelector<HTMLElement>('.arena');
      if (!root) return;
      setLinks(
        blocks.flatMap(({ defender, attacker }) => {
          const from = root.querySelector<HTMLElement>(`[data-card-target="${defender}"]`);
          const to = root.querySelector<HTMLElement>(`[data-card-target="${attacker}"]`);
          if (!from || !to) return [];
          const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
          return [{
            id: `${defender}-${attacker}`,
            x1: a.left + a.width / 2,
            y1: a.top + a.height / 2,
            x2: b.left + b.width / 2,
            y2: b.top + b.height / 2,
          }];
        }),
      );
    };
    update();
    addEventListener('resize', update);
    addEventListener('scroll', update, true);
    return () => {
      removeEventListener('resize', update);
      removeEventListener('scroll', update, true);
    };
  }, [revision, blocks]);
  if (!links.length) return null;
  return <svg className="combat-lines" aria-hidden="true">{links.map(line => <g key={line.id}><line className="combat-line-shadow" {...line}/><line className="combat-line" {...line}/></g>)}</svg>;
}
