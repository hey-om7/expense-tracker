import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VestorLogo from '../ui/VestorLogo';
import LegalLinks from './LegalLinks';
import { operator } from '../../legal/operator';

const Block = ({ block }) => {
  if (block.h) return <h3 className="legal-h3">{block.h}</h3>;
  if (block.p) return <p className="legal-p">{block.p}</p>;
  if (block.note) {
    return (
      <p className="legal-note">
        <span className="material-symbols-outlined legal-note__icon" aria-hidden="true">info</span>
        <span>{block.note}</span>
      </p>
    );
  }
  if (block.ul) {
    return (
      <ul className="legal-ul">
        {block.ul.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }
  if (block.table) {
    const { head, rows } = block.table;
    return (
      // Tables become stacked rows on narrow screens (see .legal-table in index.css).
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  i === 0
                    ? <th key={i} scope="row" data-label={head[i]}>{cell}</th>
                    : <td key={i} data-label={head[i]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
};

/**
 * Renders a legal document (see src/legal/*). Public page: works signed in or out.
 * Desktop: sticky contents list beside a narrow reading column. Mobile: one column
 * with a collapsible contents list.
 */
const LegalDocument = ({ doc, other }) => {
  const [active, setActive] = useState(doc.sections[0]?.id);

  useEffect(() => {
    document.title = `${doc.title} | Vestor`;
    window.scrollTo(0, 0);
  }, [doc.title]);

  // Highlight the section being read in the contents list.
  useEffect(() => {
    const els = doc.sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [doc.sections]);

  const toc = (
    <ol className="legal-toc">
      {doc.sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} className="legal-toc__link">
            <span className="legal-toc__num">{String(i + 1).padStart(2, '0')}</span>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="legal-topbar">
        <div className="legal-container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <VestorLogo className="w-8 h-8" />
            <span className="font-headline font-extrabold text-lg tracking-tight">Vestor</span>
          </Link>
          <Link to={other.to} className="legal-switch">
            {other.label}
            <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </header>

      <main className="legal-container pb-20">
        <div className="legal-hero">
          <p className="legal-eyebrow">Legal</p>
          <h1 className="legal-title">{doc.title}</h1>
          <p className="legal-meta">Effective {doc.effectiveDate}</p>
        </div>

        <div className="legal-grid">
          <aside className="legal-aside" aria-label="Contents">
            <p className="legal-aside__label">On this page</p>
            {toc}
          </aside>

          <article className="legal-body">
            {operator.draft && (
              <p className="legal-draft" role="note">
                <span className="material-symbols-outlined text-lg shrink-0" aria-hidden="true">edit_note</span>
                <span>Draft pending review. Items in [brackets] still need to be filled in by Vestor's operator, and this text has not yet been reviewed by a lawyer.</span>
              </p>
            )}

            <p className="legal-intro">{doc.intro}</p>

            <section className="legal-summary" aria-labelledby="in-short">
              <h2 id="in-short" className="legal-summary__title">In short</h2>
              <ul>
                {doc.summary.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </section>

            <details className="legal-mobile-toc">
              <summary>Contents</summary>
              {toc}
            </details>

            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="legal-h2">
                  <span className="legal-h2__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </h2>
                {s.blocks.map((b, j) => <Block key={j} block={b} />)}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t border-outline/10">
        <div className="legal-container py-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-on-surface-variant">© {new Date().getFullYear()} Vestor</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
};

export default LegalDocument;
