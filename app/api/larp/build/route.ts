import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { put } from '@vercel/blob';
import { LarpBuildConfig, IconVariant, SplashConfig } from '@/lib/larp/types';
import { buildLarpApp } from '@/lib/larp/generator';
import { runGithubActionsBuild } from '@/lib/larp/github-bridge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/larp/build
 * Preflight handler for open CORS support.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/larp/build
 * Schema discovery and payload documentation endpoint.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${proto}://${host}`;

  return NextResponse.json(
    {
      name: 'LARP Native Engine Build API',
      version: '2.1.0',
      description: 'Production Android APK & AAB Compilation Engine with Custom Icons & Open CORS Downloads',
      endpoints: {
        build: `${baseUrl}/api/larp/build`,
        download: `${baseUrl}/api/larp/download`,
      },
      supportedIconSources: ['HTTP/HTTPS Image URLs', 'Data URIs (PNG, JPEG, WebP, SVG)', 'Direct Base64'],
      samplePayload: {
        name: 'Roulette',
        appId: 'com.casino.roulette',
        version: '1.0.0',
        versionCode: 1,
        themeColor: '#0F172A',
        fullscreen: false,
        keepAwake: true,
        iconUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=512',
        iconVariants: [
          {
            id: 'default',
            name: 'Classic Red Casino Wheel',
            imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=512',
            isDefault: true,
            backgroundColor: '#991B1B',
          },
          {
            id: 'vip_gold',
            name: 'VIP Gold Elite Wheel',
            imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=512',
            isDefault: false,
            backgroundColor: '#D97706',
          },
        ],
        splashScreen: {
          backgroundColor: '#0F172A',
          imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=512',
          duration: 1500,
          autoHide: true,
        },
        permissions: ['android.permission.INTERNET', 'android.permission.VIBRATE'],
        username: 'optional_github_user',
        accessToken: 'optional_github_pat',
        repo: 'optional_repo_name',
      },
      corsEnabled: true,
    },
    { headers: CORS_HEADERS }
  );
}

/**
 * POST /api/larp/build
 * Main compilation endpoint. Accepts JSON or multipart/form-data.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${proto}://${host}`;

  try {
    const contentType = req.headers.get('content-type') || '';
    let name = 'My Android App';
    let appId = 'com.larp.app';
    let version = '1.0.0';
    let versionCode = 1;
    let themeColor = '#FAF8F5';
    let fullscreen = false;
    let keepAwake = false;
    let iconUrl: string | undefined;
    let iconBase64: string | undefined;
    let iconVariants: IconVariant[] = [];
    let splashScreen: SplashConfig | undefined;
    let permissions: string[] = ['android.permission.INTERNET', 'android.permission.VIBRATE'];
    let files: { path: string; content: string; isBinary?: boolean }[] = [];
    let projectZipBuffer: Buffer | undefined;

    // Optional GitHub CI/CD configuration
    let username: string | undefined;
    let accessToken: string | undefined;
    let repo: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      name = (formData.get('name') as string) || (formData.get('appName') as string) || name;
      appId = (formData.get('appId') as string) || (formData.get('packageId') as string) || appId;
      version = (formData.get('version') as string) || version;
      const parsedVc = parseInt(formData.get('versionCode') as string, 10);
      if (!isNaN(parsedVc)) versionCode = parsedVc;
      themeColor = (formData.get('themeColor') as string) || (formData.get('theme') as string) || themeColor;
      fullscreen = formData.get('fullscreen') === 'true' || formData.get('fullscreen') === '1';
      keepAwake = formData.get('keepAwake') === 'true' || formData.get('keepAwake') === '1';

      iconUrl = (formData.get('iconUrl') as string) || undefined;
      iconBase64 = (formData.get('iconBase64') as string) || undefined;

      const rawIconVariants = formData.get('iconVariants');
      if (typeof rawIconVariants === 'string') {
        try {
          iconVariants = JSON.parse(rawIconVariants);
        } catch (_) {}
      }

      const rawSplash = formData.get('splashScreen');
      if (typeof rawSplash === 'string') {
        try {
          splashScreen = JSON.parse(rawSplash);
        } catch (_) {}
      }

      const rawPerms = formData.get('permissions');
      if (typeof rawPerms === 'string') {
        try {
          permissions = JSON.parse(rawPerms);
        } catch (_) {
          permissions = rawPerms.split(',').map(p => p.trim()).filter(Boolean);
        }
      }

      username = (formData.get('username') as string) || undefined;
      accessToken = (formData.get('accessToken') as string) || (formData.get('token') as string) || undefined;
      repo = (formData.get('repo') as string) || (formData.get('repoName') as string) || undefined;

      // Check uploaded icon file
      const iconFile = formData.get('iconFile') as File | null;
      if (iconFile && iconFile.size > 0) {
        const arrayBuf = await iconFile.arrayBuffer();
        iconBase64 = Buffer.from(arrayBuf).toString('base64');
      }

      // Check uploaded project ZIP file
      const zipFile = formData.get('file') as File | null;
      if (zipFile && zipFile.size > 0) {
        const arrayBuf = await zipFile.arrayBuffer();
        projectZipBuffer = Buffer.from(arrayBuf);
      }
    } else {
      // JSON body
      const body = await req.json();
      name = body.name || body.appName || name;
      appId = body.appId || body.packageId || appId;
      version = body.version || version;
      if (body.versionCode) versionCode = parseInt(body.versionCode, 10) || versionCode;
      themeColor = body.themeColor || body.theme || themeColor;
      fullscreen = !!body.fullscreen;
      keepAwake = !!body.keepAwake;
      iconUrl = body.iconUrl;
      iconBase64 = body.iconBase64;
      if (Array.isArray(body.iconVariants)) iconVariants = body.iconVariants;
      if (body.splashScreen) splashScreen = body.splashScreen;
      if (Array.isArray(body.permissions)) permissions = body.permissions;
      // The documented staticBundle.files payload is the only source of truth for app content.
      // Do not silently reinterpret legacy or malformed shapes as a different bundle.
      if (Array.isArray(body.staticBundle?.files)) files = body.staticBundle.files;

      username = body.username || req.headers.get('x-github-username') || process.env.GITHUB_USERNAME || process.env.GITHUB_USER;
      accessToken = body.accessToken || body.token || req.headers.get('x-github-token') || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || process.env.GH_TOKEN;
      repo = body.repo || body.repoName || req.headers.get('x-github-repo') || process.env.GITHUB_REPO;
    }

    if (!username) username = req.headers.get('x-github-username') || process.env.GITHUB_USERNAME || process.env.GITHUB_USER;
    if (!accessToken) accessToken = req.headers.get('x-github-token') || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || process.env.GH_TOKEN;
    if (!repo) repo = req.headers.get('x-github-repo') || process.env.GITHUB_REPO;

    // GitHub tokens do not contain slash characters; remove accidental slash
    // insertion from copied credentials without logging the credential.
    accessToken = accessToken?.trim().replaceAll('/', '') || undefined;

    // Sanitize package ID
    const sanitizedAppId = appId
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.|\.$/, '');

    // Ensure at least one default icon variant exists
    if (!iconVariants || iconVariants.length === 0) {
      iconVariants = [
        {
          id: 'default',
          name: 'Default Icon',
          imageUrl: iconUrl,
          imageBase64: iconBase64,
          isDefault: true,
          backgroundColor: themeColor,
        },
      ];
    } else {
      // Ensure the default variant inherits any top-level iconUrl / iconBase64
      const defaultIdx = iconVariants.findIndex(v => v.isDefault || v.id === 'default');
      if (defaultIdx >= 0) {
        iconVariants[defaultIdx] = {
          ...iconVariants[defaultIdx],
          imageUrl: iconVariants[defaultIdx].imageUrl || iconUrl,
          imageBase64: iconVariants[defaultIdx].imageBase64 || iconBase64,
          isDefault: true,
        };
      } else {
        iconVariants.unshift({
          id: 'default',
          name: 'Default Icon',
          imageUrl: iconUrl,
          imageBase64: iconBase64,
          isDefault: true,
          backgroundColor: themeColor,
        });
      }
    }

    // Resolved splash screen
    const resolvedSplash: SplashConfig = {
      type: splashScreen?.type || (splashScreen?.imageUrl || splashScreen?.imageBase64 || iconUrl || iconVariants[0]?.imageUrl ? 'custom_icon' : 'flat_color'),
      backgroundColor: splashScreen?.backgroundColor || themeColor,
      duration: splashScreen?.duration || 1500,
      autoHide: splashScreen?.autoHide ?? true,
      fadeInDuration: splashScreen?.fadeInDuration || 200,
      fadeOutDuration: splashScreen?.fadeOutDuration || 300,
      imageUrl: splashScreen?.imageUrl || iconUrl || iconVariants[0]?.imageUrl,
      imageBase64: splashScreen?.imageBase64 || iconBase64 || iconVariants[0]?.imageBase64,
    };

    // Normalize the submitted web bundle once so both local compilation and GitHub CI
    // receive the same files. In particular, CI must not fall back to a generic page
    // when the caller submitted the app as a ZIP archive.
    if (projectZipBuffer) {
      try {
        const zip = await JSZip.loadAsync(projectZipBuffer);
        const extractedFiles: { path: string; content: string; isBinary?: boolean }[] = [];
        for (const [relPath, fileObj] of Object.entries(zip.files)) {
          if (fileObj.dir || relPath.includes('__MACOSX') || relPath.endsWith('.DS_Store')) continue;
          const isText = /\.(html|htm|js|mjs|css|json|svg|txt|xml|md)$/i.test(relPath);
          const content = isText
            ? await fileObj.async('string')
            : (await fileObj.async('nodebuffer') as unknown as Buffer).toString('base64');
          extractedFiles.push({
            path: relPath,
            content,
            ...(isText ? {} : { isBinary: true }),
          });
        }
        files = [...files, ...extractedFiles];
        projectZipBuffer = undefined;
      } catch (zipErr: any) {
        throw new Error(`Invalid project ZIP: ${zipErr.message}`);
      }
    }

    if (files.length === 0) {
      throw new Error('No file or files to bundle. Submit staticBundle.files or a non-empty project ZIP.');
    }

    const submittedFiles = files;

    // Build configuration
    const config: LarpBuildConfig = {
      name,
      appId: sanitizedAppId || 'com.larp.app',
      version,
      versionCode: versionCode || 1,
      themeColor,
      watchThemeColor: true,
      fullscreen,
      keepAwake,
      signing: {
        generateKeystore: true,
        alias: 'larp_release',
        password: 'larp_keystore_password_2026',
        commonName: `${name} Publisher`,
        organization: 'LARP Mobile Engineering',
        validityYears: 25,
      },
      iconVariants,
      splashScreen: resolvedSplash,
      plugins: {
        statusBar: true,
        splashScreen: true,
        haptics: true,
        device: true,
        share: true,
        preferences: true,
        dynamicIcons: true,
        screenOrientation: true,
      },
      staticBundle: {
        entrypoint: 'index.html',
        files: submittedFiles,
      },
      zipBase64: undefined,
      permissions: Array.from(new Set([...permissions, 'android.permission.INTERNET', 'android.permission.VIBRATE'])),
    };

    // 1. GITHUB DELEGATION IS THE DEFAULT BUILD PIPELINE (Optimized for Vercel & Serverless)
    let githubResult: any = null;
    const hasGithubInput = Boolean(username || accessToken || repo);
    if (hasGithubInput && (!username || !accessToken || !repo)) {
      throw new Error('GitHub build requires username, accessToken, and repo. Send them in the JSON body or x-github-* headers.');
    }

    if (username && accessToken && repo) {
      const repoName = repo;
      try {
        console.log(`[LARP Build API] Writing GitHub workflow before dispatch (${username}/${repoName})...`);
        githubResult = await runGithubActionsBuild({
          username,
          token: accessToken,
          repoName,
          config,
          processedFiles: submittedFiles,
          waitForCompletion: false,
        });

        const queuedBuildId = Buffer.from(JSON.stringify({ username, repo: repoName, runId: githubResult.runId })).toString('base64url');
        return NextResponse.json({
          success: true,
          status: 'queued',
          buildId: queuedBuildId,
          name: config.name,
          github: { runId: githubResult.runId, runUrl: githubResult.githubRunUrl, repoUrl: githubResult.githubRepoUrl },
          statusUrl: `${baseUrl}/api/larp/status?id=${encodeURIComponent(queuedBuildId)}`,
        }, { status: 202, headers: CORS_HEADERS });
      } catch (ghErr: any) {
        console.error('[LARP Build API GitHub Error]', ghErr);
        return NextResponse.json({
          success: false,
          stage: 'github_write_or_dispatch',
          error: 'GitHub workflow setup failed before the build could start.',
          details: ghErr?.message || 'Unknown GitHub API error',
          hint: 'Verify the token can write repository contents and dispatch GitHub Actions, and that username/repo identify the target repository.',
        }, { status: 502, headers: CORS_HEADERS });
      }
    }

    // 2. Assemble complete release artifacts, project ZIP, and keystore
    const buildResult = await buildLarpApp(config);

    // Direct Binary Stream Mode (Ideal for Vercel/Serverless blob downloads)
    const format = req.nextUrl.searchParams.get('format') || '';
    const acceptHeader = req.headers.get('accept') || '';
    const wantsDirectBinary = format === 'zip' || format === 'blob' || format === 'binary' || acceptHeader === 'application/zip';

    if (wantsDirectBinary && buildResult.zipBase64) {
      const binaryZipBuffer = Buffer.from(buildResult.zipBase64, 'base64');
      const zipArtifact = buildResult.artifacts.find(a => a.id === 'release_zip');
      const safeFilename = zipArtifact?.filename || `${buildResult.buildId}_release_bundle.zip`;
      return new NextResponse(binaryZipBuffer, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Content-Length': binaryZipBuffer.length.toString(),
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // Persist only the actual generated binaries in public Blob storage. The key includes
    // buildId, so two apps with the same name can never receive the same download URL.
    const zipArtifact = buildResult.artifacts.find(a => a.id === 'release_zip');
    const apkArtifact = buildResult.artifacts.find(a => a.id === 'apk');
    const githubApkBase64 = githubResult?.apkBase64;
    const githubArtifactZipBase64 = githubResult?.artifactZipBase64;
    // Never fall back to serverless compiler output: it is not a real Android binary.
    // A successful response is allowed only after GitHub Actions returned both artifacts.
    const zipBase64 = githubArtifactZipBase64;
    const apkBase64 = githubApkBase64;
    const apkFilename = githubResult?.apkFilename;
    if (!githubResult?.success || !zipBase64 || !apkBase64 || !zipArtifact || !apkArtifact || !apkFilename) {
      throw new Error('GitHub Actions did not return verified APK and release artifacts; no download was created');
    }

    const blobPrefix = `larp/${buildResult.buildId}`;
    const [zipBlob, apkBlob] = await Promise.all([
      put(`${blobPrefix}/${zipArtifact.filename}`, Buffer.from(zipBase64, 'base64'), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/zip',
      }),
      put(`${blobPrefix}/${apkFilename}`, Buffer.from(apkBase64, 'base64'), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/vnd.android.package-archive',
      }),
    ]);

    const downloadZipUrl = zipBlob.url;
    const downloadApkUrl = apkBlob.url;
    const directZipUrl = zipBlob.url;
    const directApkUrl = apkBlob.url;
    const directAabUrl = undefined;
    const downloadAabUrl = undefined;
    const directKeystoreUrl = undefined;
    const downloadKeystoreUrl = undefined;
    const dataUri = undefined;

    return NextResponse.json(
      {
        success: true,
        buildId: buildResult.buildId,
        name: config.name,
        appId: config.appId,
        version: config.version,
        versionCode: config.versionCode,
        themeColor: config.themeColor,
        fullscreen: config.fullscreen,
        keepAwake: config.keepAwake,
        downloadUrl: downloadZipUrl,
        zipBundleUrl: directZipUrl,
        apkUrl: downloadApkUrl,
        directApkUrl,
        aabUrl: downloadAabUrl,
        directAabUrl,
        keystoreUrl: downloadKeystoreUrl,
        directKeystoreUrl,
        // Direct in-memory base64 & data URI (bypasses server disk completely for Vercel & serverless)
        zipBase64,
        apkBase64,
        dataUri,
        artifacts: buildResult.artifacts.map(a => ({
          ...a,
          fullDownloadUrl:
            a.id === 'release_zip' ? zipBlob.url : a.id === 'apk' ? apkBlob.url : undefined,
        })),
        iconVariants: config.iconVariants.map(v => ({
          id: v.id,
          name: v.name,
          isDefault: v.isDefault,
          hasCustomUrl: !!v.imageUrl,
          hasCustomBase64: !!v.imageBase64,
        })),
        splashScreen: {
          backgroundColor: config.splashScreen.backgroundColor,
          duration: config.splashScreen.duration,
          autoHide: config.splashScreen.autoHide,
          hasCustomImage: !!(config.splashScreen.imageUrl || config.splashScreen.imageBase64),
        },
        github: githubResult
          ? {
              repoUrl: githubResult.repoUrl,
              runUrl: githubResult.githubRunUrl,
              artifactId: githubResult.githubArtifactId,
              artifactName: githubResult.artifactName,
              source: 'github-actions-artifact',
              downloadUrl: apkBlob.url,
              zipDownloadUrl: zipBlob.url,
            }
          : null,
        downloadGuide: {
          summary: 'The generated APK and release ZIP are uploaded to unique public Vercel Blob URLs.',
          zipDownloadEndpoint: downloadZipUrl,
          apkDownloadEndpoint: downloadApkUrl,
          directBinaryEndpoint: `${baseUrl}/api/larp/build?format=zip`,
          corsSupport: 'Open (Access-Control-Allow-Origin: *)',
          howToGenerateDirectBlobUrl: [
            '1. Read zipDownloadEndpoint or apkDownloadEndpoint from the response.',
            '2. Download the returned public Blob URL directly.',
            '3. Each URL is scoped to the unique buildId and contains the actual generated filename.',
          ],
        },
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    console.error('[LARP Build API Error]', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Build compilation failed',
        details: err.stack,
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
