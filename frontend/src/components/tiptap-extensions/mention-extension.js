import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

export const MentionPluginKey = new PluginKey('mention');

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
		return `<span data-type="mention" data-id="${id}" data-label="${label}"${desAttr}>@${label}</span>`;
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
		if (!this.options.suggestion) {
			return [];
		}

		return [
			Suggestion({
				editor: this.editor,
				pluginKey: MentionPluginKey,
				char: '@',
				allowSpaces: false,
				allowedPrefixes: [' ', '(', '[', '\n', null],
				...this.options.suggestion,
			}),
		];
	},
});

export default WikiMention;
