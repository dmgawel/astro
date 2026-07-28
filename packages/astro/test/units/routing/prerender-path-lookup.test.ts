import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrerenderPathLookup } from '../../../dist/core/routing/prerender-path-lookup.js';
import type { RouteData } from '../../../dist/types/public/internal.js';
import { dynamicPart, makeRoute, spreadPart, staticPart } from './test-helpers.ts';

function createDynamicRoute({
	route = '/articles/[slug]',
	component = 'src/pages/articles/[slug].astro',
	segments = [[staticPart('articles')], [dynamicPart('slug')]],
	type = 'page',
}: {
	route?: string;
	component?: string;
	segments?: RouteData['segments'];
	type?: RouteData['type'];
} = {}): RouteData {
	return makeRoute({
		route,
		component,
		segments,
		trailingSlash: 'ignore',
		pathname: undefined,
		type,
		prerender: true,
	});
}

describe('PrerenderPathLookup', () => {
	it('matches structurally equivalent route objects', () => {
		const route = createDynamicRoute();
		const clonedRoute = { ...route };
		const lookup = new PrerenderPathLookup([route], [{ pathname: '/articles/slow-page', route }]);

		assert.equal(lookup.has(clonedRoute, '/articles/slow-page'), true);
		assert.equal(lookup.has(clonedRoute, '/articles/missing'), false);
	});

	it('registers known-empty dynamic routes', () => {
		const route = createDynamicRoute();
		const lookup = new PrerenderPathLookup([route], []);

		assert.equal(lookup.has(route, '/articles/slow-page'), false);
	});

	it('returns undefined for unknown and static routes', () => {
		const knownRoute = createDynamicRoute();
		const unknownRoute = createDynamicRoute({ component: 'src/pages/other/[slug].astro' });
		const staticRoute = makeRoute({
			route: '/about',
			segments: [[staticPart('about')]],
			trailingSlash: 'ignore',
			pathname: '/about',
		});
		const lookup = new PrerenderPathLookup([knownRoute, staticRoute], []);

		assert.equal(lookup.has(unknownRoute, '/articles/slow-page'), undefined);
		assert.equal(lookup.has(staticRoute, '/about'), undefined);
	});

	it('normalizes root, slashes, Unicode, spaces, escapes, queries, and fragments', () => {
		const route = createDynamicRoute({
			route: '/[...slug]',
			component: 'src/pages/[...slug].astro',
			segments: [[spreadPart('slug')]],
		});
		const lookup = new PrerenderPathLookup(
			[route],
			[
				{ pathname: '/', route },
				{ pathname: '/articles/slow-page/', route },
				{ pathname: '/café', route },
				{ pathname: '/hello world', route },
				{ pathname: '/x/%23', route },
				{ pathname: '/x/%2F', route },
			],
		);

		assert.equal(lookup.has(route, '/'), true);
		assert.equal(lookup.has(route, 'articles/slow-page'), true);
		assert.equal(lookup.has(route, '/caf%C3%A9/'), true);
		assert.equal(lookup.has(route, '/hello%20world'), true);
		assert.equal(lookup.has(route, '/x/%23?value=ignored'), true);
		assert.equal(lookup.has(route, '/x/%2f#ignored'), true);
	});

	it('keeps structurally distinct route identities separate', () => {
		const route = createDynamicRoute({ route: '/a_b', component: 'c' });
		const collidingRoute = createDynamicRoute({ route: '/a', component: 'b_c' });
		const lookup = new PrerenderPathLookup(
			[route, collidingRoute],
			[{ pathname: '/only-first', route }],
		);

		assert.equal(lookup.has(route, '/only-first'), true);
		assert.equal(lookup.has(collidingRoute, '/only-first'), false);
	});
});
