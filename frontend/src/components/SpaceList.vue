<template>
  <div class="flex flex-col gap-4 p-3 sm:p-4 h-full">
    <!-- Header renders into the shell's PageHeaderTarget (pinned above the
         page): centered-title mobile variant with the app menu, or the
         desktop strip with search + New Space. -->
    <PageHeaderMobile v-if="isMobile" :title="__('Wiki Spaces')">
      <template #right>
        <div class="flex items-center gap-1">
          <Button
            v-if="canCreateSpace"
            variant="ghost"
            icon="lucide-plus"
            :label="__('New Space')"
            @click="openCreateSpaceDialog"
          />
          <MobileAppMenu />
        </div>
      </template>
    </PageHeaderMobile>
    <PageHeader v-else>
      <h2 class="text-lg-semibold text-ink-gray-9">{{ __('Wiki Spaces') }}</h2>
      <div class="flex items-center gap-2">
        <FormControl
          class="w-64"
          type="text"
          v-model="searchQuery"
          :placeholder="__('Search spaces...')"
        >
          <template #prefix>
            <span class="lucide-search h-4 w-4 text-ink-gray-4" aria-hidden="true" />
          </template>
        </FormControl>
        <Button
          v-if="canCreateSpace"
          variant="solid"
          @click="openCreateSpaceDialog"
        >
          <template #prefix>
            <span class="lucide-plus h-4 w-4" aria-hidden="true" />
          </template>
          {{ activeCategory === 'personal' ? __('New Personal Space') : __('New Space') }}
        </Button>
      </div>
    </PageHeader>

    <!-- Two Category Tabs: Project Documents & Personal Documents -->
    <div class="flex items-center gap-2 border-b border-outline-gray-2 pb-2">
      <Button
        :variant="activeCategory === 'project' ? 'solid' : 'ghost'"
        size="sm"
        @click="activeCategory = 'project'"
      >
        <template #prefix>
          <span class="lucide-folder-git-2 h-4 w-4" aria-hidden="true" />
        </template>
        {{ __('Project Documents') }}
        <Badge
          variant="subtle"
          :theme="activeCategory === 'project' ? 'blue' : 'gray'"
          size="sm"
          class="ml-1.5"
        >
          {{ projectSpacesCount }}
        </Badge>
      </Button>
      <Button
        :variant="activeCategory === 'personal' ? 'solid' : 'ghost'"
        size="sm"
        @click="activeCategory = 'personal'"
      >
        <template #prefix>
          <span class="lucide-user h-4 w-4" aria-hidden="true" />
        </template>
        {{ __('Personal Documents') }}
        <Badge
          variant="subtle"
          :theme="activeCategory === 'personal' ? 'blue' : 'gray'"
          size="sm"
          class="ml-1.5"
        >
          {{ personalSpacesCount }}
        </Badge>
      </Button>
    </div>

    <!-- Mobile keeps an inline search row (the centered header has no room). -->
    <FormControl
      v-if="isMobile"
      type="text"
      v-model="searchQuery"
      :placeholder="__('Search spaces...')"
    >
      <template #prefix>
        <span class="lucide-search h-4 w-4 text-ink-gray-4" aria-hidden="true" />
      </template>
    </FormControl>

    <div class="flex-1 overflow-auto">
      <!-- Skeleton on cold load so the empty state never flashes before the
           first page of spaces arrives. -->
      <div v-if="spaces.list.loading && !spaces.data?.length" class="flex flex-col">
        <div
          v-for="n in 8"
          :key="n"
          class="grid grid-cols-[2fr_1fr_2fr_3fr] items-center gap-4 px-2 h-12 border-b border-outline-gray-1"
        >
          <Skeleton class="h-3.5 w-2/3 rounded" />
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-3.5 w-1/2 rounded" />
          <Skeleton class="h-7 w-16 rounded" />
        </div>
      </div>

      <!-- The List family owns geometry only; empty states are app-authored. -->
      <div
        v-else-if="!currentListItems.length"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <p class="text-lg-medium text-ink-gray-7">
          {{ searchQuery ? __('No spaces found') : (activeCategory === 'personal' ? __('No Personal Documents') : __('No Project Documents')) }}
        </p>
        <p class="mt-1 max-w-sm text-p-sm text-ink-gray-5">
          {{
            searchQuery
              ? __('No wiki spaces matched your search')
              : activeCategory === 'personal'
                ? __('Create your personal space to start writing personal documentation.')
                : isManager
                  ? __('Create your first wiki space to get started')
                  : __('No project spaces available')
          }}
        </p>
        <Button
          v-if="canCreateSpace && !searchQuery"
          class="mt-4"
          variant="solid"
          :label="activeCategory === 'personal' ? __('New Personal Space') : __('New Space')"
          @click="openCreateSpaceDialog"
        />
      </div>

      <!-- Tables stay tables on mobile and scroll horizontally: the min-width
           keeps columns readable instead of compressing to mush. -->
      <div v-else class="min-w-[600px] sm:min-w-0">
        <List :columns="tracks" :row-height="40">
          <ListHeader>
            <ListHeaderCell v-for="col in columns" :key="col.key">
              {{ col.label }}
            </ListHeaderCell>
          </ListHeader>
          <ListRows :items="currentListItems" row-key="name" v-slot="{ item: row }">
            <ListRow :to="{ name: 'SpaceDetails', params: { spaceId: row.name } }">
              <ListCell v-for="col in columns" :key="col.key">
                <Badge
                  v-if="col.key === 'is_published'"
                  variant="subtle"
                  :theme="row.is_published ? 'green' : 'orange'"
                  size="sm"
                  :label="row.is_published ? __('Published') : __('Unpublished')"
                />
                <div v-else-if="col.key === 'actions'" class="flex items-center gap-1">
                  <!-- Rows are router-links (an <a>); .stop alone won't stop the browser
                       from following the row href, so .prevent is required too. -->
                  <Button
                    v-if="row.is_published"
                    variant="ghost"
                    size="sm"
                    icon-left="external-link"
                    @click.stop.prevent="viewSpace(row)"
                  >
                    {{ __('View') }}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="share-2"
                    :title="__('Share Space')"
                    @click.stop.prevent="shareSpace(row)"
                  />
                  <Button
                    v-if="isPersonalRow(row) && (row.owner === currentUser || isManager)"
                    variant="ghost"
                    theme="red"
                    size="sm"
                    icon="trash-2"
                    :title="__('Delete Personal Space')"
                    @click.stop.prevent="confirmDeleteSpace(row)"
                  />
                </div>
                <!-- Cells don't inherit an ink color from the List family, so an
                     explicit token is required or the text goes black in dark mode. -->
                <span
                  v-else
                  class="truncate"
                  :class="col.key === 'space_name' ? 'text-ink-gray-9' : 'text-ink-gray-7'"
                  :title="row[col.key]"
                  >{{ row[col.key] }}</span
                >
              </ListCell>
            </ListRow>
          </ListRows>
        </List>
      </div>

      <div v-if="spaces.hasNextPage" class="flex px-2 py-2">
        <Button
          @click="() => spaces.next()"
          :loading="spaces.list.loading"
          :label="__('Load more')"
          icon-left="refresh-cw"
        />
      </div>
    </div>

    <Dialog
      v-model:open="showCreateDialog"
      :title="createSpaceCategory === 'personal' ? __('Create Personal Space') : __('Create Wiki Space')"
      size="lg"
      :actions="[
        {
          label: __('Create'),
          variant: 'solid',
          loading: isCreating,
          onClick: handleCreateSpace,
        },
      ]"
    >
      <template #default>
        <div class="flex flex-col gap-4">
          <div v-if="isManager" class="flex items-center gap-4 p-2.5 bg-surface-gray-2 rounded-lg border border-outline-gray-2">
            <span class="text-p-sm font-medium text-ink-gray-7">{{ __('Category:') }}</span>
            <label class="flex items-center gap-1.5 text-p-sm cursor-pointer text-ink-gray-8">
              <input type="radio" value="personal" v-model="createSpaceCategory" />
              {{ __('Personal Space') }}
            </label>
            <label class="flex items-center gap-1.5 text-p-sm cursor-pointer text-ink-gray-8">
              <input type="radio" value="project" v-model="createSpaceCategory" />
              {{ __('Project Space') }}
            </label>
          </div>
          <p v-if="createSpaceCategory === 'personal'" class="text-p-xs text-ink-gray-5">
            {{ __('Personal spaces allow direct editing and saving without raising change requests or PRs.') }}
          </p>

          <FormControl
            type="text"
            :label="__('Space Name')"
            v-model="newSpace.space_name"
            :placeholder="createSpaceCategory === 'personal' ? __('My Personal Notes') : __('My Wiki Space')"
          />
          <FormControl
            type="text"
            :label="__('Route')"
            required
            :modelValue="newSpace.route"
            @update:modelValue="handleRouteInput"
            :placeholder="__('my-wiki-space')"
            :description="__('The URL path for this wiki space (e.g., /my-wiki-space)')"
          />

          <template v-if="createSpaceCategory === 'project'">
            <FormControl
              type="checkbox"
              :label="__('Synced from GitHub?')"
              v-model="newSpace.git_synced"
            />

          <template v-if="newSpace.git_synced">
            <!-- Checking the connection + loading the account list right after the
                 box is ticked: keep the user informed instead of flashing UI. -->
            <div
              v-if="githubConnected.loading || installationsResource.loading"
              class="flex items-center gap-2 rounded border border-outline-gray-2 p-3"
            >
              <span class="lucide-loader-2 h-4 w-4 animate-spin text-ink-gray-5" aria-hidden="true" />
              <span class="text-p-sm text-ink-gray-6">{{ __('Connecting to GitHub…') }}</span>
            </div>

            <template v-else>
              <!-- Not connected yet: kick off the GitHub App connect-account flow. -->
              <div
                v-if="!githubConnected.data"
                class="flex flex-col items-start gap-2 rounded border border-outline-gray-2 p-3"
              >
                <p class="text-p-sm text-ink-gray-6">
                  {{ __('Connect your GitHub account to pick a repository (private repos supported).') }}
                </p>
                <Button variant="subtle" :loading="githubConnected.loading" @click="connectGithub">
                  <template #prefix>
                    <span class="lucide-github h-4 w-4" aria-hidden="true" />
                  </template>
                  {{ __('Connect GitHub') }}
                </Button>
                <ErrorMessage :message="githubConnected.error" />
              </div>

              <!-- Connected but the App isn't installed anywhere yet: offer install. -->
              <div
                v-else-if="installationOptions.length === 0"
                class="flex flex-col items-start gap-2 rounded border border-outline-gray-2 p-3"
              >
                <p class="text-p-sm text-ink-gray-6">
                  {{ __('The GitHub App is not installed on any account yet. Install it on the account and repositories you want to sync.') }}
                </p>
                <Button variant="subtle" :loading="installationsResource.loading" @click="installApp">
                  <template #prefix>
                    <span class="lucide-github h-4 w-4" aria-hidden="true" />
                  </template>
                  {{ __('Install GitHub App') }}
                </Button>
                <ErrorMessage :message="appInstallUrl.error" />
              </div>

              <template v-else>
                <!-- Reveal one step at a time: account → repo → branch → folder.
                     A single account is auto-selected, so the picker collapses to
                     repo-first in the common case. -->
                <Autocomplete
                  v-if="installationOptions.length > 1"
                  :label="__('GitHub Account')"
                  :options="installationOptions"
                  v-model="newSpace.github_installation_id"
                  :placeholder="__('Select an account or organization')"
                />

                <!-- First repo page after an account is chosen: spinner so the repo
                     field never appears empty with no hint that it's loading. -->
                <div
                  v-if="reposInitialLoading"
                  class="flex items-center gap-2 rounded border border-outline-gray-2 p-3"
                >
                  <span class="lucide-loader-2 h-4 w-4 animate-spin text-ink-gray-5" aria-hidden="true" />
                  <span class="text-p-sm text-ink-gray-6">{{ __('Loading repositories…') }}</span>
                </div>

                <template v-else-if="newSpace.github_installation_id">
                  <Autocomplete
                    :label="__('Repository')"
                    remote
                    :options="repoOptions"
                    v-model="newSpace.repo_full_name"
                    :loading="repos.loading"
                    :has-more="repos.hasMore"
                    :placeholder="__('Search repositories…')"
                    @search="(q) => loadRepos({ search: q, reset: true })"
                    @load-more="loadRepos()"
                  />

                  <Autocomplete
                    v-if="newSpace.repo_full_name"
                    :label="__('Branch')"
                    :options="branchOptions"
                    v-model="newSpace.branch"
                    :loading="branches.loading"
                    :placeholder="__('main')"
                  />

                  <FormControl
                    v-if="newSpace.branch"
                    type="text"
                    :label="__('Docs folder')"
                    v-model="newSpace.docs_subdir"
                    :placeholder="__('docs')"
                    :description="__('Folder in the repo to sync. Supports nested paths like docs/guide.')"
                  />
                </template>
                <ErrorMessage :message="installationsResource.error || repos.error || branches.error" />
              </template>
            </template>
          </template>
          </template>

          <ErrorMessage :message="formError || spaces.insert.error" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:open="showDeleteConfirm"
      :title="__('Delete Personal Space')"
      :actions="[
        {
          label: __('Cancel'),
          variant: 'subtle',
          onClick: () => (showDeleteConfirm = false),
        },
        {
          label: __('Delete'),
          theme: 'red',
          variant: 'solid',
          loading: isDeleting,
          onClick: handleDeleteSpace,
        },
      ]"
    >
      <template #default>
        <p class="text-p-sm text-ink-gray-7">
          {{ __('Are you sure you want to delete personal space "{0}"? All its documents will be permanently removed.', [spaceToDelete?.space_name || spaceToDelete?.name]) }}
        </p>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import Autocomplete from '@/components/Autocomplete.vue';
import MobileAppMenu from '@/components/MobileAppMenu.vue';
import { useMobile } from '@/composables/useMobile';
import { useUserStore } from '@/stores/user';
import { getSpaceCanonicalUrl, handleShare } from '@/lib/share';
import {
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	PageHeader,
	PageHeaderMobile,
	Skeleton,
	createListResource,
	createResource,
	toast,
} from 'frappe-ui';
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

watch(
	() => route.query?.empty_space,
	(val) => {
		if (val) {
			toast.warning(__('No document in space'));
			router.replace({ path: '/spaces' });
		}
	},
	{ immediate: true },
);

const userStore = useUserStore();
const { isMobile } = useMobile();
const isManager = computed(() => userStore.isWikiManager);

const activeCategory = ref('project'); // 'project' | 'personal'
const createSpaceCategory = ref('personal');
const isCreating = ref(false);
const showDeleteConfirm = ref(false);
const spaceToDelete = ref(null);
const isDeleting = ref(false);

const currentUser = computed(() => userStore.data?.name || '');
const canCreateSpace = computed(() => {
	if (activeCategory.value === 'personal') return Boolean(userStore.data?.is_logged_in);
	return isManager.value;
});

function openCreateSpaceDialog() {
	if (!isManager.value) {
		createSpaceCategory.value = 'personal';
	} else {
		createSpaceCategory.value = activeCategory.value;
	}
	showCreateDialog.value = true;
}

const showCreateDialog = ref(false);
const routeManuallyEdited = ref(false);
const searchQuery = ref('');
const formError = ref('');

const newSpace = reactive({
	space_name: '',
	route: '',
	git_synced: false,
	github_installation_id: '',
	repo_full_name: '',
	branch: '',
	docs_subdir: 'docs',
});

// GitHub App connect + repo picker (TB4b). The connect-account OAuth round-trip
// runs in a popup against `/github/authorize`; we poll `is_connected` until the
// user's token is cached server-side, then list their installations and repos.
const githubConnected = createResource({ url: 'wiki.api.github.is_connected' });
const installationsResource = createResource({
	url: 'wiki.api.github.my_installations',
	// A single account is the common case — pick it automatically so the form
	// collapses to repo-first (the account step hides when there's nothing to choose).
	onSuccess: (data) => {
		if ((data || []).length === 1) {
			// Bridge the gap to the first repo page so the spinner stays up instead of
			// flashing an empty repo field before loadRepos() (via the watch) kicks in.
			repos.loadedOnce = false;
			repos.loading = true;
			newSpace.github_installation_id = String(data[0].id);
		}
	},
});
const repositoriesResource = createResource({
	url: 'wiki.api.github.my_repositories',
});
const branchesResource = createResource({
	url: 'wiki.api.github.my_repo_branches',
});
const appInstallUrl = createResource({
	url: 'wiki.api.github.app_install_url',
});

const installationOptions = computed(() =>
	(installationsResource.data || []).map((i) => ({
		label: i.account_type ? `${i.account} (${i.account_type})` : i.account,
		value: String(i.id),
	})),
);

// Repos are paged from the server (a search/load-more list, not loaded all at
// once) so big orgs don't stall the dialog. `loadRepos` accumulates pages and
// resets when the search term changes.
const repos = reactive({
	list: [],
	page: 1,
	search: '',
	hasMore: false,
	loading: false,
	loadedOnce: false,
	error: null,
});

// Show the big "Loading repositories…" spinner only on the first load for an
// account — later searches keep the field visible and use its in-dropdown hint.
const reposInitialLoading = computed(
	() => !!newSpace.github_installation_id && repos.loading && !repos.loadedOnce,
);

async function loadRepos({ search, reset = false } = {}) {
	if (!newSpace.github_installation_id) return;
	if (search !== undefined) repos.search = search;
	if (reset) {
		repos.page = 1;
		repos.list = [];
	}
	repos.loading = true;
	repos.error = null;
	try {
		const res = await repositoriesResource.submit({
			installation_id: newSpace.github_installation_id,
			search: repos.search,
			page: repos.page,
		});
		const batch = res?.repositories || [];
		repos.list = repos.page === 1 ? batch : [...repos.list, ...batch];
		repos.hasMore = !!res?.has_more;
		if (repos.hasMore) repos.page += 1;
	} catch (error) {
		repos.error = error;
	} finally {
		repos.loading = false;
		repos.loadedOnce = true;
	}
}

const repoOptions = computed(() =>
	repos.list.map((r) => ({
		label: r.private ? `${r.full_name} 🔒` : r.full_name,
		value: r.full_name,
		default_branch: r.default_branch,
	})),
);

const branches = reactive({ list: [], loading: false, error: null });

async function loadBranches(fullName) {
	branches.list = [];
	if (!fullName) return;
	branches.loading = true;
	branches.error = null;
	try {
		branches.list =
			(await branchesResource.submit({ repo_full_name: fullName })) || [];
	} catch (error) {
		branches.error = error;
	} finally {
		branches.loading = false;
	}
}

const branchOptions = computed(() =>
	branches.list.map((b) => ({ label: b, value: b })),
);

// When the dialog reveals the Git-sync section, learn whether we're already
// connected (and if so, load the account list straight away).
watch(
	() => newSpace.git_synced,
	(synced) => {
		if (synced) {
			appInstallUrl.fetch();
			githubConnected.fetch().then(() => {
				if (githubConnected.data) installationsResource.fetch();
			});
		}
	},
);

// The App install also happens in a popup; poll installations until it appears.
function installApp() {
	const url = appInstallUrl.data;
	if (!url) {
		appInstallUrl.fetch();
		return;
	}
	const popup = window.open(
		url,
		'github-install',
		'popup,width=720,height=760',
	);
	stopConnectPoll();
	connectPoll = setInterval(async () => {
		if (popup && popup.closed) {
			stopConnectPoll();
			installationsResource.reload();
			return;
		}
		await installationsResource.reload();
		if ((installationsResource.data || []).length > 0) {
			stopConnectPoll();
			popup?.close();
		}
	}, 1500);
}

let connectPoll = null;
function stopConnectPoll() {
	if (connectPoll) {
		clearInterval(connectPoll);
		connectPoll = null;
	}
}

function connectGithub() {
	const popup = window.open(
		'/github/authorize',
		'github-connect',
		'popup,width=720,height=760',
	);
	githubConnected.loading = true;
	stopConnectPoll();
	connectPoll = setInterval(async () => {
		if (popup && popup.closed && !githubConnected.data) {
			stopConnectPoll();
			githubConnected.loading = false;
			return;
		}
		await githubConnected.reload();
		if (githubConnected.data) {
			stopConnectPoll();
			popup?.close();
			installationsResource.fetch();
		}
	}, 1500);
}

// Picking an account resets the downstream choices and loads its first repo page.
watch(
	() => newSpace.github_installation_id,
	(installationId) => {
		newSpace.repo_full_name = '';
		newSpace.branch = '';
		repos.loadedOnce = false;
		if (installationId) loadRepos({ search: '', reset: true });
	},
);

// Picking a repo defaults the branch to that repo's default branch and loads
// the rest of its branches for the selector.
watch(
	() => newSpace.repo_full_name,
	(fullName) => {
		const repo = repoOptions.value.find((r) => r.value === fullName);
		newSpace.branch = repo?.default_branch || '';
		loadBranches(fullName);
		if (fullName) formError.value = '';
	},
);

function slugify(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

watch(
	() => newSpace.space_name,
	(newName) => {
		if (!routeManuallyEdited.value) {
			newSpace.route = slugify(newName);
		}
	},
);

function handleRouteInput(value) {
	if (value !== slugify(newSpace.space_name)) {
		routeManuallyEdited.value = true;
	}
	newSpace.route = value;
	if (value) formError.value = '';
}

const columns = [
	{
		label: __('Name'),
		key: 'space_name',
		width: 2,
	},
	{
		label: __('Status'),
		key: 'is_published',
		width: 1,
	},
	{
		label: __('Route'),
		key: 'route',
		width: 2,
	},
	{
		// Wide last column, left-aligned: keeps the View and Delete buttons in one straight
		// column that starts right after the route rather than hugging the far edge.
		label: '',
		key: 'actions',
		width: 3,
		align: 'left',
	},
];

// Numeric width = fr weight, translated into the List grid template.
const tracks = columns.map((col) =>
	typeof col.width === 'number' ? `minmax(0,${col.width}fr)` : col.width,
);

// Open the space's public-facing reader. The reader lives at the site root
// (`/<route>`), outside the `/wiki-app` editor SPA, so it can't go through the
// router — a new tab keeps the editor session intact.
async function viewSpace(row) {
	try {
		const res = await fetch(
			`/api/method/wiki.api.get_space_capabilities?space=${encodeURIComponent(row.name)}`,
			{ credentials: 'same-origin' }
		);
		if (res.ok) {
			const json = await res.json();
			const data = json?.message;
			if (data && (!data.has_documents || !data.has_published_documents)) {
				toast.warning(__('No document in space'));
				return;
			}
		}
	} catch (e) {
		// Fall through
	}
	window.open(`/${row.route}`, '_blank', 'noopener');
}

const spaces = createListResource({
	doctype: 'Wiki Space',
	fields: [
		'name',
		'space_name',
		'route',
		'root_group',
		'is_published',
		'owner',
	],
	orderBy: 'creation desc',
	pageLength: 50,
	auto: true,
	insert: {
		onSuccess: (doc) => {
			showCreateDialog.value = false;
			newSpace.space_name = '';
			newSpace.route = '';
			newSpace.git_synced = false;
			newSpace.github_installation_id = '';
			newSpace.repo_full_name = '';
			newSpace.branch = '';
			newSpace.docs_subdir = 'docs';
			repos.list = [];
			repos.loadedOnce = false;
			branches.list = [];
			formError.value = '';
			routeManuallyEdited.value = false;
			toast.success(
				__('Wiki Space "{0}" created successfully.', [doc.space_name]),
			);
			// Synced spaces kick off their first sync automatically on the space
			// detail page (see SpaceDetails), so just navigate there.
			router.push({ name: 'SpaceDetails', params: { spaceId: doc.name } });
		},
	},
});

const spaceCategoriesResource = createResource({
	url: 'project_documentation.api.project_access.get_user_space_categories',
	auto: true,
});

const projectSpaceNames = computed(() => {
	const list =
		spaceCategoriesResource.data?.project_spaces ||
		spaceCategoriesResource.data?.message?.project_spaces ||
		[];
	return new Set(list);
});

const isPersonalRow = (row) => {
	return !projectSpaceNames.value.has(row?.name);
};

const projectSpaces = computed(() => {
	return (spaces.data || []).filter((s) => projectSpaceNames.value.has(s.name));
});

const personalSpaces = computed(() => {
	return (spaces.data || []).filter(
		(s) =>
			!projectSpaceNames.value.has(s.name) &&
			(s.owner === currentUser.value || isManager.value),
	);
});

const projectSpacesCount = computed(() => projectSpaces.value.length);
const personalSpacesCount = computed(() => personalSpaces.value.length);

const currentListItems = computed(() => {
	const list =
		activeCategory.value === 'personal'
			? personalSpaces.value
			: projectSpaces.value;
	if (!searchQuery.value) return list;
	const q = searchQuery.value.toLowerCase().trim();
	return list.filter(
		(s) =>
			(s.space_name || '').toLowerCase().includes(q) ||
			(s.route || '').toLowerCase().includes(q),
	);
});

let searchDebounceTimer = null;
watch(searchQuery, (value) => {
	clearTimeout(searchDebounceTimer);
	searchDebounceTimer = setTimeout(() => {
		spaces.update({
			filters: {},
			orFilters: value
				? [
						['space_name', 'like', `%${value}%`],
						['route', 'like', `%${value}%`],
					]
				: [],
			start: 0,
		});
		spaces.reload();
	}, 300);
});

const handleCreateSpace = async () => {
	formError.value = '';
	if (!newSpace.route) {
		formError.value = __('Route is required.');
		return;
	}

	if (createSpaceCategory.value === 'personal') {
		isCreating.value = true;
		try {
			const res = await createResource({
				url: 'wiki.api.create_personal_space',
				params: {
					space_name: newSpace.space_name || newSpace.route,
					route: newSpace.route,
				},
			}).submit();
			showCreateDialog.value = false;
			newSpace.space_name = '';
			newSpace.route = '';
			routeManuallyEdited.value = false;
			formError.value = '';
			toast.success(__('Personal Space created successfully.'));
			await spaces.reload();
			spaceCategoriesResource.reload();
			if (res?.name) {
				router.push({ name: 'SpaceDetails', params: { spaceId: res.name } });
			}
		} catch (err) {
			formError.value =
				err?.messages?.[0] || err?.message || __('Failed to create personal space');
		} finally {
			isCreating.value = false;
		}
		return;
	}

	if (newSpace.git_synced && !newSpace.repo_full_name.trim()) {
		formError.value = __('Please pick a GitHub repository');
		return;
	}

	const payload = {
		space_name: newSpace.space_name,
		route: newSpace.route,
		roles: [{ role: 'Guest', permission_level: 'Read' }],
	};

	if (newSpace.git_synced) {
		payload.git_synced = 1;
		payload.repo_full_name = newSpace.repo_full_name.trim();
		payload.branch = newSpace.branch.trim() || 'main';
		if (newSpace.docs_subdir.trim()) {
			payload.docs_subdir = newSpace.docs_subdir.trim();
		}
		if (newSpace.github_installation_id) {
			payload.github_installation_id = newSpace.github_installation_id;
		}
	}

	return spaces.insert.submit(payload);
};

function shareSpace(row) {
	if (!row?.name) return;
	handleShare({
		title: row.space_name || row.name,
		url: getSpaceCanonicalUrl(row.name),
	});
}

function confirmDeleteSpace(row) {
	spaceToDelete.value = row;
	showDeleteConfirm.value = true;
}

async function handleDeleteSpace() {
	if (!spaceToDelete.value) return;
	isDeleting.value = true;
	try {
		await createResource({
			url: 'frappe.client.delete',
			params: {
				doctype: 'Wiki Space',
				name: spaceToDelete.value.name,
			},
		}).submit();
		toast.success(__('Personal Space deleted successfully.'));
		showDeleteConfirm.value = false;
		spaceToDelete.value = null;
		await spaces.reload();
	} catch (err) {
		toast.error(
			err?.messages?.[0] || err?.message || __('Error deleting personal space.'),
		);
	} finally {
		isDeleting.value = false;
	}
}
</script>
