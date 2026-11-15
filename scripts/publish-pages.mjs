import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Сначала закоммитьте изменения проекта.');
const tree = git('rev-parse', 'HEAD:dist');
const remoteHead = git('ls-remote', 'origin', 'refs/heads/gh-pages');
const parent = [];
if (remoteHead) {
  git('fetch', 'origin', 'gh-pages');
  const remoteSha = remoteHead.split(/\s/)[0];
  if (git('rev-parse', `${remoteSha}^{tree}`) === tree) {
    console.log('Ветка gh-pages уже содержит текущую версию dist/.');
    process.exit(0);
  }
  parent.push('-p', remoteSha);
}
const sha = git('commit-tree', tree, ...parent, '-m', `Publish calculator from ${git('rev-parse', '--short', 'HEAD')}`);
execFileSync('git', ['push', 'origin', `${sha}:refs/heads/gh-pages`], { stdio: 'inherit' });
