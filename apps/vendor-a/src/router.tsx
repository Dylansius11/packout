import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './components/app-shell';
import { HomePage } from './features/home/home-page';
import { JoinPage } from './features/join/join-page';
import { IssuePage } from './features/journal/issue-page';
import { IssuesPage } from './features/journal/issues-page';
import { WorkspaceLayout } from './features/journal/workspace-layout';
import { NewWorkspacePage } from './features/onboarding/new-workspace-page';
import { SetupPage } from './features/onboarding/setup-page';

const rootRoute = createRootRoute({ component: AppShell });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const newRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/new',
  component: NewWorkspacePage,
});
const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join',
  component: JoinPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup/$salt',
  component: () => <SetupPage salt={setupRoute.useParams().salt} />,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/w/$wsId',
  component: () => <WorkspaceLayout wsId={workspaceRoute.useParams().wsId} />,
});
const issuesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: IssuesPage,
});
const issueRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/issues/$issueId',
  component: () => <IssuePage issueId={issueRoute.useParams().issueId} />,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  newRoute,
  joinRoute,
  setupRoute,
  workspaceRoute.addChildren([issuesRoute, issueRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
