import { createResource } from 'frappe-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNotificationsStore = defineStore('notifications', () => {
	const unreadCount = ref(0);
	const taggedCount = ref(0);
	const notifications = ref([]);
	const isLoading = ref(false);

	const notificationsResource = createResource({
		url: 'wiki.api.get_wiki_notifications',
		onSuccess(data) {
			unreadCount.value = data?.unread_count || 0;
			taggedCount.value = data?.tagged_count || 0;
			notifications.value = data?.notifications || [];
			isLoading.value = false;
		},
		onError() {
			isLoading.value = false;
		},
	});

	const markReadResource = createResource({
		url: 'wiki.api.mark_wiki_notification_as_read',
	});

	function fetch(limit = 30) {
		isLoading.value = true;
		return notificationsResource.fetch({ limit });
	}

	function reload() {
		return notificationsResource.reload();
	}

	async function markAsRead(docname) {
		if (!docname) return;
		const item = notifications.value.find((n) => n.name === docname);
		if (item && !item.read) {
			item.read = true;
			if (unreadCount.value > 0) {
				unreadCount.value--;
			}
		}
		try {
			await markReadResource.submit({ docname });
		} catch (e) {
			console.error('Failed to mark notification as read:', e);
		}
	}

	async function markAllAsRead() {
		notifications.value.forEach((n) => {
			n.read = true;
		});
		unreadCount.value = 0;
		try {
			await markReadResource.submit({ docname: 'all' });
		} catch (e) {
			console.error('Failed to mark all notifications as read:', e);
		}
	}

	return {
		unreadCount,
		taggedCount,
		notifications,
		isLoading,
		fetch,
		reload,
		markAsRead,
		markAllAsRead,
	};
});
