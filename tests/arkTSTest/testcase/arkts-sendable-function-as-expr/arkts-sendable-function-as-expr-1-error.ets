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

@Sendable 
function sendableFunction(): void {} 
function noneSendableFunction(): void {}

@Sendable 
type SendableType = () => void; 
type NoneSendableType = () => void;

const a1: NoneSendableType = sendableFunction;
const a2: NoneSendableType = noneSendableFunction;
const a4: SendableType = noneSendableFunction as SendableType; // ERROR
const a5: SendableType = a1 as SendableType; // ERROR
const a6: SendableType = a2 as SendableType; // ERROR