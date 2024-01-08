#!/usr/bin/env python
# coding: utf-8
# Copyright (c) 2023 Huawei Device Co., Ltd.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import shutil
import sys
import subprocess


def run_cmd(cmd, execution_path=None):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                           stdin=subprocess.PIPE,
                           stderr=subprocess.PIPE,
                           cwd=execution_path)
    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        print(stdout.decode(), stderr.decode())
        raise Exception(stderr.decode())


def run_pack(execution_path):
    run_cmd(["npm", "pack"], execution_path)


def main(args):
    source_path = args[0]
    run_pack(source_path)


if __name__ == '__main__':
    main(sys.argv[1:])