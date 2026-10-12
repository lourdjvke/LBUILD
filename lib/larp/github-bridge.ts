import JSZip from 'jszip';
import { LarpBuildConfig } from './types';
import { generateGitHubWorkflowYaml } from './github-actions';
import { compileGenuineAndroidApk } from './native-compiler';
import { resolveImageToPngBuffer, resolveMultiDensityIcons } from './image-resolver';

export interface GithubBridgeOptions {
  username: string;
  token: string;
  repoName?: string;
  config: LarpBuildConfig;
  processedFiles: { path: string; content: string; isBinary?: boolean }[];
  waitForCompletion?: boolean;
}

export interface GithubBridgeResult {
  success: boolean;
  apkFilename: string;
  downloadUrl: string;
  githubRunUrl?: string;
  githubRepoUrl?: string;
  githubArtifactId?: number;
  githubArtifactSize?: number;
  logs: string[];
  runId?: number;
  runConclusion?: string;
  apkBase64?: string;
  artifactZipBase64?: string;
  artifactName?: string;
}

export async function runGithubActionsBuild(options: GithubBridgeOptions): Promise<GithubBridgeResult> {
  const { username, token, config, processedFiles } = options;
  const rawRepo = options.repoName || config.repo || config.repoId || config.repoName;
  const repoName = rawRepo?.trim();
  if (!repoName || !/^[A-Za-z0-9_.-]+$/.test(repoName)) {
    throw new Error('A valid GitHub repository name is required (letters, numbers, ., _, and - only)');
  }
  if (!/^[A-Za-z0-9-]+$/.test(username)) {
    throw new Error('A valid GitHub username or organization is required');
  }
  const logs: string[] = [];
  const safeAppName = config.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'larp_app';
  const expectedApkFilename = `${safeAppName}_signed_release.apk`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'LARP-Android-Compiler-Bridge',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  logs.push(`[GitHub Actions Bridge] Authenticated as GitHub user "${username}"`);

  const repoUrl = `https://github.com/${username}/${repoName}`;
  let runUrl: string | undefined;
  let runId: number | undefined;
  let runConclusion: string | undefined;
  let githubArtifactId: number | undefined;
  let defaultBranch = 'main';
  let githubArtifactSize: number | undefined;
  let optionsResult: Partial<Pick<GithubBridgeResult, 'apkFilename' | 'apkBase64' | 'artifactZipBase64' | 'artifactName'>> = {};

  try {
    // 1. Ensure repository exists
    const repoCheckRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`, { headers });
    if (repoCheckRes.status === 404) {
      logs.push(`[GitHub Bridge] Creating repo "${repoName}" for ${username}...`);
      const createRes = await fetch(`https://api.github.com/user/repos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: `Automated Android APK build for ${config.name} via LARP Runtime`,
          private: false,
          auto_init: true,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`GitHub repository lookup/create failed (${createRes.status}): ${await createRes.text()}`);
      }
      const createdRepo = await createRes.json();
      defaultBranch = createdRepo.default_branch || defaultBranch;
      logs.push(`[GitHub Bridge] Repo "${repoName}" created on branch "${defaultBranch}".`);
    } else if (repoCheckRes.ok) {
      const repository = await repoCheckRes.json();
      defaultBranch = repository.default_branch || defaultBranch;
      logs.push(`[GitHub Bridge] Connected to repo: ${repoUrl} (default branch: ${defaultBranch})`);
    } else {
      throw new Error(`GitHub repository lookup failed (${repoCheckRes.status}): ${await repoCheckRes.text()}`);
    }

    // 2. Commit files to trigger GitHub Actions
    const workflowContent = generateGitHubWorkflowYaml(config);
    const filesToCommit: { path: string; content: string }[] = [
      {
        path: '.github/workflows/larp-build.yml',
        content: Buffer.from(workflowContent).toString('base64'),
      },
      {
        path: 'README.md',
        content: Buffer.from(`# ${config.name} (LARP Android Build)\nGenerated: ${new Date().toISOString()}`).toString('base64'),
      },
    ];

    // Commit all project files (HTML, CSS, JS, assets) into public/
    for (const file of processedFiles) {
      const base64Content = (file as any).isBinary
        ? file.content
        : Buffer.from(file.content, 'utf8').toString('base64');
      filesToCommit.push({
        path: `public/${file.path}`,
        content: base64Content,
      });
    }

    // Resolve and commit custom launcher icons under res/mipmap-* and res/drawable
    try {
      const defaultVariant = config.iconVariants.find(v => v.isDefault) || config.iconVariants[0];
      const defaultIconSource = defaultVariant?.imageUrl || defaultVariant?.imageBase64 || (config as any).iconUrl || (config as any).iconBase64;
      const defaultDensityIcons = await resolveMultiDensityIcons(defaultIconSource, {
        backgroundColor: defaultVariant?.backgroundColor || config.themeColor || '#D97757',
        label: config.name,
      });

      for (const [density, buf] of Object.entries(defaultDensityIcons)) {
        const folder = density === 'default' ? 'mipmap' : `mipmap-${density}`;
        filesToCommit.push({
          path: `res/${folder}/ic_launcher.png`,
          content: buf.toString('base64'),
        });
      }
      filesToCommit.push({
        path: 'res/drawable/ic_launcher.png',
        content: defaultDensityIcons['xxxhdpi'].toString('base64'),
      });

      for (const variant of config.iconVariants) {
        const variantSource = variant.imageUrl || variant.imageBase64;
        const variantDensityIcons = await resolveMultiDensityIcons(variantSource, {
          backgroundColor: variant.backgroundColor || config.themeColor,
          label: variant.name || variant.id,
        });
        for (const [density, buf] of Object.entries(variantDensityIcons)) {
          const folder = density === 'default' ? 'mipmap' : `mipmap-${density}`;
          filesToCommit.push({
            path: `res/${folder}/ic_launcher_${variant.id}.png`,
            content: buf.toString('base64'),
          });
        }
        filesToCommit.push({
          path: `res/drawable/ic_launcher_${variant.id}.png`,
          content: variantDensityIcons['xxxhdpi'].toString('base64'),
        });
      }
    } catch (_) {}

    const commitFailures: string[] = [];
    for (const file of filesToCommit) {
      try {
        const existing = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/contents/${file.path}`, { headers });
        let sha: string | undefined;
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        } else if (existing.status !== 404) {
          const body = await existing.text();
          throw new Error(`lookup failed (${existing.status}): ${body.slice(0, 300)}`);
        }

        const putRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/contents/${file.path}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `[LARP API Middleman] Commit ${file.path}`,
            content: file.content,
            sha,
            branch: defaultBranch,
          }),
        });
        if (!putRes.ok) {
          const body = await putRes.text();
          throw new Error(`write failed (${putRes.status}): ${body.slice(0, 300)}`);
        }
        logs.push(`[GitHub Bridge] Synced ${file.path}`);
      } catch (commitErr: any) {
        const failure = `${file.path}: ${commitErr?.message || 'unknown GitHub API error'}`;
        commitFailures.push(failure);
        logs.push(`[GitHub Actions Bridge Error] ${failure}`);
      }
    }

    // Never dispatch a workflow when its YAML or project files were not written.
    // Previously these failures were swallowed, which made the API appear queued
    // even though GitHub had nothing valid to build.
    if (commitFailures.length > 0) {
      throw new Error(`GitHub file write failed for ${commitFailures.length} file(s): ${commitFailures.slice(0, 3).join('; ')}`);
    }

    // 3. Dispatch workflow explicitly
    const dispatchStartedAt = new Date().toISOString();
    logs.push(`[GitHub Bridge] Dispatching workflow via GitHub Actions API...`);
    const dispatchRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/workflows/larp-build.yml/dispatches`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: defaultBranch }),
    });

    if (dispatchRes.status === 204) {
      logs.push(`[GitHub Bridge] Workflow dispatch acknowledged (HTTP 204).`);
    } else {
      const dispatchError = await dispatchRes.text();
      throw new Error(`GitHub workflow dispatch failed (${dispatchRes.status}): ${dispatchError}`);
    }

    // Async mode returns only after identifying this dispatch's run. The status
    // endpoint performs the artifact fetch later, so POST never blocks on CI.
    if (options.waitForCompletion === false) {
      for (let attempt = 1; attempt <= 15; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        const runsRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/runs?workflow_id=larp-build.yml&event=workflow_dispatch&per_page=20`, { headers });
        if (!runsRes.ok) continue;
        const runsData = await runsRes.json();
        const run = runsData.workflow_runs?.find((candidate: any) => candidate.created_at >= dispatchStartedAt && candidate.head_branch === defaultBranch);
        if (run) {
          return {
            success: true,
            apkFilename: expectedApkFilename,
            downloadUrl: '',
            githubRunUrl: run.html_url,
            githubRepoUrl: repoUrl,
            runId: run.id,
            runConclusion: run.conclusion || 'in_progress',
            logs: [...logs, `[GitHub Bridge] Async run identified: ${run.id}`],
          };
        }
      }
      throw new Error('GitHub accepted the workflow dispatch but did not expose its run yet');
    }

    // 4. Poll for the run created by this dispatch and wait for its real artifact.
    logs.push(`[GitHub Bridge] Monitoring GitHub Actions runner progress...`);
    const startTime = Date.now();
    let completed = false;

    // GitHub-hosted Android builds can take several minutes. Never return a placeholder
    // artifact while the run is still queued or building.
    for (let attempt = 1; attempt <= 120; attempt++) {
      await new Promise(r => setTimeout(r, 5000));

      const runsRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/runs?workflow_id=larp-build.yml&event=workflow_dispatch&per_page=20`, { headers });
      if (!runsRes.ok) continue;

      const runsData = await runsRes.json();
      const latestRun = runsData.workflow_runs?.find((run: any) =>
        run.created_at >= dispatchStartedAt && run.head_branch === defaultBranch
      );
      if (!latestRun) continue;

      runId = latestRun.id;
      runUrl = latestRun.html_url;
      const status = latestRun.status;
      const conclusion = latestRun.conclusion;

      logs.push(`[GitHub Actions Runner] Poll #${attempt} (+${Math.round((Date.now() - startTime) / 1000)}s): status=${status}${conclusion ? ` (${conclusion})` : ''}`);

      if (status === 'completed') {
        completed = true;
        runConclusion = conclusion;
        logs.push(`[GitHub Actions Runner] Run #${latestRun.run_number} finished with conclusion: "${conclusion}"`);

        if (conclusion === 'success') {
          // 5. Fetch Artifacts from GitHub Actions
          logs.push(`[GitHub Bridge] Fetching runner artifacts from GitHub API...`);
          const artRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/runs/${runId}/artifacts`, { headers });
          if (artRes.ok) {
            const artData = await artRes.json();
            const releaseArtifact = artData.artifacts?.find((a: any) => a.name.includes('release')) || artData.artifacts?.[0];

            if (releaseArtifact) {
              githubArtifactId = releaseArtifact.id;
              githubArtifactSize = releaseArtifact.size_in_bytes;
              logs.push(`[GitHub Bridge] Found remote artifact: "${releaseArtifact.name}" (ID: ${releaseArtifact.id}, ${releaseArtifact.size_in_bytes} bytes)`);

              // Download artifact zip from GitHub
              logs.push(`[GitHub Bridge Middleman] Downloading artifact zip from GitHub Actions...`);
              const downloadRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/artifacts/${releaseArtifact.id}/zip`, { headers });

              if (downloadRes.ok) {
                const zipBuffer = Buffer.from(await downloadRes.arrayBuffer());
                logs.push(`[GitHub Bridge Middleman] Downloaded ${zipBuffer.length} bytes from GitHub.`);

                const zip = await JSZip.loadAsync(zipBuffer);
                const apkPath = Object.keys(zip.files).find((path) => path.toLowerCase().endsWith('.apk'));
                const apkFile = apkPath ? zip.file(apkPath) : undefined;

                if (apkFile && apkPath) {
                  const apkBytes = await apkFile.async('nodebuffer');
                  const actualApkFilename = apkPath.split('/').pop() || expectedApkFilename;
                  optionsResult = { apkFilename: actualApkFilename, apkBase64: apkBytes.toString('base64'), artifactZipBase64: zipBuffer.toString('base64'), artifactName: releaseArtifact.name };
                  logs.push(`[GitHub Bridge Success] Verified genuine GitHub-built "${actualApkFilename}" (${apkBytes.length} bytes) in memory; no server filesystem write performed.`);
                }

                const keystoreFile = zip.file('larp_release.keystore');
                if (keystoreFile) {
                  const keystoreBytes = await keystoreFile.async('nodebuffer');
                  logs.push(`[GitHub Bridge Success] Verified release keystore (${keystoreBytes.length} bytes) in memory; no server filesystem write performed.`);
                }
              }
            }
          }
        }
        break;
      }
    }

    if (!completed) {
      logs.push(`[GitHub Bridge Notice] Runner still executing in background (${runUrl}). Ready to serve.`);
    }
  } catch (ghErr: any) {
    logs.push(`[GitHub Actions Bridge Error] ${ghErr.message}`);
  }

  const resolvedApkFilename = optionsResult.apkFilename;
  logs.push(resolvedApkFilename
    ? `[LARP API Ready] GitHub Actions artifact verified: ${resolvedApkFilename}`
    : '[LARP API Notice] GitHub Actions did not return a completed APK artifact.');

  return {
    success: Boolean(optionsResult.apkBase64),
    apkFilename: resolvedApkFilename || expectedApkFilename,
    downloadUrl: '',
    githubRunUrl: runUrl || `https://github.com/${username}/${repoName}/actions`,
    githubRepoUrl: repoUrl,
    githubArtifactId,
    githubArtifactSize,
    runConclusion: runConclusion || 'in_progress',
    logs,
    runId,
    apkBase64: optionsResult.apkBase64,
    artifactZipBase64: optionsResult.artifactZipBase64,
    artifactName: optionsResult.artifactName,
  };
}
