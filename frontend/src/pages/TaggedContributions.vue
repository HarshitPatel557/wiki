<template>
	<div class="flex flex-col h-full overflow-hidden">
		<!-- Header renders into the shell's PageHeaderTarget. -->
		<PageHeaderMobile v-if="isMobile" :title="__('Tagged to Me')">
			<template #right>
				<MobileAppMenu />
			</template>
		</PageHeaderMobile>
		<PageHeader v-else>
			<h2 class="text-lg-semibold text-ink-gray-9">{{ __('Tagged to Me') }}</h2>
		</PageHeader>

		<ContributionsPanel
			:resource="taggedResource"
			:columns="reviewColumns"
			:options="options"
			@assign="openAssign"
		/>

		<AssignDialog
			v-if="assignTarget"
			v-model="showAssignDialog"
			:change-request-id="assignTarget"
			@assigned="onAssigned"
		/>
	</div>
</template>

<script setup>
import AssignDialog from '@/components/AssignDialog.vue';
import ContributionsPanel from '@/components/ContributionsPanel.vue';
import MobileAppMenu from '@/components/MobileAppMenu.vue';
import { useMobile } from '@/composables/useMobile';
import { useUserStore } from '@/stores/user';
import {
	PageHeader,
	PageHeaderMobile,
	createListResource,
	usePageMeta,
} from 'frappe-ui';
import { computed, ref, watch } from 'vue';

const { isMobile } = useMobile();

usePageMeta(() => ({ title: `${__('Tagged to Me')} | Promot Wiki` }));

const userStore = useUserStore();
const currentUser = computed(() => userStore.data?.name);

const reviewColumns = [
	{ label: __('Title'), key: 'title', width: 2 },
	{ label: __('Author'), key: 'owner', width: 1 },
	{ label: __('Space'), key: 'space_name', width: 2 },
	{ label: __('Status'), key: 'status', width: '8rem' },
	{ label: '', key: 'modified', width: '7.5rem', align: 'right' },
];

const reviewRowRoute = (row) => ({
	name: 'ChangeRequestReview',
	params: { changeRequestId: row.name },
});

const options = {
	selectable: false,
	showTooltip: true,
	resizeColumn: false,
	getRowRoute: reviewRowRoute,
	emptyState: {
		title: __('Nothing tagged to you'),
		description: __('Change requests mentioning you will appear here.'),
	},
};

const taggedResource = createListResource({
	doctype: 'Wiki Change Request',
	fields: [
		'name',
		'title',
		'wiki_space.space_name',
		'status',
		'owner',
		'modified',
		'_assign',
	],
	filters: {
		_user_tags: ['like', `%${currentUser.value || ''}%`],
	},
	orderBy: 'modified desc',
	pageLength: 25,
	auto: false,
});

watch(
	currentUser,
	(user) => {
		if (user) {
			taggedResource.update({
				filters: {
					_user_tags: ['like', `%${user}%`],
				},
			});
			taggedResource.reload();
		}
	},
	{ immediate: true },
);

const showAssignDialog = ref(false);
const assignTarget = ref(null);

function openAssign(row) {
	assignTarget.value = row.name;
	showAssignDialog.value = true;
}

function onAssigned() {
	taggedResource.reload();
}
</script>
