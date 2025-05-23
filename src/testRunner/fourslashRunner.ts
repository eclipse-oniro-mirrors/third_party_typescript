import * as FourSlash from "./_namespaces/FourSlash";
import * as ts from "./_namespaces/ts";
import { IO, RunnerBase, TestRunnerKind } from "./_namespaces/Harness";

export class FourSlashRunner extends RunnerBase {
    protected basePath: string;
    protected testSuiteName: TestRunnerKind;

    constructor(private testType: FourSlash.FourSlashTestType) {
        super();
        switch (testType) {
            case FourSlash.FourSlashTestType.Native:
                this.basePath = "tests/cases/fourslash";
                this.testSuiteName = "fourslash";
                break;
            case FourSlash.FourSlashTestType.OH:
                this.basePath = "tests/cases/fourslash/oh";
                this.testSuiteName = "fourslash-oh";
                break;
            case FourSlash.FourSlashTestType.Shims:
                this.basePath = "tests/cases/fourslash/shims";
                this.testSuiteName = "fourslash-shims";
                break;
            case FourSlash.FourSlashTestType.ShimsWithPreprocess:
                this.basePath = "tests/cases/fourslash/shims-pp";
                this.testSuiteName = "fourslash-shims-pp";
                break;
            case FourSlash.FourSlashTestType.Server:
                this.basePath = "tests/cases/fourslash/server";
                this.testSuiteName = "fourslash-server";
                break;
            default:
                throw ts.Debug.assertNever(testType);
        }
    }

    public enumerateTestFiles() {
        // see also: `enumerateTestFiles` in tests/webTestServer.ts
        return this.enumerateFiles(this.basePath, /\.ts/i, { recursive: false });
    }

    public kind() {
        return this.testSuiteName;
    }

    public initializeTests() {
        if (this.tests.length === 0) {
            this.tests = IO.enumerateTestFiles(this);
        }

        describe(this.testSuiteName + " tests", () => {
            this.tests.forEach(test => {
                const file = typeof test === "string" ? test : test.file;
                describe(file, () => {
                    let fn = ts.normalizeSlashes(file);
                    const justName = fn.replace(/^.*[\\\/]/, "");

                    // Convert to relative path
                    const testIndex = fn.indexOf("tests/");
                    if (testIndex >= 0) fn = fn.substr(testIndex);

                    if (justName !== "fourslash.ts") {
                        it(this.testSuiteName + " test " + justName + " runs correctly", () => {
                            FourSlash.runFourSlashTest(this.basePath, this.testType, fn);
                        });
                    }
                });
            });
        });
    }
}

export class GeneratedFourslashRunner extends FourSlashRunner {
    constructor(testType: FourSlash.FourSlashTestType) {
        super(testType);
        this.basePath += "/generated/";
    }
}
