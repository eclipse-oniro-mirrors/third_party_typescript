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
    Method Decorator：Class getter decorators
 module: ES2022
 isCurrent: true
 ---*/


import { Assert } from '../../../suite/assert.js'

function lazy(value: Function, context: { kind: string, name: string }) {
  if (context.kind === 'getter') {
    return function (this: object) {
      const result = value.call(this);
      Object.defineProperty(
        this, context.name,
        {
          value: result,
          writable: false
        }
      );
      return 'This is result.';
    };
  }
}

class C {
  @lazy
  get value() {
    return 'Result of computation';
  }
}

const inst = new C();
Assert.equal(inst.value, 'This is result.');