/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
'use shared'

export const enum Enum1 {
    prop1 = 1
}  // OK

export const enum Enum2 {
    prop1 = 1,
    prop2 = 2
}  // OK

export enum Enum3 {
    prop1 = 1
}  // ERROR

export enum Enum4 {
    prop1 = 1,
    prop2 = 2
}  // ERROR

const enum Enum5 {
    prop1 = 1
}

const enum Enum6 {
    prop1 = 1,
    prop2 = 2
}

export{Enum5, Enum6} // OK