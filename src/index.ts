/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership. Camunda licenses this file to you under the Apache License,
 * Version 2.0; you may not use this file except in compliance with the License.
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

import { error as logError, getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { EventPayloads } from "@octokit/webhooks";
import { exec } from "@actions/exec";
import { GitHub } from "@actions/github/lib/utils";

const replace = require("replace-in-file");

const run = async () => {
  const token = getInput("github_token", { required: true });

  const sliceVersion = getInput("sliceVersion", { required: false });
  const files = getInput("files", { required: false }).split(",");
  const path = getInput("path", { required: false });
  const ignoredFiles = getInput("ignoredFiles", { required: false }).split(",");
  const oldVersion = getInput("oldVersion", { required: true });
  const newVersion = getInput("newVersion", { required: true });

  try {
    await bumpVersions({
      files,
      sliceVersion,
      path,
      ignoredFiles,
      newVersion,
      oldVersion,
      payload: context.payload as EventPayloads.WebhookPayloadPullRequest,
      token,
    });
  } catch (error) {
    logError(error);
    setFailed(error.message);
  }
};

const bumpVersions = async ({
  files,
  sliceVersion,
  path,
  ignoredFiles,
  newVersion,
  oldVersion,
  payload: {
    repository: {
      name: repo,
      owner: { login: owner },
    },
  },
  token,
}: {
  files: string[];
  sliceVersion: string;
  path: string;
  ignoredFiles: string[];
  newVersion: string;
  oldVersion: string;
  payload: EventPayloads.WebhookPayloadPullRequest;
  token: string;
}) => {
  await exec("git", [
    "clone",
    `https://x-access-token:${token}@github.com/${owner}/${repo}.git`,
  ]);

  await exec("git", [
    "config",
    "--global",
    "user.email",
    "github-actions[bot]@users.noreply.github.com",
  ]);
  await exec("git", ["config", "--global", "user.name", "github-actions[bot]"]);

  const oldVersionEscaped = oldVersion.replace(".", "\\.");

  const filesReplace =
    files.length > 0
      ? files.map((file) => `./${repo}${path}/${file}`)
      : `./${repo}${path}/**/*`;
  replace.sync({
    files: filesReplace,
    from: new RegExp(`${oldVersionEscaped}`, "g"),
    ignore: ignoredFiles,
    to: newVersion,
  });

  const sliceVersionAsNumber = Number(sliceVersion || -2);
  if (sliceVersionAsNumber !== 0) {
    replace.sync({
      files: filesReplace,
      from: new RegExp(
        `${oldVersionEscaped.slice(0, sliceVersionAsNumber)}`,
        "g",
      ),
      ignore: ignoredFiles,
      to: newVersion.slice(0, sliceVersionAsNumber),
    });
  }

  const git = async (...args: string[]) => {
    await exec("git", args, { cwd: repo });
  };

  await git("switch", "master");
  const branchName = `${newVersion}-release`;
  await git("switch", "--create", branchName);

  await git("add", "-A");
  await git("commit", "-m", `chore(release): bumps versions to ${newVersion}`);

  await git("push", "--set-upstream", "origin", branchName);

  const github: InstanceType<typeof GitHub> = getOctokit(token);
  void github.pulls.create({
    base: "master",
    body: `- Bumps versions from ${oldVersion} to ${newVersion}
  - Searched files: ${files.join(", ")}
- ...`,
    head: branchName,
    owner,
    repo,
    title: `Prepare examples for ${newVersion} release`,
  });
};

void run();
