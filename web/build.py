parts=['a_core','b_mid','c_rooms','d_screens','e_table','f_hand','g_main']
js='\n'.join(open(f'/home/claude/mor/ui/{p}.js').read() for p in parts)
import json,base64,re as _re
_ff=''.join("@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (f,w,base64.b64encode(open('/home/claude/mor/fonts/'+fn,'rb').read()).decode(),ur) for f,w,fn,ur in json.load(open('/home/claude/mor/fonts/fonts.json')))
_head=_re.sub(r'<link rel="preconnect"[^>]*>\n<link href="https://fonts[^>]*>', '<style>'+_ff+'</style>', open('/home/claude/mor/ui/head.html').read())
open('/home/claude/mor/index.src.html','w').write(_head+'<script>\n{\n'+js+'\n}\n</script>\n</body>\n</html>\n')
s=open('/home/claude/mor/index.src.html').read()
eng=open('/home/claude/mor/engine.js').read().replace("if (typeof module !== 'undefined') module.exports = Mor;","")
gm=open('/home/claude/mor/games.js').read().replace("if (typeof module !== 'undefined') module.exports = Games;","")
fbjs=open('/tmp/fbbuild/fb.js').read()
base=s.replace('/*ENGINE*/',eng+'\n'+gm)
open('/home/claude/mor/index.html','w').write(base.replace('/*FIREBASE*/',''))
open('/home/claude/mor/app.html','w').write(base.replace('/*FIREBASE*/',fbjs))
import re
for i,m in enumerate(re.findall(r'<script>(.*?)</script>',base,re.S)): open(f'/tmp/c{i}.js','w').write(m)
