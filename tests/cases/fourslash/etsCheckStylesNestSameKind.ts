/// <reference path='./fourslash.ts' />

// @experimentaldecorators: true
// @ets: {}
// @target: es6
// @lib: es6

// @Filename: test.ets
//// @Styles function globalStyleFn() {
////     .width(100)
////     .innerStyle()
//// }
////
//// @Styles function innerStyle() {
////     .height(50)
////     .innerStyle()
//// }
////
//// @Extend(Flex) function flexExtendA() {
////     .width(1)
////     .flexExtendB()
//// }
////
//// @Extend(Flex) function flexExtendB() {
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
////         .width(9)
////         .innerStyle()
////         .componentFancy()
////     }
//// }

verify.noErrors();
