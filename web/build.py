s=open('/home/claude/mor/index.src.html').read()
eng=open('/home/claude/mor/engine.js').read().replace("if (typeof module !== 'undefined') module.exports = Mor;","")
gm=open('/home/claude/mor/games.js').read().replace("if (typeof module !== 'undefined') module.exports = Games;","")
fbjs=open('/tmp/fbbuild/fb.js').read()
base=s.replace('/*ENGINE*/',eng+'\n'+gm)
open('/home/claude/mor/index.html','w').write(base.replace('/*FIREBASE*/',''))
open('/home/claude/mor/app.html','w').write(base.replace('/*FIREBASE*/',fbjs))
import re
for i,m in enumerate(re.findall(r'<script>(.*?)</script>',base,re.S)): open(f'/tmp/c{i}.js','w').write(m)
