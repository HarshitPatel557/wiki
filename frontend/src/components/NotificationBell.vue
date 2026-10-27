<template>
	<Popover side="bottom" align="end" :offset="8">
		<template #target="{ open, togglePopover }">
			<button
				type="button"
				class="relative flex items-center justify-center rounded-md p-1.5 transition-colors focus:outline-none"
				:class="[
					collapsed
						? 'size-8 text-ink-gray-7 hover:bg-surface-gray-3 hover:text-ink-gray-9'
						: 'size-7 text-ink-gray-6 hover:bg-surface-gray-2 hover:text-ink-gray-9',
					open ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : '',
				]"
				:title="__('Notifications')"
				@click="togglePopover"
			>
				<span class="lucide-bell size-4" aria-hidden="true" />
				<!-- Notification Count Badge -->
				<span
					v-if="unreadCount > 0"
					class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow ring-2 ring-surface-sidebar animate-in fade-in"
				>
					{{ unreadCount > 99 ? '99+' : unreadCount }}
				</span>
			</button>
		</template>

		<template #body="{ close }">
			<div
				class="w-80 sm:w-96 rounded-xl border border-outline-gray-2 bg-surface-elevation-2 shadow-2xl text-ink-gray-9 overflow-hidden flex flex-col"
				style="max-height: 480px"
			>
				<!-- Header -->
				<div
					class="flex items-center justify-between border-b border-outline-gray-2 px-3.5 py-2.5 bg-surface-gray-1"
				>
					<div class="flex items-center gap-2">
						<span class="text-sm font-semibold">{{ __('Notifications') }}</span>
						<Badge
							v-if="unreadCount > 0"
							variant="solid"
							theme="red"
							size="sm"
						>
							{{ unreadCount }} {{ __('new') }}
						</Badge>
					</div>
					<button
						v-if="unreadCount > 0"
						type="button"
						class="text-xs text-ink-gray-5 hover:text-ink-gray-9 hover:underline transition-colors"
						@click="notificationsStore.markAllAsRead()"
					>
						{{ __('Mark all as read') }}
					</button>
				</div>

				<!-- Content: Notifications List -->
				<div class="flex-1 overflow-y-auto divide-y divide-outline-gray-1">
					<div
						v-if="notificationsStore.isLoading && !notifications.length"
						class="flex flex-col items-center justify-center py-12 text-ink-gray-4"
					>
						<span class="lucide-loader-2 size-5 animate-spin mb-2" />
						<span class="text-xs">{{ __('Loading notifications…') }}</span>
					</div>

					<div
						v-else-if="!notifications.length"
						class="flex flex-col items-center justify-center py-12 px-4 text-center"
					>
						<div
							class="flex size-10 items-center justify-center rounded-full bg-surface-gray-2 text-ink-gray-4 mb-2"
						>
							<span class="lucide-bell-off size-5" />
						</div>
						<p class="text-sm font-medium text-ink-gray-7">
							{{ __('No notifications yet') }}
						</p>
						<p class="text-xs text-ink-gray-4 mt-0.5">
							{{ __('When someone mentions or tags you, it will appear here.') }}
						</p>
					</div>

					<div
						v-for="item in notifications"
						:key="item.name"
						class="group flex items-start gap-3 p-3 transition-colors cursor-pointer text-left"
						:class="[
							item.read
								? 'hover:bg-surface-gray-2/60 opacity-80'
								: 'bg-surface-blue-1/30 hover:bg-surface-blue-1/60 font-medium',
						]"
						@click="handleNotificationClick(item, close)"
					>
						<!-- Sender Avatar -->
						<div class="relative shrink-0 mt-0.5">
							<Avatar
								shape="circle"
								:label="item.from_user_name || item.from_user || 'U'"
								:image="item.from_user_image"
								size="sm"
							/>
							<span
								v-if="!item.read"
								class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-600 ring-2 ring-surface-elevation-2"
							/>
						</div>

						<!-- Details -->
						<div class="flex-1 min-w-0">
							<p
								class="text-xs leading-snug line-clamp-2 text-ink-gray-8"
								v-html="cleanSubject(item.subject)"
							/>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-[11px] text-ink-gray-4">
									{{ item.pretty_date }}
								</span>
								<span
									v-if="item.type === 'Mention'"
									class="text-[10px] px-1 rounded bg-surface-gray-3 text-ink-gray-6"
								>
									{{ __('Mention') }}
								</span>
							</div>
						</div>

						<!-- Action arrow -->
						<div
							class="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<span class="lucide-chevron-right size-4 text-ink-gray-4" />
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div
					class="border-t border-outline-gray-2 p-2 bg-surface-gray-1 text-center"
				>
					<button
						type="button"
						class="text-xs font-medium text-ink-gray-6 hover:text-ink-gray-9 transition-colors flex items-center justify-center gap-1 w-full py-1 rounded hover:bg-surface-gray-2"
						@click="viewAllTagged(close)"
					>
						<span>{{ __('View all tagged to me') }}</span>
						<span class="lucide-arrow-right size-3" />
					</button>
				</div>
			</div>
		</template>
	</Popover>
</template>

<script setup>
import { useNotificationsStore } from '@/stores/notifications';
import { Avatar, Badge, Popover } from 'frappe-ui';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

defineProps({
	collapsed: {
		type: Boolean,
		default: false,
	},
});

const router = useRouter();
const notificationsStore = useNotificationsStore();

const unreadCount = computed(() => notificationsStore.unreadCount);
const notifications = computed(() => notificationsStore.notifications);

function cleanSubject(subject) {
	return subject || '';
}

function handleNotificationClick(item, close) {
	notificationsStore.markAsRead(item.name);
	if (close) close();

	if (item.link) {
		const link = item.link;
		if (link.startsWith('/wiki-app/')) {
			const routePath = link.replace('/wiki-app', '');
			router.push(routePath);
			return;
		} else if (link.startsWith('/app/')) {
			if (item.document_type === 'Wiki Change Request' && item.document_name) {
				router.push({
					name: 'ChangeRequestReview',
					params: { changeRequestId: item.document_name },
				});
				return;
			}
			window.location.href = link;
			return;
		}
	}

	if (item.document_type === 'Wiki Change Request' && item.document_name) {
		router.push({
			name: 'ChangeRequestReview',
			params: { changeRequestId: item.document_name },
		});
	}
}

function viewAllTagged(close) {
	if (close) close();
	router.push({ name: 'TaggedToMe' });
}
</script>
