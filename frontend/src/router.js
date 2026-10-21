import { createRouter, createWebHistory } from 'vue-router';

const routes = [
	{
		path: '/',
		name: 'Home',
		redirect: '/spaces',
	},
	{
		path: '/spaces',
		name: 'SpaceList',
		component: () => import('@/pages/Spaces.vue'),
	},
	{
		path: '/change-requests',
		name: 'ChangeRequests',
		component: () => import('@/pages/Contributions.vue'),
	},
	{
		path: '/tagged',
		name: 'TaggedToMe',
		component: () => import('@/pages/TaggedContributions.vue'),
	},
	{
		path: '/tagged-to-me',
		redirect: { name: 'TaggedToMe' },
	},
	{
		path: '/change-requests/:changeRequestId',
		name: 'ChangeRequestReview',
		component: () => import('@/pages/ContributionReview.vue'),
		props: true,
	},
	{
		path: '/contributions',
		redirect: { name: 'ChangeRequests' },
	},
	{
		path: '/contributions/:batchId',
		redirect: (to) => ({
			name: 'ChangeRequestReview',
			params: { changeRequestId: to.params.batchId },
		}),
	},
	{
		path: '/spaces/:spaceId',
		component: () => import('@/pages/SpaceDetails.vue'),
		props: true,
		children: [
			{
				path: '',
				name: 'SpaceDetails',
				component: () => import('@/components/SpaceWelcome.vue'),
			},
			{
				path: 'page/:pageId',
				name: 'SpacePage',
				component: () => import('@/components/WikiDocumentPanel.vue'),
				props: true,
			},
			{
				path: 'draft/:docKey',
				name: 'DraftChangeRequest',
				component: () => import('@/components/DraftContributionPanel.vue'),
				props: true,
			},
			{
				path: 'draft/:contributionId',
				redirect: (to) => ({
					name: 'DraftChangeRequest',
					params: {
						spaceId: to.params.spaceId,
						docKey: to.params.contributionId,
					},
				}),
			},
		],
	},
];

// The app's base path. Kept in sync with APP_ROUTE in wiki_document.py (which
// also feeds website_route_rules) and APP_BASE in e2e/helpers/routes.ts.
const router = createRouter({
	history: createWebHistory('/wiki-app'),
	routes,
});

router.beforeEach(async (to, from, next) => {
	const { useSessionStore } = await import('@/stores/session');
	const { useUserStore } = await import('@/stores/user');
	const sessionStore = useSessionStore();

	const userStore = useUserStore();
	let isLoggedIn = sessionStore.isLoggedIn;
	try {
		if (!userStore.data) {
			await userStore.fetch();
		}
	} catch (error) {
		isLoggedIn = false;
	}

	if (!isLoggedIn) {
		window.location.href = `/login?redirect-to=/wiki-app${encodeURIComponent(
			to.fullPath,
		)}`;
		return;
	}

	if (to.params.spaceId) {
		try {
			const spaceId = to.params.spaceId;
			const pageId = to.params.pageId;
			const url = `/api/method/wiki.api.get_space_capabilities?space=${encodeURIComponent(
				spaceId,
			)}${pageId ? `&page=${encodeURIComponent(pageId)}` : ''}`;
			const res = await fetch(url, { credentials: 'same-origin' });
			if (res.ok) {
				const json = await res.json();
				const data = json?.message;
				if (data) {
					const isEmpty = !data.has_documents || (data.is_read_only && !data.has_published_documents);
					if (isEmpty && (data.is_read_only || (!pageId && !data.can_write && !data.can_contribute))) {
						const { toast } = await import('frappe-ui');
						const msg = typeof __ === 'function' ? __('No document in space') : 'No document in space';
						toast.warning(msg);
						if (from.name === 'SpaceList') {
							next(false);
						} else {
							next({ name: 'SpaceList' });
						}
						return;
					}

					if (data.is_read_only && data.reader_url) {
						window.location.replace(data.reader_url);
						return;
					}
				}
			}
		} catch (error) {
			// On network error or failure, fall through to regular routing
		}
	}

	next();
});

export default router;
