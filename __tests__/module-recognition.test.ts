import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Springgraph from '../src/index';
import { facetRegistry } from '../src/architecture/facet-engine';
import { profileRegistry } from '../src/architecture/profile-registry';
import { registerSpringCloudProfile } from '../src/architecture/profiles/spring-cloud';

function writePom(dir: string, artifactId: string, options: {
  packaging?: string;
  modules?: string[];
  parent?: { groupId: string; artifactId: string };
  hasSpringBootPlugin?: boolean;
} = {}): void {
  const { packaging = 'jar', modules, parent, hasSpringBootPlugin } = options;
  const parentBlock = parent
    ? `<parent>\n    <groupId>${parent.groupId}</groupId>\n    <artifactId>${parent.artifactId}</artifactId>\n    <version>1.0.0</version>\n  </parent>`
    : '';
  const modulesBlock = modules && modules.length > 0
    ? `<modules>\n    ${modules.map(m => `<module>${m}</module>`).join('\n    ')}\n  </modules>`
    : '';
  const buildBlock = hasSpringBootPlugin
    ? `<build>\n    <plugins>\n      <plugin>\n        <groupId>org.springframework.boot</groupId>\n        <artifactId>spring-boot-maven-plugin</artifactId>\n      </plugin>\n    </plugins>\n  </build>`
    : '';

  fs.writeFileSync(
    path.join(dir, 'pom.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<project>\n  <modelVersion>4.0.0</modelVersion>\n  ${parentBlock}\n  <groupId>com.example</groupId>\n  <artifactId>${artifactId}</artifactId>\n  <version>1.0.0</version>\n  <packaging>${packaging}</packaging>\n  ${modulesBlock}\n  ${buildBlock}\n</project>\n`
  );
}

describe('Spring Cloud Maven module recognition', () => {
  let tempDir: string;
  let cg: Springgraph;

  beforeEach(async () => {
    profileRegistry.clear();
    facetRegistry.clear();
    registerSpringCloudProfile();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'springgraph-module-recognition-'));

    // Root aggregator pom
    writePom(tempDir, 'demo-parent', {
      packaging: 'pom',
      modules: ['user-service', 'order-service', 'shared-lib'],
    });

    // user-service: Spring Boot application
    const userServiceDir = path.join(tempDir, 'user-service');
    fs.mkdirSync(path.join(userServiceDir, 'src', 'main', 'java', 'com', 'example', 'user'), { recursive: true });
    fs.mkdirSync(path.join(userServiceDir, 'src', 'main', 'resources'), { recursive: true });
    writePom(userServiceDir, 'user-service', {
      parent: { groupId: 'com.example', artifactId: 'demo-parent' },
      hasSpringBootPlugin: true,
    });
    fs.writeFileSync(
      path.join(userServiceDir, 'src', 'main', 'resources', 'application.yml'),
      'server:\n  port: 8081\nspring:\n  application:\n    name: user-service\n'
    );
    fs.writeFileSync(
      path.join(userServiceDir, 'src', 'main', 'java', 'com', 'example', 'user', 'UserApplication.java'),
      'package com.example.user;\n' +
      'import org.springframework.boot.autoconfigure.SpringBootApplication;\n' +
      'import org.springframework.boot.SpringApplication;\n' +
      '@SpringBootApplication\n' +
      'public class UserApplication {\n' +
      '  public static void main(String[] args) { SpringApplication.run(UserApplication.class, args); }\n' +
      '}\n'
    );
    fs.writeFileSync(
      path.join(userServiceDir, 'src', 'main', 'java', 'com', 'example', 'user', 'UserController.java'),
      'package com.example.user;\n' +
      'import org.springframework.web.bind.annotation.RestController;\n' +
      '@RestController\n' +
      'public class UserController { }\n'
    );

    // order-service: Spring Boot application
    const orderServiceDir = path.join(tempDir, 'order-service');
    fs.mkdirSync(path.join(orderServiceDir, 'src', 'main', 'java', 'com', 'example', 'order'), { recursive: true });
    fs.mkdirSync(path.join(orderServiceDir, 'src', 'main', 'resources'), { recursive: true });
    writePom(orderServiceDir, 'order-service', {
      parent: { groupId: 'com.example', artifactId: 'demo-parent' },
      hasSpringBootPlugin: true,
    });
    fs.writeFileSync(
      path.join(orderServiceDir, 'src', 'main', 'resources', 'application.properties'),
      'server.port=8082\nspring.application.name=order-service\n'
    );
    fs.writeFileSync(
      path.join(orderServiceDir, 'src', 'main', 'java', 'com', 'example', 'order', 'OrderApplication.java'),
      'package com.example.order;\n' +
      'import org.springframework.boot.autoconfigure.SpringBootApplication;\n' +
      'import org.springframework.boot.SpringApplication;\n' +
      '@SpringBootApplication\n' +
      'public class OrderApplication {\n' +
      '  public static void main(String[] args) { SpringApplication.run(OrderApplication.class, args); }\n' +
      '}\n'
    );

    // shared-lib: plain library module
    const sharedLibDir = path.join(tempDir, 'shared-lib');
    fs.mkdirSync(path.join(sharedLibDir, 'src', 'main', 'java', 'com', 'example', 'shared'), { recursive: true });
    writePom(sharedLibDir, 'shared-lib', {
      parent: { groupId: 'com.example', artifactId: 'demo-parent' },
    });
    fs.writeFileSync(
      path.join(sharedLibDir, 'src', 'main', 'java', 'com', 'example', 'shared', 'SharedUtil.java'),
      'package com.example.shared;\npublic class SharedUtil { }\n'
    );

    cg = Springgraph.initSync(tempDir);
    await cg.indexAll();
  });

  afterEach(() => {
    try { cg?.unwatch(); } catch {}
    try { cg?.close(); } catch {}
    profileRegistry.clear();
    facetRegistry.clear();
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes the Maven module tree to the modules table', () => {
    const db = (cg as any).db as import('../src/db').DatabaseConnection;
    const rows = db.getDb().prepare('SELECT * FROM modules ORDER BY path').all() as Array<{
      path: string;
      name: string;
      packaging: string;
      is_service: number;
      port: number | null;
      parent_path: string | null;
    }>;

    expect(rows).toHaveLength(4);
    const byPath = new Map(rows.map(r => [r.path, r]));

    expect(byPath.get('')).toMatchObject({ name: 'demo-parent', packaging: 'pom', is_service: 0, parent_path: null });
    expect(byPath.get('user-service')).toMatchObject({ name: 'user-service', packaging: 'jar', is_service: 1, port: 8081, parent_path: '' });
    expect(byPath.get('order-service')).toMatchObject({ name: 'order-service', packaging: 'jar', is_service: 1, port: 8082, parent_path: '' });
    expect(byPath.get('shared-lib')).toMatchObject({ name: 'shared-lib', packaging: 'jar', is_service: 0, parent_path: '' });
  });

  it('maps files to their owning module', () => {
    const db = (cg as any).db as import('../src/db').DatabaseConnection;
    const rows = db.getDb().prepare(
      `SELECT f.path, m.path AS module_path FROM files f JOIN modules m ON f.module_id = m.id ORDER BY f.path`
    ).all() as Array<{ path: string; module_path: string }>;

    const byFile = new Map(rows.map(r => [r.path.replace(/\\/g, '/'), r.module_path]));
    expect(byFile.get('user-service/pom.xml')).toBe('user-service');
    expect(byFile.get('user-service/src/main/java/com/example/user/UserApplication.java')).toBe('user-service');
    expect(byFile.get('order-service/src/main/java/com/example/order/OrderApplication.java')).toBe('order-service');
    expect(byFile.get('shared-lib/src/main/java/com/example/shared/SharedUtil.java')).toBe('shared-lib');
    expect(byFile.get('pom.xml')).toBe('');
  });

  it('exposes moduleTree and serviceModules in the architecture snapshot', () => {
    const snapshot = cg.getArchitectureSnapshot();
    expect(snapshot.moduleTree).toBeDefined();
    expect(snapshot.moduleTree!.length).toBeGreaterThan(0);

    const root = snapshot.moduleTree![0];
    expect(root.path).toBe('');
    expect(root.children?.map(c => c.path).sort()).toEqual(['order-service', 'shared-lib', 'user-service']);

    expect(snapshot.serviceModules).toBeDefined();
    const servicePaths = snapshot.serviceModules!.map(m => m.path).sort();
    expect(servicePaths).toEqual(['order-service', 'user-service']);

    const userService = snapshot.serviceModules!.find(m => m.path === 'user-service');
    expect(userService?.port).toBe(8081);
    expect(userService?.isService).toBe(true);
  });

  it('enriches node facets with module and moduleType', () => {
    const snapshot = cg.getArchitectureSnapshot();

    const userApp = snapshot.nodes.find(n => n.name === 'UserApplication');
    expect(userApp).toBeDefined();
    const userAppFacet = snapshot.facets.get(userApp!.id);
    expect(userAppFacet?.module).toBe('user-service');
    expect(userAppFacet?.moduleType).toBe('service');
    expect(userAppFacet?.isEntrypoint).toBe(true);

    const sharedUtil = snapshot.nodes.find(n => n.name === 'SharedUtil');
    expect(sharedUtil).toBeDefined();
    const sharedUtilFacet = snapshot.facets.get(sharedUtil!.id);
    expect(sharedUtilFacet?.module).toBe('shared-lib');
    expect(sharedUtilFacet?.moduleType).toBe('library');
  });
});
