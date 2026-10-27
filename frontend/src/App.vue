<script setup lang="ts">
import { FrappeUIProvider, setConfig, toast } from 'frappe-ui';
import { onBeforeUnmount, onMounted } from 'vue';
import MainLayout from './layouts/MainLayout.vue';
import { useSocket } from './socket';

setConfig('systemTimezone', window.timezone?.system || null);
setConfig('localTimezone', window.timezone?.user || null);

// Realtime reviewer-decision pings to the change-request author. The matching
// Notification Log entry (created server-side) is the durable copy; this is
// just the live nudge while the author has the app open.
import { useNotificationsStore } from './stores/notifications';

const notificationsStore = useNotificationsStore();

function onChangeRequestUpdate(data: { subject?: string }) {
	if (data?.subject) toast.info(data.subject);
	notificationsStore.reload();
}

function onWikiMention(data: { subject?: string }) {
	notificationsStore.reload();
	if (data?.subject) {
		toast.info(data.subject);
	}
}

function onNotification() {
	notificationsStore.reload();
}

onMounted(() => {
	const socket = useSocket();
	socket?.on('wiki_change_request_update', onChangeRequestUpdate);
	socket?.on('wiki_mention', onWikiMention);
	socket?.on('notification', onNotification);
});
onBeforeUnmount(() => {
	const socket = useSocket();
	socket?.off('wiki_change_request_update', onChangeRequestUpdate);
	socket?.off('wiki_mention', onWikiMention);
	socket?.off('notification', onNotification);
});
</script>

<template>
	<FrappeUIProvider>
		<MainLayout>
			<router-view />
		</MainLayout>
	</FrappeUIProvider>
</template>