/* Generated file to emulate the  Harness namespace. */

export * from "../../harness/_namespaces/Harness";
export * from "../../loggedIO/_namespaces/Harness";
import * as Parallel from "./Harness.Parallel";
export { Parallel };
export * from "../fourslashRunner";
export * from "../compilerRunner";
export * from "../externalCompileRunner";
export * from "../test262Runner";
export * from "../runner";

// If running bundled, we want this to be here so that esbuild places the tests after runner.ts.
if (!__filename.endsWith("Harness.js")) {
    require("../tests");
}