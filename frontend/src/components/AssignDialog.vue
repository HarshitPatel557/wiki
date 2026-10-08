<template>
	<Dialog v-model:open="show" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Assign Reviewer') }}</h3>
		</template>
		<template #default>
			<div class="space-y-4">
				<p class="text-ink-gray-7">
					{{ __('Assign this change request to a reviewer. They will be notified and it will appear in their "Assigned to me" list.') }}
				</p>
				<Autocomplete
					v-model="selected"
					:options="userOptions"
					:placeholder="__('Search people...')"
					multiple
					@update:query="onQueryChange"
				/>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button variant="outline" @click="close">{{ __('Cancel') }}</Button>
				<Button
					variant="solid"
					:loading="assignResource.loading"
					:disabled="!selected.length"
					@click="handleAssign(close)"
				>
					{{ __('Assign') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import {
	Autocomplete,
	Button,
	Dialog,
	createResource,
	toast,
} from 'frappe-ui';
import { computed, ref, watch } from 'vue';

const props = defineProps({
	modelValue: { type: Boolean, default: false },
	changeRequestId: { type: String, required: true },
});
const emit = defineEmits(['update:modelValue', 'assigned']);

const show = computed({
	get: () => props.modelValue,
	set: (value) => emit('update:modelValue', value),
});

const selected = ref([]);
const searchResults = ref([]);
const loading = ref(false);

async function fetchUsers(query = '') {
	loading.value = true;
	try {
		const q = encodeURIComponent(query || '');
		const cr = encodeURIComponent(props.changeRequestId || '');
		const res = await fetch(
			`/api/method/project_documentation.api.user_search.search_mention_users?query=${q}&change_request=${cr}&limit=30`,
			{
				headers: {
					Accept: 'application/json',
				},
			},
		);
		const data = await res.json();
		searchResults.value = data.message || [];
	} catch (err) {
		console.error('Failed to search users for reviewer assignment:', err);
	} finally {
		loading.value = false;
	}
}

let debounceTimer = null;
function onQueryChange(q) {
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		fetchUsers(q);
	}, 200);
}

watch(
	() => [show.value, props.changeRequestId],
	([isOpen, crId]) => {
		if (isOpen && crId) {
			fetchUsers('');
		} else if (!isOpen) {
			selected.value = [];
		}
	},
	{ immediate: true },
);

const userOptions = computed(() => {
	const map = new Map();

	// Preserve selected items in options so selections aren't dropped when search query changes
	for (const s of selected.value) {
		if (s) {
			const val = typeof s === 'object' ? s.value : s;
			const lbl = typeof s === 'object' ? s.label : s;
			map.set(val, { label: lbl, value: val });
		}
	}

	for (const u of searchResults.value) {
		const val = u.value || u.id || u.name;
		if (!val) continue;
		const name = u.label || u.full_name || val;
		const designation = u.designation || u.custom_designation ? ` (${u.designation || u.custom_designation})` : '';
		const email = u.email && u.email !== name ? ` · ${u.email}` : (val !== name && val.includes('@') ? ` · ${val}` : '');
		const label = `${name}${designation}${email}`;
		map.set(val, {
			label,
			value: val,
		});
	}

	return Array.from(map.values());
});

const assignResource = createResource({
	url: 'frappe.desk.form.assign_to.add',
});

async function handleAssign(close) {
	const assignTo = selected.value.map((o) => (o && o.value ? o.value : o));
	if (!assignTo.length) return;
	try {
		await assignResource.submit({
			doctype: 'Wiki Change Request',
			name: props.changeRequestId,
			assign_to: assignTo,
		});
		toast.success(__('Reviewer assigned'));
		selected.value = [];
		close?.();
		emit('assigned');
	} catch (error) {
		toast.error(error.messages?.[0] || __('Error assigning reviewer'));
	}
}
</script>
