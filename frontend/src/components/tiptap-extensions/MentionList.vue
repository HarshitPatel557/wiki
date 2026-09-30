<template>
    <div
        class="mention-list relative max-h-[320px] min-w-64 max-w-[380px] overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-elevation-2 p-1 text-base shadow-2xl z-50"
    >
        <template v-if="items.length">
            <template
                v-for="(group, groupIndex) in groupedItems"
                :key="group.label ?? groupIndex"
            >
                <div
                    v-if="group.label"
                    class="flex h-7 items-center justify-between px-2.5 text-xs font-semibold tracking-wider uppercase text-ink-gray-4 border-b border-outline-gray-1 mb-1 mt-1.5 first:mt-0.5"
                >
                    <span>{{ group.label }}</span>
                    <span v-if="group.label === 'PROJECT MEMBERS'" class="text-[10px] px-1.5 py-0.2 bg-surface-blue-2 text-ink-blue-7 rounded-full font-medium lowercase">project</span>
                </div>
                <button
                    v-for="{ item, index } in group.entries"
                    :key="item.id || index"
                    :ref="(el) => setItemRef(el, index)"
                    type="button"
                    class="flex min-h-10 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors text-left cursor-pointer"
                    :class="index === selectedIndex ? 'bg-surface-gray-2 text-ink-gray-9' : 'text-ink-gray-8 hover:bg-surface-gray-1'"
                    @click="selectItem(index)"
                    @mouseover="selectedIndex = index"
                >
                    <div class="flex items-center gap-2 min-w-0 mr-2">
                        <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-gray-3 text-xs font-medium text-ink-gray-7">
                            {{ (item.label || item.id || '?').charAt(0).toUpperCase() }}
                        </div>
                        <div class="truncate font-medium text-ink-gray-9">
                            {{ item.label }}
                        </div>
                    </div>
                    <div v-if="item.designation" class="shrink-0 text-xs text-ink-gray-5 font-normal max-w-[140px] truncate">
                        {{ item.designation }}
                    </div>
                </button>
            </template>
        </template>
        <div
            v-else
            class="mention-empty px-3 py-2 text-sm text-ink-gray-5 text-center"
        >
            {{ __('No users found') }}
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUpdate, ref, watch } from 'vue';

const props = defineProps({
	items: {
		type: Array,
		default: () => [],
	},
	command: {
		type: Function,
		required: true,
	},
});

const selectedIndex = ref(0);
const itemRefs = ref([]);

// Group items by item.group (PROJECT MEMBERS vs OTHER USERS)
const groupedItems = computed(() => {
	const groups = [];
	(props.items || []).forEach((item, index) => {
		const label = typeof item.group === 'string' ? item.group : undefined;
		const last = groups[groups.length - 1];
		if (last && last.label === label) last.entries.push({ item, index });
		else groups.push({ label, entries: [{ item, index }] });
	});
	return groups;
});

onBeforeUpdate(() => {
	itemRefs.value = [];
});

function setItemRef(el, index) {
	if (el instanceof HTMLElement) itemRefs.value[index] = el;
}

function selectItem(index) {
	const item = props.items?.[index];
	if (item) {
		props.command(item);
	}
}

function scrollSelectedIntoView() {
	nextTick(() => {
		itemRefs.value[selectedIndex.value]?.scrollIntoView({ block: 'nearest' });
	});
}

function onKeyDown(event) {
	if (event.key === 'ArrowUp') {
		if (!props.items?.length) return false;
		event.preventDefault();
		selectedIndex.value =
			(selectedIndex.value - 1 + props.items.length) % props.items.length;
		scrollSelectedIntoView();
		return true;
	}
	if (event.key === 'ArrowDown') {
		if (!props.items?.length) return false;
		event.preventDefault();
		selectedIndex.value = (selectedIndex.value + 1) % props.items.length;
		scrollSelectedIntoView();
		return true;
	}
	if (event.key === 'Enter' || event.key === 'Tab') {
		if (props.items && props.items.length > 0) {
			event.preventDefault();
			selectItem(selectedIndex.value);
			return true;
		}
		return false;
	}
	return false;
}

watch(
	() => props.items,
	() => {
		selectedIndex.value = 0;
	},
);

defineExpose({
	onKeyDown,
});
</script>
