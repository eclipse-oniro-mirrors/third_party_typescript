/// <reference path='./fourslash.ts' />

// @experimentaldecorators: true
// @ets: {}
// @target: es6
// @lib: es6

// @Filename: test.ets
//// @Styles function useStateStylesFn() {
////     .stateStyles({
////         normal: {
////             .width(200)
////             .globalStyleFn()
////         }
////     })
//// }
////
//// @Styles function globalStyleFn() {
////     .width(100)
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
////         Text('s')
////             .stateStyles({
////                 normal: {
////                     .width(5)
////                     .globalStyleFn()
////                 }
////             })
////     }
//// }

verify.noErrors();
