import * as ts from "../../_namespaces/ts";

describe("unittests:: tsserver:: Projects", () => {
    it("handles the missing files - that were added to program because they were added with ///<ref", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/commonFile1.ts",
            content: `/// <reference path="commonFile2.ts"/>
                    let x = y`
        };
        const host = ts.projectSystem.createServerHost([file1, ts.projectSystem.libFile]);
        const session = ts.projectSystem.createSession(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        ts.projectSystem.openFilesForSession([file1], session);

        const getErrRequest = ts.projectSystem.makeSessionRequest<ts.server.protocol.SemanticDiagnosticsSyncRequestArgs>(
            ts.server.CommandNames.SemanticDiagnosticsSync,
            { file: file1.path }
        );

        // Two errors: CommonFile2 not found and cannot find name y
        session.executeCommand(getErrRequest);

        host.writeFile(ts.projectSystem.commonFile2.path, ts.projectSystem.commonFile2.content);
        host.runQueuedTimeoutCallbacks();
        session.executeCommand(getErrRequest);
        ts.projectSystem.baselineTsserverLogs("projects", "handles the missing files added with tripleslash ref", session);
    });

    it("should create new inferred projects for files excluded from a configured project", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {},
                    "files": ["${ts.projectSystem.commonFile1.path}", "${ts.projectSystem.commonFile2.path}"]
                }`
        };
        const files = [ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, configFile];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(ts.projectSystem.commonFile1.path);

        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);
        configFile.content = `{
                "compilerOptions": {},
                "files": ["${ts.projectSystem.commonFile1.path}"]
            }`;
        host.writeFile(configFile.path, configFile.content);

        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);
        host.checkTimeoutQueueLengthAndRun(2); // Update the configured project + refresh inferred projects
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path]);

        projectService.openClientFile(ts.projectSystem.commonFile2.path);
        ts.projectSystem.checkNumberOfInferredProjects(projectService, 1);
    });

    it("should disable features when the files are too large", () => {
        const file1 = {
            path: "/a/b/f1.js",
            content: "let x =1;",
            fileSize: 10 * 1024 * 1024
        };
        const file2 = {
            path: "/a/b/f2.js",
            content: "let y =1;",
            fileSize: 6 * 1024 * 1024
        };
        const file3 = {
            path: "/a/b/f3.js",
            content: "let y =1;",
            fileSize: 6 * 1024 * 1024
        };

        const proj1name = "proj1", proj2name = "proj2", proj3name = "proj3";

        const host = ts.projectSystem.createServerHost([file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openExternalProject({ rootFiles: ts.projectSystem.toExternalFiles([file1.path]), options: {}, projectFileName: proj1name });
        const proj1 = projectService.findProject(proj1name)!;
        assert.isTrue(proj1.languageServiceEnabled);

        projectService.openExternalProject({ rootFiles: ts.projectSystem.toExternalFiles([file2.path]), options: {}, projectFileName: proj2name });
        const proj2 = projectService.findProject(proj2name)!;
        assert.isTrue(proj2.languageServiceEnabled);

        projectService.openExternalProject({ rootFiles: ts.projectSystem.toExternalFiles([file3.path]), options: {}, projectFileName: proj3name });
        const proj3 = projectService.findProject(proj3name)!;
        assert.isFalse(proj3.languageServiceEnabled);
    });

    it("should not crash when opening a file in a project with a disabled language service", () => {
        const file1 = {
            path: "/a/b/f1.js",
            content: "let x =1;",
            fileSize: 50 * 1024 * 1024
        };
        const file2 = {
            path: "/a/b/f2.js",
            content: "let x =1;",
            fileSize: 100
        };

        const projName = "proj1";

        const host = ts.projectSystem.createServerHost([file1, file2]);
        const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true, eventHandler: ts.noop });

        projectService.openExternalProject({ rootFiles: ts.projectSystem.toExternalFiles([file1.path, file2.path]), options: {}, projectFileName: projName });
        const proj1 = projectService.findProject(projName)!;
        assert.isFalse(proj1.languageServiceEnabled);

        assert.doesNotThrow(() => projectService.openClientFile(file2.path));
    });

    describe("ignoreConfigFiles", () => {
        it("external project including config file", () => {
            const file1 = {
                path: "/a/b/f1.ts",
                content: "let x =1;"
            };
            const config1 = {
                path: "/a/b/tsconfig.json",
                content: JSON.stringify(
                    {
                        compilerOptions: {},
                        files: ["f1.ts"]
                    }
                )
            };

            const externalProjectName = "externalproject";
            const host = ts.projectSystem.createServerHost([file1, config1]);
            const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true, syntaxOnly: true });
            projectService.openExternalProject({
                rootFiles: ts.projectSystem.toExternalFiles([file1.path, config1.path]),
                options: {},
                projectFileName: externalProjectName
            });

            ts.projectSystem.checkNumberOfProjects(projectService, { externalProjects: 1 });
            const proj = projectService.externalProjects[0];
            assert.isDefined(proj);

            assert.isTrue(proj.fileExists(file1.path));
        });

        it("loose file included in config file (openClientFile)", () => {
            const file1 = {
                path: "/a/b/f1.ts",
                content: "let x =1;"
            };
            const config1 = {
                path: "/a/b/tsconfig.json",
                content: JSON.stringify(
                    {
                        compilerOptions: {},
                        files: ["f1.ts"]
                    }
                )
            };

            const host = ts.projectSystem.createServerHost([file1, config1]);
            const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true, syntaxOnly: true });
            projectService.openClientFile(file1.path, file1.content);

            ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
            const proj = projectService.inferredProjects[0];
            assert.isDefined(proj);

            assert.isTrue(proj.fileExists(file1.path));
        });

        it("loose file included in config file (applyCodeChanges)", () => {
            const file1 = {
                path: "/a/b/f1.ts",
                content: "let x =1;"
            };
            const config1 = {
                path: "/a/b/tsconfig.json",
                content: JSON.stringify(
                    {
                        compilerOptions: {},
                        files: ["f1.ts"]
                    }
                )
            };

            const host = ts.projectSystem.createServerHost([file1, config1]);
            const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true, syntaxOnly: true });
            projectService.applyChangesInOpenFiles(ts.singleIterator({ fileName: file1.path, content: file1.content }));

            ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
            const proj = projectService.inferredProjects[0];
            assert.isDefined(proj);

            assert.isTrue(proj.fileExists(file1.path));
        });
    });

    it("reload regular file after closing", () => {
        const f1 = {
            path: "/a/b/app.ts",
            content: "x."
        };
        const f2 = {
            path: "/a/b/lib.ts",
            content: "let x: number;"
        };

        const host = ts.projectSystem.createServerHost([f1, f2, ts.projectSystem.libFile]);
        const service = ts.projectSystem.createProjectService(host);
        service.openExternalProject({ projectFileName: "/a/b/project", rootFiles: ts.projectSystem.toExternalFiles([f1.path, f2.path]), options: {} });

        service.openClientFile(f1.path);
        service.openClientFile(f2.path, "let x: string");

        service.checkNumberOfProjects({ externalProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(service.externalProjects[0], [f1.path, f2.path, ts.projectSystem.libFile.path]);

        const completions1 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 2, ts.emptyOptions)!;
        // should contain completions for string
        assert.isTrue(completions1.entries.some(e => e.name === "charAt"), "should contain 'charAt'");
        assert.isFalse(completions1.entries.some(e => e.name === "toExponential"), "should not contain 'toExponential'");

        service.closeClientFile(f2.path);
        const completions2 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 2, ts.emptyOptions)!;
        // should contain completions for string
        assert.isFalse(completions2.entries.some(e => e.name === "charAt"), "should not contain 'charAt'");
        assert.isTrue(completions2.entries.some(e => e.name === "toExponential"), "should contain 'toExponential'");
    });

    it("clear mixed content file after closing", () => {
        const f1 = {
            path: "/a/b/app.ts",
            content: " "
        };
        const f2 = {
            path: "/a/b/lib.html",
            content: "<html/>"
        };

        const host = ts.projectSystem.createServerHost([f1, f2, ts.projectSystem.libFile]);
        const service = ts.projectSystem.createProjectService(host);
        service.openExternalProject({ projectFileName: "/a/b/project", rootFiles: [{ fileName: f1.path }, { fileName: f2.path, hasMixedContent: true }], options: {} });

        service.openClientFile(f1.path);
        service.openClientFile(f2.path, "let somelongname: string");

        service.checkNumberOfProjects({ externalProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(service.externalProjects[0], [f1.path, f2.path, ts.projectSystem.libFile.path]);

        const completions1 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 0, ts.emptyOptions)!;
        assert.isTrue(completions1.entries.some(e => e.name === "somelongname"), "should contain 'somelongname'");

        service.closeClientFile(f2.path);
        const completions2 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 0, ts.emptyOptions)!;
        assert.isFalse(completions2.entries.some(e => e.name === "somelongname"), "should not contain 'somelongname'");
        const sf2 = service.externalProjects[0].getLanguageService().getProgram()!.getSourceFile(f2.path)!;
        assert.equal(sf2.text, "");
    });

    it("changes in closed files are reflected in project structure", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: `export * from "./f2"`
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: `export let x = 1`
        };
        const file3 = {
            path: "/a/c/f3.ts",
            content: `export let y = 1;`
        };
        const host = ts.projectSystem.createServerHost([file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        const inferredProject0 = projectService.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path]);

        projectService.openClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProject0);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path]);
        const inferredProject1 = projectService.inferredProjects[1];
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);

        host.writeFile(file2.path, `export * from "../c/f3"`); // now inferred project should inclule file3
        host.checkTimeoutQueueLengthAndRun(2);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProject0);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path]);
        assert.strictEqual(projectService.inferredProjects[1], inferredProject1);
        assert.isTrue(inferredProject1.isOrphan());
    });

    it("deleted files affect project structure", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: `export * from "./f2"`
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: `export * from "../c/f3"`
        };
        const file3 = {
            path: "/a/c/f3.ts",
            content: `export let y = 1;`
        };
        const host = ts.projectSystem.createServerHost([file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);

        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });

        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path]);

        projectService.openClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });

        host.deleteFile(file2.path);
        host.checkTimeoutQueueLengthAndRun(2);

        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });

        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
    });

    it("ignores files excluded by a custom safe type list", () => {
        const file1 = {
            path: "/a/b/f1.js",
            content: "export let x = 5"
        };
        const office = {
            path: "/lib/duckquack-3.min.js",
            content: "whoa do @@ not parse me ok thanks!!!"
        };
        const host = ts.projectSystem.createServerHost([file1, office, ts.projectSystem.customTypesMap]);
        const projectService = ts.projectSystem.createProjectService(host);
        try {
            projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: ts.projectSystem.toExternalFiles([file1.path, office.path]) });
            const proj = projectService.externalProjects[0];
            assert.deepEqual(proj.getFileNames(/*excludeFilesFromExternalLibraries*/ true), [file1.path]);
            assert.deepEqual(proj.getTypeAcquisition().include, ["duck-types"]);
        }
        finally {
            projectService.resetSafeList();
        }
    });

    it("file with name constructor.js doesnt cause issue with typeAcquisition when safe type list", () => {
        const file1 = {
            path: "/a/b/f1.js",
            content: `export let x = 5; import { s } from "s"`
        };
        const constructorFile = {
            path: "/a/b/constructor.js",
            content: "const x = 10;"
        };
        const bliss = {
            path: "/a/b/bliss.js",
            content: "export function is() { return true; }"
        };
        const host = ts.projectSystem.createServerHost([file1, ts.projectSystem.libFile, constructorFile, bliss, ts.projectSystem.customTypesMap]);
        let request: string | undefined;
        const cachePath = "/a/data";
        const typingsInstaller: ts.server.ITypingsInstaller = {
            isKnownTypesPackageName: ts.returnFalse,
            installPackage: ts.notImplemented,
            enqueueInstallTypingsRequest: (proj, typeAcquisition, unresolvedImports) => {
                assert.isUndefined(request);
                request = JSON.stringify(ts.server.createInstallTypingsRequest(proj, typeAcquisition, unresolvedImports || ts.server.emptyArray, cachePath));
            },
            attach: ts.noop,
            onProjectClosed: ts.noop,
            globalTypingsCacheLocation: cachePath
        };

        const projectName = "project";
        const projectService = ts.projectSystem.createProjectService(host, { typingsInstaller });
        projectService.openExternalProject({ projectFileName: projectName, options: {}, rootFiles: ts.projectSystem.toExternalFiles([file1.path, constructorFile.path, bliss.path]) });
        assert.equal(request, JSON.stringify({
            projectName,
            fileNames: [ts.projectSystem.libFile.path, file1.path, constructorFile.path, bliss.path],
            compilerOptions: { allowNonTsExtensions: true, noEmitForJsFiles: true },
            typeAcquisition: { include: ["blissfuljs"], exclude: [], enable: true },
            unresolvedImports: ["s"],
            projectRootPath: "/",
            cachePath,
            kind: "discover"
        }));
        const response = JSON.parse(request!);
        request = undefined;
        projectService.updateTypingsForProject({
            kind: "action::set",
            projectName: response.projectName,
            typeAcquisition: response.typeAcquisition,
            compilerOptions: response.compilerOptions,
            typings: ts.emptyArray,
            unresolvedImports: response.unresolvedImports,
        });

        host.checkTimeoutQueueLength(0);
        assert.isUndefined(request);
    });

    it("ignores files excluded by the default type list", () => {
        const file1 = {
            path: "/a/b/f1.js",
            content: "export let x = 5"
        };
        const minFile = {
            path: "/c/moment.min.js",
            content: "unspecified"
        };
        const kendoFile1 = {
            path: "/q/lib/kendo/kendo.all.min.js",
            content: "unspecified"
        };
        const kendoFile2 = {
            path: "/q/lib/kendo/kendo.ui.min.js",
            content: "unspecified"
        };
        const kendoFile3 = {
            path: "/q/lib/kendo-ui/kendo.all.js",
            content: "unspecified"
        };
        const officeFile1 = {
            path: "/scripts/Office/1/excel-15.debug.js",
            content: "unspecified"
        };
        const officeFile2 = {
            path: "/scripts/Office/1/powerpoint.js",
            content: "unspecified"
        };
        const files = [file1, minFile, kendoFile1, kendoFile2, kendoFile3, officeFile1, officeFile2];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host);
        try {
            projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: ts.projectSystem.toExternalFiles(files.map(f => f.path)) });
            const proj = projectService.externalProjects[0];
            assert.deepEqual(proj.getFileNames(/*excludeFilesFromExternalLibraries*/ true), [file1.path]);
            assert.deepEqual(proj.getTypeAcquisition().include, ["kendo-ui", "office"]);
        }
        finally {
            projectService.resetSafeList();
        }
    });

    it("removes version numbers correctly", () => {
        const testData: [string, string][] = [
            ["jquery-max", "jquery-max"],
            ["jquery.min", "jquery"],
            ["jquery-min.4.2.3", "jquery"],
            ["jquery.min.4.2.1", "jquery"],
            ["minimum", "minimum"],
            ["min", "min"],
            ["min.3.2", "min"],
            ["jquery", "jquery"]
        ];
        for (const t of testData) {
            assert.equal(ts.removeMinAndVersionNumbers(t[0]), t[1], t[0]);
        }
    });

    it("ignores files excluded by a legacy safe type list", () => {
        const file1 = {
            path: "/a/b/bliss.js",
            content: "let x = 5"
        };
        const file2 = {
            path: "/a/b/foo.js",
            content: ""
        };
        const file3 = {
            path: "/a/b/Bacon.js",
            content: "let y = 5"
        };
        const host = ts.projectSystem.createServerHost([file1, file2, file3, ts.projectSystem.customTypesMap]);
        const projectService = ts.projectSystem.createProjectService(host);
        try {
            projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: ts.projectSystem.toExternalFiles([file1.path, file2.path]), typeAcquisition: { enable: true } });
            const proj = projectService.externalProjects[0];
            assert.deepEqual(proj.getFileNames(), [file2.path]);
        }
        finally {
            projectService.resetSafeList();
        }
    });

    it("correctly migrate files between projects", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: `
                export * from "../c/f2";
                export * from "../d/f3";`
        };
        const file2 = {
            path: "/a/c/f2.ts",
            content: "export let x = 1;"
        };
        const file3 = {
            path: "/a/d/f3.ts",
            content: "export let y = 1;"
        };
        const host = ts.projectSystem.createServerHost([file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file2.path]);
        let inferredProjects = projectService.inferredProjects.slice();

        projectService.openClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProjects[0]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file2.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
        inferredProjects = projectService.inferredProjects.slice();

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        assert.notStrictEqual(projectService.inferredProjects[0], inferredProjects[0]);
        assert.notStrictEqual(projectService.inferredProjects[0], inferredProjects[1]);
        ts.projectSystem.checkProjectRootFiles(projectService.inferredProjects[0], [file1.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path]);
        inferredProjects = projectService.inferredProjects.slice();

        projectService.closeClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 3 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProjects[0]);
        assert.isTrue(projectService.inferredProjects[0].isOrphan());
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file2.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[2], [file3.path]);
        inferredProjects = projectService.inferredProjects.slice();

        projectService.closeClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 3 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProjects[0]);
        assert.strictEqual(projectService.inferredProjects[1], inferredProjects[1]);
        assert.strictEqual(projectService.inferredProjects[2], inferredProjects[2]);
        assert.isTrue(projectService.inferredProjects[0].isOrphan());
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file2.path]);
        assert.isTrue(projectService.inferredProjects[2].isOrphan());

        projectService.openClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        assert.strictEqual(projectService.inferredProjects[0], inferredProjects[2]);
        assert.strictEqual(projectService.inferredProjects[1], inferredProjects[1]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file3.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file2.path]);
    });

    it("regression test for crash in acquireOrUpdateDocument", () => {
        const tsFile = {
            fileName: "/a/b/file1.ts",
            path: "/a/b/file1.ts",
            content: ""
        };
        const jsFile = {
            path: "/a/b/file1.js",
            content: "var x = 10;",
            fileName: "/a/b/file1.js",
            scriptKind: "JS" as const
        };

        const host = ts.projectSystem.createServerHost([]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.applyChangesInOpenFiles(ts.singleIterator(tsFile));
        const projs = projectService.synchronizeProjectList([]);
        projectService.findProject(projs[0].info!.projectName)!.getLanguageService().getNavigationBarItems(tsFile.fileName);
        projectService.synchronizeProjectList([projs[0].info!]);
        projectService.applyChangesInOpenFiles(ts.singleIterator(jsFile));
    });

    it("config file is deleted", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: "let x = 1;"
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: "let y = 2;"
        };
        const config = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: {} })
        };
        const host = ts.projectSystem.createServerHost([file1, file2, config]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);

        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);

        host.deleteFile(config.path);
        host.checkTimeoutQueueLengthAndRun(1);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file2.path]);
    });

    it("loading files with correct priority", () => {
        const f1 = {
            path: "/a/main.ts",
            content: "let x = 1"
        };
        const f2 = {
            path: "/a/main.js",
            content: "var y = 1"
        };
        const f3 = {
            path: "/main.js",
            content: "var y = 1"
        };
        const config = {
            path: "/a/tsconfig.json",
            content: JSON.stringify({
                compilerOptions: { allowJs: true }
            })
        };
        const host = ts.projectSystem.createServerHost([f1, f2, f3, config]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.setHostConfiguration({
            extraFileExtensions: [
                { extension: ".js", isMixedContent: false },
                { extension: ".html", isMixedContent: true }
            ]
        });
        projectService.openClientFile(f1.path);
        projectService.checkNumberOfProjects({ configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [f1.path, config.path]);

        // Since f2 refers to config file as the default project, it needs to be kept alive
        projectService.closeClientFile(f1.path);
        projectService.openClientFile(f2.path);
        projectService.checkNumberOfProjects({ inferredProjects: 1, configuredProjects: 1 });
        assert.isDefined(projectService.configuredProjects.get(config.path));
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [f2.path]);

        // Should close configured project with next file open
        projectService.closeClientFile(f2.path);
        projectService.openClientFile(f3.path);
        projectService.checkNumberOfProjects({ inferredProjects: 1 });
        assert.isUndefined(projectService.configuredProjects.get(config.path));
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [f3.path]);
    });

    it("tsconfig script block support", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: ` `
        };
        const file2 = {
            path: "/a/b/f2.html",
            content: `var hello = "hello";`
        };
        const config = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: true } })
        };
        const host = ts.projectSystem.createServerHost([file1, file2, config]);
        const session = ts.projectSystem.createSession(host);
        ts.projectSystem.openFilesForSession([file1], session);
        const projectService = session.getProjectService();

        // HTML file will not be included in any projects yet
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        const configuredProj = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectActualFiles(configuredProj, [file1.path, config.path]);

        // Specify .html extension as mixed content
        const extraFileExtensions = [{ extension: ".html", scriptKind: ts.ScriptKind.JS, isMixedContent: true }];
        const configureHostRequest = ts.projectSystem.makeSessionRequest<ts.projectSystem.protocol.ConfigureRequestArguments>(ts.projectSystem.CommandNames.Configure, { extraFileExtensions });
        session.executeCommand(configureHostRequest);

        // The configured project should now be updated to include html file
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        assert.strictEqual(ts.projectSystem.configuredProjectAt(projectService, 0), configuredProj, "Same configured project should be updated");
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);

        // Open HTML file
        projectService.applyChangesInOpenFiles(ts.singleIterator({
            fileName: file2.path,
            hasMixedContent: true,
            scriptKind: ts.ScriptKind.JS,
            content: `var hello = "hello";`
        }));
        // Now HTML file is included in the project
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);

        // Check identifiers defined in HTML content are available in .ts file
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        let completions = project.getLanguageService().getCompletionsAtPosition(file1.path, 1, ts.emptyOptions);
        assert(completions && ts.some(completions.entries, e => e.name === "hello"), `expected entry hello to be in completion list`);

        // Close HTML file
        projectService.applyChangesInOpenFiles(
            /*openFiles*/ undefined,
            /*changedFiles*/ undefined,
            /*closedFiles*/[file2.path]);

        // HTML file is still included in project
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);

        // Check identifiers defined in HTML content are not available in .ts file
        completions = project.getLanguageService().getCompletionsAtPosition(file1.path, 5, ts.emptyOptions);
        assert(completions && completions.entries[0].name !== "hello", `unexpected hello entry in completion list`);
    });

    it("no tsconfig script block diagnostic errors", () => {

        //  #1. Ensure no diagnostic errors when allowJs is true
        const file1 = {
            path: "/a/b/f1.ts",
            content: ` `
        };
        const file2 = {
            path: "/a/b/f2.html",
            content: `var hello = "hello";`
        };
        const config1 = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: true } })
        };

        let host = ts.projectSystem.createServerHost([file1, file2, config1, ts.projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(ts.projectSystem.libFile.path), "tsc.js") });
        let session = ts.projectSystem.createSession(host);

        // Specify .html extension as mixed content in a configure host request
        const extraFileExtensions = [{ extension: ".html", scriptKind: ts.ScriptKind.JS, isMixedContent: true }];
        const configureHostRequest = ts.projectSystem.makeSessionRequest<ts.projectSystem.protocol.ConfigureRequestArguments>(ts.projectSystem.CommandNames.Configure, { extraFileExtensions });
        session.executeCommand(configureHostRequest);

        ts.projectSystem.openFilesForSession([file1], session);
        let projectService = session.getProjectService();

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

        let diagnostics = ts.projectSystem.configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
        assert.deepEqual(diagnostics, []);

        //  #2. Ensure no errors when allowJs is false
        const config2 = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: false } })
        };

        host = ts.projectSystem.createServerHost([file1, file2, config2, ts.projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(ts.projectSystem.libFile.path), "tsc.js") });
        session = ts.projectSystem.createSession(host);

        session.executeCommand(configureHostRequest);

        ts.projectSystem.openFilesForSession([file1], session);
        projectService = session.getProjectService();

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

        diagnostics = ts.projectSystem.configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
        assert.deepEqual(diagnostics, []);

        //  #3. Ensure no errors when compiler options aren't specified
        const config3 = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({})
        };

        host = ts.projectSystem.createServerHost([file1, file2, config3, ts.projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(ts.projectSystem.libFile.path), "tsc.js") });
        session = ts.projectSystem.createSession(host);

        session.executeCommand(configureHostRequest);

        ts.projectSystem.openFilesForSession([file1], session);
        projectService = session.getProjectService();

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

        diagnostics = ts.projectSystem.configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
        assert.deepEqual(diagnostics, []);

        //  #4. Ensure no errors when files are explicitly specified in tsconfig
        const config4 = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: true }, files: [file1.path, file2.path] })
        };

        host = ts.projectSystem.createServerHost([file1, file2, config4, ts.projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(ts.projectSystem.libFile.path), "tsc.js") });
        session = ts.projectSystem.createSession(host);

        session.executeCommand(configureHostRequest);

        ts.projectSystem.openFilesForSession([file1], session);
        projectService = session.getProjectService();

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

        diagnostics = ts.projectSystem.configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
        assert.deepEqual(diagnostics, []);

        //  #4. Ensure no errors when files are explicitly excluded in tsconfig
        const config5 = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: true }, exclude: [file2.path] })
        };

        host = ts.projectSystem.createServerHost([file1, file2, config5, ts.projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(ts.projectSystem.libFile.path), "tsc.js") });
        session = ts.projectSystem.createSession(host);

        session.executeCommand(configureHostRequest);

        ts.projectSystem.openFilesForSession([file1], session);
        projectService = session.getProjectService();

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

        diagnostics = ts.projectSystem.configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
        assert.deepEqual(diagnostics, []);
    });

    it("project structure update is deferred if files are not added\removed", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: `import {x} from "./f2"`
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: "export let x = 1"
        };
        const host = ts.projectSystem.createServerHost([file1, file2]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        projectService.openClientFile(file2.path);

        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        projectService.applyChangesInOpenFiles(
            /*openFiles*/ undefined,
            /*changedFiles*/ts.singleIterator({ fileName: file1.path, changes: ts.singleIterator({ span: ts.createTextSpan(0, file1.path.length), newText: "let y = 1" }) }),
            /*closedFiles*/ undefined);

        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        projectService.ensureInferredProjectsUpToDate_TestOnly();
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
    });

    it("files with mixed content are handled correctly", () => {
        const file1 = {
            path: "/a/b/f1.html",
            content: `<html><script language="javascript">var x = 1;</></html>`
        };
        const host = ts.projectSystem.createServerHost([file1]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        const projectFileName = "projectFileName";
        projectService.openExternalProject({ projectFileName, options: {}, rootFiles: [{ fileName: file1.path, scriptKind: ts.ScriptKind.JS, hasMixedContent: true }] });


        const project = projectService.externalProjects[0];

        const scriptInfo = project.getScriptInfo(file1.path)!;
        const snap = scriptInfo.getSnapshot();
        const actualText = ts.getSnapshotText(snap);
        projectService.logger.info(`Text of${file1.path}: ${actualText}`);

        projectService.openClientFile(file1.path, `var x = 1;`);
        project.updateGraph();

        const quickInfo = project.getLanguageService().getQuickInfoAtPosition(file1.path, 4)!;
        projectService.logger.info(`QuickInfo : ${quickInfo.kind}`);

        projectService.closeClientFile(file1.path);

        const scriptInfo2 = project.getScriptInfo(file1.path)!;
        const actualText2 = ts.getSnapshotText(scriptInfo2.getSnapshot());
        projectService.logger.info(`Text of${file1.path}: ${actualText2}`);
        ts.projectSystem.baselineTsserverLogs("projects", "files with mixed content are handled correctly", projectService);
    });

    it("syntax tree cache handles changes in project settings", () => {
        const file1 = {
            path: "/a/b/app.ts",
            content: "{x: 1}"
        };
        const host = ts.projectSystem.createServerHost([file1]);
        const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true });
        projectService.setCompilerOptionsForInferredProjects({ target: ts.ScriptTarget.ES5, allowJs: false });
        projectService.openClientFile(file1.path);
        projectService.inferredProjects[0].getLanguageService(/*ensureSynchronized*/ false).getOutliningSpans(file1.path);
        projectService.setCompilerOptionsForInferredProjects({ target: ts.ScriptTarget.ES5, allowJs: true });
        projectService.getScriptInfo(file1.path)!.editContent(0, 0, " ");
        projectService.inferredProjects[0].getLanguageService(/*ensureSynchronized*/ false).getOutliningSpans(file1.path);
        projectService.closeClientFile(file1.path);
    });

    it("File in multiple projects at opened and closed correctly", () => {
        const file1 = {
            path: "/a/b/app.ts",
            content: "let x = 1;"
        };
        const file2 = {
            path: "/a/c/f.ts",
            content: `/// <reference path="../b/app.ts"/>`
        };
        const tsconfig1 = {
            path: "/a/c/tsconfig.json",
            content: "{}"
        };
        const tsconfig2 = {
            path: "/a/b/tsconfig.json",
            content: "{}"
        };
        const host = ts.projectSystem.createServerHost([file1, file2, tsconfig1, tsconfig2]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        const project1 = projectService.configuredProjects.get(tsconfig1.path)!;
        assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 1"); // file2
        assert.equal(project1.getScriptInfo(file2.path)!.containingProjects.length, 1, "containing projects count");
        assert.isFalse(project1.isClosed());

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 2 });
        assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 2"); // file2
        assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
        assert.isFalse(project1.isClosed());

        const project2 = projectService.configuredProjects.get(tsconfig2.path)!;
        assert.isTrue(project2.hasOpenRef(), "Has open ref count in project2 - 2"); // file1
        assert.isFalse(project2.isClosed());

        assert.equal(project1.getScriptInfo(file1.path)!.containingProjects.length, 2, `${file1.path} containing projects count`);
        assert.equal(project1.getScriptInfo(file2.path)!.containingProjects.length, 1, `${file2.path} containing projects count`);

        projectService.closeClientFile(file2.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 2 });
        assert.isFalse(project1.hasOpenRef(), "Has open ref count in project1 - 3"); // No files
        assert.isTrue(project2.hasOpenRef(), "Has open ref count in project2 - 3"); // file1
        assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
        assert.strictEqual(projectService.configuredProjects.get(tsconfig2.path), project2);
        assert.isFalse(project1.isClosed());
        assert.isFalse(project2.isClosed());

        projectService.closeClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 2 });
        assert.isFalse(project1.hasOpenRef(), "Has open ref count in project1 - 4"); // No files
        assert.isFalse(project2.hasOpenRef(), "Has open ref count in project2 - 4"); // No files
        assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
        assert.strictEqual(projectService.configuredProjects.get(tsconfig2.path), project2);
        assert.isFalse(project1.isClosed());
        assert.isFalse(project2.isClosed());

        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
        assert.isUndefined(projectService.configuredProjects.get(tsconfig2.path));
        assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 5"); // file2
        assert.isFalse(project1.isClosed());
        assert.isTrue(project2.isClosed());
    });

    it("snapshot from different caches are incompatible", () => {
        const f1 = {
            path: "/a/b/app.ts",
            content: "let x = 1;"
        };
        const host = ts.projectSystem.createServerHost([f1]);
        const projectFileName = "/a/b/proj.csproj";
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openExternalProject({
            projectFileName,
            rootFiles: [ts.projectSystem.toExternalFile(f1.path)],
            options: {}
        });
        projectService.openClientFile(f1.path, "let x = 1;\nlet y = 2;");

        projectService.checkNumberOfProjects({ externalProjects: 1 });
        projectService.externalProjects[0].getLanguageService(/*ensureSynchronized*/ false).getNavigationBarItems(f1.path);
        projectService.closeClientFile(f1.path);

        projectService.openClientFile(f1.path);
        projectService.checkNumberOfProjects({ externalProjects: 1 });
        const navbar = projectService.externalProjects[0].getLanguageService(/*ensureSynchronized*/ false).getNavigationBarItems(f1.path);
        assert.equal(navbar[0].spans[0].length, f1.content.length);
    });

    it("Getting errors from closed script info does not throw exception (because of getting project from orphan script info)", () => {
        const f1 = {
            path: "/a/b/app.ts",
            content: "let x = 1;"
        };
        const config = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: {} })
        };
        const host = ts.projectSystem.createServerHost([f1, ts.projectSystem.libFile, config]);
        const session = ts.projectSystem.createSession(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        session.executeCommandSeq({
            command: ts.server.CommandNames.Open,
            arguments: {
                file: f1.path
            }
        } as ts.projectSystem.protocol.OpenRequest);
        session.executeCommandSeq({
            command: ts.server.CommandNames.Close,
            arguments: {
                file: f1.path
            }
        } as ts.projectSystem.protocol.CloseRequest);
        session.executeCommandSeq({
            command: ts.server.CommandNames.Geterr,
            arguments: {
                delay: 0,
                files: [f1.path]
            }
        } as ts.projectSystem.protocol.GeterrRequest);
        ts.projectSystem.baselineTsserverLogs("projects", "getting errors from closed script info does not throw exception because of getting project from orphan script info", session);
    });

    it("Properly handle Windows-style outDir", () => {
        const configFile: ts.projectSystem.File = {
            path: "C:\\a\\tsconfig.json",
            content: JSON.stringify({
                compilerOptions: {
                    outDir: `C:\\a\\b`
                },
                include: ["*.ts"]
            })
        };
        const file1: ts.projectSystem.File = {
            path: "C:\\a\\f1.ts",
            content: "let x = 1;"
        };

        const host = ts.projectSystem.createServerHost([file1, configFile], { windowsStyleRoot: "c:/" });
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectActualFiles(project, [ts.normalizePath(file1.path), ts.normalizePath(configFile.path)]);
        const options = project.getCompilerOptions();
        assert.equal(options.outDir, "C:/a/b", "");
    });

    it("files opened and closed affecting multiple projects", () => {
        const file: ts.projectSystem.File = {
            path: "/a/b/projects/config/file.ts",
            content: `import {a} from "../files/file1"; export let b = a;`
        };
        const config: ts.projectSystem.File = {
            path: "/a/b/projects/config/tsconfig.json",
            content: ""
        };
        const filesFile1: ts.projectSystem.File = {
            path: "/a/b/projects/files/file1.ts",
            content: "export let a = 10;"
        };
        const filesFile2: ts.projectSystem.File = {
            path: "/a/b/projects/files/file2.ts",
            content: "export let aa = 10;"
        };

        const files = [config, file, filesFile1, filesFile2, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const session = ts.projectSystem.createSession(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        // Create configured project
        session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Open,
            arguments: {
                file: file.path
            }
        });

        // open files/file1 = should not create another project
        session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Open,
            arguments: {
                file: filesFile1.path
            }
        });

        // Close the file = should still have project
        session.executeCommandSeq<ts.projectSystem.protocol.CloseRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Close,
            arguments: {
                file: file.path
            }
        });

        // Open files/file2 - should create inferred project and close configured project
        session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Open,
            arguments: {
                file: filesFile2.path
            }
        });

        // Actions on file1 would result in assert
        session.executeCommandSeq<ts.projectSystem.protocol.OccurrencesRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Occurrences,
            arguments: {
                file: filesFile1.path,
                line: 1,
                offset: filesFile1.content.indexOf("a")
            }
        });

        ts.projectSystem.baselineTsserverLogs("projects", "files opened and closed affecting multiple projects", session);
    });

    it("requests are done on file on pendingReload but has svc for previous version", () => {
        const file1: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/file1.ts`,
            content: `import { y } from "./file2"; let x = 10;`
        };
        const file2: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/file2.ts`,
            content: "export let y = 10;"
        };
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: "{}"
        };
        const files = [file1, file2, ts.projectSystem.libFile, config];
        const host = ts.projectSystem.createServerHost(files);
        const session = ts.projectSystem.createSession(host);
        session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Open,
            arguments: { file: file2.path, fileContent: file2.content }
        });
        session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Open,
            arguments: { file: file1.path }
        });
        session.executeCommandSeq<ts.projectSystem.protocol.CloseRequest>({
            command: ts.projectSystem.protocol.CommandTypes.Close,
            arguments: { file: file2.path }
        });

        file2.content += "export let z = 10;";
        host.writeFile(file2.path, file2.content);
        // Do not let the timeout runs, before executing command
        const startOffset = file2.content.indexOf("y") + 1;
        session.executeCommandSeq<ts.projectSystem.protocol.GetApplicableRefactorsRequest>({
            command: ts.projectSystem.protocol.CommandTypes.GetApplicableRefactors,
            arguments: { file: file2.path, startLine: 1, startOffset, endLine: 1, endOffset: startOffset + 1 }
        });
    });

    describe("includes deferred files in the project context", () => {
        function verifyDeferredContext(lazyConfiguredProjectsFromExternalProject: boolean) {
            const file1 = {
                path: "/a.deferred",
                content: "const a = 1;"
            };
            // Deferred extensions should not affect JS files.
            const file2 = {
                path: "/b.js",
                content: "const b = 1;"
            };
            const tsconfig = {
                path: "/tsconfig.json",
                content: ""
            };

            const host = ts.projectSystem.createServerHost([file1, file2, tsconfig]);
            const session = ts.projectSystem.createSession(host);
            const projectService = session.getProjectService();
            session.executeCommandSeq<ts.projectSystem.protocol.ConfigureRequest>({
                command: ts.projectSystem.protocol.CommandTypes.Configure,
                arguments: { preferences: { lazyConfiguredProjectsFromExternalProject } }
            });

            // Configure the deferred extension.
            const extraFileExtensions = [{ extension: ".deferred", scriptKind: ts.ScriptKind.Deferred, isMixedContent: true }];
            const configureHostRequest = ts.projectSystem.makeSessionRequest<ts.projectSystem.protocol.ConfigureRequestArguments>(ts.projectSystem.CommandNames.Configure, { extraFileExtensions });
            session.executeCommand(configureHostRequest);

            // Open external project
            const projectName = "/proj1";
            projectService.openExternalProject({
                projectFileName: projectName,
                rootFiles: ts.projectSystem.toExternalFiles([file1.path, file2.path, tsconfig.path]),
                options: {}
            });

            // Assert
            ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });

            const configuredProject = ts.projectSystem.configuredProjectAt(projectService, 0);
            if (lazyConfiguredProjectsFromExternalProject) {
                // configured project is just created and not yet loaded
                ts.projectSystem.checkProjectActualFiles(configuredProject, ts.emptyArray);
                projectService.ensureInferredProjectsUpToDate_TestOnly();
            }
            ts.projectSystem.checkProjectActualFiles(configuredProject, [file1.path, tsconfig.path]);

            // Allow allowNonTsExtensions will be set to true for deferred extensions.
            assert.isTrue(configuredProject.getCompilerOptions().allowNonTsExtensions);
        }

        it("when lazyConfiguredProjectsFromExternalProject not set", () => {
            verifyDeferredContext(/*lazyConfiguredProjectsFromExternalProject*/ false);
        });
        it("when lazyConfiguredProjectsFromExternalProject is set", () => {
            verifyDeferredContext(/*lazyConfiguredProjectsFromExternalProject*/ true);
        });
    });

    it("Orphan source files are handled correctly on watch trigger", () => {
        const file1: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/file1.ts`,
            content: `export let x = 10;`
        };
        const file2: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/file2.ts`,
            content: "export let y = 10;"
        };
        const configContent1 = JSON.stringify({
            files: ["src/file1.ts", "src/file2.ts"]
        });
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: configContent1
        };
        const files = [file1, file2, ts.projectSystem.libFile, config];
        const host = ts.projectSystem.createServerHost(files);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(file1.path);
        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(config.path)!, [file1.path, file2.path, ts.projectSystem.libFile.path, config.path]);

        const configContent2 = JSON.stringify({
            files: ["src/file1.ts"]
        });
        config.content = configContent2;
        host.writeFile(config.path, config.content);
        host.runQueuedTimeoutCallbacks();

        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(config.path)!, [file1.path, ts.projectSystem.libFile.path, config.path]);
        verifyFile2InfoIsOrphan();

        file2.content += "export let z = 10;";
        host.writeFile(file2.path, file2.content);
        host.runQueuedTimeoutCallbacks();

        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(config.path)!, [file1.path, ts.projectSystem.libFile.path, config.path]);
        verifyFile2InfoIsOrphan();

        function verifyFile2InfoIsOrphan() {
            const info = ts.Debug.checkDefined(service.getScriptInfoForPath(file2.path as ts.Path));
            assert.equal(info.containingProjects.length, 0);
        }
    });

    it("no project structure update on directory watch invoke on open file save", () => {
        const projectRootPath = "/users/username/projects/project";
        const file1: ts.projectSystem.File = {
            path: `${projectRootPath}/a.ts`,
            content: "export const a = 10;"
        };
        const config: ts.projectSystem.File = {
            path: `${projectRootPath}/tsconfig.json`,
            content: "{}"
        };
        const files = [file1, config];
        const host = ts.projectSystem.createServerHost(files);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(service, { configuredProjects: 1 });

        host.modifyFile(file1.path, file1.content, { invokeFileDeleteCreateAsPartInsteadOfChange: true });
        host.checkTimeoutQueueLength(0);
    });

    it("synchronizeProjectList provides redirect info when requested", () => {
        const projectRootPath = "/users/username/projects/project";
        const fileA: ts.projectSystem.File = {
            path: `${projectRootPath}/A/a.ts`,
            content: "export const foo: string = 5;"
        };
        const configA: ts.projectSystem.File = {
            path: `${projectRootPath}/A/tsconfig.json`,
            content: `{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  }
}`
        };
        const fileB: ts.projectSystem.File = {
            path: `${projectRootPath}/B/b.ts`,
            content: "import { foo } from \"../A/a\"; console.log(foo);"
        };
        const configB: ts.projectSystem.File = {
            path: `${projectRootPath}/B/tsconfig.json`,
            content: `{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  },
  "references": [
    { "path": "../A" }
  ]
}`
        };
        const files = [fileA, fileB, configA, configB, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(fileA.path);
        projectService.openClientFile(fileB.path);
        const knownProjects = projectService.synchronizeProjectList([], /*includeProjectReferenceRedirectInfo*/ true);
        assert.deepEqual(knownProjects[0].files, [
            {
                fileName: ts.projectSystem.libFile.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: fileA.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: configA.path,
                isSourceOfProjectReferenceRedirect: false
            }
        ]);
        assert.deepEqual(knownProjects[1].files, [
            {
                fileName: ts.projectSystem.libFile.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: fileA.path,
                isSourceOfProjectReferenceRedirect: true,
            },
            {
                fileName: fileB.path,
                isSourceOfProjectReferenceRedirect: false,
            },
            {
                fileName: configB.path,
                isSourceOfProjectReferenceRedirect: false
            }
        ]);
    });

    it("synchronizeProjectList provides updates to redirect info when requested", () => {
        const projectRootPath = "/users/username/projects/project";
        const fileA: ts.projectSystem.File = {
            path: `${projectRootPath}/A/a.ts`,
            content: "export const foo: string = 5;"
        };
        const configA: ts.projectSystem.File = {
            path: `${projectRootPath}/A/tsconfig.json`,
            content: `{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  }
}`
        };
        const fileB: ts.projectSystem.File = {
            path: `${projectRootPath}/B/b.ts`,
            content: "import { foo } from \"../B/b2\"; console.log(foo);"
        };
        const fileB2: ts.projectSystem.File = {
            path: `${projectRootPath}/B/b2.ts`,
            content: "export const foo: string = 5;"
        };
        const configB: ts.projectSystem.File = {
            path: `${projectRootPath}/B/tsconfig.json`,
            content: `{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  },
  "references": [
    { "path": "../A" }
  ]
}`
        };
        const files = [fileA, fileB, fileB2, configA, configB, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(fileA.path);
        projectService.openClientFile(fileB.path);
        const knownProjects = projectService.synchronizeProjectList([], /*includeProjectReferenceRedirectInfo*/ true);
        assert.deepEqual(knownProjects[0].files, [
            {
                fileName: ts.projectSystem.libFile.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: fileA.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: configA.path,
                isSourceOfProjectReferenceRedirect: false
            }
        ]);
        assert.deepEqual(knownProjects[1].files, [
            {
                fileName: ts.projectSystem.libFile.path,
                isSourceOfProjectReferenceRedirect: false
            },
            {
                fileName: fileB2.path,
                isSourceOfProjectReferenceRedirect: false,
            },
            {
                fileName: fileB.path,
                isSourceOfProjectReferenceRedirect: false,
            },
            {
                fileName: configB.path,
                isSourceOfProjectReferenceRedirect: false
            }
        ]);

        host.modifyFile(configA.path, `{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  },
  "include": [
      "**/*",
      "../B/b2.ts"
  ]
}`);
        const newKnownProjects = projectService.synchronizeProjectList(knownProjects.map(proj => proj.info!), /*includeProjectReferenceRedirectInfo*/ true);
        assert.deepEqual(newKnownProjects[0].changes?.added, [
            {
                fileName: fileB2.path,
                isSourceOfProjectReferenceRedirect: false
            }
        ]);
        assert.deepEqual(newKnownProjects[1].changes?.updatedRedirects, [
            {
                fileName: fileB2.path,
                isSourceOfProjectReferenceRedirect: true
            }
        ]);
    });

    it("synchronizeProjectList returns correct information when base configuration file cannot be resolved", () => {
        const file: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/index.ts`,
            content: "export const foo = 5;"
        };
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: JSON.stringify({ extends: "./tsconfig_base.json" })
        };
        const host = ts.projectSystem.createServerHost([file, config, ts.projectSystem.libFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file.path);
        const knownProjects = projectService.synchronizeProjectList([], /*includeProjectReferenceRedirectInfo*/ false);
        assert.deepEqual(knownProjects[0].files, [
            ts.projectSystem.libFile.path,
            file.path,
            config.path,
            `${ts.tscWatch.projectRoot}/tsconfig_base.json`,
        ]);
    });

    it("synchronizeProjectList returns correct information when base configuration file cannot be resolved and redirect info is requested", () => {
        const file: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/index.ts`,
            content: "export const foo = 5;"
        };
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: JSON.stringify({ extends: "./tsconfig_base.json" })
        };
        const host = ts.projectSystem.createServerHost([file, config, ts.projectSystem.libFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file.path);
        const knownProjects = projectService.synchronizeProjectList([], /*includeProjectReferenceRedirectInfo*/ true);
        assert.deepEqual(knownProjects[0].files, [
            { fileName: ts.projectSystem.libFile.path, isSourceOfProjectReferenceRedirect: false },
            { fileName: file.path, isSourceOfProjectReferenceRedirect: false },
            { fileName: config.path, isSourceOfProjectReferenceRedirect: false },
            { fileName: `${ts.tscWatch.projectRoot}/tsconfig_base.json`, isSourceOfProjectReferenceRedirect: false },
        ]);
    });

    it("handles delayed directory watch invoke on file creation", () => {
        const projectRootPath = "/users/username/projects/project";
        const fileB: ts.projectSystem.File = {
            path: `${projectRootPath}/b.ts`,
            content: "export const b = 10;"
        };
        const fileA: ts.projectSystem.File = {
            path: `${projectRootPath}/a.ts`,
            content: "export const a = 10;"
        };
        const fileSubA: ts.projectSystem.File = {
            path: `${projectRootPath}/sub/a.ts`,
            content: fileA.content
        };
        const config: ts.projectSystem.File = {
            path: `${projectRootPath}/tsconfig.json`,
            content: "{}"
        };
        const files = [fileSubA, fileB, config, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const session = ts.projectSystem.createSession(host, { canUseEvents: true, noGetErrOnBackgroundUpdate: true, logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        openFile(fileB);
        openFile(fileSubA);

        host.checkTimeoutQueueLengthAndRun(0);

        // This should schedule 2 timeouts for ensuring project structure and ensuring projects for open file
        host.deleteFile(fileSubA.path);
        host.deleteFolder(ts.getDirectoryPath(fileSubA.path));
        host.writeFile(fileA.path, fileA.content);
        host.checkTimeoutQueueLength(2);

        ts.projectSystem.closeFilesForSession([fileSubA], session);
        // This should cancel existing updates and schedule new ones
        host.checkTimeoutQueueLength(2);

        // Open the fileA (as if rename)
        // config project is updated to check if fileA is present in it
        openFile(fileA);

        // Run the timeout for updating configured project and ensuring projects for open file
        host.checkTimeoutQueueLengthAndRun(2);

        // file is deleted but watches are not yet invoked
        const originalFileExists = host.fileExists;
        host.fileExists = s => s === fileA.path ? false : originalFileExists.call(host, s);
        ts.projectSystem.closeFilesForSession([fileA], session);
        host.checkTimeoutQueueLength(2); // Update configured project and projects for open file

        // This should create inferred project since fileSubA not on the disk
        openFile(fileSubA);

        host.checkTimeoutQueueLengthAndRun(2); // Update configured project and projects for open file
        host.fileExists = originalFileExists;

        // Actually trigger the file move
        host.deleteFile(fileA.path);
        host.ensureFileOrFolder(fileSubA);
        host.checkTimeoutQueueLength(2);

        ts.projectSystem.verifyGetErrRequest({ session, host, files: [fileB, fileSubA], existingTimeouts: 2 });
        ts.projectSystem.baselineTsserverLogs("projects", "handles delayed directory watch invoke on file creation", session);

        function openFile(file: ts.projectSystem.File) {
            ts.projectSystem.openFilesForSession([{ file, projectRootPath }], session);
        }
    });

    it("assert when removing project", () => {
        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, ts.projectSystem.libFile]);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(ts.projectSystem.commonFile1.path);
        const project = service.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.libFile.path]);
        // Intentionally create scriptinfo and attach it to project
        const info = service.getOrCreateScriptInfoForNormalizedPath(ts.projectSystem.commonFile2.path as ts.server.NormalizedPath, /*openedByClient*/ false)!;
        info.attachToProject(project);
        try {
            service.applyChangesInOpenFiles(/*openFiles*/ undefined, /*changedFiles*/ undefined, [ts.projectSystem.commonFile1.path]);
        }
        catch (e) {
            assert.isTrue(e.message.indexOf("Debug Failure. False expression: Found script Info still attached to project") === 0);
        }
    });
    it("does not look beyond node_modules folders for default configured projects", () => {
        const rootFilePath = ts.server.asNormalizedPath("/project/index.ts");
        const rootProjectPath = ts.server.asNormalizedPath("/project/tsconfig.json");
        const nodeModulesFilePath1 = ts.server.asNormalizedPath("/project/node_modules/@types/a/index.d.ts");
        const nodeModulesProjectPath1 = ts.server.asNormalizedPath("/project/node_modules/@types/a/tsconfig.json");
        const nodeModulesFilePath2 = ts.server.asNormalizedPath("/project/node_modules/@types/b/index.d.ts");
        const serverHost = ts.projectSystem.createServerHost([
            { path: rootFilePath, content: "import 'a'; import 'b';" },
            { path: rootProjectPath, content: "{}" },
            { path: nodeModulesFilePath1, content: "{}" },
            { path: nodeModulesProjectPath1, content: "{}" },
            { path: nodeModulesFilePath2, content: "{}" },
        ]);
        const projectService = ts.projectSystem.createProjectService(serverHost, { useSingleInferredProject: true });

        const openRootFileResult = projectService.openClientFile(rootFilePath);
        assert.strictEqual(openRootFileResult.configFileName?.toString(), rootProjectPath);

        const openNodeModulesFileResult1 = projectService.openClientFile(nodeModulesFilePath1);
        assert.strictEqual(openNodeModulesFileResult1.configFileName?.toString(), nodeModulesProjectPath1);

        const openNodeModulesFileResult2 = projectService.openClientFile(nodeModulesFilePath2);
        assert.isUndefined(openNodeModulesFileResult2.configFileName);

        const rootProject = projectService.findProject(rootProjectPath)!;
        ts.projectSystem.checkProjectActualFiles(rootProject, [rootProjectPath, rootFilePath, nodeModulesFilePath1, nodeModulesFilePath2]);

        ts.projectSystem.checkNumberOfInferredProjects(projectService, 0);
    });

    describe("file opened is in configured project that will be removed", () => {
        function runOnTs<T extends ts.server.protocol.Request>(scenario: string, getRequest: (innerFile: ts.projectSystem.File) => Partial<T>) {
            it(scenario, () => {
                const testsConfig: ts.projectSystem.File = {
                    path: `${ts.tscWatch.projectRoot}/playground/tsconfig.json`,
                    content: "{}"
                };
                const testsFile: ts.projectSystem.File = {
                    path: `${ts.tscWatch.projectRoot}/playground/tests.ts`,
                    content: `export function foo() {}`
                };
                const innerFile: ts.projectSystem.File = {
                    path: `${ts.tscWatch.projectRoot}/playground/tsconfig-json/tests/spec.ts`,
                    content: `export function bar() { }`
                };
                const innerConfig: ts.projectSystem.File = {
                    path: `${ts.tscWatch.projectRoot}/playground/tsconfig-json/tsconfig.json`,
                    content: JSON.stringify({
                        include: ["./src"]
                    })
                };
                const innerSrcFile: ts.projectSystem.File = {
                    path: `${ts.tscWatch.projectRoot}/playground/tsconfig-json/src/src.ts`,
                    content: `export function foobar() { }`
                };
                const host = ts.projectSystem.createServerHost([testsConfig, testsFile, innerFile, innerConfig, innerSrcFile, ts.projectSystem.libFile]);
                const session = ts.projectSystem.createSession(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
                ts.projectSystem.openFilesForSession([testsFile], session);
                ts.projectSystem.closeFilesForSession([testsFile], session);
                ts.projectSystem.openFilesForSession([innerFile], session);
                session.executeCommandSeq(getRequest(innerFile));
                ts.projectSystem.baselineTsserverLogs("projects", scenario, session);
            });
        }
        runOnTs<ts.projectSystem.protocol.OutliningSpansRequest>(
            "file opened is in configured project that will be removed",
            innerFile => ({
                command: ts.projectSystem.protocol.CommandTypes.GetOutliningSpans,
                arguments: { file: innerFile.path }
            })
        );

        runOnTs<ts.projectSystem.protocol.ReferencesRequest>(
            "references on file opened is in configured project that will be removed",
            innerFile => ({
                command: ts.projectSystem.protocol.CommandTypes.References,
                arguments: ts.projectSystem.protocolFileLocationFromSubstring(innerFile, "bar")
            })
        );

        it("js file opened is in configured project that will be removed", () => {
            const rootConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
                content: JSON.stringify({ compilerOptions: { allowJs: true } })
            };
            const mocksFile: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/mocks/cssMock.js`,
                content: `function foo() { }`
            };
            const innerFile: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/apps/editor/scripts/createConfigVariable.js`,
                content: `function bar() { }`
            };
            const innerConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/apps/editor/tsconfig.json`,
                content: JSON.stringify({
                    extends: "../../tsconfig.json",
                    include: ["./src"],
                })
            };
            const innerSrcFile: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/apps/editor/src/src.js`,
                content: `function fooBar() { }`
            };
            const host = ts.projectSystem.createServerHost([rootConfig, mocksFile, innerFile, innerConfig, innerSrcFile, ts.projectSystem.libFile]);
            const session = ts.projectSystem.createSession(host, { canUseEvents: true, logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
            ts.projectSystem.openFilesForSession([mocksFile], session);
            ts.projectSystem.closeFilesForSession([mocksFile], session);
            ts.projectSystem.openFilesForSession([innerFile], session);
            ts.projectSystem.baselineTsserverLogs("projects", "js file opened is in configured project that will be removed", session);
        });
    });
});
