/**
 * Sync FK regression test (issue #455).
 *
 * #62 plugged FK violations at the extraction layer (empty-named nodes whose
 * containment edges had no target). #455 reports the same `FOREIGN KEY constraint
 * failed` reappearing on v0.9.5, but during *watch sync* on a Python-only project —
 * a different trigger than the C/C++ header empty-name issue #62 covered.
 *
 * The reproducer below drives the same path the daemon takes: extract → resolve →
 * insert edges. The resolution pass's `insertEdges` was not guarded the way the
 * extraction-layer insert was after #62, so any edge with a stale source/target
 * (e.g. a synthesized framework target whose node was deleted by a concurrent
 * file rewrite) throws and aborts the sync, leaving the FK error the user sees.
 *
 * The test asserts: a sequence of file rewrites + sync()s never throws, and the
 * graph stays internally consistent (every edge's source + target are real nodes).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CodeGraph from '../src/index';
import { initGrammars, loadAllGrammars } from '../src/extraction/grammars';

beforeAll(async () => {
  await initGrammars();
  await loadAllGrammars();
});

describe('watch sync FK regression (#455)', () => {
  let tmpDir: string | undefined;
  let cg: CodeGraph | undefined;

  afterEach(() => {
    if (cg) {
      cg.close();
      cg = undefined;
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  function assertGraphIntegrity(cg: CodeGraph): void {
    // Every edge must reference real nodes. If FK was disabled or violated,
    // dangling refs would show up here.
    const db = (cg as unknown as { db: { getDb(): { prepare(sql: string): { get(): unknown } } } }).db;
    const sqlite = db.getDb();
    const dangling = sqlite
      .prepare(
        `SELECT count(*) as c FROM edges e
         WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.source)
            OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target)`
      )
      .get() as { c: number };
    expect(dangling.c).toBe(0);
  }

  it('survives repeated sync() cycles on a Django-style Python project without FK errors', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fk455-'));

    // Mimic a small Django app: requirements + manage.py marker, models/views/urls
    // in two app packages that cross-reference each other.
    fs.writeFileSync(path.join(tmpDir, 'manage.py'), '# django marker\n');
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'django==4.2\n');

    fs.mkdirSync(path.join(tmpDir, 'users'));
    fs.writeFileSync(path.join(tmpDir, 'users/__init__.py'), '');
    fs.writeFileSync(
      path.join(tmpDir, 'users/models.py'),
      'class User:\n' +
        '    def __init__(self, name):\n' +
        '        self.name = name\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'users/views.py'),
      'from users.models import User\n' +
        'class UserListView:\n' +
        '    def get(self, request):\n' +
        '        return User("a")\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'users/urls.py'),
      'from django.urls import path\n' +
        'from users.views import UserListView\n' +
        'urlpatterns = [path("users/", UserListView.as_view(), name="user-list")]\n'
    );

    fs.mkdirSync(path.join(tmpDir, 'posts'));
    fs.writeFileSync(path.join(tmpDir, 'posts/__init__.py'), '');
    fs.writeFileSync(
      path.join(tmpDir, 'posts/models.py'),
      'from users.models import User\n' +
        'class Post:\n' +
        '    def __init__(self, author):\n' +
        '        self.author = author\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'posts/views.py'),
      'from posts.models import Post\n' +
        'class PostListView:\n' +
        '    def get(self, request):\n' +
        '        return Post(None)\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'posts/urls.py'),
      'from django.urls import path\n' +
        'from posts.views import PostListView\n' +
        'urlpatterns = [path("posts/", PostListView.as_view(), name="post-list")]\n'
    );

    cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();
    assertGraphIntegrity(cg);

    // Drive the same path the daemon's file watcher drives: a series of file
    // rewrites + sync()s. We shuffle line counts on each rewrite so node IDs
    // (file:kind:name:line) shift around, forcing real INSERT OR REPLACE +
    // CASCADE behavior across files that cross-reference each other.
    const targets = [
      'users/views.py',
      'posts/views.py',
      'users/urls.py',
      'posts/urls.py',
      'users/models.py',
    ];

    for (let iter = 0; iter < 8; iter++) {
      const file = targets[iter % targets.length]!;
      const full = path.join(tmpDir, file);
      const content = fs.readFileSync(full, 'utf8');
      // Insert N blank lines at the top to shift every node's line number.
      const padded = '\n'.repeat(iter + 1) + content;
      // Use a future mtime so the size+mtime pre-filter in
      // ExtractionOrchestrator.sync can't skip the file.
      fs.writeFileSync(full, padded);
      const now = Date.now() + (iter + 1) * 1_000;
      fs.utimesSync(full, now / 1000, now / 1000);

      // The fix should make this never throw; before the fix, FK errors fire
      // during the resolution-layer insertEdges call inside sync().
      await expect(cg.sync()).resolves.toBeDefined();
      assertGraphIntegrity(cg);
    }
  });

  it("drops resolution edges whose target node is no longer in the graph (the pathology #455 reports)", async () => {
    // This narrower test reproduces the exact failure mode the user sees in
    // their daemon log: the resolver hands `insertEdges` an edge whose target
    // doesn't exist in `nodes`, and the FK constraint aborts the whole sync.
    //
    // We force the bug by populating the resolver's per-name cache with a
    // stale node (whose id is *not* in the DB) and then asking it to resolve
    // a reference to that name. Without the fix this throws
    // `FOREIGN KEY constraint failed`; with it, the bad edge is filtered out
    // and resolution returns normally.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fk455-stale-'));
    fs.writeFileSync(path.join(tmpDir, 'a.py'), 'def caller():\n    Target()\n');
    fs.writeFileSync(path.join(tmpDir, 'b.py'), 'class Target:\n    pass\n');

    cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    // Reach in to the internals — the simplest way to forge the "stale node
    // ID in the resolver's lookup path" condition the production bug arises
    // from. The fix is what the test is verifying; touching internals here
    // is a means to that end, not a contract we're asserting.
    type Internals = {
      queries: {
        getNodesByName(name: string): Array<{ id: string; name: string }>;
        getAllNodeNames(): string[];
      };
      resolver: {
        warmCaches(): void;
        resolveAndPersist(
          refs: Array<{
            fromNodeId: string;
            referenceName: string;
            referenceKind: string;
            line: number;
            column: number;
            filePath: string;
            language: string;
          }>
        ): { resolved: unknown[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nameCache: { set(key: string, value: any): void };
      };
    };
    const internals = cg as unknown as Internals;
    const queries = internals.queries;
    const resolver = internals.resolver;

    const caller = queries.getNodesByName('caller')[0];
    const target = queries.getNodesByName('Target')[0];
    expect(caller).toBeDefined();
    expect(target).toBeDefined();

    // Warm caches so warmCaches no-ops on the resolveAndPersist call below
    // and our seeded nameCache entry isn't overwritten.
    resolver.warmCaches();

    // Forge a stale lookup result: a Node whose `id` doesn't exist in the
    // `nodes` table. This is structurally what happens when a framework
    // resolver's WeakMap cache hands back a Node that was deleted by a
    // concurrent file rewrite — the user's #455 scenario.
    const staleNode = { ...target!, id: 'class:stale.py:Target:1' };
    resolver.nameCache.set('Target', [staleNode]);

    // Ask the resolver to persist an edge that will resolve via the seeded
    // (stale) cache entry. Without the FK filter this would throw
    // `FOREIGN KEY constraint failed` and abort the whole batch.
    expect(() =>
      resolver.resolveAndPersist([
        {
          fromNodeId: caller!.id,
          referenceName: 'Target',
          referenceKind: 'calls',
          line: 2,
          column: 4,
          filePath: 'a.py',
          language: 'python',
        },
      ])
    ).not.toThrow();

    // The bad edge must not have been persisted either — FK enforcement is
    // still on, and post-fix the dangling-edge count remains zero.
    assertGraphIntegrity(cg);
  });
});
