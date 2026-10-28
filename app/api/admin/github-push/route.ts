import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';

async function runGit(args: string[], cwd: string, gitDir: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', [`--git-dir=${gitDir}`, `--work-tree=${cwd}`, ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

export async function POST(request: NextRequest) {
  const gitDir = '/tmp/panelverse-push.git';
  try {
    const body = await request.json();
    let token = String(body.token || '').trim();
    const repoInput = String(body.repo || 'zraarz656-ui/panelverse-app').trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Please provide your GitHub Personal Access Token.' },
        { status: 400 }
      );
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_') && token.length === 36) {
      token = `ghp_${token}`;
    }

    const repoSlug = repoInput
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!repoSlug.includes('/')) {
      return NextResponse.json(
        { ok: false, error: 'Repository must be in format username/repo (e.g. zraarz656-ui/panelverse-app)' },
        { status: 400 }
      );
    }

    const cwd = process.cwd();

    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    await runGit(['init'], cwd, gitDir);
    await runGit(['config', 'user.name', 'zraarz656-ui'], cwd, gitDir);
    await runGit(['config', 'user.email', 'zraarz656@gmail.com'], cwd, gitDir);
    await runGit(['branch', '-M', 'main'], cwd, gitDir);
    await runGit(['add', '-A'], cwd, gitDir);
    await runGit(['commit', '-m', 'Deploy PanelVerse Webtoon & Manga Reader'], cwd, gitDir);

    const remoteUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${repoSlug}.git`;
    await runGit(['push', '--force', remoteUrl, 'HEAD:refs/heads/main'], cwd, gitDir);

    return NextResponse.json({
      ok: true,
      repo: repoSlug,
      url: `https://github.com/${repoSlug}`,
      message: `Successfully pushed all project files to https://github.com/${repoSlug}`,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : 'Git push failed';
    const safeMsg = rawMsg.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
    return NextResponse.json(
      { ok: false, error: safeMsg },
      { status: 500 }
    );
  } finally {
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }
  }
}
