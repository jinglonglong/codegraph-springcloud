import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseConnection } from '../src/db';
import {
  parsePomContent,
  extractPortAndName,
  buildModuleTree,
  findModuleForFile,
  detectServicesAndPorts,
} from '../src/architecture/pom-tree-parser';

describe('pom-tree-parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-pom-tree-parser-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parsePomContent extracts modules, artifactId, packaging and spring boot plugin', () => {
    const pomContent = `
      <project>
        <parent>
          <groupId>com.example</groupId>
          <artifactId>parent-pom</artifactId>
          <version>1.0.0</version>
        </parent>
        <artifactId>user-service</artifactId>
        <packaging>war</packaging>
        <modules>
          <module>user-api</module>
          <module>user-impl</module>
        </modules>
        <build>
          <plugins>
            <plugin>
              <groupId>org.springframework.boot</groupId>
              <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
          </plugins>
        </build>
      </project>
    `;

    const pomPath = path.join(tempDir, 'user-service/pom.xml');
    fs.mkdirSync(path.dirname(pomPath), { recursive: true });
    fs.writeFileSync(pomPath, pomContent, 'utf-8');

    const result = parsePomContent(pomPath, tempDir, pomContent);

    expect(result.artifactId).toBe('user-service');
    expect(result.parentArtifactId).toBe('parent-pom');
    expect(result.packaging).toBe('war');
    expect(result.modules).toEqual(['user-api', 'user-impl']);
    expect(result.hasSpringBootPlugin).toBe(true);
    expect(result.relativePath).toBe('user-service');
  });

  it('extractPortAndName parses server.port and spring.application.name correctly', () => {
    const ymlContent = `
server:
  port: 8081
spring:
  application:
    name: test-service
    `;
    const ymlPath = path.join(tempDir, 'application.yml');
    fs.writeFileSync(ymlPath, ymlContent, 'utf-8');

    const ymlResult = extractPortAndName(ymlPath);
    expect(ymlResult.port).toBe(8081);
    expect(ymlResult.serviceName).toBe('test-service');

    const propsContent = `
server.port = 8082
spring.application.name=prop-service
    `;
    const propsPath = path.join(tempDir, 'application.properties');
    fs.writeFileSync(propsPath, propsContent, 'utf-8');

    const propsResult = extractPortAndName(propsPath);
    expect(propsResult.port).toBe(8082);
    expect(propsResult.serviceName).toBe('prop-service');
  });

  it('buildModuleTree lists all parsed pom objects', () => {
    const rootPom = `
      <project>
        <artifactId>root</artifactId>
        <modules>
          <module>module-a</module>
        </modules>
      </project>
    `;
    const childPom = `
      <project>
        <artifactId>module-a</artifactId>
        <parent>
          <artifactId>root</artifactId>
        </parent>
      </project>
    `;

    fs.writeFileSync(path.join(tempDir, 'pom.xml'), rootPom, 'utf-8');
    fs.mkdirSync(path.join(tempDir, 'module-a'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'module-a/pom.xml'), childPom, 'utf-8');

    const allFiles = ['pom.xml', 'module-a/pom.xml'];
    const poms = buildModuleTree(tempDir, allFiles);

    expect(poms).toHaveLength(2);
    const root = poms.find(p => p.relativePath === '');
    const child = poms.find(p => p.relativePath === 'module-a');

    expect(root).toBeDefined();
    expect(root?.artifactId).toBe('root');
    expect(child).toBeDefined();
    expect(child?.artifactId).toBe('module-a');
  });

  it('findModuleForFile maps files to closest module relative directory', () => {
    const modules = [
      { relativePath: '', artifactId: 'root' },
      { relativePath: 'services/user-service', artifactId: 'user-service' },
      { relativePath: 'common/common-dto', artifactId: 'common-dto' },
    ] as any[];

    expect(findModuleForFile('services/user-service/src/main/java/App.java', modules)?.artifactId).toBe('user-service');
    expect(findModuleForFile('common/common-dto/src/main/java/DTO.java', modules)?.artifactId).toBe('common-dto');
    expect(findModuleForFile('pom.xml', modules)?.artifactId).toBe('root');
    expect(findModuleForFile('other/file.txt', modules)?.artifactId).toBe('root');
  });
});
