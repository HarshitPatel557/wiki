import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import tippy, { delegate } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

export const MentionPluginKey = new PluginKey('mention');
export const MentionTooltipPluginKey = new PluginKey('mentionTooltip');

function cleanTooltipValue(val) {
	if (!val || val === 'null' || val === 'undefined') return '';
	return String(val).trim();
}

export function createMentionTooltipContent(reference) {
	if (!reference) return null;

	const name = cleanTooltipValue(
		reference.getAttribute('data-label') ||
		reference.textContent?.replace(/^@/, '')
	);
	const designation = cleanTooltipValue(reference.getAttribute('data-designation'));
	const email = cleanTooltipValue(reference.getAttribute('data-id'));

	const fields = [
		{ label: 'Name', value: name },
		{ label: 'Designation', value: designation },
		{ label: 'Email', value: email },
	].filter((f) => Boolean(f.value));

	if (fields.length === 0) {
		return null;
	}

	const container = document.createElement('div');
	container.className =
		'wiki-mention-tooltip p-2.5 text-xs rounded-lg shadow-xl border border-outline-gray-2 bg-surface-elevation-2 text-ink-gray-9 flex flex-col gap-1 min-w-[160px] max-w-[320px] pointer-events-none z-50';

	for (const field of fields) {
		const row = document.createElement('div');
		row.className =
			'wiki-mention-tooltip-row flex items-baseline gap-1.5 leading-tight';

		const labelSpan = document.createElement('span');
		labelSpan.className =
			'wiki-mention-tooltip-label font-semibold text-ink-gray-5 shrink-0 select-none';
		labelSpan.textContent = `${field.label}:`;

		const valSpan = document.createElement('span');
		valSpan.className =
			'wiki-mention-tooltip-value font-medium text-ink-gray-9 truncate';
		valSpan.textContent = field.value;

		row.appendChild(labelSpan);
		row.appendChild(valSpan);
		container.appendChild(row);
	}

	return container;
}

/**
 * Wiki Mention Node Extension
 *
 * Supports structured user mentions with @ autocomplete.
 * Persists cleanly as HTML span in markdown and survives round-trips.
 */
export const WikiMention = Node.create({
	name: 'mention',

	group: 'inline',

	inline: true,

	selectable: false,

	atom: true,

	addAttributes() {
		return {
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-id'),
				renderHTML: (attributes) => {
					if (!attributes.id) {
						return {};
					}
					return {
						'data-id': attributes.id,
					};
				},
			},
			label: {
				default: null,
				parseHTML: (element) =>
					element.getAttribute('data-label') ||
					element.textContent?.replace(/^@/, ''),
				renderHTML: (attributes) => {
					if (!attributes.label) {
						return {};
					}
					return {
						'data-label': attributes.label,
					};
				},
			},
			designation: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-designation'),
				renderHTML: (attributes) => {
					if (!attributes.designation) {
						return {};
					}
					return {
						'data-designation': attributes.designation,
					};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-type="mention"]',
			},
			{
				tag: 'span.wiki-mention',
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const label = node.attrs.label || node.attrs.id || '';
		return [
			'span',
			mergeAttributes(
				{
					'data-type': 'mention',
					class: 'wiki-mention',
				},
				this.options.HTMLAttributes,
				HTMLAttributes,
			),
			`@${label}`,
		];
	},

	renderMarkdown(node) {
		const id = (node.attrs.id || '').replace(/"/g, '&quot;');
		const label = (node.attrs.label || node.attrs.id || '').replace(/"/g, '&quot;');
		const designation = (node.attrs.designation || '').replace(/"/g, '&quot;');
		const desAttr = designation ? ` data-designation="${designation}"` : '';
		const title = [node.attrs.id, node.attrs.designation].filter(Boolean).join(' · ').replace(/"/g, '&quot;');
		const titleAttr = title ? ` title="${title}"` : '';
		return `<span data-type="mention" data-id="${id}" data-label="${label}"${desAttr}${titleAttr}>@${label}</span>`;
	},

	addOptions() {
		return {
			HTMLAttributes: {},
			suggestion: {
				char: '@',
				allowSpaces: false,
				startOfLine: false,
				command: ({ editor, range, props }) => {
					editor
						.chain()
						.focus()
						.insertContentAt(range, [
							{
								type: this.name,
								attrs: {
									id: props.id,
									label: props.label,
									designation: props.designation,
								},
							},
							{
								type: 'text',
								text: ' ',
							},
						])
						.run();
				},
				allow: ({ state, range }) => {
					const $from = state.doc.resolve(range.from);
					const type = $from.parent.type.name;
					return type !== 'codeBlock';
				},
			},
		};
	},

	addProseMirrorPlugins() {
		const plugins = [];

		if (this.options.suggestion) {
			plugins.push(
				Suggestion({
					editor: this.editor,
					pluginKey: MentionPluginKey,
					char: '@',
					allowSpaces: false,
					allowedPrefixes: [' ', '(', '[', '\n', null],
					...this.options.suggestion,
				}),
			);
		}

		plugins.push(
			new Plugin({
				key: MentionTooltipPluginKey,
				view(editorView) {
					const delegateFn = delegate || tippy?.delegate;
					if (!delegateFn || !editorView?.dom) {
						return {};
					}

					const delegateInstance = delegateFn(editorView.dom, {
						target: '.wiki-mention, span[data-type="mention"]',
						appendTo: () => document.body,
						theme: 'none',
						placement: 'top',
						interactive: false,
						delay: [80, 0],
						arrow: false,
						offset: [0, 6],
						popperOptions: {
							modifiers: [
								{
									name: 'flip',
									options: {
										fallbackPlacements: ['bottom', 'top-start', 'bottom-start'],
									},
								},
								{
									name: 'preventOverflow',
									options: { boundary: 'viewport', padding: 8 },
								},
							],
						},
						onShow(instance) {
							const content = createMentionTooltipContent(instance.reference);
							if (!content) {
								return false;
							}
							instance.setContent(content);
						},
					});

					return {
						destroy() {
							delegateInstance?.destroy();
						},
					};
				},
			}),
		);

		return plugins;
	},
});

export default WikiMention;
