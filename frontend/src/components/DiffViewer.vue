<template>
	<div ref="wrapper" class="diff-viewer" />
</template>

<script setup>
import { FileDiff } from '@pierre/diffs';
import { useStorage } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const THEMES = {
	dark: 'github-dark',
	light: 'github-light',
};

const userTheme = useStorage('wiki-theme', 'dark');
const themeType = computed(() =>
	userTheme.value === 'dark' ? 'dark' : 'light',
);

const props = defineProps({
	oldContent: {
		type: String,
		default: '',
	},
	newContent: {
		type: String,
		default: '',
	},
	fileName: {
		type: String,
		default: 'changes.md',
	},
	language: {
		type: String,
		default: 'markdown',
	},
	diffStyle: {
		type: String,
		default: 'split',
	},
});

const wrapper = ref(null);
let diffInstance = null;

function decodeHtmlEntities(str) {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function formatMentionsForDiff(text) {
	if (!text) return '';
	return text.replace(
		/<span\b[^>]*?(?:data-type=["']mention["']|class=["'][^"']*wiki-mention[^"']*["'])[^>]*?(?:>([\s\S]*?)<\/span>|\/>)/gi,
		(match, innerText) => {
			const labelMatch = match.match(/data-label=["']([^"']+)["']/i);
			let label = labelMatch ? decodeHtmlEntities(labelMatch[1]) : '';
			if (!label && innerText) {
				label = decodeHtmlEntities(innerText.trim());
			}
			if (label) {
				return `@${label.replace(/^@/, '')}`;
			}
			const idMatch = match.match(/data-id=["']([^"']+)["']/i);
			if (idMatch && idMatch[1]) {
				const id = decodeHtmlEntities(idMatch[1]);
				return `@${id.replace(/^@/, '')}`;
			}
			return innerText || '';
		},
	);
}

function normalizeContent(content) {
	const formatted = formatMentionsForDiff(content || '');
	const normalized = formatted
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
	if (!normalized) {
		return '';
	}
	return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function renderDiff() {
	if (!wrapper.value) return;
	if (diffInstance) {
		diffInstance.cleanUp();
		diffInstance = null;
	}
	diffInstance = new FileDiff({
		theme: THEMES,
		diffStyle: props.diffStyle,
		lineDiffType: 'word',
		themeType: themeType.value,
	});

	diffInstance.render({
		oldFile: {
			name: props.fileName,
			contents: normalizeContent(props.oldContent),
			lang: props.language,
		},
		newFile: {
			name: props.fileName,
			contents: normalizeContent(props.newContent),
			lang: props.language,
		},
		containerWrapper: wrapper.value,
	});
}

onMounted(renderDiff);

watch(
	() => [
		props.oldContent,
		props.newContent,
		props.fileName,
		props.language,
		props.diffStyle,
		themeType.value,
	],
	() => {
		renderDiff();
	},
);

onBeforeUnmount(() => {
	diffInstance?.cleanUp();
	diffInstance = null;
});
</script>

<style scoped>
.diff-viewer {
	width: 100%;
	overflow: auto;
}
</style>
