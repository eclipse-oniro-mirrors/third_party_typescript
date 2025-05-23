import * as ts from "../../_namespaces/ts";
import * as Utils from "../../_namespaces/Utils";

describe("unittests:: tsc:: forceConsistentCasingInFileNames::", () => {
    ts.verifyTsc({
        scenario: "forceConsistentCasingInFileNames",
        subScenario: "with relative and non relative file resolutions",
        commandLineArgs: ["/src/project/src/struct.d.ts", "--forceConsistentCasingInFileNames", "--explainFiles"],
        fs: () => ts.loadProjectFromFiles({
            "/src/project/src/struct.d.ts": Utils.dedent`
                    import * as xs1 from "fp-ts/lib/Struct";
                    import * as xs2 from "fp-ts/lib/struct";
                    import * as xs3 from "./Struct";
                    import * as xs4 from "./struct";
                `,
            "/src/project/node_modules/fp-ts/lib/struct.d.ts": `export function foo(): void`,
        }),
    });
});