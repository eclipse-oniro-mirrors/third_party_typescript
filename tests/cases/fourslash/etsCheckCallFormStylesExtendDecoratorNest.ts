/// <reference path='./fourslash.ts' />

// @experimentaldecorators: true
// @ets: {}
// @target: es6
// @lib: es6

// @Filename: test.ets
//// @Styles({ minApiVersion: 12 }) function callFormStyle() {
////     .width(7)
////     .innerStyle()
//// }
////
//// @Extend(Text, { minApiVersion: 12 }) function callFormExtend() {
////     .fontSize(8)
//// }
////
//// @Styles function innerStyle() {
////     .height(50)
//// }
////
//// @Entry
//// @Component
//// struct Foo {
////     build() {
////         Text('y').callFormStyle()
////         Text('z').callFormExtend()
////     }
//// }

verify.noErrors();
