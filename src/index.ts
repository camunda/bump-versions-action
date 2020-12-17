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

  const path = getInput("path", { required: false }) || "";
  const ignoredFiles = getInput("ignoredFiles", { required: true }).split(",");
  const oldVersion = getInput("oldVersion", { required: true });
  const newVersion = getInput("newVersion", { required: true });

  try {
    await bumpVersions({
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

  const ignore = ignoredFiles.map((ignoredFile) => `./${repo}/${ignoredFile}`);

  replace.sync({
    files: `./${repo}${path}/**/*`,
    from: new RegExp(`${oldVersion}`, "g"),
    ignore,
    to: newVersion,
  });

  replace.sync({
    files: `./${repo}${path}/**/*`,
    from: new RegExp(`${oldVersion.slice(0, -2)}`, "g"),
    ignore,
    to: newVersion.slice(0, -2),
  });

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
  - Ignored files: ${ignoredFiles.join(", ")}
- ...`,
    head: branchName,
    owner,
    repo,
    title: `Prepare examples for ${newVersion} release`,
  });
};

void run();
