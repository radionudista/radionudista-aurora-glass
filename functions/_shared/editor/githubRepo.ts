import type { RepoFileWrite } from './types';

export interface GithubRepoConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

const githubHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'radionudista-editor',
  'X-GitHub-Api-Version': '2022-11-28',
});

export const parseGithubRepo = (raw: string): { owner: string; repo: string } => {
  const trimmed = raw.trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0) throw new Error('EDITOR_GITHUB_REPO debe ser owner/repo');
  return { owner: trimmed.slice(0, slash), repo: trimmed.slice(slash + 1) };
};

export const readGithubTextFile = async (
  config: GithubRepoConfig,
  filePath: string
): Promise<string | null> => {
  const { token, owner, repo, branch } = config;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer ${filePath} desde GitHub.`);
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content) return null;
  const normalized = data.content.replace(/\n/g, '');
  if (typeof atob === 'function') {
    return decodeURIComponent(
      Array.from(atob(normalized), (c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')
    );
  }
  return Buffer.from(normalized, 'base64').toString('utf8');
};

export const commitRepoFiles = async (
  config: GithubRepoConfig,
  files: RepoFileWrite[],
  deletions: string[],
  message: string
): Promise<string> => {
  const { token, owner, repo, branch } = config;
  if (files.length === 0 && deletions.length === 0) {
    throw new Error('No hay cambios para commitear.');
  }

  const headers = githubHeaders(token);

  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!refRes.ok) {
    throw new Error(`Rama "${branch}" no encontrada.`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const parentSha = refData.object.sha;

  const parentCommitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentSha}`,
    { headers }
  );
  if (!parentCommitRes.ok) throw new Error('No se pudo leer el commit base.');
  const parentCommit = (await parentCommitRes.json()) as { tree: { sha: string } };

  const treeItems: Array<
    | { path: string; mode: '100644'; type: 'blob'; sha: string }
    | { path: string; mode: '100644'; type: 'blob'; sha: null }
  > = [];

  for (const file of files) {
    const blobBody =
      file.encoding === 'base64'
        ? { content: file.content, encoding: 'base64' as const }
        : { content: file.content, encoding: 'utf-8' as const };

    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(blobBody),
    });
    if (!blobRes.ok) throw new Error(`Error creando blob para ${file.path}`);
    const blob = (await blobRes.json()) as { sha: string };
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  for (const pathToDelete of deletions) {
    treeItems.push({ path: pathToDelete, mode: '100644', type: 'blob', sha: null });
  }

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error('Error creando árbol de Git.');
  const tree = (await treeRes.json()) as { sha: string };

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });
  if (!commitRes.ok) throw new Error('Error creando commit.');
  const commit = (await commitRes.json()) as { sha: string };

  const updateRefRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha }),
    }
  );
  if (!updateRefRes.ok) throw new Error('Error actualizando la rama.');

  return commit.sha;
};
