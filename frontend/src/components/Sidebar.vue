<template>
	<Sidebar v-model:collapsed="isSidebarCollapsed">
		<div class="flex h-full flex-col p-2">
			<div class="flex items-center justify-between gap-1">
				<SidebarHeader
					class="flex-1 min-w-0"
					:title="__('Promot Wiki')"
					:subtitle="userStore.data?.full_name"
					logo="/assets/wiki/images/promot-wiki-icon.png"
					:menu-items="headerMenuItems"
				/>
				<NotificationBell v-if="!isSidebarCollapsed" />
			</div>
			<div v-if="isSidebarCollapsed" class="flex justify-center py-1">
				<NotificationBell :collapsed="true" />
			</div>
			<nav class="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto">
				<SidebarItem
					v-for="item in navItems"
					:key="item.label"
					:label="item.label"
					:icon="item.icon"
					:to="item.to"
					:active="route.path.startsWith(router.resolve(item.to).path)"
				/>
			</nav>
			<SidebarCollapseToggle class="mt-auto" />
		</div>
	</Sidebar>
</template>

<script setup>
import {
	Sidebar,
	SidebarCollapseToggle,
	SidebarHeader,
	SidebarItem,
} from 'frappe-ui';

import { useNotificationsStore } from '@/stores/notifications';
import { useSessionStore } from '@/stores/session';
import { useUserStore } from '@/stores/user';
import { useStorage } from '@vueuse/core';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NotificationBell from './NotificationBell.vue';
import { useTheme } from '../composables/useTheme';
import { useWikiSettings } from '../composables/useWikiSettings';

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const notificationsStore = useNotificationsStore();
const { open: openWikiSettings } = useWikiSettings();

const { themeIcon, toggleTheme } = useTheme();

const isSidebarCollapsed = useStorage('is-sidebar-collapsed', false);

onMounted(() => {
	notificationsStore.fetch();
});

const headerMenuItems = computed(() => [
	...(userStore.isWikiManager
		? [
				{
					label: __('Settings'),
					icon: 'lucide-settings',
					onClick: () => openWikiSettings(),
				},
			]
		: []),
	{ label: __('Toggle Theme'), icon: themeIcon.value, onClick: toggleTheme },
	{ label: __('Log out'), icon: 'lucide-log-out', onClick: logout },
]);

const navItems = computed(() => [
	{ label: __('Spaces'), icon: 'lucide-rocket', to: { name: 'SpaceList' }, key: 'spaces' },
	{
		label: __('Change Requests'),
		icon: 'lucide-git-branch',
		to: { name: 'ChangeRequests' },
		key: 'crs',
	},
	{
		label: __('Tagged to Me'),
		icon: 'lucide-tag',
		to: { name: 'TaggedToMe' },
		key: 'tagged',
	},
]);

function logout() {
	sessionStore.logout.submit();
}
</script>
