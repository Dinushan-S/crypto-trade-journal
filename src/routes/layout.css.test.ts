// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The component classes in layout.css were extracted from repeated inline
 * `style="…"` strings. This asserts each class still declares exactly what the
 * inline string did — same properties, same values. If someone edits a class
 * and drifts from the original, this fails.
 */

const ORIGINALS: Record<string, string> = {
	card: 'background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;',
	'card-flush':
		'background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;',
	page: 'padding:1.5rem;max-width:900px;',
	'page-header':
		'display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;',
	table: 'width:100%;border-collapse:collapse;font-size:0.8125rem;',
	th: 'padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;',
	td: 'padding:0.5rem 0.75rem;',
	'td-mono': "padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;",
	'thead-row': 'background:var(--bg);border-bottom:1px solid var(--border);',
	'row-divider': 'border-bottom:1px solid var(--border);',
	'section-label':
		'display:block;font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;',
	'field-label':
		'display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;',
	'form-label':
		'display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;',
	'stat-value':
		"font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);",
	'muted-sm': 'font-size:0.8rem;color:var(--text-muted);',
	'muted-xs': 'font-size:0.75rem;color:var(--text-muted);',
	input:
		'padding:0.5rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;',
	'input-inline':
		'padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--accent);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;font-family:inherit;',
	'input-wide':
		'width:100%;padding:0.625rem 0.875rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;',
	textarea:
		'width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;',
	'computed-field':
		"padding:0.5rem 0.75rem;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:0.5rem;color:var(--accent);font-size:0.875rem;width:100%;box-sizing:border-box;font-family:'JetBrains Mono',monospace;",
	'btn-ghost':
		'padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;',
	'scroll-x': 'overflow-x:auto;',
	'span-full': 'grid-column:1/-1;',
	'form-label-lg':
		'display:block;font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:0.375rem;',
	'field-label-tight':
		'font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;',
	'link-muted': 'color:var(--text-muted);text-decoration:none;font-size:0.875rem;',
	'input-sm':
		'padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;',
	'textarea-lg':
		'width:100%;padding:0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;line-height:1.5;',
	'stat-value-lg':
		"font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--text-primary);"
};

/** "a: b; c: d;" -> [["a","b"], ["c","d"]], whitespace and quote style normalised. */
const declarations = (block: string): [string, string][] =>
	block
		.split(';')
		.map((d) => d.trim())
		.filter(Boolean)
		.map((d) => {
			const i = d.indexOf(':');
			const prop = d.slice(0, i).trim();
			const value = d
				.slice(i + 1)
				.trim()
				.replace(/\s*,\s*/g, ',')
				.replace(/\s*\/\s*/g, '/')
				.replace(/"/g, "'")
				.replace(/\s+/g, ' ');
			return [prop, value] as [string, string];
		});

const css = readFileSync(new URL('./layout.css', import.meta.url), 'utf8');

const ruleFor = (cls: string): string => {
	const m = css.match(new RegExp(`(?:^|\\n)\\.${cls.replace(/-/g, '\\-')}\\s*\\{([^}]*)\\}`));
	if (!m) throw new Error(`.${cls} not found in layout.css`);
	return m[1];
};

describe('layout.css component classes match the inline styles they replaced', () => {
	for (const [cls, original] of Object.entries(ORIGINALS)) {
		it(`.${cls}`, () => {
			expect(declarations(ruleFor(cls))).toEqual(declarations(original));
		});
	}
});
