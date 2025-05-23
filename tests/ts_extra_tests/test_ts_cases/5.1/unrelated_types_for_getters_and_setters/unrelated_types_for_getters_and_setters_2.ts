/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**---
 description: >
    TypeScript 5.1 allows completely unrelated types for get and set accessor properties, provided that they have explicit type annotations.
 module: ESNext
 isCurrent: true
 ---*/


import { Assert } from '../../../suite/assert.js';

class SafeBox {
  private _value: number = 5;

  set value(newValue: string | boolean | null) {
    let myValue = Number(newValue);

    if (!Number.isFinite(myValue)) {
      this._value = 0;
      return;
    }
    this._value = myValue;
  }

  get value(): number {
    return this._value;
  }
}

let safe = new SafeBox();

safe.value = '123';
Assert.equal(safe.value, 123);