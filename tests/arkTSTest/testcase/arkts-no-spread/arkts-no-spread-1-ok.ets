/*
* Copyright (c) 2023 Huawei Device Co., Ltd.
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


// Description: Expands an array using the expansion operator

class Point2D {
  x: number = 0; y: number = 0
}

class Point3D {
  x: number = 0; y: number = 0; z: number = 0
  constructor(p2d: Point2D, z: number) {
    this.x = p2d.x
    this.y = p2d.y
    this.z = z
  }
}

let p3d = new Point3D({ x: 1, y: 2 } as Point2D, 3)
console.log(p3d.x, p3d.y, p3d.z)

class DerivedFromArray extends Uint16Array { };

let arr1 = [1, 2, 3]
let arr2 = new Uint16Array([4, 5, 6])
let arr3 = new DerivedFromArray([7, 8, 9])
let arr4 = [...arr1, 10, ...arr2, 11, ...arr3]