/// <reference path='./fourslash.ts' />

// @experimentaldecorators: true
// @ets: {}
// @target: es6
// @lib: es6

// @Filename: test.ets
//// @Styles function innerStyle() {
////     .height(50)
//// }
////
//// @Styles function globalStyleFn() {
////     .width(100)
////     .innerStyle()
////     .[|notACommonAttributeMember|]()
//// }

verify.getSemanticDiagnostics([
    { message: "Property 'notACommonAttributeMember' does not exist on type 'CommonAttribute'.", code: 2339, range: test.ranges()[0] },
]);
