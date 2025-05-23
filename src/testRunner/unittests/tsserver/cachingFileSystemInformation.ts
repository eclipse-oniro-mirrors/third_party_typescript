import * as ts from "../../_namespaces/ts";

describe("unittests:: tsserver:: CachingFileSystemInformation:: tsserverProjectSystem CachingFileSystemInformation", () => {
    enum CalledMapsWithSingleArg {
        fileExists = "fileExists",
        directoryExists = "directoryExists",
        getDirectories = "getDirectories",
        readFile = "readFile"
    }
    enum CalledMapsWithFiveArgs {
        readDirectory = "readDirectory"
    }
    type CalledMaps = CalledMapsWithSingleArg | CalledMapsWithFiveArgs;
    type CalledWithFiveArgs = [readonly string[], readonly string[], readonly string[], number];
    function createLoggerTrackingHostCalls(host: ts.projectSystem.TestServerHost) {
        const calledMaps: Record<CalledMapsWithSingleArg, ts.MultiMap<string, true>> & Record<CalledMapsWithFiveArgs, ts.MultiMap<string, CalledWithFiveArgs>> = {
            fileExists: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.fileExists),
            directoryExists: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.directoryExists),
            getDirectories: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.getDirectories),
            readFile: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.readFile),
            readDirectory: setCallsTrackingWithFiveArgFn(CalledMapsWithFiveArgs.readDirectory)
        };

        return logCacheAndClear;

        function setCallsTrackingWithSingleArgFn(prop: CalledMapsWithSingleArg) {
            const calledMap = ts.createMultiMap<true>();
            const cb = (host as any)[prop].bind(host);
            (host as any)[prop] = (f: string) => {
                calledMap.add(f, /*value*/ true);
                return cb(f);
            };
            return calledMap;
        }

        function setCallsTrackingWithFiveArgFn<U, V, W, X>(prop: CalledMapsWithFiveArgs) {
            const calledMap = ts.createMultiMap<[U, V, W, X]>();
            const cb = (host as any)[prop].bind(host);
            (host as any)[prop] = (f: string, arg1?: U, arg2?: V, arg3?: W, arg4?: X) => {
                calledMap.add(f, [arg1!, arg2!, arg3!, arg4!]); // TODO: GH#18217
                return cb(f, arg1, arg2, arg3, arg4);
            };
            return calledMap;
        }

        function logCacheEntry(logger: ts.projectSystem.Logger, callback: CalledMaps) {
            const result = ts.arrayFrom<[string, (true | CalledWithFiveArgs)[]], { key: string, count: number }>(calledMaps[callback].entries(), ([key, arr]) => ({ key, count: arr.length }));
            logger.info(`${callback}:: ${JSON.stringify(result)}`);
            calledMaps[callback].clear();
        }

        function logCacheAndClear(logger: ts.projectSystem.Logger) {
            logCacheEntry(logger, CalledMapsWithSingleArg.fileExists);
            logCacheEntry(logger, CalledMapsWithSingleArg.directoryExists);
            logCacheEntry(logger, CalledMapsWithSingleArg.getDirectories);
            logCacheEntry(logger, CalledMapsWithSingleArg.readFile);
            logCacheEntry(logger, CalledMapsWithFiveArgs.readDirectory);
        }
    }

    function logSemanticDiagnostics(projectService: ts.server.ProjectService, project: ts.server.Project, file: ts.projectSystem.File) {
        const diags = project.getLanguageService().getSemanticDiagnostics(file.path);
        projectService.logger.info(`getSemanticDiagnostics:: ${file.path}:: ${diags.length}`);
        diags.forEach(d => projectService.logger.info(ts.formatDiagnostic(d, project)));
    }

    it("works using legacy resolution logic", () => {
        let rootContent = `import {x} from "f1"`;
        const root: ts.projectSystem.File = {
            path: "/c/d/f0.ts",
            content: rootContent
        };

        const imported: ts.projectSystem.File = {
            path: "/c/f1.ts",
            content: `foo()`
        };

        const host = ts.projectSystem.createServerHost([root, imported]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true });
        projectService.openClientFile(root.path);
        const project = projectService.inferredProjects[0];
        const rootScriptInfo = project.getRootScriptInfos()[0];
        assert.equal(rootScriptInfo.fileName, root.path);

        // ensure that imported file was found
        logSemanticDiagnostics(projectService, project, imported);

        const logCacheAndClear = createLoggerTrackingHostCalls(host);

        // trigger synchronization to make sure that import will be fetched from the cache
        // ensure file has correct number of errors after edit
        editContent(`import {x} from "f1";
                 var x: string = 1;`);
        logSemanticDiagnostics(projectService, project, imported);
        logCacheAndClear(projectService.logger);

        // trigger synchronization to make sure that the host will try to find 'f2' module on disk
        editContent(`import {x} from "f2"`);
        try {
            // trigger synchronization to make sure that the host will try to find 'f2' module on disk
            logSemanticDiagnostics(projectService, project, imported);
        }
        catch (e) {
            projectService.logger.info(e.message);
        }
        logCacheAndClear(projectService.logger);

        editContent(`import {x} from "f1"`);
        logSemanticDiagnostics(projectService, project, imported);
        logCacheAndClear(projectService.logger);

        // setting compiler options discards module resolution cache
        projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true, target: ts.ScriptTarget.ES5 });
        logSemanticDiagnostics(projectService, project, imported);
        logCacheAndClear(projectService.logger);
        ts.projectSystem.baselineTsserverLogs("cachingFileSystemInformation", "works using legacy resolution logic", projectService);

        function editContent(newContent: string) {
            rootScriptInfo.editContent(0, rootContent.length, newContent);
            rootContent = newContent;
        }
    });

    it("loads missing files from disk", () => {
        const root: ts.projectSystem.File = {
            path: "/c/foo.ts",
            content: `import {y} from "bar"`
        };

        const imported: ts.projectSystem.File = {
            path: "/c/bar.d.ts",
            content: `export var y = 1`
        };

        const host = ts.projectSystem.createServerHost([root]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true });
        const logCacheAndClear = createLoggerTrackingHostCalls(host);
        projectService.openClientFile(root.path);
        const project = projectService.inferredProjects[0];
        const rootScriptInfo = project.getRootScriptInfos()[0];
        assert.equal(rootScriptInfo.fileName, root.path);

        logSemanticDiagnostics(projectService, project, root);
        logCacheAndClear(projectService.logger);

        host.writeFile(imported.path, imported.content);
        host.runQueuedTimeoutCallbacks();
        logSemanticDiagnostics(projectService, project, root);
        logCacheAndClear(projectService.logger);
        ts.projectSystem.baselineTsserverLogs("cachingFileSystemInformation", "loads missing files from disk", projectService);
    });

    it("when calling goto definition of module", () => {
        const clientFile: ts.projectSystem.File = {
            path: "/a/b/controllers/vessels/client.ts",
            content: `
                    import { Vessel } from '~/models/vessel';
                    const v = new Vessel();
                `
        };
        const anotherModuleFile: ts.projectSystem.File = {
            path: "/a/b/utils/db.ts",
            content: "export class Bookshelf { }"
        };
        const moduleFile: ts.projectSystem.File = {
            path: "/a/b/models/vessel.ts",
            content: `
                    import { Bookshelf } from '~/utils/db';
                    export class Vessel extends Bookshelf {}
                `
        };
        const tsconfigFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({
                compilerOptions: {
                    target: "es6",
                    module: "es6",
                    baseUrl: "./",  // all paths are relative to the baseUrl
                    paths: {
                        "~/*": ["*"]   // resolve any `~/foo/bar` to `<baseUrl>/foo/bar`
                    }
                },
                exclude: [
                    "api",
                    "build",
                    "node_modules",
                    "public",
                    "seeds",
                    "sql_updates",
                    "tests.build"
                ]
            })
        };
        const projectFiles = [clientFile, anotherModuleFile, moduleFile, tsconfigFile];
        const host = ts.projectSystem.createServerHost(projectFiles);
        const session = ts.projectSystem.createSession(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        ts.projectSystem.openFilesForSession([clientFile], session);
        const logCacheAndClear = createLoggerTrackingHostCalls(host);

        // Get definitions shouldnt make host requests
        const getDefinitionRequest = ts.projectSystem.makeSessionRequest<ts.projectSystem.protocol.FileLocationRequestArgs>(ts.projectSystem.protocol.CommandTypes.Definition, {
            file: clientFile.path,
            position: clientFile.content.indexOf("/vessel") + 1,
            line: undefined!, // TODO: GH#18217
            offset: undefined! // TODO: GH#18217
        });
        session.executeCommand(getDefinitionRequest);
        logCacheAndClear(session.logger);

        // Open the file should call only file exists on module directory and use cached value for parental directory
        ts.projectSystem.openFilesForSession([moduleFile], session);
        logCacheAndClear(session.logger);

        ts.projectSystem.baselineTsserverLogs("cachingFileSystemInformation", "when calling goto definition of module", session);
    });

    describe("WatchDirectories for config file with", () => {
        function verifyWatchDirectoriesCaseSensitivity(useCaseSensitiveFileNames: boolean) {
            it(`watchDirectories for config file with case ${useCaseSensitiveFileNames ? "" : "in"}sensitive file system`, () => {
                const frontendDir = "/Users/someuser/work/applications/frontend";
                const file1: ts.projectSystem.File = {
                    path: `${frontendDir}/src/app/utils/Analytic.ts`,
                    content: "export class SomeClass { };"
                };
                const file2: ts.projectSystem.File = {
                    path: `${frontendDir}/src/app/redux/configureStore.ts`,
                    content: "export class configureStore { }"
                };
                const file3: ts.projectSystem.File = {
                    path: `${frontendDir}/src/app/utils/Cookie.ts`,
                    content: "export class Cookie { }"
                };
                const es2016LibFile: ts.projectSystem.File = {
                    path: "/a/lib/lib.es2016.full.d.ts",
                    content: ts.projectSystem.libFile.content
                };
                const typeRoots = ["types", "node_modules/@types"];
                const types = ["node", "jest"];
                const tsconfigFile: ts.projectSystem.File = {
                    path: `${frontendDir}/tsconfig.json`,
                    content: JSON.stringify({
                        compilerOptions: {
                            strict: true,
                            strictNullChecks: true,
                            target: "es2016",
                            module: "commonjs",
                            moduleResolution: "node",
                            sourceMap: true,
                            noEmitOnError: true,
                            experimentalDecorators: true,
                            emitDecoratorMetadata: true,
                            types,
                            noUnusedLocals: true,
                            outDir: "./compiled",
                            typeRoots,
                            baseUrl: ".",
                            paths: {
                                "*": [
                                    "types/*"
                                ]
                            }
                        },
                        include: [
                            "src/**/*"
                        ],
                        exclude: [
                            "node_modules",
                            "compiled"
                        ]
                    })
                };
                const projectFiles = [file1, file2, es2016LibFile, tsconfigFile];
                const host = ts.projectSystem.createServerHost(projectFiles, { useCaseSensitiveFileNames });
                const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
                projectService.openClientFile(file1.path);

                const logCacheAndClear = createLoggerTrackingHostCalls(host);

                // Create file cookie.ts
                host.writeFile(file3.path, file3.content);
                host.runQueuedTimeoutCallbacks();
                logCacheAndClear(projectService.logger);

                projectService.openClientFile(file3.path);
                logCacheAndClear(projectService.logger);
                ts.projectSystem.baselineTsserverLogs("cachingFileSystemInformation", `watchDirectories for config file with case ${useCaseSensitiveFileNames ? "" : "in"}sensitive file system`, projectService);
            });
        }
        verifyWatchDirectoriesCaseSensitivity(/*useCaseSensitiveFileNames*/ false);
        verifyWatchDirectoriesCaseSensitivity(/*useCaseSensitiveFileNames*/ true);
    });

    describe("Subfolder invalidations correctly include parent folder failed lookup locations", () => {
        function runFailedLookupTest(resolution: "Node" | "Classic") {
            const projectLocation = "/proj";
            const file1: ts.projectSystem.File = {
                path: `${projectLocation}/foo/boo/app.ts`,
                content: `import * as debug from "debug"`
            };
            const file2: ts.projectSystem.File = {
                path: `${projectLocation}/foo/boo/moo/app.ts`,
                content: `import * as debug from "debug"`
            };
            const tsconfig: ts.projectSystem.File = {
                path: `${projectLocation}/tsconfig.json`,
                content: JSON.stringify({
                    files: ["foo/boo/app.ts", "foo/boo/moo/app.ts"],
                    moduleResolution: resolution
                })
            };

            const files = [file1, file2, tsconfig, ts.projectSystem.libFile];
            const host = ts.projectSystem.createServerHost(files);
            const service = ts.projectSystem.createProjectService(host);
            service.openClientFile(file1.path);

            const project = service.configuredProjects.get(tsconfig.path)!;
            ts.projectSystem.checkProjectActualFiles(project, files.map(f => f.path));
            assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file1.path).map(diag => diag.messageText), ["Cannot find module 'debug' or its corresponding type declarations."]);
            assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file2.path).map(diag => diag.messageText), ["Cannot find module 'debug' or its corresponding type declarations."]);

            const debugTypesFile: ts.projectSystem.File = {
                path: `${projectLocation}/node_modules/debug/index.d.ts`,
                content: "export {}"
            };
            files.push(debugTypesFile);
            host.writeFile(debugTypesFile.path, debugTypesFile.content);
            host.runQueuedTimeoutCallbacks(); // Scheduled invalidation of resolutions
            host.runQueuedTimeoutCallbacks(); // Actual update
            ts.projectSystem.checkProjectActualFiles(project, files.map(f => f.path));
            assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file1.path).map(diag => diag.messageText), []);
            assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file2.path).map(diag => diag.messageText), []);
        }

        it("Includes the parent folder FLLs in node module resolution mode", () => {
            runFailedLookupTest("Node");
        });
        it("Includes the parent folder FLLs in classic module resolution mode", () => {
            runFailedLookupTest("Classic");
        });
    });

    describe("Verify npm install in directory with tsconfig file works when", () => {
        function verifyNpmInstall(timeoutDuringPartialInstallation: boolean) {
            const root = "/user/username/rootfolder/otherfolder";
            const getRootedFileOrFolder = (fileOrFolder: ts.projectSystem.File) => {
                fileOrFolder.path = root + fileOrFolder.path;
                return fileOrFolder;
            };
            const app: ts.projectSystem.File = getRootedFileOrFolder({
                path: "/a/b/app.ts",
                content: "import _ from 'lodash';"
            });
            const tsconfigJson: ts.projectSystem.File = getRootedFileOrFolder({
                path: "/a/b/tsconfig.json",
                content: '{ "compilerOptions": { } }'
            });
            const packageJson: ts.projectSystem.File = getRootedFileOrFolder({
                path: "/a/b/package.json",
                content: `
{
  "name": "test",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {
    "lodash",
    "rxjs"
  },
  "devDependencies": {
    "@types/lodash",
    "typescript"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
`
            });
            const host = ts.projectSystem.createServerHost([app, ts.projectSystem.libFile, tsconfigJson, packageJson]);
            const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
            projectService.setHostConfiguration({ preferences: { includePackageJsonAutoImports: "off" } });
            projectService.openClientFile(app.path);

            let npmInstallComplete = false;

            // Simulate npm install
            const filesAndFoldersToAdd: ts.projectSystem.File[] = [
                { path: "/a/b/node_modules" },
                { path: "/a/b/node_modules/.staging/@types" },
                { path: "/a/b/node_modules/.staging/lodash-b0733faa" },
                { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61" },
                { path: "/a/b/node_modules/.staging/typescript-8493ea5d" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/package.json", content: "{\n  \"name\": \"symbol-observable\",\n  \"version\": \"1.0.4\",\n  \"description\": \"Symbol.observable ponyfill\",\n  \"license\": \"MIT\",\n  \"repository\": \"blesh/symbol-observable\",\n  \"author\": {\n    \"name\": \"Ben Lesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"engines\": {\n    \"node\": \">=0.10.0\"\n  },\n  \"scripts\": {\n    \"test\": \"npm run build && mocha && tsc ./ts-test/test.ts && node ./ts-test/test.js && check-es3-syntax -p lib/ --kill\",\n    \"build\": \"babel es --out-dir lib\",\n    \"prepublish\": \"npm test\"\n  },\n  \"files\": [\n    \"" },
                { path: "/a/b/node_modules/.staging/lodash-b0733faa/package.json", content: "{\n  \"name\": \"lodash\",\n  \"version\": \"4.17.4\",\n  \"description\": \"Lodash modular utilities.\",\n  \"keywords\": \"modules, stdlib, util\",\n  \"homepage\": \"https://lodash.com/\",\n  \"repository\": \"lodash/lodash\",\n  \"icon\": \"https://lodash.com/icon.svg\",\n  \"license\": \"MIT\",\n  \"main\": \"lodash.js\",\n  \"author\": \"John-David Dalton <john.david.dalton@gmail.com> (http://allyoucanleet.com/)\",\n  \"contributors\": [\n    \"John-David Dalton <john.david.dalton@gmail.com> (http://allyoucanleet.com/)\",\n    \"Mathias Bynens <mathias@qiwi." },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/package.json", content: "{\n  \"name\": \"rxjs\",\n  \"version\": \"5.4.3\",\n  \"description\": \"Reactive Extensions for modern JavaScript\",\n  \"main\": \"Rx.js\",\n  \"config\": {\n    \"commitizen\": {\n      \"path\": \"cz-conventional-changelog\"\n    }\n  },\n  \"lint-staged\": {\n    \"*.@(js)\": [\n      \"eslint --fix\",\n      \"git add\"\n    ],\n    \"*.@(ts)\": [\n      \"eslint -c .eslintrc --ext .ts . --fix\",\n      \"git add\"\n    ]\n  },\n  \"scripts-info\": {\n    \"info\": \"List available script\",\n    \"build_all\": \"Build all packages (ES6, CJS, UMD) and generate packages\",\n    \"build_cjs\": \"Build CJS package with clean up existing build, copy source into dist\",\n    \"build_es6\": \"Build ES6 package with clean up existing build, copy source into dist\",\n    \"build_closure_core\": \"Minify Global core build using closure compiler\",\n    \"build_global\": \"Build Global package, then minify build\",\n    \"build_perf\": \"Build CJS & Global build, run macro performance test\",\n    \"build_test\": \"Build CJS package & test spec, execute mocha test runner\",\n    \"build_cover\": \"Run lint to current code, build CJS & test spec, execute test coverage\",\n    \"build_docs\": \"Build ES6 & global package, create documentation using it\",\n    \"build_spec\": \"Build test specs\",\n    \"check_circular_dependencies\": \"Check codebase has circular dependencies\",\n    \"clean_spec\": \"Clean up existing test spec build output\",\n    \"clean_dist_cjs\": \"Clean up existing CJS package output\",\n    \"clean_dist_es6\": \"Clean up existing ES6 package output\",\n    \"clean_dist_global\": \"Clean up existing Global package output\",\n    \"commit\": \"Run git commit wizard\",\n    \"compile_dist_cjs\": \"Compile codebase into CJS module\",\n    \"compile_module_es6\": \"Compile codebase into ES6\",\n    \"cover\": \"Execute test coverage\",\n    \"lint_perf\": \"Run lint against performance test suite\",\n    \"lint_spec\": \"Run lint against test spec\",\n    \"lint_src\": \"Run lint against source\",\n    \"lint\": \"Run lint against everything\",\n    \"perf\": \"Run macro performance benchmark\",\n    \"perf_micro\": \"Run micro performance benchmark\",\n    \"test_mocha\": \"Execute mocha test runner against existing test spec build\",\n    \"test_browser\": \"Execute mocha test runner on browser against existing test spec build\",\n    \"test\": \"Clean up existing test spec build, build test spec and execute mocha test runner\",\n    \"tests2png\": \"Generate marble diagram image from test spec\",\n    \"watch\": \"Watch codebase, trigger compile when source code changes\"\n  },\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git@github.com:ReactiveX/RxJS.git\"\n  },\n  \"keywords\": [\n    \"Rx\",\n    \"RxJS\",\n    \"ReactiveX\",\n    \"ReactiveExtensions\",\n    \"Streams\",\n    \"Observables\",\n    \"Observable\",\n    \"Stream\",\n    \"ES6\",\n    \"ES2015\"\n  ],\n  \"author\": \"Ben Lesh <ben@benlesh.com>\",\n  \"contributors\": [\n    {\n      \"name\": \"Ben Lesh\",\n      \"email\": \"ben@benlesh.com\"\n    },\n    {\n      \"name\": \"Paul Taylor\",\n      \"email\": \"paul.e.taylor@me.com\"\n    },\n    {\n      \"name\": \"Jeff Cross\",\n      \"email\": \"crossj@google.com\"\n    },\n    {\n      \"name\": \"Matthew Podwysocki\",\n      \"email\": \"matthewp@microsoft.com\"\n    },\n    {\n      \"name\": \"OJ Kwon\",\n      \"email\": \"kwon.ohjoong@gmail.com\"\n    },\n    {\n      \"name\": \"Andre Staltz\",\n      \"email\": \"andre@staltz.com\"\n    }\n  ],\n  \"license\": \"Apache-2.0\",\n  \"bugs\": {\n    \"url\": \"https://github.com/ReactiveX/RxJS/issues\"\n  },\n  \"homepage\": \"https://github.com/ReactiveX/RxJS\",\n  \"devDependencies\": {\n    \"babel-polyfill\": \"^6.23.0\",\n    \"benchmark\": \"^2.1.0\",\n    \"benchpress\": \"2.0.0-beta.1\",\n    \"chai\": \"^3.5.0\",\n    \"color\": \"^0.11.1\",\n    \"colors\": \"1.1.2\",\n    \"commitizen\": \"^2.8.6\",\n    \"coveralls\": \"^2.11.13\",\n    \"cz-conventional-changelog\": \"^1.2.0\",\n    \"danger\": \"^1.1.0\",\n    \"doctoc\": \"^1.0.0\",\n    \"escape-string-regexp\": \"^1.0.5 \",\n    \"esdoc\": \"^0.4.7\",\n    \"eslint\": \"^3.8.0\",\n    \"fs-extra\": \"^2.1.2\",\n    \"get-folder-size\": \"^1.0.0\",\n    \"glob\": \"^7.0.3\",\n    \"gm\": \"^1.22.0\",\n    \"google-closure-compiler-js\": \"^20170218.0.0\",\n    \"gzip-size\": \"^3.0.0\",\n    \"http-server\": \"^0.9.0\",\n    \"husky\": \"^0.13.3\",\n    \"lint-staged\": \"3.2.5\",\n    \"lodash\": \"^4.15.0\",\n    \"madge\": \"^1.4.3\",\n    \"markdown-doctest\": \"^0.9.1\",\n    \"minimist\": \"^1.2.0\",\n    \"mkdirp\": \"^0.5.1\",\n    \"mocha\": \"^3.0.2\",\n    \"mocha-in-sauce\": \"0.0.1\",\n    \"npm-run-all\": \"^4.0.2\",\n    \"npm-scripts-info\": \"^0.3.4\",\n    \"nyc\": \"^10.2.0\",\n    \"opn-cli\": \"^3.1.0\",\n    \"platform\": \"^1.3.1\",\n    \"promise\": \"^7.1.1\",\n    \"protractor\": \"^3.1.1\",\n    \"rollup\": \"0.36.3\",\n    \"rollup-plugin-inject\": \"^2.0.0\",\n    \"rollup-plugin-node-resolve\": \"^2.0.0\",\n    \"rx\": \"latest\",\n    \"rxjs\": \"latest\",\n    \"shx\": \"^0.2.2\",\n    \"sinon\": \"^2.1.0\",\n    \"sinon-chai\": \"^2.9.0\",\n    \"source-map-support\": \"^0.4.0\",\n    \"tslib\": \"^1.5.0\",\n    \"eslint\": \"^4.4.2\",\n    \"typescript\": \"~2.0.6\",\n    \"typings\": \"^2.0.0\",\n    \"validate-commit-msg\": \"^2.14.0\",\n    \"watch\": \"^1.0.1\",\n    \"webpack\": \"^1.13.1\",\n    \"xmlhttprequest\": \"1.8.0\"\n  },\n  \"engines\": {\n    \"npm\": \">=2.0.0\"\n  },\n  \"typings\": \"Rx.d.ts\",\n  \"dependencies\": {\n    \"symbol-observable\": \"^1.0.1\"\n  }\n}" },
                { path: "/a/b/node_modules/.staging/typescript-8493ea5d/package.json", content: "{\n    \"name\": \"typescript\",\n    \"author\": \"Microsoft Corp.\",\n    \"homepage\": \"http://typescriptlang.org/\",\n    \"version\": \"2.4.2\",\n    \"license\": \"Apache-2.0\",\n    \"description\": \"TypeScript is a language for application scale JavaScript development\",\n    \"keywords\": [\n        \"TypeScript\",\n        \"Microsoft\",\n        \"compiler\",\n        \"language\",\n        \"javascript\"\n    ],\n    \"bugs\": {\n        \"url\": \"https://github.com/Microsoft/TypeScript/issues\"\n    },\n    \"repository\": {\n        \"type\": \"git\",\n        \"url\": \"https://github.com/Microsoft/TypeScript.git\"\n    },\n    \"main\": \"./lib/typescript.js\",\n    \"typings\": \"./lib/typescript.d.ts\",\n    \"bin\": {\n        \"tsc\": \"./bin/tsc\",\n        \"tsserver\": \"./bin/tsserver\"\n    },\n    \"engines\": {\n        \"node\": \">=4.2.0\"\n    },\n    \"devDependencies\": {\n        \"@types/browserify\": \"latest\",\n        \"@types/chai\": \"latest\",\n        \"@types/convert-source-map\": \"latest\",\n        \"@types/del\": \"latest\",\n        \"@types/glob\": \"latest\",\n        \"@types/gulp\": \"latest\",\n        \"@types/gulp-concat\": \"latest\",\n        \"@types/gulp-help\": \"latest\",\n        \"@types/gulp-newer\": \"latest\",\n        \"@types/gulp-sourcemaps\": \"latest\",\n        \"@types/merge2\": \"latest\",\n        \"@types/minimatch\": \"latest\",\n        \"@types/minimist\": \"latest\",\n        \"@types/mkdirp\": \"latest\",\n        \"@types/mocha\": \"latest\",\n        \"@types/node\": \"latest\",\n        \"@types/q\": \"latest\",\n        \"@types/run-sequence\": \"latest\",\n        \"@types/through2\": \"latest\",\n        \"browserify\": \"latest\",\n        \"chai\": \"latest\",\n        \"convert-source-map\": \"latest\",\n        \"del\": \"latest\",\n        \"gulp\": \"latest\",\n        \"gulp-clone\": \"latest\",\n        \"gulp-concat\": \"latest\",\n        \"gulp-help\": \"latest\",\n        \"gulp-insert\": \"latest\",\n        \"gulp-newer\": \"latest\",\n        \"gulp-sourcemaps\": \"latest\",\n        \"gulp-typescript\": \"latest\",\n        \"into-stream\": \"latest\",\n        \"istanbul\": \"latest\",\n        \"jake\": \"latest\",\n        \"merge2\": \"latest\",\n        \"minimist\": \"latest\",\n        \"mkdirp\": \"latest\",\n        \"mocha\": \"latest\",\n        \"mocha-fivemat-progress-reporter\": \"latest\",\n        \"q\": \"latest\",\n        \"run-sequence\": \"latest\",\n        \"sorcery\": \"latest\",\n        \"through2\": \"latest\",\n        \"travis-fold\": \"latest\",\n        \"ts-node\": \"latest\",\n        \"eslint\": \"5.16.0\",\n        \"typescript\": \"^2.4\"\n    },\n    \"scripts\": {\n        \"pretest\": \"jake tests\",\n        \"test\": \"jake runtests-parallel\",\n        \"build\": \"npm run build:compiler && npm run build:tests\",\n        \"build:compiler\": \"jake local\",\n        \"build:tests\": \"jake tests\",\n        \"start\": \"node lib/tsc\",\n        \"clean\": \"jake clean\",\n        \"gulp\": \"gulp\",\n        \"jake\": \"jake\",\n        \"lint\": \"jake lint\",\n        \"setup-hooks\": \"node scripts/link-hooks.js\"\n    },\n    \"browser\": {\n        \"buffer\": false,\n        \"fs\": false,\n        \"os\": false,\n        \"path\": false\n    }\n}" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/index.js", content: "module.exports = require('./lib/index');\n" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/index.d.ts", content: "declare const observableSymbol: symbol;\nexport default observableSymbol;\n" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/lib" },
                { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/lib/index.js", content: "'use strict';\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nvar _ponyfill = require('./ponyfill');\n\nvar _ponyfill2 = _interopRequireDefault(_ponyfill);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }\n\nvar root; /* global window */\n\n\nif (typeof self !== 'undefined') {\n  root = self;\n} else if (typeof window !== 'undefined') {\n  root = window;\n} else if (typeof global !== 'undefined') {\n  root = global;\n} else if (typeof module !== 'undefined') {\n  root = module;\n} else {\n  root = Function('return this')();\n}\n\nvar result = (0, _ponyfill2['default'])(root);\nexports['default'] = result;" },
            ].map(getRootedFileOrFolder);
            verifyAfterPartialOrCompleteNpmInstall(2);

            filesAndFoldersToAdd.push(...[
                { path: "/a/b/node_modules/.staging/typescript-8493ea5d/lib" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/add/operator" },
                { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7/package.json", content: "{\n    \"name\": \"@types/lodash\",\n    \"version\": \"4.14.74\",\n    \"description\": \"TypeScript definitions for Lo-Dash\",\n    \"license\": \"MIT\",\n    \"contributors\": [\n        {\n            \"name\": \"Brian Zengel\",\n            \"url\": \"https://github.com/bczengel\"\n        },\n        {\n            \"name\": \"Ilya Mochalov\",\n            \"url\": \"https://github.com/chrootsu\"\n        },\n        {\n            \"name\": \"Stepan Mikhaylyuk\",\n            \"url\": \"https://github.com/stepancar\"\n        },\n        {\n            \"name\": \"Eric L Anderson\",\n            \"url\": \"https://github.com/ericanderson\"\n        },\n        {\n            \"name\": \"AJ Richardson\",\n            \"url\": \"https://github.com/aj-r\"\n        },\n        {\n            \"name\": \"Junyoung Clare Jang\",\n            \"url\": \"https://github.com/ailrun\"\n        }\n    ],\n    \"main\": \"\",\n    \"repository\": {\n        \"type\": \"git\",\n        \"url\": \"https://www.github.com/DefinitelyTyped/DefinitelyTyped.git\"\n    },\n    \"scripts\": {},\n    \"dependencies\": {},\n    \"typesPublisherContentHash\": \"12af578ffaf8d86d2df37e591857906a86b983fa9258414326544a0fe6af0de8\",\n    \"typeScriptVersion\": \"2.2\"\n}" },
                { path: "/a/b/node_modules/.staging/lodash-b0733faa/index.js", content: "module.exports = require('./lodash');" },
                { path: "/a/b/node_modules/.staging/typescript-8493ea5d/package.json.3017591594", content: "" }
            ].map(getRootedFileOrFolder));
            // Since we added/removed in .staging no timeout
            verifyAfterPartialOrCompleteNpmInstall(0);

            // Remove file "/a/b/node_modules/.staging/typescript-8493ea5d/package.json.3017591594"
            host.deleteFile(ts.last(filesAndFoldersToAdd).path);
            filesAndFoldersToAdd.length--;
            verifyAfterPartialOrCompleteNpmInstall(0);

            filesAndFoldersToAdd.push(...[
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/bundles" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/operator" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/add/observable/dom" },
                { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7/index.d.ts", content: "\n// Stub for lodash\nexport = _;\nexport as namespace _;\ndeclare var _: _.LoDashStatic;\ndeclare namespace _ {\n    interface LoDashStatic {\n        someProp: string;\n    }\n    class SomeClass {\n        someMethod(): void;\n    }\n}" }
            ].map(getRootedFileOrFolder));
            verifyAfterPartialOrCompleteNpmInstall(0);

            filesAndFoldersToAdd.push(...[
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/scheduler" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/util" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/symbol" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/testing" },
                { path: "/a/b/node_modules/.staging/rxjs-22375c61/package.json.2252192041", content: "{\n  \"_args\": [\n    [\n      {\n        \"raw\": \"rxjs@^5.4.2\",\n        \"scope\": null,\n        \"escapedName\": \"rxjs\",\n        \"name\": \"rxjs\",\n        \"rawSpec\": \"^5.4.2\",\n        \"spec\": \">=5.4.2 <6.0.0\",\n        \"type\": \"range\"\n      },\n      \"C:\\\\Users\\\\shkamat\\\\Desktop\\\\app\"\n    ]\n  ],\n  \"_from\": \"rxjs@>=5.4.2 <6.0.0\",\n  \"_id\": \"rxjs@5.4.3\",\n  \"_inCache\": true,\n  \"_location\": \"/rxjs\",\n  \"_nodeVersion\": \"7.7.2\",\n  \"_npmOperationalInternal\": {\n    \"host\": \"s3://npm-registry-packages\",\n    \"tmp\": \"tmp/rxjs-5.4.3.tgz_1502407898166_0.6800217325799167\"\n  },\n  \"_npmUser\": {\n    \"name\": \"blesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"_npmVersion\": \"5.3.0\",\n  \"_phantomChildren\": {},\n  \"_requested\": {\n    \"raw\": \"rxjs@^5.4.2\",\n    \"scope\": null,\n    \"escapedName\": \"rxjs\",\n    \"name\": \"rxjs\",\n    \"rawSpec\": \"^5.4.2\",\n    \"spec\": \">=5.4.2 <6.0.0\",\n    \"type\": \"range\"\n  },\n  \"_requiredBy\": [\n    \"/\"\n  ],\n  \"_resolved\": \"https://registry.npmjs.org/rxjs/-/rxjs-5.4.3.tgz\",\n  \"_shasum\": \"0758cddee6033d68e0fd53676f0f3596ce3d483f\",\n  \"_shrinkwrap\": null,\n  \"_spec\": \"rxjs@^5.4.2\",\n  \"_where\": \"C:\\\\Users\\\\shkamat\\\\Desktop\\\\app\",\n  \"author\": {\n    \"name\": \"Ben Lesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"bugs\": {\n    \"url\": \"https://github.com/ReactiveX/RxJS/issues\"\n  },\n  \"config\": {\n    \"commitizen\": {\n      \"path\": \"cz-conventional-changelog\"\n    }\n  },\n  \"contributors\": [\n    {\n      \"name\": \"Ben Lesh\",\n      \"email\": \"ben@benlesh.com\"\n    },\n    {\n      \"name\": \"Paul Taylor\",\n      \"email\": \"paul.e.taylor@me.com\"\n    },\n    {\n      \"name\": \"Jeff Cross\",\n      \"email\": \"crossj@google.com\"\n    },\n    {\n      \"name\": \"Matthew Podwysocki\",\n      \"email\": \"matthewp@microsoft.com\"\n    },\n    {\n      \"name\": \"OJ Kwon\",\n      \"email\": \"kwon.ohjoong@gmail.com\"\n    },\n    {\n      \"name\": \"Andre Staltz\",\n      \"email\": \"andre@staltz.com\"\n    }\n  ],\n  \"dependencies\": {\n    \"symbol-observable\": \"^1.0.1\"\n  },\n  \"description\": \"Reactive Extensions for modern JavaScript\",\n  \"devDependencies\": {\n    \"babel-polyfill\": \"^6.23.0\",\n    \"benchmark\": \"^2.1.0\",\n    \"benchpress\": \"2.0.0-beta.1\",\n    \"chai\": \"^3.5.0\",\n    \"color\": \"^0.11.1\",\n    \"colors\": \"1.1.2\",\n    \"commitizen\": \"^2.8.6\",\n    \"coveralls\": \"^2.11.13\",\n    \"cz-conventional-changelog\": \"^1.2.0\",\n    \"danger\": \"^1.1.0\",\n    \"doctoc\": \"^1.0.0\",\n    \"escape-string-regexp\": \"^1.0.5 \",\n    \"esdoc\": \"^0.4.7\",\n    \"eslint\": \"^3.8.0\",\n    \"fs-extra\": \"^2.1.2\",\n    \"get-folder-size\": \"^1.0.0\",\n    \"glob\": \"^7.0.3\",\n    \"gm\": \"^1.22.0\",\n    \"google-closure-compiler-js\": \"^20170218.0.0\",\n    \"gzip-size\": \"^3.0.0\",\n    \"http-server\": \"^0.9.0\",\n    \"husky\": \"^0.13.3\",\n    \"lint-staged\": \"3.2.5\",\n    \"lodash\": \"^4.15.0\",\n    \"madge\": \"^1.4.3\",\n    \"markdown-doctest\": \"^0.9.1\",\n    \"minimist\": \"^1.2.0\",\n    \"mkdirp\": \"^0.5.1\",\n    \"mocha\": \"^3.0.2\",\n    \"mocha-in-sauce\": \"0.0.1\",\n    \"npm-run-all\": \"^4.0.2\",\n    \"npm-scripts-info\": \"^0.3.4\",\n    \"nyc\": \"^10.2.0\",\n    \"opn-cli\": \"^3.1.0\",\n    \"platform\": \"^1.3.1\",\n    \"promise\": \"^7.1.1\",\n    \"protractor\": \"^3.1.1\",\n    \"rollup\": \"0.36.3\",\n    \"rollup-plugin-inject\": \"^2.0.0\",\n    \"rollup-plugin-node-resolve\": \"^2.0.0\",\n    \"rx\": \"latest\",\n    \"rxjs\": \"latest\",\n    \"shx\": \"^0.2.2\",\n    \"sinon\": \"^2.1.0\",\n    \"sinon-chai\": \"^2.9.0\",\n    \"source-map-support\": \"^0.4.0\",\n    \"tslib\": \"^1.5.0\",\n    \"eslint\": \"^5.16.0\",\n    \"typescript\": \"~2.0.6\",\n    \"typings\": \"^2.0.0\",\n    \"validate-commit-msg\": \"^2.14.0\",\n    \"watch\": \"^1.0.1\",\n    \"webpack\": \"^1.13.1\",\n    \"xmlhttprequest\": \"1.8.0\"\n  },\n  \"directories\": {},\n  \"dist\": {\n    \"integrity\": \"sha512-fSNi+y+P9ss+EZuV0GcIIqPUK07DEaMRUtLJvdcvMyFjc9dizuDjere+A4V7JrLGnm9iCc+nagV/4QdMTkqC4A==\",\n    \"shasum\": \"0758cddee6033d68e0fd53676f0f3596ce3d483f\",\n    \"tarball\": \"https://registry.npmjs.org/rxjs/-/rxjs-5.4.3.tgz\"\n  },\n  \"engines\": {\n    \"npm\": \">=2.0.0\"\n  },\n  \"homepage\": \"https://github.com/ReactiveX/RxJS\",\n  \"keywords\": [\n    \"Rx\",\n    \"RxJS\",\n    \"ReactiveX\",\n    \"ReactiveExtensions\",\n    \"Streams\",\n    \"Observables\",\n    \"Observable\",\n    \"Stream\",\n    \"ES6\",\n    \"ES2015\"\n  ],\n  \"license\": \"Apache-2.0\",\n  \"lint-staged\": {\n    \"*.@(js)\": [\n      \"eslint --fix\",\n      \"git add\"\n    ],\n    \"*.@(ts)\": [\n      \"eslint -c .eslintrc --ext .ts . --fix\",\n      \"git add\"\n    ]\n  },\n  \"main\": \"Rx.js\",\n  \"maintainers\": [\n    {\n      \"name\": \"blesh\",\n      \"email\": \"ben@benlesh.com\"\n    }\n  ],\n  \"name\": \"rxjs\",\n  \"optionalDependencies\": {},\n  \"readme\": \"ERROR: No README data found!\",\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git+ssh://git@github.com/ReactiveX/RxJS.git\"\n  },\n  \"scripts-info\": {\n    \"info\": \"List available script\",\n    \"build_all\": \"Build all packages (ES6, CJS, UMD) and generate packages\",\n    \"build_cjs\": \"Build CJS package with clean up existing build, copy source into dist\",\n    \"build_es6\": \"Build ES6 package with clean up existing build, copy source into dist\",\n    \"build_closure_core\": \"Minify Global core build using closure compiler\",\n    \"build_global\": \"Build Global package, then minify build\",\n    \"build_perf\": \"Build CJS & Global build, run macro performance test\",\n    \"build_test\": \"Build CJS package & test spec, execute mocha test runner\",\n    \"build_cover\": \"Run lint to current code, build CJS & test spec, execute test coverage\",\n    \"build_docs\": \"Build ES6 & global package, create documentation using it\",\n    \"build_spec\": \"Build test specs\",\n    \"check_circular_dependencies\": \"Check codebase has circular dependencies\",\n    \"clean_spec\": \"Clean up existing test spec build output\",\n    \"clean_dist_cjs\": \"Clean up existing CJS package output\",\n    \"clean_dist_es6\": \"Clean up existing ES6 package output\",\n    \"clean_dist_global\": \"Clean up existing Global package output\",\n    \"commit\": \"Run git commit wizard\",\n    \"compile_dist_cjs\": \"Compile codebase into CJS module\",\n    \"compile_module_es6\": \"Compile codebase into ES6\",\n    \"cover\": \"Execute test coverage\",\n    \"lint_perf\": \"Run lint against performance test suite\",\n    \"lint_spec\": \"Run lint against test spec\",\n    \"lint_src\": \"Run lint against source\",\n    \"lint\": \"Run lint against everything\",\n    \"perf\": \"Run macro performance benchmark\",\n    \"perf_micro\": \"Run micro performance benchmark\",\n    \"test_mocha\": \"Execute mocha test runner against existing test spec build\",\n    \"test_browser\": \"Execute mocha test runner on browser against existing test spec build\",\n    \"test\": \"Clean up existing test spec build, build test spec and execute mocha test runner\",\n    \"tests2png\": \"Generate marble diagram image from test spec\",\n    \"watch\": \"Watch codebase, trigger compile when source code changes\"\n  },\n  \"typings\": \"Rx.d.ts\",\n  \"version\": \"5.4.3\"\n}\n" }
            ].map(getRootedFileOrFolder));
            verifyAfterPartialOrCompleteNpmInstall(0);

            // remove /a/b/node_modules/.staging/rxjs-22375c61/package.json.2252192041
            host.deleteFile(ts.last(filesAndFoldersToAdd).path);
            filesAndFoldersToAdd.length--;
            // and add few more folders/files
            filesAndFoldersToAdd.push(...[
                { path: "/a/b/node_modules/symbol-observable" },
                { path: "/a/b/node_modules/@types" },
                { path: "/a/b/node_modules/@types/lodash" },
                { path: "/a/b/node_modules/lodash" },
                { path: "/a/b/node_modules/rxjs" },
                { path: "/a/b/node_modules/typescript" },
                { path: "/a/b/node_modules/.bin" }
            ].map(getRootedFileOrFolder));
            // From the type root update
            verifyAfterPartialOrCompleteNpmInstall(2);

            ts.forEach(filesAndFoldersToAdd, f => {
                f.path = f.path
                    .replace("/a/b/node_modules/.staging", "/a/b/node_modules")
                    .replace(/[\-\.][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w]/g, "");
            });

            host.deleteFolder(root + "/a/b/node_modules/.staging", /*recursive*/ true);
            // npm installation complete, timeout after reload fs
            npmInstallComplete = true;
            verifyAfterPartialOrCompleteNpmInstall(2);

            ts.projectSystem.baselineTsserverLogs(
                "cachingFileSystemInformation",
                `npm install works when ${timeoutDuringPartialInstallation ? "timeout occurs inbetween installation" : "timeout occurs after installation"}`,
                projectService
            );

            function verifyAfterPartialOrCompleteNpmInstall(timeoutQueueLengthWhenRunningTimeouts: number) {
                filesAndFoldersToAdd.forEach(f => host.ensureFileOrFolder(f));
                if (npmInstallComplete || timeoutDuringPartialInstallation) {
                    if (timeoutQueueLengthWhenRunningTimeouts) {
                        // Expected project update
                        host.checkTimeoutQueueLengthAndRun(timeoutQueueLengthWhenRunningTimeouts + 1); // Scheduled invalidation of resolutions
                        host.runQueuedTimeoutCallbacks(); // Actual update
                    }
                    else {
                        host.checkTimeoutQueueLengthAndRun(timeoutQueueLengthWhenRunningTimeouts);
                    }
                }
                else {
                    host.checkTimeoutQueueLength(3);
                }
            }
        }

        it("timeouts occur inbetween installation", () => {
            verifyNpmInstall(/*timeoutDuringPartialInstallation*/ true);
        });
        it("timeout occurs after installation", () => {
            verifyNpmInstall(/*timeoutDuringPartialInstallation*/ false);
        });
    });

    it("when node_modules dont receive event for the @types file addition", () => {
        const projectLocation = "/user/username/folder/myproject";
        const app: ts.projectSystem.File = {
            path: `${projectLocation}/app.ts`,
            content: `import * as debug from "debug"`
        };
        const tsconfig: ts.projectSystem.File = {
            path: `${projectLocation}/tsconfig.json`,
            content: ""
        };

        const files = [app, tsconfig, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(app.path);

        const project = service.configuredProjects.get(tsconfig.path)!;
        ts.projectSystem.checkProjectActualFiles(project, files.map(f => f.path));
        assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(app.path).map(diag => diag.messageText), ["Cannot find module 'debug' or its corresponding type declarations."]);

        const debugTypesFile: ts.projectSystem.File = {
            path: `${projectLocation}/node_modules/@types/debug/index.d.ts`,
            content: "export {}"
        };
        files.push(debugTypesFile);
        // Do not invoke recursive directory watcher for anything other than node_module/@types
        const invoker = host.invokeFsWatchesRecursiveCallbacks;
        host.invokeFsWatchesRecursiveCallbacks = (fullPath, eventName, entryFullPath) => {
            if (fullPath.endsWith("@types")) {
                invoker.call(host, fullPath, eventName, entryFullPath);
            }
        };
        host.writeFile(debugTypesFile.path, debugTypesFile.content);
        host.runQueuedTimeoutCallbacks();
        ts.projectSystem.checkProjectActualFiles(project, files.map(f => f.path));
        assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(app.path).map(diag => diag.messageText), []);
    });

    it("when creating new file in symlinked folder", () => {
        const module1: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/client/folder1/module1.ts`,
            content: `export class Module1Class { }`
        };
        const module2: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/folder2/module2.ts`,
            content: `import * as M from "folder1/module1";`
        };
        const symlink: ts.projectSystem.SymLink = {
            path: `${ts.tscWatch.projectRoot}/client/linktofolder2`,
            symLink: `${ts.tscWatch.projectRoot}/folder2`,
        };
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: JSON.stringify({
                compilerOptions: {
                    baseUrl: "client",
                    paths: { "*": ["*"] },
                },
                include: ["client/**/*", "folder2"]
            })
        };
        const host = ts.projectSystem.createServerHost([module1, module2, symlink, config, ts.projectSystem.libFile]);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(`${symlink.path}/module2.ts`);
        ts.projectSystem.checkNumberOfProjects(service, { configuredProjects: 1 });
        const project = ts.Debug.checkDefined(service.configuredProjects.get(config.path));
        ts.projectSystem.checkProjectActualFiles(project, [module1.path, `${symlink.path}/module2.ts`, config.path, ts.projectSystem.libFile.path]);
        host.writeFile(`${symlink.path}/module3.ts`, `import * as M from "folder1/module1";`);
        host.runQueuedTimeoutCallbacks();
        ts.projectSystem.checkNumberOfProjects(service, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(project, [module1.path, `${symlink.path}/module2.ts`, config.path, ts.projectSystem.libFile.path, `${symlink.path}/module3.ts`]);
    });
});
