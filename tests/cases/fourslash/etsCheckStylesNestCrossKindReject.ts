/// <reference path='./fourslash.ts' />

// @experimentaldecorators: true
// @ets: {}
// @target: es6
// @lib: es6

// @Filename: test.ets
//// @Styles function globalStyleFn() {
////     .[|textExtendFn|]()
//// }
////
//// @Extend(Flex) function flexExtendA() {
////     .[|globalStyleFn|]()
//// }
////
//// @Extend(Text) function textExtendFn() {
////     .fontSize(3)
//// }
////
//// @Styles function innerStyle() {
////     .height(2)
//// }
////
//// @Entry
//// @Component
//// struct Foo {
////     build() {
////         Flex() {
////         }.width(1)
////     }
////     @Styles componentFancy() {
////         .[|flexExtendA|]()
////     }
//// }
////
//// @Styles function outerBad() {
////     .[|componentFancy|]()
//// }

const [r0, r1, r2, r3] = test.ranges();
verify.getSemanticDiagnostics([
    { message: "Property 'textExtendFn' does not exist on type 'CommonAttribute'.", code: 2339, range: r0 },
    { message: "Property 'globalStyleFn' does not exist on type 'FlexAttribute'.", code: 2339, range: r1 },
    { message: "Property 'flexExtendA' does not exist on type 'CommonAttribute'.", code: 2339, range: r2 },
    { message: "Property 'componentFancy' does not exist on type 'CommonAttribute'.", code: 2339, range: r3 },
]);
