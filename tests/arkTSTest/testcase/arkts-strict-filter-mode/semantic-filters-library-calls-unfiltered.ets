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

import { declarationAcceptsString } from './node_modules/strict_filter_declaration';
import { generatedAcceptsString } from './build/generated_library';
import { previewAcceptsString } from './.preview/preview_library';
import {
  acceptGeneric,
  acceptObject,
  acceptPair,
  acceptRest,
  acceptString,
  acceptStringArray,
  acceptStringOrNumber,
  acceptTuple,
  fourNullishOverload,
  GenericLibraryContainer,
  getUnknown,
  LibraryContainer,
  nullOnlyOverload,
  OptionalLibraryValue,
  threeNullishOverload,
} from './oh_modules/strict_filter_library';
import * as strictFilterLibrary from './oh_modules/strict_filter_library';

// Direct, nested, generic, overload and aliased library-call boundaries.
acceptString(null);
acceptString(undefined);
nullOnlyOverload(null);
acceptObject({ value: null });
new LibraryContainer(undefined);
acceptObject({ value: getUnknown() });
declare const libraryContainer: LibraryContainer;
libraryContainer.accept(null);
libraryContainer['accept'](undefined);
LibraryContainer.acceptStatic(null);
new GenericLibraryContainer<string>(undefined);
acceptGeneric<string>(null);
acceptStringOrNumber(undefined);
acceptStringArray(['text', null]);
acceptTuple([undefined, 0]);
declare const optionalValue: OptionalLibraryValue;
acceptObject(optionalValue);
const acceptStringAlias = acceptString;
acceptStringAlias(null);
strictFilterLibrary.acceptString(undefined);
acceptString?.(null);
threeNullishOverload(undefined);
fourNullishOverload(null);

// Different expression shapes at a library-call boundary.
declare const condition: boolean;
declare const nullableText: string | null;
declare const restValues: (string | null)[];
acceptString(condition ? null : 'text');
acceptString(nullableText && 'text');
acceptPair(null, 0);
acceptRest(...restValues);
acceptPair('text', null);
acceptRest('text', null, undefined);
acceptString((nullableText));
acceptString(null as string | null);
acceptString(condition ? nullableText : 'fallback');

// Library declarations from all supported third-party/generated locations.
declarationAcceptsString(null);
generatedAcceptsString(null);
previewAcceptsString(null);
