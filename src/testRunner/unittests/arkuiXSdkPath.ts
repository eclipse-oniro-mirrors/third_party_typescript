/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as ts from "../_namespaces/ts";

interface VirtualFileEntry {
    content: string;
    scriptKind: ts.ScriptKind;
}

describe("unittests:: ArkUI-X independent SDK path resolution", () => {
    const hostSdkPath = "/host/openharmony/ets/build-tools/ets-loader";
    const defaultArkuiXRoot = "/custom/arkui-x/Sdk";
    let originalArkuiXPath: string | undefined;
    let originalIsCrossplatform: string | undefined;

    function createVirtualHost(
        files: Readonly<Record<string, VirtualFileEntry>>,
        resolvedModules?: Readonly<Record<string, ts.ResolvedModuleFull>>
    ): ts.CompilerHost {
        return {
            getSourceFile: (fileName: string) => {
                const entry = files[fileName];
                if (!entry) {
                    return undefined;
                }
                const sf = ts.createSourceFile(fileName, entry.content, ts.ScriptTarget.ES2021, /*setParentNodes*/ true, entry.scriptKind);
                sf.version = ts.sys.createHash ? ts.sys.createHash(entry.content) : entry.content;
                return sf;
            },
            getDefaultLibFileName: () => "lib.d.ts",
            writeFile: ts.noop,
            getCurrentDirectory: () => "/",
            getDirectories: () => [],
            getCanonicalFileName: (f: string) => f,
            useCaseSensitiveFileNames: () => true,
            getNewLine: () => "\n",
            fileExists: (f: string) => ts.hasProperty(files, f),
            readFile: (f: string) => files[f]?.content,
            createHash: ts.sys.createHash,
            resolveModuleNames: resolvedModules
                ? (moduleNames: string[]) => moduleNames.map(name => resolvedModules[name])
                : undefined,
        };
    }

    function runComponentCheck(componentFile: string, componentName: string): readonly ts.Diagnostic[] {
        const appFile = "/project/entry/src/main/ets/pages/Index.ets";
        const componentDts = `
interface ${componentName}Interface {
    (): void;
}
declare const ${componentName}: ${componentName}Interface;
`;
        const appSource = `${componentName}();`;
        const options: ts.CompilerOptions = {
            etsLoaderPath: hostSdkPath,
            ets: {
                components: [componentName],
                libs: [],
            },
        };
        const host = createVirtualHost({
            [componentFile]: { content: componentDts, scriptKind: ts.ScriptKind.TS },
            [appFile]: { content: appSource, scriptKind: ts.ScriptKind.ETS },
        });
        const program = ts.createProgram([componentFile, appFile], options, host);
        const sf = program.getSourceFile(appFile)!;
        return program.getSemanticDiagnostics(sf);
    }

    function findComponentPlaceDiagnostic(diags: readonly ts.Diagnostic[], componentName: string): ts.Diagnostic | undefined {
        return diags.find(d =>
            d.messageText && d.messageText.toString().includes(`UI component '${componentName}' cannot be used in this place`)
        );
    }

    function runSendableImportCheck(callerFile: string, sendableFile: string): readonly ts.Diagnostic[] {
        const apiSource = `import { MySendable } from "./sendable";`;
        const sendableSource = `export declare class MySendable {}`;
        const options: ts.CompilerOptions = {
            etsLoaderPath: hostSdkPath,
            needDoArkTsLinter: true,
            tsImportSendableEnable: false,
        };
        const host = createVirtualHost(
            {
                [callerFile]: { content: apiSource, scriptKind: ts.ScriptKind.TS },
                [sendableFile]: { content: sendableSource, scriptKind: ts.ScriptKind.ETS },
            },
            {
                "./sendable": {
                    resolvedFileName: sendableFile,
                    isExternalLibraryImport: false,
                    extension: ts.Extension.Dets,
                } as ts.ResolvedModuleFull,
            }
        );
        const program = ts.createProgram([callerFile], options, host);
        return program.getSemanticDiagnostics();
    }

    function findForbiddenSendableDiagnostic(diags: readonly ts.Diagnostic[]): ts.Diagnostic | undefined {
        return diags.find(d =>
            d.messageText && d.messageText.toString().includes("Importing ArkTS files in JS and TS files is forbidden")
        );
    }

    function runThrowsCheck(declFile: string, jsDocThrows: string): readonly ts.Diagnostic[] {
        const appFile = "/project/entry/src/main/ets/pages/Index.ets";
        const declSource = `
/**
 * @throws ${jsDocThrows}
 */
declare function sdkThrowsApi(): void;
`;
        const appSource = `
function callApi(): void {
    sdkThrowsApi();
}
`;
        const options: ts.CompilerOptions = {
            etsLoaderPath: hostSdkPath,
        };
        const host = createVirtualHost({
            [declFile]: { content: declSource, scriptKind: ts.ScriptKind.TS },
            [appFile]: { content: appSource, scriptKind: ts.ScriptKind.ETS },
        });
        const program = ts.createProgram([declFile, appFile], options, host);
        const sf = program.getSourceFile(appFile)!;
        return program.getSemanticDiagnostics(sf);
    }

    function findThrowsDiagnostic(diags: readonly ts.Diagnostic[]): ts.Diagnostic | undefined {
        return diags.find(d =>
            d.code === 28040 ||
            (d.messageText && d.messageText.toString().includes("Function may throw exceptions. Special handling is required."))
        );
    }

    function runInteropLinterCheck(
        callerFile: string,
        targetFile: string,
        tsImportSendableEnable: boolean
    ): ts.Diagnostic[] {
        const callerSource = `import DefaultNonSendable from "./sendable";`;
        const targetSource = `export default class DefaultNonSendable {}`;
        const options: ts.CompilerOptions = {
            etsLoaderPath: hostSdkPath,
            needDoArkTsLinter: true,
            tsImportSendableEnable,
            noEmit: true,
        };
        const host = createVirtualHost(
            {
                [callerFile]: { content: callerSource, scriptKind: ts.ScriptKind.TS },
                [targetFile]: { content: targetSource, scriptKind: ts.ScriptKind.ETS },
            },
            {
                "./sendable": {
                    resolvedFileName: targetFile,
                    isExternalLibraryImport: false,
                    extension: ts.Extension.Dets,
                } as ts.ResolvedModuleFull,
            }
        );
        const builderProgram = ts.createIncrementalProgramForArkTs({
            rootNames: [callerFile],
            options,
            host,
        });
        return ts.ArkTSLinter_1_1.runArkTSLinter(builderProgram);
    }

    function findLinterSendableDiagnostic(diags: readonly ts.Diagnostic[]): ts.Diagnostic | undefined {
        return diags.find(d =>
            d.code === 165 ||
            (d.messageText && d.messageText.toString().includes("arkts-no-ts-import-ets"))
        );
    }

    beforeEach(() => {
        originalArkuiXPath = process.env.arkUIXSdkRootPath;
        originalIsCrossplatform = process.env.isCrossplatform;
        delete process.env.arkUIXSdkRootPath;
        delete process.env.arkUIXSdxRootPath;
        delete process.env.isCrossplatform;
    });

    afterEach(() => {
        if (originalArkuiXPath !== undefined) {
            process.env.arkUIXSdkRootPath = originalArkuiXPath;
        }
        else {
            delete process.env.arkUIXSdkRootPath;
        }
        if (originalIsCrossplatform !== undefined) {
            process.env.isCrossplatform = originalIsCrossplatform;
        }
        else {
            delete process.env.isCrossplatform;
        }
        delete process.env.arkUIXSdxRootPath;
    });

    function enableCrossplatformArkuiXSdk(rootPath: string = defaultArkuiXRoot): void {
        process.env.isCrossplatform = "true";
        process.env.arkUIXSdkRootPath = rootPath;
    }

    it("recognizes system components declared under ArkUI-X SDK openharmony/ets/component/ path", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runComponentCheck(`${defaultArkuiXRoot}/openharmony/ets/component/button.d.ts`, "Button");
        // System UI component called outside build context in ETS file should report error 28015
        const componentDiag = findComponentPlaceDiagnostic(diags, "Button");
        assert.isDefined(componentDiag, "Expected UI component 'Button' cannot be used in this place error");
    });

    it("does not misidentify custom component in component-custom directory as system component (boundary check)", () => {
        enableCrossplatformArkuiXSdk();

        // Adjacent path sharing 'component' prefix but not in 'component' directory
        const diags = runComponentCheck(`${defaultArkuiXRoot}/openharmony/ets/component-custom/button.d.ts`, "CustomButton");
        // Component in component-custom is NOT an SDK system component, should NOT report error 28015
        const componentDiag = findComponentPlaceDiagnostic(diags, "CustomButton");
        assert.isUndefined(componentDiag, "Component in component-custom should not be treated as system component");
    });

    it("does not recognize system components when only typo env var arkUIXSdxRootPath is set", () => {
        process.env.isCrossplatform = "true";
        delete process.env.arkUIXSdkRootPath;
        process.env.arkUIXSdxRootPath = defaultArkuiXRoot;

        const diags = runComponentCheck(`${defaultArkuiXRoot}/openharmony/ets/component/button.d.ts`, "Button");
        const componentDiag = findComponentPlaceDiagnostic(diags, "Button");
        assert.isUndefined(componentDiag, "Typo env var arkUIXSdxRootPath must not be recognized as ArkUI-X SDK root");
    });

    it("allows declaration files in ArkUI-X SDK to import sendable declarations without forbidden error", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runSendableImportCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.test.d.ts`,
            `${defaultArkuiXRoot}/openharmony/ets/api/sendable.d.ets`
        );
        const forbiddenDiag = findForbiddenSendableDiagnostic(diags);
        assert.isUndefined(forbiddenDiag, "Should not report forbidden error when SDK .d.ts imports sendable");
    });

    it("strictly checks directory boundaries and forbids sendable import from adjacent ets-user directory", () => {
        enableCrossplatformArkuiXSdk();

        // Adjacent directory with same prefix: openharmony/ets-user/ vs openharmony/ets/
        const diags = runSendableImportCheck(
            `${defaultArkuiXRoot}/openharmony/ets-user/api.d.ts`,
            `${defaultArkuiXRoot}/openharmony/ets-user/sendable.d.ets`
        );
        // Files in ets-user MUST NOT be treated as SDK files, and must report forbidden error
        const forbiddenDiag = findForbiddenSendableDiagnostic(diags);
        assert.isDefined(forbiddenDiag, "Files in ets-user directory must report forbidden error when importing sendable");
    });

    it("skips @throws 401 warning for functions declared under ArkUI-X SDK", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runThrowsCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.throws401.d.ts`,
            "{ BusinessError } 401 - Parameter error."
        );
        const throwsDiag = findThrowsDiagnostic(diags);
        assert.isUndefined(throwsDiag, "Expected @throws 401 in ArkUI-X SDK declaration to skip warning 28040");
    });

    it("reports @throws 401 warning for functions in adjacent non-SDK ets-user directory", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runThrowsCheck(
            `${defaultArkuiXRoot}/openharmony/ets-user/@ohos.throws401.d.ts`,
            "{ BusinessError } 401 - Parameter error."
        );
        const throwsDiag = findThrowsDiagnostic(diags);
        assert.isDefined(throwsDiag, "Expected @throws 401 in adjacent ets-user directory to still report warning 28040");
    });

    it("still reports non-401 @throws warning for functions declared under ArkUI-X SDK", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runThrowsCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.throws201.d.ts`,
            "{ BusinessError } 201 - Permission denied."
        );
        const throwsDiag = findThrowsDiagnostic(diags);
        assert.isDefined(throwsDiag, "Expected non-401 @throws in ArkUI-X SDK declaration to still report warning 28040");
    });

    it("Linter classifies ArkUI-X SDK file as SDK and allows importing SDK sendable declaration", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runInteropLinterCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.caller.d.ts`,
            `${defaultArkuiXRoot}/openharmony/ets/api/sendable.d.ets`,
            /*tsImportSendableEnable*/ false
        );
        const linterDiag = findLinterSendableDiagnostic(diags);
        assert.isUndefined(linterDiag, "Expected Linter to classify caller and target in ArkUI-X SDK and allow sendable import");
    });

    it("Linter does not classify adjacent ets-user file as SDK when importing SDK sendable declaration", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runInteropLinterCheck(
            `${defaultArkuiXRoot}/openharmony/ets-user/caller.d.ts`,
            `${defaultArkuiXRoot}/openharmony/ets/api/sendable.d.ets`,
            /*tsImportSendableEnable*/ true
        );
        const linterDiag = findLinterSendableDiagnostic(diags);
        assert.isDefined(linterDiag, "Expected Linter to reject sendable default import from adjacent ets-user caller (isInSdk = false)");
    });

    it("Linter rejects target sendable module in adjacent ets-user directory even when caller is in ArkUI-X SDK", () => {
        enableCrossplatformArkuiXSdk();

        const diags = runInteropLinterCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.caller.d.ts`,
            `${defaultArkuiXRoot}/openharmony/ets-user/sendable.d.ets`,
            /*tsImportSendableEnable*/ false
        );
        const linterDiag = findLinterSendableDiagnostic(diags);
        assert.isDefined(linterDiag, "Expected Linter to reject sendable target outside ArkUI-X SDK whitelist");
    });

    it("does not exempt host OpenHarmony SDK files when ArkUI-X SDK path is active", () => {
        enableCrossplatformArkuiXSdk();

        const throwsDiags = runThrowsCheck(
            "/host/openharmony/ets/api/@ohos.throws401.d.ts",
            "{ BusinessError } 401 - Parameter error."
        );
        const throwsDiag = findThrowsDiagnostic(throwsDiags);
        assert.isDefined(throwsDiag, "Expected host SDK @throws 401 not to be exempted when ArkUI-X SDK is active");

        const sendableDiags = runSendableImportCheck(
            "/host/openharmony/ets/api/@ohos.test.d.ts",
            "/host/openharmony/ets/api/sendable.d.ets"
        );
        const forbiddenDiag = findForbiddenSendableDiagnostic(sendableDiags);
        assert.isDefined(forbiddenDiag, "Expected host SDK .d.ts not to be exempted for sendable import when ArkUI-X SDK is active");
    });

    it("uses host OpenHarmony SDK instead of ArkUI-X SDK when isCrossplatform is not true even if arkUIXSdkRootPath is set", () => {
        process.env.isCrossplatform = "false";
        process.env.arkUIXSdkRootPath = defaultArkuiXRoot;

        const arkuiXThrowsDiags = runThrowsCheck(
            `${defaultArkuiXRoot}/openharmony/ets/api/@ohos.throws401.d.ts`,
            "{ BusinessError } 401 - Parameter error."
        );
        assert.isDefined(findThrowsDiagnostic(arkuiXThrowsDiags), "Expected ArkUI-X SDK path not to be exempted when isCrossplatform is false");

        const hostThrowsDiags = runThrowsCheck(
            "/host/openharmony/ets/api/@ohos.throws401.d.ts",
            "{ BusinessError } 401 - Parameter error."
        );
        assert.isUndefined(findThrowsDiagnostic(hostThrowsDiags), "Expected host OpenHarmony SDK path to be exempted when isCrossplatform is false");
    });

    it("supports OpenHarmony CI SDK layout without openharmony intermediate directory for sendable import", () => {
        process.env.isCrossplatform = "false";
        const ciEtsLoaderPath = "/out/sdk/packages/ohos-sdk/linux/26.1.0/ets/build-tools/ets-loader";
        const files: Record<string, VirtualFileEntry> = {
            "/out/sdk/packages/ohos-sdk/linux/26.1.0/ets/api/@ohos.arkui.StateManagement.d.ts": {
                content: 'import { State } from "./sendable";\nexport declare const s: State;\n',
                scriptKind: ts.ScriptKind.TS
            },
            "/out/sdk/packages/ohos-sdk/linux/26.1.0/ets/api/sendable.d.ets": {
                content: "export declare class State {}\n",
                scriptKind: ts.ScriptKind.ETS
            }
        };
        const resolvedModules: Record<string, ts.ResolvedModuleFull> = {
            "./sendable": {
                resolvedFileName: "/out/sdk/packages/ohos-sdk/linux/26.1.0/ets/api/sendable.d.ets",
                extension: ts.Extension.Dets,
                isExternalLibraryImport: false
            }
        };
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2021,
            module: ts.ModuleKind.ESNext,
            needDoArkTsLinter: true,
            etsLoaderPath: ciEtsLoaderPath
        };
        const program = ts.createProgram(Object.keys(files), options, createVirtualHost(files, resolvedModules));
        const diags = program.getSemanticDiagnostics(
            program.getSourceFile("/out/sdk/packages/ohos-sdk/linux/26.1.0/ets/api/@ohos.arkui.StateManagement.d.ts")
        );
        assert.isUndefined(findForbiddenSendableDiagnostic(diags), "Expected CI ohos-sdk layout without openharmony/ subdir to allow SDK sendable import");
    });
});
