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

export interface LibraryValue {
  value: string;
}

export interface OptionalLibraryValue {
  value?: string;
}

export function acceptString(value: string): void {}
export function acceptStringOrNumber(value: string | number): void {}
export function acceptObject(value: LibraryValue): void {}
export function acceptStringArray(value: string[]): void {}
export function acceptTuple(value: [string, number]): void {}
export function acceptGeneric<T>(value: T): void {}
export function acceptCallback(callback: (value: string | number) => void): void {}
export function acceptPair(value: string, count: number): void {}
export function acceptRest(...values: string[]): void {}
export function getUnknown(): unknown { return ''; }

export class LibraryContainer {
  constructor(value: string) {}
  accept(value: string): void {}
  static acceptStatic(value: string): void {}
}

export class GenericLibraryContainer<T> {
  constructor(value: T) {}
}

export function nullOnlyOverload(value: string): void;
export function nullOnlyOverload(value: number): void;
export function nullOnlyOverload(value: string | number): void {}

export function mixedOverload(value: string, flag: number): void;
export function mixedOverload(value: null, flag: string): void;
export function mixedOverload(value: string | null, flag: string | number): void {}

export function threeNullishOverload(value: string): void;
export function threeNullishOverload(value: number): void;
export function threeNullishOverload(value: boolean): void;
export function threeNullishOverload(value: string | number | boolean): void {}

export function fourNullishOverload(value: string): void;
export function fourNullishOverload(value: number): void;
export function fourNullishOverload(value: boolean): void;
export function fourNullishOverload(value: symbol): void;
export function fourNullishOverload(value: string | number | boolean | symbol): void {}
