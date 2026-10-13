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

@Builder
function builderBare() {
  Column() {
    Text("bare")
  }
}

@Builder({ isPlaceholder: true })
function builderCallForm() {
  Column() {
    Text("callform")
  }
}

@Builder()
function builderEmptyCall() {
  Column() {
    Text("emptycall")
  }
}

@Component
struct BuilderCallFormExample {
  @Builder
  builderMethodBare() {
    Column() {
      Text("innerBare")
    }
  }

  @Builder({ isPlaceholder: true })
  builderMethodCallForm() {
    Row() {
      Text("innerCallForm")
    }
  }

  @LocalBuilder({ isPlaceholder: true })
  localBuilderCallForm() {
    Column() {
      Text("innerLocal")
    }
  }

  build() {
    Column() {
      Text("page")
    }
  }
}
