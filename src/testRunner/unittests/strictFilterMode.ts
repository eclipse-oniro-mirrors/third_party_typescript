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

import * as ts from '../_namespaces/ts';
import { newProgram, SourceText } from './helpers';

describe('unittests:: strict filter mode', () => {
    it('maps enableAccurateNullChecks to the internal filtering strategy', () => {
        assert.strictEqual(ts.getStrictFilterMode({ enableAccurateNullChecks: true }), 'semantic');
        assert.strictEqual(ts.getStrictFilterMode({ enableAccurateNullChecks: false }), 'range');
        assert.strictEqual(ts.getStrictFilterMode({}), 'range');
        assert.strictEqual(
            ts.getStrictFilterMode({ enableAccurateNullChecks: 'true' as unknown as boolean }),
            'range',
        );
    });

    it('invalidates semantic diagnostics when enableAccurateNullChecks changes', () => {
        assert.isTrue(ts.compilerOptionsAffectSemanticDiagnostics(
            { enableAccurateNullChecks: true },
            { enableAccurateNullChecks: false },
        ));
        assert.isTrue(ts.compilerOptionsAffectSemanticDiagnostics(
            { enableAccurateNullChecks: false },
            { enableAccurateNullChecks: true },
        ));
        assert.isTrue(ts.compilerOptionsAffectSemanticDiagnostics(
            { enableAccurateNullChecks: true, enableStrictCheckOHModule: false },
            { enableAccurateNullChecks: true, enableStrictCheckOHModule: true },
        ));
        assert.isTrue(ts.compilerOptionsAffectSemanticDiagnostics(
            { enableAccurateNullChecks: true, disableStrictCheckPaths: ['oh_modules'] },
            { enableAccurateNullChecks: true, disableStrictCheckPaths: ['generated_dependencies'] },
        ));
    });

    it('classifies project TS as a library source without classifying project ETS', () => {
        const tsSourceFile = ts.createSourceFile(
            '/project/project_source.ts',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        const etsSourceFile = ts.createSourceFile(
            '/project/project_source.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );

        assert.strictEqual(
            ts.getLibraryCallFilterKind(tsSourceFile.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(ts.getLibraryCallFilterKind(etsSourceFile.statements[0]), undefined);
    });

    it('handles library source classification boundaries conservatively', () => {
        const thirdPartyEts = ts.createSourceFile(
            '/project/node_modules/pkg/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const similarDirectoryEts = ts.createSourceFile(
            '/project/node_modules_backup/pkg/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const standardLibrary = ts.createSourceFile(
            '/compiler/lib/lib.es2021.d.ts',
            'declare interface Array<T> {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        standardLibrary.hasNoDefaultLib = true;
        const ohModulesEts = ts.createSourceFile(
            'C:\\project\\OH_MODULES\\pkg\\index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const projectDeclaration = ts.createSourceFile(
            '/project/types/api.d.ts',
            'export declare function acceptString(value: string): void;',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        const similarBuildDirectory = ts.createSourceFile(
            '/project/build_output/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const buildEts = ts.createSourceFile(
            '/project/build/generated/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const previewEts = ts.createSourceFile(
            '/project/.preview/generated/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const ohModulesDeclaration = ts.createSourceFile(
            '/project/oh_modules/pkg/index.d.ts',
            'export declare function acceptString(value: string): void;',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        const standardLibraryLookalike = ts.createSourceFile(
            '/project/types/lib.es2021.d.ts',
            'export declare function acceptString(value: string): void;',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        const customNoDefaultLib = ts.createSourceFile(
            '/compiler/lib/custom.d.ts',
            'export declare function acceptString(value: string): void;',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.TS,
        );
        customNoDefaultLib.hasNoDefaultLib = true;

        assert.strictEqual(
            ts.getLibraryCallFilterKind(thirdPartyEts.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(ts.getLibraryCallFilterKind(similarDirectoryEts.statements[0]), undefined);
        assert.strictEqual(ts.getLibraryCallFilterKind(similarBuildDirectory.statements[0]), undefined);
        assert.strictEqual(
            ts.getLibraryCallFilterKind(buildEts.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(previewEts.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(ohModulesEts.statements[0]),
            ts.ArkTSLibraryCallFilterKind.OhModulesEts,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(ohModulesDeclaration.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(projectDeclaration.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(ts.getLibraryCallFilterKind(standardLibrary.statements[0]), undefined);
        assert.strictEqual(
            ts.getLibraryCallFilterKind(standardLibraryLookalike.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(customNoDefaultLib.statements[0]),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(ts.getLibraryCallFilterKind(undefined), undefined);
    });

    it('uses disableStrictCheckPaths when classifying a custom third-party ETS directory', () => {
        const customThirdPartyEts = ts.createSourceFile(
            '/project/generated_dependencies/pkg/index.ets',
            'export function acceptString(value: string): void {}',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        assert.strictEqual(
            ts.getLibraryCallFilterKind(
                customThirdPartyEts.statements[0],
                { disableStrictCheckPaths: ['generated_dependencies'] },
            ),
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    function getCallDiagnostics(
        mainText: string,
        libraryText: string,
        mainFileName = '/main.ets',
        enableAccurateNullChecks = true,
        additionalCompilerOptions: ts.CompilerOptions = {},
        libraryFileName = '/oh_modules/library.ts',
        libraryImport = './oh_modules/library',
        getFinalLinterDiagnostics = false,
    ): readonly ts.Diagnostic[] {
        const minimalGlobalTypes = [
            'declare global {',
            '    interface SymbolConstructor { readonly iterator: unique symbol; }',
            '    var Symbol: SymbolConstructor;',
            '    interface IteratorResult<T, TReturn = any> { done?: boolean; value: T | TReturn; }',
            '    interface Iterator<T, TReturn = any, TNext = undefined> {',
            '        next(...args: [] | [TNext]): IteratorResult<T, TReturn>;',
            '    }',
            '    interface Iterable<T> { [Symbol.iterator](): Iterator<T>; }',
            '    interface Array<T> extends Iterable<T> { length: number; [index: number]: T; }',
            '    interface Promise<T> {}',
            '}',
        ].join('\n');
        const files = [
            {
                name: mainFileName,
                text: SourceText.New(
                    '',
                    `import * as library from "${libraryImport}";`,
                    `${minimalGlobalTypes}\n${mainText}`,
                ),
            },
            { name: libraryFileName, text: SourceText.New('', '', libraryText) },
        ];
        const program = newProgram(files, [mainFileName], {
            ...additionalCompilerOptions,
            enableAccurateNullChecks,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            noLib: true,
            strictNullChecks: true,
            target: ts.ScriptTarget.ES2021,
        });
        const sourceFile = program.getSourceFile(mainFileName)!;
        return getFinalLinterDiagnostics ?
            program.getBindAndCheckDiagnostics(sourceFile, /*cancellationToken*/ undefined, /*isForLinter*/ true) :
            program.getTypeChecker().getDiagnostics(sourceFile);
    }

    it('returns already-filtered semantic diagnostics to the linter without changing normal diagnostics', () => {
        const mainText = 'library.acceptString(null);';
        const libraryText = 'export function acceptString(value: string): void {}';
        const finalLinterDiagnostics = getCallDiagnostics(
            mainText,
            libraryText,
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            /*additionalCompilerOptions*/ {},
            '/oh_modules/library.ts',
            './oh_modules/library',
            /*getFinalLinterDiagnostics*/ true,
        );

        assert.deepEqual(finalLinterDiagnostics, []);

        const files = [
            {
                name: '/main.ets',
                text: SourceText.New('', 'import * as library from "./oh_modules/library";', mainText),
            },
            { name: '/oh_modules/library.ts', text: SourceText.New('', '', libraryText) },
        ];
        const program = newProgram(files, ['/main.ets'], {
            enableAccurateNullChecks: true,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            noLib: true,
            strictNullChecks: true,
            target: ts.ScriptTarget.ES2021,
        });
        const normalDiagnostics = program.getBindAndCheckDiagnostics(program.getSourceFile('/main.ets')!);
        assert.strictEqual(normalDiagnostics.length, 1);
        assert.strictEqual(normalDiagnostics[0].code, 2345);
    });

    it('keeps non-filterable failures in final linter diagnostics', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptString(1);',
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            /*additionalCompilerOptions*/ {},
            '/oh_modules/library.ts',
            './oh_modules/library',
            /*getFinalLinterDiagnostics*/ true,
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].category, ts.DiagnosticCategory.Error);
    });

    it('downgrades filterable oh_modules ETS failures before returning them to the linter', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptString(null);',
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            /*additionalCompilerOptions*/ {},
            '/oh_modules/library.ets',
            './oh_modules/library',
            /*getFinalLinterDiagnostics*/ true,
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].category, ts.DiagnosticCategory.Warning);
    });

    it('does not apply semantic filtering at the linter diagnostic boundary when the option is disabled', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptString(null);',
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ false,
            /*additionalCompilerOptions*/ {},
            '/oh_modules/library.ts',
            './oh_modules/library',
            /*getFinalLinterDiagnostics*/ true,
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].category, ts.DiagnosticCategory.Error);
    });

    it('does not turn a consumed ts-expect-error directive into an unused directive', () => {
        const diagnostics = getCallDiagnostics(
            [
                '// @ts-expect-error: the library boundary error is intentionally suppressed',
                'library.acceptString(null);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            /*additionalCompilerOptions*/ {},
            '/oh_modules/library.ts',
            './oh_modules/library',
            /*getFinalLinterDiagnostics*/ true,
        );

        assert.deepEqual(diagnostics, []);
    });

    it('marks calls to a custom third-party ETS directory configured by disableStrictCheckPaths', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptString(null);',
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            { disableStrictCheckPaths: ['generated_dependencies'] },
            '/generated_dependencies/library.ets',
            './generated_dependencies/library',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks and consumes semantic diagnostics independently of the diagnostic locale', () => {
        const localizedMessages: ts.MapLike<string> = {};
        localizedMessages[ts.Diagnostics.Argument_of_type_0_is_not_assignable_to_parameter_of_type_1.key] =
            '类型“{0}”的参数不能赋给类型“{1}”的参数。';
        ts.setLocalizedDiagnosticMessages(localizedMessages);
        try {
            const diagnostics = getCallDiagnostics(
                'library.acceptString(null);',
                'export function acceptString(value: string): void {}',
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.include(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'), '不能赋给');
            assert.strictEqual(
                diagnostics[0].arktsLibraryCallFilter,
                ts.ArkTSLibraryCallFilterKind.Library,
            );

            const finalDiagnostics = getCallDiagnostics(
                'library.acceptString(null);',
                'export function acceptString(value: string): void {}',
                '/main.ets',
                /*enableAccurateNullChecks*/ true,
                /*additionalCompilerOptions*/ {},
                '/oh_modules/library.ts',
                './oh_modules/library',
                /*getFinalLinterDiagnostics*/ true,
            );
            assert.deepEqual(finalDiagnostics, []);
        }
        finally {
            ts.setLocalizedDiagnosticMessages(undefined);
        }
    });

    it('marks only actual nullish boundary failures, not nullish words in type text', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const nullText: "null";',
                'declare const undefinedText: "undefined";',
                'declare const unknownText: "unknown";',
                'library.acceptExpectedText(nullText);',
                'library.acceptExpectedText(undefinedText);',
                'library.acceptExpectedObject({ value: unknownText });',
                'library.acceptNamedTokenProperties({ null: 0, undefined: 1 });',
                'library.acceptString(null);',
            ].join('\n'),
            [
                'export function acceptExpectedText(value: "expected"): void {}',
                'export function acceptExpectedObject(value: { value: "expected" }): void {}',
                'export interface NamedTokenProperties { null: string; undefined: string; }',
                'export function acceptNamedTokenProperties(value: NamedTokenProperties): void {}',
                'export function acceptString(value: string): void {}',
            ].join('\n'),
        );

        assert.strictEqual(
            diagnostics.length,
            6,
            diagnostics.map(diagnostic => `${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' | ')}`).join('\n'),
        );
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(diagnostics[1].arktsLibraryCallFilter, undefined);
        assert.strictEqual(diagnostics[2].arktsLibraryCallFilter, undefined);
        assert.strictEqual(diagnostics[3].arktsLibraryCallFilter, undefined);
        assert.strictEqual(diagnostics[4].arktsLibraryCallFilter, undefined);
        assert.strictEqual(
            diagnostics[5].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark property names or template literal text as nullish types', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const nullProperty: { null: number };',
                'declare const optionalUndefinedProperty: { undefined?: number };',
                'declare const unknownMethod: { unknown(): void };',
                'declare const nullTemplate: `null-${string}`;',
                'declare const undefinedTemplate: `undefined-${string}`;',
                'library.acceptOtherObject(nullProperty);',
                'library.acceptOtherObject(optionalUndefinedProperty);',
                'library.acceptOtherObject(unknownMethod);',
                'library.acceptExpectedText(nullTemplate);',
                'library.acceptExpectedText(undefinedTemplate);',
            ].join('\n'),
            [
                'export function acceptOtherObject(value: { other: string }): void {}',
                'export function acceptExpectedText(value: "expected"): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 5);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('still marks a nested null type when it is the concrete failure reason', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const nestedNull: { value: null };',
                'library.acceptObject(nestedNull);',
            ].join('\n'),
            'export function acceptObject(value: { value: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a mixed object failure when a later property has a non-nullish mismatch', () => {
        const diagnostics = getCallDiagnostics(
            [
                'interface MixedSource { a: null; b: number; }',
                'declare const mixed: MixedSource;',
                'library.acceptMixedObject(mixed);',
            ].join('\n'),
            'export function acceptMixedObject(value: { a: string; b: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not mark a call when a later argument has a non-nullish mismatch', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptTwo(null, 1);',
            'export function acceptTwo(first: string, second: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks a nested object when every failing leaf is nullish', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { outer: { first: null; second: undefined } };',
                'library.acceptNested(source);',
            ].join('\n'),
            'export function acceptNested(value: { outer: { first: string; second: number } }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a deeply nested object with a hidden non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { outer: { first: null; second: boolean } };',
                'library.acceptNested(source);',
            ].join('\n'),
            'export function acceptNested(value: { outer: { first: string; second: number } }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not mark a union that also contains a non-nullish incompatible type', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: null | number;',
                'library.acceptString(source);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks a call when multiple ordinary arguments fail only for nullish reasons', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptThree(null, undefined, null);',
            'export function acceptThree(first: string, second: number, third: boolean): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks a rest call when every failing element is nullish', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptRest(null, undefined, null);',
            'export function acceptRest(...values: string[]): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a rest call with a later non-nullish incompatible element', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptRest(null, undefined, 1);',
            'export function acceptRest(...values: string[]): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks a callback whose return type fails only at a nullish leaf', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptFactory(() => null);',
            'export function acceptFactory(factory: () => string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a callback return object with a hidden non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptFactory(() => ({ first: null, second: 1 }));',
            'export function acceptFactory(factory: () => { first: string; second: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('marks an explicitly instantiated generic failure that is entirely nullish', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptGenericShape<string>({ value: null });',
            'export function acceptGenericShape<T>(value: { value: T }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark an explicitly instantiated generic with another incompatible property', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptGenericShape<string>({ value: null, count: false });',
            'export function acceptGenericShape<T>(value: { value: T; count: number }): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('marks every array element diagnostic when all failures are nullish', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptArray([null, undefined]);',
            'export function acceptArray(value: string[]): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(
            diagnostic => diagnostic.arktsLibraryCallFilter === ts.ArkTSLibraryCallFilterKind.Library,
        ));
    });

    it('does not mark any array element diagnostic when one element has a non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptArray([null, 1]);',
            'export function acceptArray(value: string[]): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('marks every tuple element diagnostic when all failures are nullish', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptTuple([null, undefined]);',
            'export function acceptTuple(value: [string, number]): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(
            diagnostic => diagnostic.arktsLibraryCallFilter === ts.ArkTSLibraryCallFilterKind.Library,
        ));
    });

    it('does not mark any tuple element diagnostic when one element has a non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptTuple([null, true]);',
            'export function acceptTuple(value: [string, number]): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('marks an object when every failing leaf is unknown', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { first: unknown; second: unknown };',
                'library.acceptObject(source);',
            ].join('\n'),
            'export function acceptObject(value: { first: string; second: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark an unknown object with a hidden non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { first: unknown; second: number };',
                'library.acceptObject(source);',
            ].join('\n'),
            'export function acceptObject(value: { first: string; second: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not hide a later direct unknown argument behind a filterable null argument', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const later: unknown;',
                'library.acceptTwo(null, later);',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not bypass the strictCheckerOnly unknown gate when a prior null argument is filterable', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const later: unknown;',
                'library.acceptTwo(null, later);',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            { strictCheckerOnly: true },
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('still marks a prior null failure when a later unknown argument is compatible', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const later: unknown;',
                'library.acceptTwo(null, later);',
            ].join('\n'),
            'export function acceptTwo(first: string, second: unknown): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('still marks a hidden nested unknown failure after a filterable null argument', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const later: { value: unknown };',
                'library.acceptTwo(null, later);',
            ].join('\n'),
            'export function acceptTwo(first: string, second: { value: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not hide a later unconstrained type parameter behind a filterable null argument', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function invoke<T>(later: T): void {',
                '    library.acceptTwo(null, later);',
                '}',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not hide a later type parameter constrained to unknown', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function invoke<T extends unknown>(later: T): void {',
                '    library.acceptTwo(null, later);',
                '}',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not bypass the strictCheckerOnly gate for a later unconstrained type parameter', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function invoke<T>(later: T): void {',
                '    library.acceptTwo(null, later);',
                '}',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            { strictCheckerOnly: true },
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2345);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('still marks a later type parameter constrained only to nullish types', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function invoke<T extends null | undefined>(later: T): void {',
                '    library.acceptTwo(null, later);',
                '}',
            ].join('\n'),
            'export function acceptTwo(first: string, second: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('handles recursive object relations when the concrete failure is nullish', () => {
        const diagnostics = getCallDiagnostics(
            [
                'interface Source { value: null; next: Source; }',
                'declare const source: Source;',
                'library.acceptObject(source);',
            ].join('\n'),
            [
                'export interface Target { value: string; next: Target; }',
                'export function acceptObject(value: Target): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a recursive object with a hidden non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            [
                'interface Source { value: null; count: number; next: Source; }',
                'declare const source: Source;',
                'library.acceptObject(source);',
            ].join('\n'),
            [
                'export interface Target { value: string; count: string; next: Target; }',
                'export function acceptObject(value: Target): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks a null-or-undefined union with no other incompatible constituent', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: null | undefined;',
                'library.acceptString(source);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not create diagnostics when the target already accepts nullish values', () => {
        const diagnostics = getCallDiagnostics(
            [
                'library.acceptNullable(null);',
                'library.acceptNullable(undefined);',
            ].join('\n'),
            'export function acceptNullable(value: string | null | undefined): void {}',
        );

        assert.strictEqual(diagnostics.length, 0);
    });

    it('does not create diagnostics for any or never arguments', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const anyValue: any;',
                'declare const neverValue: never;',
                'library.acceptString(anyValue);',
                'library.acceptString(neverValue);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 0);
    });

    it('does not mark a nullish object that also misses a required property', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptObject({ value: null });',
            'export function acceptObject(value: { value: string; required: number }): void {}',
        );

        assert.isTrue(diagnostics.length > 0);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('does not mark a nullish object with an excess property failure', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptObject({ value: null, extra: true });',
            'export function acceptObject(value: { value: string }): void {}',
        );

        assert.isTrue(diagnostics.length > 0);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('does not mark a nullish object with a discriminant mismatch', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { kind: "source"; value: null };',
                'library.acceptObject(source);',
            ].join('\n'),
            'export function acceptObject(value: { kind: "target"; value: string }): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not mark a nullish structural failure with incompatible private members', () => {
        const diagnostics = getCallDiagnostics(
            [
                'class Source { private brand: number = 0; value: null = null; }',
                'library.acceptTarget(new Source());',
            ].join('\n'),
            [
                'export class Target { private brand: number = 0; value: string = \'\'; }',
                'export function acceptTarget(value: Target): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not mark a generic constraint failure even when the type argument is null', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptConstrained<null>(null);',
            'export function acceptConstrained<T extends string>(value: T): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2344);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not create a diagnostic when one overload accepts null', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptOverload(null);',
            [
                'export function acceptOverload(value: string): void;',
                'export function acceptOverload(value: null): void;',
                'export function acceptOverload(value: string | null): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 0);
    });

    it('does not mark an overload failure that also contains an arity mismatch', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptOverload(null, true);',
            [
                'export function acceptOverload(value: string): void;',
                'export function acceptOverload(value: null, flag: string, count: number): void;',
                'export function acceptOverload(value: string | null, flag?: string, count?: number): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2575);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks a spread tuple when every expanded argument failure is nullish', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const values: [null, undefined, null];',
                'library.acceptThree(...values);',
            ].join('\n'),
            'export function acceptThree(first: string, second: number, third: boolean): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a spread tuple containing a non-nullish incompatible argument', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const values: [null, undefined, number];',
                'library.acceptThree(...values);',
            ].join('\n'),
            'export function acceptThree(first: string, second: number, third: boolean): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('handles a deeply nested all-nullish structural failure', () => {
        const wrap = (leaf: string): string => {
            let result = leaf;
            for (let i = 0; i < 32; i++) {
                result = `{ next: ${result} }`;
            }
            return result;
        };
        const diagnostics = getCallDiagnostics(
            [
                `declare const source: ${wrap('null')};`,
                'library.acceptDeep(source);',
            ].join('\n'),
            `export function acceptDeep(value: ${wrap('string')}): void {}`,
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark a wide call when its last argument has a non-nullish failure', () => {
        const parameterCount = 32;
        const parameters = Array.from({ length: parameterCount }, (_, index) => `p${index}: string`).join(', ');
        const argumentsList = Array.from(
            { length: parameterCount },
            (_, index) => index === parameterCount - 1 ? '1' : 'null',
        ).join(', ');
        const diagnostics = getCallDiagnostics(
            `library.acceptMany(${argumentsList});`,
            `export function acceptMany(${parameters}): void {}`,
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('keeps normal relation results isolated before and after a semantic library recheck', () => {
        const diagnostics = getCallDiagnostics(
            [
                'let before: string = null;',
                'library.acceptString(null);',
                'let after: string = null;',
                'library.acceptString(undefined);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 4);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(
            diagnostics[1].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(diagnostics[2].arktsLibraryCallFilter, undefined);
        assert.strictEqual(
            diagnostics[3].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks a real overload diagnostic when all candidates fail only for nullish reasons', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptOverload(null);',
            [
                'export function acceptOverload(value: string): void;',
                'export function acceptOverload(value: number): void;',
                'export function acceptOverload(value: string | number): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2769);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks an overload diagnostic when one candidate becomes applicable after ignoring nullish', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const value: string | undefined;',
                'library.acceptOverload(value);',
            ].join('\n'),
            [
                'export interface Resource { readonly id: number; }',
                'export function acceptOverload(value: string): void;',
                'export function acceptOverload(value: Resource): void;',
                'export function acceptOverload(value: string | Resource): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2769);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks an overload with more than three candidates when an earlier candidate becomes applicable', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const value: string | undefined;',
                'library.acceptOverload(value);',
            ].join('\n'),
            [
                'export interface Resource { readonly id: number; }',
                'export function acceptOverload(value: string): void;',
                'export function acceptOverload(value: Resource): void;',
                'export function acceptOverload(value: number): void;',
                'export function acceptOverload(value: boolean): void;',
                'export function acceptOverload(value: string | Resource | number | boolean): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2769);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('does not mark an overload when every candidate has a non-nullish failure', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const value: string | undefined;',
                'library.acceptOverload(value, true);',
            ].join('\n'),
            [
                'export interface Resource { readonly id: number; }',
                'export function acceptOverload(value: string, flag: string): void;',
                'export function acceptOverload(value: Resource, flag: number): void;',
                'export function acceptOverload(value: string | Resource, flag: string | number): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2769);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not mark arity or type-argument-count failures', () => {
        const diagnostics = getCallDiagnostics(
            [
                'library.acceptTwo(null);',
                'library.acceptGeneric<string, number>(null);',
            ].join('\n'),
            [
                'export function acceptTwo(first: string, second: string): void {}',
                'export function acceptGeneric<T>(value: T): void {}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('does not mark diagnostics for a TS caller or when the option is disabled', () => {
        const mainText = 'library.acceptString(null);';
        const libraryText = 'export function acceptString(value: string): void {}';
        const tsDiagnostics = getCallDiagnostics(mainText, libraryText, '/main.ts');
        const disabledDiagnostics = getCallDiagnostics(mainText, libraryText, '/main.ets', /*enableAccurateNullChecks*/ false);

        assert.strictEqual(tsDiagnostics.length, 1);
        assert.strictEqual(tsDiagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(disabledDiagnostics.length, 1);
        assert.strictEqual(disabledDiagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('marks the library boundary but not a nested project expression error', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function projectMaybe(value: string): string | null { return value; }',
                'library.acceptString(projectMaybe(null));',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(diagnostics[1].arktsLibraryCallFilter, undefined);
    });

    it('does not mark a direct call to a project ETS declaration', () => {
        const diagnostics = getCallDiagnostics(
            [
                'function projectAcceptString(value: string): void {}',
                'projectAcceptString(null);',
                'library.acceptString(null);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(
            diagnostics[1].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('marks parenthesized, returned, callable, intersection, and optional library calls', () => {
        const diagnostics = getCallDiagnostics(
            [
                '(library.acceptString)(null);',
                'library.getAcceptor()(undefined);',
                'library.callable(null);',
                'library.intersectionCallable(undefined);',
                'library.unionCallable(null);',
                'library.acceptString?.(null);',
                'declare const maybeContainer: library.LibraryContainer | undefined;',
                'maybeContainer?.accept(undefined);',
                'declare const optionalContainer: library.OptionalContainer;',
                'optionalContainer.accept?.(null);',
            ].join('\n'),
            [
                'export function acceptString(value: string): void {}',
                'export function getAcceptor(): (value: string) => void { return acceptString; }',
                'export interface Acceptor { (value: string): void; }',
                'export interface AlternateAcceptor { (value: string): void; }',
                'export interface Tagged { readonly tag: string; }',
                'export declare const callable: Acceptor;',
                'export declare const intersectionCallable: Acceptor & Tagged;',
                'export declare const unionCallable: Acceptor | AlternateAcceptor;',
                'export class LibraryContainer { accept(value: string): void {} }',
                'export interface OptionalContainer { accept?: (value: string) => void; }',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 8);
        assert.isTrue(diagnostics.every(
            diagnostic => diagnostic.arktsLibraryCallFilter === ts.ArkTSLibraryCallFilterKind.Library,
        ));
    });

    it('marks property, element, and awaited nullish arguments but accepts a non-null assertion', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const source: { value: string | null };',
                'library.acceptString(source.value);',
                'library.acceptString(source["value"]);',
                'library.acceptString(source.value!);',
                'async function invoke(): Promise<void> {',
                '    library.acceptString(await (undefined as string | undefined));',
                '}',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 3);
        assert.isTrue(diagnostics.every(
            diagnostic => diagnostic.arktsLibraryCallFilter === ts.ArkTSLibraryCallFilterKind.Library,
        ));
    });

    it('handles library base constructors and keeps ordinary constructor failures', () => {
        const diagnostics = getCallDiagnostics(
            [
                'class Derived extends library.LibraryBase {',
                '    constructor() { super(null); }',
                '}',
                'new library.LibraryBase(true);',
            ].join('\n'),
            'export class LibraryBase { constructor(value: string) {} }',
        );

        assert.strictEqual(diagnostics.length, 2);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(diagnostics[1].arktsLibraryCallFilter, undefined);
    });

    it('marks an overloaded library instance method when a candidate fails only for nullish reasons', () => {
        const diagnostics = getCallDiagnostics(
            [
                'declare const attribute: library.Attribute;',
                'declare const value: string | undefined;',
                'attribute.accessibilityText(value);',
            ].join('\n'),
            [
                'export interface Resource { readonly id: number; }',
                'export class Attribute {',
                '    accessibilityText(value: string): this;',
                '    accessibilityText(value: Resource): this;',
                '    accessibilityText(value: string | Resource): this { return this; }',
                '}',
            ].join('\n'),
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2769);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('keeps a real this-context failure from a library function', () => {
        const diagnostics = getCallDiagnostics(
            'library.withThis(null);',
            'export function withThis(this: { tag: string }, value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, 2684);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    it('does not treat call, apply, or bind standard-library signatures as library boundaries', () => {
        const mainFileName = '/main.ets';
        const files = [
            {
                name: mainFileName,
                text: SourceText.New(
                    '',
                    'import { acceptString } from "./oh_modules/library";',
                    [
                        'acceptString.call(undefined, null);',
                        'acceptString.apply(undefined, [null]);',
                        'acceptString.bind(undefined, null);',
                    ].join('\n'),
                ),
            },
            {
                name: '/oh_modules/library.ts',
                text: SourceText.New('', '', 'export function acceptString(value: string): void {}'),
            },
            {
                name: 'lib.d.ts',
                text: SourceText.New(
                    '/// <reference no-default-lib="true"/>',
                    '',
                    [
                        'interface Array<T> { length: number; [index: number]: T; }',
                        'interface Function {}',
                        'interface CallableFunction extends Function {',
                        '    apply<T, A extends any[], R>(this: (this: T, ...args: A) => R, thisArg: T, args: A): R;',
                        '    call<T, A extends any[], R>(this: (this: T, ...args: A) => R, thisArg: T, ...args: A): R;',
                        '    bind<T, A0, A extends any[], R>(',
                        '        this: (this: T, arg0: A0, ...args: A) => R,',
                        '        thisArg: T,',
                        '        arg0: A0,',
                        '    ): (...args: A) => R;',
                        '}',
                    ].join('\n'),
                ),
            },
        ];
        const program = newProgram(files, [mainFileName], {
            enableAccurateNullChecks: true,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            strictBindCallApply: true,
            strictFunctionTypes: true,
            strictNullChecks: true,
            target: ts.ScriptTarget.ES2021,
        });
        const diagnostics = program.getTypeChecker().getDiagnostics(program.getSourceFile(mainFileName)!);

        assert.strictEqual(
            diagnostics.length,
            3,
            diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
        );
        assert.isTrue(diagnostics.every(diagnostic => diagnostic.arktsLibraryCallFilter === undefined));
    });

    it('keeps project property initializers and return-value failures outside library-call filtering', () => {
        const diagnostics = getCallDiagnostics(
            [
                'class ProjectValue { value: string = null; }',
                'function returnsString(): string { return undefined; }',
                'library.acceptString(null);',
            ].join('\n'),
            'export function acceptString(value: string): void {}',
        );

        assert.strictEqual(diagnostics.length, 3);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(diagnostics[1].arktsLibraryCallFilter, undefined);
        assert.strictEqual(
            diagnostics[2].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('classifies JavaScript, JSX, and TSX files only when they are in a library directory', () => {
        const scriptKinds = [ts.ScriptKind.JS, ts.ScriptKind.JSX, ts.ScriptKind.TSX];
        for (const scriptKind of scriptKinds) {
            const extension = scriptKind === ts.ScriptKind.JS ? 'js' : scriptKind === ts.ScriptKind.JSX ? 'jsx' : 'tsx';
            const thirdPartySource = ts.createSourceFile(
                `/project/node_modules/pkg/index.${extension}`,
                'export function acceptString(value) {}',
                ts.ScriptTarget.Latest,
                /*setParentNodes*/ true,
                scriptKind,
            );
            const projectSource = ts.createSourceFile(
                `/project/src/index.${extension}`,
                'export function acceptString(value) {}',
                ts.ScriptTarget.Latest,
                /*setParentNodes*/ true,
                scriptKind,
            );

            assert.strictEqual(
                ts.getLibraryCallFilterKind(thirdPartySource.statements[0]),
                ts.ArkTSLibraryCallFilterKind.Library,
            );
            assert.strictEqual(ts.getLibraryCallFilterKind(projectSource.statements[0]), undefined);
        }
    });

    it('marks a typed call whose declaration comes from a third-party TSX file', () => {
        const diagnostics = getCallDiagnostics(
            'library.acceptString(null);',
            'export function acceptString(value: string): void {}',
            '/main.ets',
            /*enableAccurateNullChecks*/ true,
            { jsx: ts.JsxEmit.Preserve },
            '/node_modules/library.tsx',
            './node_modules/library',
        );

        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(
            diagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
    });

    it('returns the same filtered result when the same program is checked repeatedly', () => {
        const mainFileName = '/main.ets';
        const files = [
            {
                name: mainFileName,
                text: SourceText.New(
                    '',
                    'import * as library from "./oh_modules/library";',
                    'library.acceptString(null);',
                ),
            },
            {
                name: '/oh_modules/library.ts',
                text: SourceText.New('', '', 'export function acceptString(value: string): void {}'),
            },
        ];
        const program = newProgram(files, [mainFileName], {
            enableAccurateNullChecks: true,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            noLib: true,
            strictNullChecks: true,
            target: ts.ScriptTarget.ES2021,
        });
        const sourceFile = program.getSourceFile(mainFileName)!;

        const first = program.getBindAndCheckDiagnostics(sourceFile, /*cancellationToken*/ undefined, /*isForLinter*/ true);
        const second = program.getBindAndCheckDiagnostics(sourceFile, /*cancellationToken*/ undefined, /*isForLinter*/ true);

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
    });

    it('invalidates restored incremental diagnostics when the option changes', () => {
        const projectRoot = '/project';
        const mainFileName = `${projectRoot}/main.ets`;
        const libraryFileName = `${projectRoot}/oh_modules/library.ts`;
        const buildInfoFileName = `${projectRoot}/cache.tsbuildinfo`;
        const sys = ts.tscWatch.createWatchedSystem(
            [
                {
                    path: mainFileName,
                    content: 'import * as library from "./oh_modules/library"; library.acceptString(null);',
                },
                {
                    path: libraryFileName,
                    content: 'export function acceptString(value: string): void {}',
                },
            ],
            { currentDirectory: projectRoot },
        );
        const baseOptions: ts.CompilerOptions = {
            incremental: true,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            noLib: true,
            strictNullChecks: true,
            target: ts.ScriptTarget.ES2021,
            tsBuildInfoFile: buildInfoFileName,
        };
        const createBuilder = (enableAccurateNullChecks: boolean): ts.EmitAndSemanticDiagnosticsBuilderProgram => {
            const options = { ...baseOptions, enableAccurateNullChecks };
            return ts.createIncrementalProgram({
                rootNames: [mainFileName],
                options,
                host: ts.createIncrementalCompilerHost(options, sys),
            });
        };
        const getMainDiagnostics = (
            builder: ts.EmitAndSemanticDiagnosticsBuilderProgram,
        ): readonly ts.Diagnostic[] => builder.getSemanticDiagnostics(builder.getProgram().getSourceFile(mainFileName)!);

        const rangeBuilder = createBuilder(/*enableAccurateNullChecks*/ false);
        const rangeDiagnostics = getMainDiagnostics(rangeBuilder);
        rangeBuilder.emitBuildInfo();
        assert.isTrue(sys.fileExists(buildInfoFileName));

        const semanticBuilder = createBuilder(/*enableAccurateNullChecks*/ true);
        const semanticDiagnostics = getMainDiagnostics(semanticBuilder);
        semanticBuilder.emitBuildInfo();

        const rangeBuilderAgain = createBuilder(/*enableAccurateNullChecks*/ false);
        const rangeDiagnosticsAgain = getMainDiagnostics(rangeBuilderAgain);

        assert.strictEqual(rangeDiagnostics.length, 1);
        assert.strictEqual(rangeDiagnostics[0].arktsLibraryCallFilter, undefined);
        assert.strictEqual(semanticDiagnostics.length, 1);
        assert.strictEqual(
            semanticDiagnostics[0].arktsLibraryCallFilter,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        assert.strictEqual(rangeDiagnosticsAgain.length, 1);
        assert.strictEqual(rangeDiagnosticsAgain[0].arktsLibraryCallFilter, undefined);
    });

    it('handles an omitted argument node conservatively without crashing', () => {
        const sourceFile = ts.createSourceFile(
            '/main.ets',
            'library.acceptThree(null, , undefined);',
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            ts.ScriptKind.ETS,
        );
        const diagnostics = getCallDiagnostics(
            'library.acceptThree(null, , undefined);',
            'export function acceptThree(first: string, second: number, third: boolean): void {}',
        );

        assert.strictEqual(sourceFile.parseDiagnostics.length, 1);
        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].arktsLibraryCallFilter, undefined);
    });

    function createOverloadDiagnostic(
        filterKind?: ts.ArkTSLibraryCallFilterKind,
        childFilterKind?: ts.ArkTSLibraryCallFilterKind,
        filterCause?: ts.ArkTSLibraryCallFilterCause,
    ): ts.Diagnostic {
        const child: ts.DiagnosticMessageChain = {
            category: ts.DiagnosticCategory.Error,
            code: 2345,
            messageText: 'Argument of type \'undefined\' is not assignable to parameter of type \'string\'.',
            arktsLibraryCallFilter: childFilterKind,
        };
        return {
            category: ts.DiagnosticCategory.Error,
            code: 2769,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: {
                category: ts.DiagnosticCategory.Error,
                code: 2769,
                messageText: 'No overload matches this call.',
                next: [child],
            },
            arktsLibraryCallFilter: filterKind,
            arktsLibraryCallFilterCause: filterCause,
        };
    }

    it('does not infer semantic filter eligibility from a child message-chain marker', () => {
        const diagnostic = createOverloadDiagnostic(
            /*filterKind*/ undefined,
            ts.ArkTSLibraryCallFilterKind.Library,
        );
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, [diagnostic]);
    });

    it('uses the final diagnostic marker as the semantic filter authority', () => {
        const diagnostic = createOverloadDiagnostic(
            ts.ArkTSLibraryCallFilterKind.Library,
            /*childFilterKind*/ undefined,
            ts.ArkTSLibraryCallFilterCause.Nullish,
        );
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, []);
    });

    it('ignores unknown final diagnostic marker values', () => {
        const diagnostic = createOverloadDiagnostic(
            99 as ts.ArkTSLibraryCallFilterKind,
            /*childFilterKind*/ undefined,
            ts.ArkTSLibraryCallFilterCause.Nullish,
        );
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, [diagnostic]);
    });

    it('does not filter this-context diagnostics even if they carry a library marker', () => {
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Error,
            code: 2684,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: 'The \'this\' context is not assignable to the method\'s \'this\' context.',
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
            arktsLibraryCallFilterCause: ts.ArkTSLibraryCallFilterCause.Nullish,
        };
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, [diagnostic]);
    });

    it('does not consume warnings even when a valid marker is present', () => {
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Warning,
            code: 2345,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: 'Argument of type \'null\' is not assignable to parameter of type \'string\'.',
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
            arktsLibraryCallFilterCause: ts.ArkTSLibraryCallFilterCause.Nullish,
        };
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, [diagnostic]);
    });

    it('does not consume a stale marker for nullish words that are not types', () => {
        const messages = [
            ...['null', 'undefined', 'unknown'].map(value =>
                `Argument of type '${JSON.stringify(value)}' is not assignable to parameter of type '"expected"'.`),
            'Argument of type \'{ null: number; }\' is not assignable to parameter of type \'{ other: string; }\'.',
            'Argument of type \'`null-${string}`\' is not assignable to parameter of type \'"expected"\'.',
        ];
        const diagnostics: ts.Diagnostic[] = messages.map(messageText => ({
            category: ts.DiagnosticCategory.Error,
            code: 2345,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText,
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
        }));
        diagnostics.push({
            category: ts.DiagnosticCategory.Error,
            code: 2345,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: {
                category: ts.DiagnosticCategory.Error,
                code: 2345,
                messageText: 'Argument of type \'{ undefined?: number | undefined; }\' is not assignable to parameter of type \'{ other: string; }\'.',
                next: [{
                    category: ts.DiagnosticCategory.Error,
                    code: 2741,
                    messageText: 'Property \'other\' is missing in type \'{ undefined?: number | undefined; }\' but required in type \'{ other: string; }\'.',
                }],
            },
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
        });
        const result = ts.applyArkTSLibraryCallDiagnosticFilter(diagnostics, { enableAccurateNullChecks: true });
        assert.deepEqual(result, diagnostics);
    });

    it('does not consume non-nullish or non-target diagnostics with a stale marker', () => {
        const diagnostics: ts.Diagnostic[] = [
            [2322, 'Type \'number\' is not assignable to type \'string\'.'],
            [2345, 'Argument of type \'number\' is not assignable to parameter of type \'string\'.'],
            [2344, 'Type \'number\' does not satisfy the constraint \'string\'.'],
            [2554, 'Expected 1 arguments, but got 0.'],
            [2558, 'Expected 1 type arguments, but got 2.'],
        ].map(([code, messageText]) => ({
            category: ts.DiagnosticCategory.Error,
            code: code as number,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: messageText as string,
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
        }));
        const result = ts.applyArkTSLibraryCallDiagnosticFilter(diagnostics, { enableAccurateNullChecks: true });
        assert.deepEqual(result, diagnostics);
    });

    it('uses structured unknown causes instead of the legacy filterFlag in semantic mode', () => {
        const createUnknownDiagnostic = (
            filterFlag?: boolean,
            filterCause?: ts.ArkTSLibraryCallFilterCause,
        ): ts.Diagnostic => ({
            category: ts.DiagnosticCategory.Error,
            code: 2322,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: {
                category: ts.DiagnosticCategory.Error,
                code: 2322,
                messageText: 'Type \'unknown\' is not assignable to type \'string\'.',
                filterFlag,
            },
            arktsLibraryCallFilter: ts.ArkTSLibraryCallFilterKind.Library,
            arktsLibraryCallFilterCause: filterCause,
        });
        const legacyDiagnostic = createUnknownDiagnostic(/*filterFlag*/ true);
        const structuredDiagnostic = createUnknownDiagnostic(
            /*filterFlag*/ undefined,
            ts.ArkTSLibraryCallFilterCause.Unknown,
        );
        const result = ts.applyArkTSLibraryCallDiagnosticFilter(
            [legacyDiagnostic, structuredDiagnostic],
            { enableAccurateNullChecks: true, strictCheckerOnly: true },
        );

        assert.deepEqual(result, [legacyDiagnostic]);
    });

    it('keeps a marked overload diagnostic when any displayed child is non-nullish', () => {
        const diagnostic = createOverloadDiagnostic(ts.ArkTSLibraryCallFilterKind.Library);
        const chain = diagnostic.messageText as ts.DiagnosticMessageChain;
        chain.next!.push({
            category: ts.DiagnosticCategory.Error,
            code: 2345,
            messageText: 'Argument of type \'number\' is not assignable to parameter of type \'string\'.',
        });
        const result = ts.applyArkTSLibraryCallDiagnosticFilter([diagnostic], { enableAccurateNullChecks: true });
        assert.deepEqual(result, [diagnostic]);
    });
});
