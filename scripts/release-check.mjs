import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const tag=process.env.GITHUB_REF_NAME??process.argv[2];
if(!/^v\d+\.\d+\.\d+$/.test(tag??''))throw new Error('An immutable semver release tag is required');
function git(args){const r=spawnSync('git',args,{encoding:'utf8'});if(r.status)throw new Error(r.stderr);return r.stdout.trim();}
if(git(['cat-file','-t',tag])!=='tag')throw new Error('Release tag must be annotated');
const commit=git(['rev-parse',tag+'^{commit}']);const branches=git(['branch','-r','--contains',commit]);if(!/origin\/(main|master)(\s|$)/.test(branches))throw new Error('Release candidate must be reachable from main/master');
if(JSON.parse(fs.readFileSync('package.json','utf8')).version!==tag.slice(1))throw new Error('Package version must match the release tag');
const records=git(['log','--format=%H%x09%s%x09%an',tag]).split('\n').filter(Boolean);
const groups=new Map();for(const line of records){const [sha,subject,author]=line.split('\t');const key=subject.includes('!:')?'Breaking changes':({feat:'Features',fix:'Fixes',docs:'Documentation',test:'Tests',ci:'CI',refactor:'Refactors'}[subject.split(/[(:]/)[0]]??'Chores');if(!groups.has(key))groups.set(key,[]);groups.get(key).push('- '+subject+' (['+sha.slice(0,7)+'](https://github.com/VoytekMichalek/personal-finance-app/commit/'+sha+')) — '+author);}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/release-notes.md','# '+tag+'\n\n'+[...groups].map(([key,items])=>'## '+key+'\n\n'+items.join('\n')).join('\n\n')+'\n');console.log('Release identity and source validated.');
