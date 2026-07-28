import type { PathWithRoute } from '../../types/public/integrations.js';
import type { RouteData } from '../../types/public/internal.js';
import { trimSlashes } from '../path.js';

type PathsByType = Map<RouteData['type'], Set<string>>;
type PathsByComponent = Map<string, PathsByType>;

export class PrerenderPathLookup {
	#pathsByRoute = new Map<string, PathsByComponent>();

	constructor(routes: Iterable<RouteData>, paths: Iterable<PathWithRoute>) {
		for (const route of routes) {
			this.#register(route);
		}
		for (const { pathname, route } of paths) {
			this.#get(route)?.add(canonicalizePathname(pathname));
		}
	}

	has(route: RouteData, pathname: string): boolean | undefined {
		const paths = this.#get(route);
		return paths?.has(canonicalizePathname(pathname));
	}

	#register(route: RouteData): void {
		if (route.params.length === 0) return;

		let pathsByComponent = this.#pathsByRoute.get(route.route);
		if (!pathsByComponent) {
			pathsByComponent = new Map();
			this.#pathsByRoute.set(route.route, pathsByComponent);
		}

		let pathsByType = pathsByComponent.get(route.component);
		if (!pathsByType) {
			pathsByType = new Map();
			pathsByComponent.set(route.component, pathsByType);
		}

		if (!pathsByType.has(route.type)) {
			pathsByType.set(route.type, new Set());
		}
	}

	#get(route: RouteData): Set<string> | undefined {
		return this.#pathsByRoute.get(route.route)?.get(route.component)?.get(route.type);
	}
}

function canonicalizePathname(pathname: string): string {
	const pathnameEnd = pathname.search(/[?#]/);
	const urlPathname = pathnameEnd === -1 ? pathname : pathname.slice(0, pathnameEnd);
	const url = new URL('http://astro.build');
	url.pathname = urlPathname;
	const normalized = trimSlashes(url.pathname).replace(/%[0-9a-f]{2}/gi, (escape) =>
		escape.toUpperCase(),
	);
	return normalized || '/';
}
