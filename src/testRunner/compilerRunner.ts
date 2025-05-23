import * as vpath from "./_namespaces/vpath";
import * as ts from "./_namespaces/ts";
import * as compiler from "./_namespaces/compiler";
import * as Utils from "./_namespaces/Utils";
import {
    Baseline, Compiler, FileBasedTest, FileBasedTestConfiguration, getFileBasedTestConfigurationDescription,
    getFileBasedTestConfigurations, IO, RunnerBase, TestCaseParser, TestRunnerKind,
} from "./_namespaces/Harness";

export const enum CompilerTestType {
    Conformance,
    Regressions,
    Test262,
    OH
}

interface CompilerFileBasedTest extends FileBasedTest {
    readonly content?: string;
}

export class CompilerBaselineRunner extends RunnerBase {
    private basePath = "tests/cases";
    private testSuiteName: TestRunnerKind;
    private emit: boolean;

    public options: string | undefined;

    constructor(public testType: CompilerTestType) {
        super();
        this.emit = true;
        if (testType === CompilerTestType.Conformance) {
            this.testSuiteName = "conformance";
        }
        else if (testType === CompilerTestType.Regressions) {
            this.testSuiteName = "compiler";
        }
        else if (testType === CompilerTestType.Test262) {
            this.testSuiteName = "test262";
        }
        else if (testType === CompilerTestType.OH) {
            this.testSuiteName = "compiler-oh";
        }
        else {
            this.testSuiteName = "compiler"; // default to this for historical reasons
        }
        this.basePath += "/" + this.testSuiteName;
    }

    public kind() {
        return this.testSuiteName;
    }

    public enumerateTestFiles() {
        // see also: `enumerateTestFiles` in tests/webTestServer.ts
        return this.enumerateFiles(this.basePath, /\.(ets|tsx?)$/, { recursive: true }).map(CompilerTest.getConfigurations);
    }

    public initializeTests() {
        describe(this.testSuiteName + " tests", () => {
            describe("Setup compiler for compiler baselines", () => {
                this.parseOptions();
            });

            // this will set up a series of describe/it blocks to run between the setup and cleanup phases
            const files = this.tests.length > 0 ? this.tests : IO.enumerateTestFiles(this);
            files.forEach(test => {
                const file = typeof test === "string" ? test : test.file;
                this.checkTestCodeOutput(vpath.normalizeSeparators(file), typeof test === "string" ? CompilerTest.getConfigurations(test) : test);
            });
        });
    }

    public checkTestCodeOutput(fileName: string, test?: CompilerFileBasedTest) {
        if (test && ts.some(test.configurations)) {
            test.configurations.forEach(configuration => {
                describe(`${this.testSuiteName} tests for ${fileName}${configuration ? ` (${getFileBasedTestConfigurationDescription(configuration)})` : ``}`, () => {
                    this.runSuite(fileName, test, configuration);
                });
            });
        }
        else {
            describe(`${this.testSuiteName} tests for ${fileName}`, () => {
                this.runSuite(fileName, test);
            });
        }
    }

    private runSuite(fileName: string, test?: CompilerFileBasedTest, configuration?: FileBasedTestConfiguration) {
        // Mocha holds onto the closure environment of the describe callback even after the test is done.
        // Everything declared here should be cleared out in the "after" callback.
        let compilerTest!: CompilerTest;
        before(() => {
            let payload;
            if (test && test.content) {
                const rootDir = test.file.indexOf("conformance") === -1 ? "tests/cases/compiler/" : ts.getDirectoryPath(test.file) + "/";
                payload = TestCaseParser.makeUnitsFromTest(test.content, test.file, rootDir);
            }
            compilerTest = new CompilerTest(fileName, payload, configuration);
        });
        it(`Correct errors for ${fileName}`, () => compilerTest.verifyDiagnostics());
        it(`Correct module resolution tracing for ${fileName}`, () => compilerTest.verifyModuleResolution());
        it(`Correct sourcemap content for ${fileName}`, () => compilerTest.verifySourceMapRecord());
        it(`Correct JS output for ${fileName}`, () => (this.emit && compilerTest.verifyJavaScriptOutput()));
        it(`Correct Sourcemap output for ${fileName}`, () => compilerTest.verifySourceMapOutput());
        it(`Correct type/symbol baselines for ${fileName}`, () => compilerTest.verifyTypesAndSymbols());
        after(() => {
            compilerTest = undefined!;
        });
    }

    private parseOptions() {
        if (this.options && this.options.length > 0) {
            this.emit = false;

            const opts = this.options.split(",");
            for (const opt of opts) {
                switch (opt) {
                    case "emit":
                        this.emit = true;
                        break;
                    default:
                        throw new Error("unsupported flag");
                }
            }
        }
    }
}

class CompilerTest {
    private static varyBy: readonly string[] = [
        "module",
        "moduleResolution",
        "moduleDetection",
        "target",
        "jsx",
        "removeComments",
        "importHelpers",
        "importHelpers",
        "downlevelIteration",
        "isolatedModules",
        "strict",
        "noImplicitAny",
        "strictNullChecks",
        "strictFunctionTypes",
        "strictBindCallApply",
        "strictPropertyInitialization",
        "noImplicitThis",
        "alwaysStrict",
        "allowSyntheticDefaultImports",
        "esModuleInterop",
        "emitDecoratorMetadata",
        "skipDefaultLibCheck",
        "preserveConstEnums",
        "skipLibCheck",
        "exactOptionalPropertyTypes",
        "useDefineForClassFields",
        "useUnknownInCatchVariables",
        "noUncheckedIndexedAccess",
        "noPropertyAccessFromIndexSignature",
    ];
    private fileName: string;
    private justName: string;
    private configuredName: string;
    private lastUnit: TestCaseParser.TestUnitData;
    private harnessSettings: TestCaseParser.CompilerSettings;
    private hasNonDtsFiles: boolean;
    private result: compiler.CompilationResult;
    private options: ts.CompilerOptions;
    private tsConfigFiles: Compiler.TestFile[];
    // equivalent to the files that will be passed on the command line
    private toBeCompiled: Compiler.TestFile[];
    // equivalent to other files on the file system not directly passed to the compiler (ie things that are referenced by other files)
    private otherFiles: Compiler.TestFile[];

    constructor(fileName: string, testCaseContent?: TestCaseParser.TestCaseContent, configurationOverrides?: TestCaseParser.CompilerSettings) {
        this.fileName = fileName;
        this.justName = vpath.basename(fileName);
        this.configuredName = this.justName;
        if (configurationOverrides) {
            let configuredName = "";
            const keys = Object
                .keys(configurationOverrides)
                .sort();
            for (const key of keys) {
                if (configuredName) {
                    configuredName += ",";
                }
                configuredName += `${key.toLowerCase()}=${configurationOverrides[key].toLowerCase()}`;
            }
            if (configuredName) {
                const extname = vpath.extname(this.justName);
                const basename = vpath.basename(this.justName, extname, /*ignoreCase*/ true);
                this.configuredName = `${basename}(${configuredName})${extname}`;
            }
        }

        const rootDir = fileName.indexOf("conformance") === -1 ? "tests/cases/compiler/" : ts.getDirectoryPath(fileName) + "/";

        if (testCaseContent === undefined) {
            testCaseContent = TestCaseParser.makeUnitsFromTest(IO.readFile(fileName)!, fileName, rootDir);
        }

        if (configurationOverrides) {
            testCaseContent = { ...testCaseContent, settings: { ...testCaseContent.settings, ...configurationOverrides } };
        }

        const units = testCaseContent.testUnitData;
        this.harnessSettings = testCaseContent.settings;
        let tsConfigOptions: ts.CompilerOptions | undefined;
        this.tsConfigFiles = [];
        if (testCaseContent.tsConfig) {
            assert.equal(testCaseContent.tsConfig.fileNames.length, 0, `list of files in tsconfig is not currently supported`);
            assert.equal(testCaseContent.tsConfig.raw.exclude, undefined, `exclude in tsconfig is not currently supported`);

            tsConfigOptions = ts.cloneCompilerOptions(testCaseContent.tsConfig.options);
            this.tsConfigFiles.push(this.createHarnessTestFile(testCaseContent.tsConfigFileUnitData!, rootDir, ts.combinePaths(rootDir, tsConfigOptions.configFilePath)));
        }
        else {
            const baseUrl = this.harnessSettings.baseUrl;
            if (baseUrl !== undefined && !ts.isRootedDiskPath(baseUrl)) {
                this.harnessSettings.baseUrl = ts.getNormalizedAbsolutePath(baseUrl, rootDir);
            }
        }

        this.lastUnit = units[units.length - 1];
        this.hasNonDtsFiles = units.some(unit => !ts.isDeclarationFileName(unit.name));
        // We need to assemble the list of input files for the compiler and other related files on the 'filesystem' (ie in a multi-file test)
        // If the last file in a test uses require or a triple slash reference we'll assume all other files will be brought in via references,
        // otherwise, assume all files are just meant to be in the same compilation session without explicit references to one another.
        this.toBeCompiled = [];
        this.otherFiles = [];

        if (testCaseContent.settings.noImplicitReferences || /require\(/.test(this.lastUnit.content) || /reference\spath/.test(this.lastUnit.content)) {
            this.toBeCompiled.push(this.createHarnessTestFile(this.lastUnit, rootDir));
            units.forEach(unit => {
                if (unit.name !== this.lastUnit.name) {
                    this.otherFiles.push(this.createHarnessTestFile(unit, rootDir));
                }
            });
        }
        else {
            this.toBeCompiled = units.map(unit => {
                return this.createHarnessTestFile(unit, rootDir);
            });
        }

        if (tsConfigOptions && tsConfigOptions.configFilePath !== undefined) {
            tsConfigOptions.configFilePath = ts.combinePaths(rootDir, tsConfigOptions.configFilePath);
            tsConfigOptions.configFile!.fileName = tsConfigOptions.configFilePath;
        }

        this.result = Compiler.compileFiles(
            this.toBeCompiled,
            this.otherFiles,
            this.harnessSettings,
            /*options*/ tsConfigOptions,
            /*currentDirectory*/ this.harnessSettings.currentDirectory,
            testCaseContent.symlinks
        );

        this.options = this.result.options;
    }

    public static getConfigurations(file: string): CompilerFileBasedTest {
        // also see `parseCompilerTestConfigurations` in tests/webTestServer.ts
        const content = IO.readFile(file)!;
        const settings = TestCaseParser.extractCompilerSettings(content);
        const configurations = getFileBasedTestConfigurations(settings, CompilerTest.varyBy);
        return { file, configurations, content };
    }

    public verifyDiagnostics() {
        // check errors
        Compiler.doErrorBaseline(
            this.configuredName,
            this.tsConfigFiles.concat(this.toBeCompiled, this.otherFiles),
            this.result.diagnostics,
            !!this.options.pretty);
    }

    public verifyModuleResolution() {
        if (this.options.traceResolution) {
            Baseline.runBaseline(this.configuredName.replace(/\.(ets|tsx?)$/, ".trace.json"),
                JSON.stringify(this.result.traces.map(Utils.sanitizeTraceResolutionLogEntry), undefined, 4));
        }
    }

    public verifySourceMapRecord() {
        if (this.options.sourceMap || this.options.inlineSourceMap || this.options.declarationMap) {
            const record = Utils.removeTestPathPrefixes(this.result.getSourceMapRecord()!);
            const baseline = (this.options.noEmitOnError && this.result.diagnostics.length !== 0) || record === undefined
                // Because of the noEmitOnError option no files are created. We need to return null because baselining isn't required.
                ? null // eslint-disable-line no-null/no-null
                : record;
            Baseline.runBaseline(this.configuredName.replace(/\.(ets|tsx?)$/, ".sourcemap.txt"), baseline);
        }
    }

    public verifyJavaScriptOutput() {
        if (this.hasNonDtsFiles) {
            Compiler.doJsEmitBaseline(
                this.configuredName,
                this.fileName,
                this.options,
                this.result,
                this.tsConfigFiles,
                this.toBeCompiled,
                this.otherFiles,
                this.harnessSettings);
        }
    }

    public verifySourceMapOutput() {
        Compiler.doSourcemapBaseline(
            this.configuredName,
            this.options,
            this.result,
            this.harnessSettings);
    }

    public verifyTypesAndSymbols() {
        if (this.fileName.indexOf("APISample") >= 0) {
            return;
        }

        const noTypesAndSymbols =
            this.harnessSettings.noTypesAndSymbols &&
            this.harnessSettings.noTypesAndSymbols.toLowerCase() === "true";
        if (noTypesAndSymbols) {
            return;
        }

        Compiler.doTypeAndSymbolBaseline(
            this.configuredName,
            this.result.program!,
            this.toBeCompiled.concat(this.otherFiles).filter(file => !!this.result.program!.getSourceFile(file.unitName)),
            /*opts*/ undefined,
            /*multifile*/ undefined,
            /*skipTypeBaselines*/ undefined,
            /*skipSymbolBaselines*/ undefined,
            !!ts.length(this.result.diagnostics)
        );
    }

    private makeUnitName(name: string, root: string) {
        const path = ts.toPath(name, root, ts.identity);
        const pathStart = ts.toPath(IO.getCurrentDirectory(), "", ts.identity);
        return pathStart ? path.replace(pathStart, "/") : path;
    }

    private createHarnessTestFile(lastUnit: TestCaseParser.TestUnitData, rootDir: string, unitName?: string): Compiler.TestFile {
        return { unitName: unitName || this.makeUnitName(lastUnit.name, rootDir), content: lastUnit.content, fileOptions: lastUnit.fileOptions };
    }
}
