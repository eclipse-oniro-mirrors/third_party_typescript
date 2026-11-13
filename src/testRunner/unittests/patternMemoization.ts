import * as ts from '../_namespaces/ts';

function referenceMatch(patterns: readonly (string | ts.Pattern)[], candidate: string): string | ts.Pattern | undefined {
    let best: ts.Pattern | undefined;
    for (const pattern of patterns) {
        if (typeof pattern === 'string') {
            if (pattern === candidate) {
                return pattern;
            }
        }
        else if (candidate.length >= pattern.prefix.length + pattern.suffix.length &&
            candidate.startsWith(pattern.prefix) && candidate.endsWith(pattern.suffix) &&
            (!best || pattern.prefix.length > best.prefix.length)) {
            best = pattern;
        }
    }
    return best;
}

describe('unittests::patternMemoization', () => {
    it('honors in-place paths key changes across public resolveModuleName calls', () => {
        const options: ts.CompilerOptions = {
            baseUrl: '/project',
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            paths: { '@app/*': ['src/*'] },
        };
        const files = new Set(['/project/src/x.ts', '/project/special.ts']);
        const host: ts.ModuleResolutionHost = {
            fileExists: file => files.has(file),
            readFile: () => undefined,
        };
        const resolve = (): string | undefined => ts.resolveModuleName('@app/x', '/project/index.ts', options, host).resolvedModule?.resolvedFileName;
        assert.equal(resolve(), '/project/src/x.ts');
        options.paths!['@app/x'] = ['special.ts'];
        assert.equal(resolve(), '/project/special.ts');
        delete options.paths!['@app/x'];
        assert.equal(resolve(), '/project/src/x.ts');
    });

    it('parses the keys of a paths object only once and keeps a stable array', () => {
        let enumerations = 0;
        const paths = new Proxy(Object.freeze({ '@app/*': ['src/*'], exact: ['file'], '**': ['invalid'] }), {
            ownKeys(target): string[] {
                enumerations++;
                return Object.keys(target);
            }
        });
        const parsed = ts.tryParsePatterns(paths);
        assert.deepEqual(parsed, [{ prefix: '@app/', suffix: '' }, 'exact']);
        const firstEnumerations = enumerations;
        assert.strictEqual(ts.tryParsePatterns(paths), parsed);
        assert.isAbove(firstEnumerations, 0);
        assert.equal(enumerations, firstEnumerations);
        assert.notStrictEqual(ts.tryParsePatterns({ ...paths }), parsed);
    });

    it('does not rescan rules for either a match or a cached miss', () => {
        let reads = 0;
        const patterns = ts.tryParsePatterns(Object.freeze({ '@app/*': ['src/*'] }));
        const rule = patterns[0] as ts.Pattern;
        const { prefix } = rule;
        Object.defineProperty(rule, 'prefix', { get() { reads++; return prefix; } });
        assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/model'), rule);
        assert.isUndefined(ts.matchPatternOrExact(patterns, 'missing'));
        const firstReads = reads;
        assert.isAbove(firstReads, 0);
        assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/model'), rule);
        assert.isUndefined(ts.matchPatternOrExact(patterns, 'missing'));
        assert.equal(reads, firstReads);
        assert.isUndefined(ts.matchPatternOrExact([{ prefix: '@other/', suffix: '' }], '@app/model'));
    });

    it('returns a lone catch-all rule without rescanning it for distinct names', () => {
        const patterns = ts.tryParsePatterns(Object.freeze({ '*': ['src/*'] }));
        const rule = patterns[0] as ts.Pattern;
        let reads = 0;
        Object.defineProperty(rule, 'prefix', { get() { reads++; return ''; } });
        assert.strictEqual(ts.matchPatternOrExact(patterns, ''), rule);
        for (let i = 0; i < 100; i++) {
            assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/module' + i), rule);
        }
        assert.equal(reads, 0);

        const mixed = ts.tryParsePatterns(Object.freeze({ '*': ['src/*'], '@app/model': ['special.ts'] }));
        assert.strictEqual(ts.matchPatternOrExact(mixed, '@app/model'), '@app/model');
        assert.strictEqual(ts.matchPatternOrExact(mixed, '@app/other'), mixed[0]);
    });

    it('bounds the cache while the same paths configuration stays alive', () => {
        const patterns = ts.tryParsePatterns(Object.freeze({ '@app/*': ['src/*'] }));
        const rule = patterns[0] as ts.Pattern;
        const { prefix } = rule;
        let reads = 0;
        Object.defineProperty(rule, 'prefix', { get() { reads++; return prefix; } });
        assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/original'), rule);
        for (let i = 0; i < 16_384; i++) {
            assert.isUndefined(ts.matchPatternOrExact(patterns, 'missing/' + i));
        }
        const readsBeforeRecentHit = reads;
        assert.isUndefined(ts.matchPatternOrExact(patterns, 'missing/16382'));
        assert.equal(reads, readsBeforeRecentHit, 'recent misses should survive eviction');
        const readsBeforeRetry = reads;
        assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/original'), rule);
        assert.isAbove(reads, readsBeforeRetry, 'the old entry should have been evicted');
        const readsAfterRetry = reads;
        assert.strictEqual(ts.matchPatternOrExact(patterns, '@app/original'), rule);
        assert.equal(reads, readsAfterRetry, 'the recomputed match should be cached');
    });

    it('preserves exact-match priority, wildcard ties and misses across configurations', () => {
        const candidates = ['@app/model', '@app/internal/model', '@app/other.ts', '@app/a.ts', '', 'missing'];
        const rules = ['@app/*', '@app/internal/*', '@app/*.ts', '@app/*r.ts', '@app/model', '**'];
        let seed = 42;
        for (let i = 0; i < 200; i++) {
            const paths: ts.MapLike<string[]> = {};
            for (let j = 0; j < rules.length; j++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                if (seed >>> 31) {
                    paths[rules[(i + j) % rules.length]] = ['src/*'];
                }
            }
            const patterns = ts.tryParsePatterns(Object.freeze(paths));
            for (const candidate of candidates.concat(candidates)) {
                assert.strictEqual(ts.matchPatternOrExact(patterns, candidate), referenceMatch(patterns, candidate));
            }
        }
    });
});
